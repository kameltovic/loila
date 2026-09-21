// "En clair" summaries for indexed article pages (cited by a FAQ answer or a letter), most-cited first.
// npx tsx scripts/batch-articles.ts [--limit N] [--force] [--id LEGIARTI…] [--dry-run]
// Skips articles whose summary matches the current text (texte_sha); a re-ingested text is summarized again.
// Then ship: npx tsx scripts/export-content.ts <bundle> --summaries
import type { Article } from "../src/lib/db";

try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

const SYSTEM = `Tu es Loilà, un site qui explique le droit français à des non-juristes.
On te donne UN article de loi. Résume-le en français simple, au vouvoiement, pour quelqu'un qui n'est pas juriste.
Règles :
- Uniquement ce que dit CET article. N'ajoute aucune règle, aucune exception, aucun chiffre, aucun délai qui n'y figure pas.
- Recopie les chiffres, montants, délais et pourcentages exactement sous la forme du texte : en lettres s'ils y sont en lettres ("soixante-cinq ans"), en chiffres s'ils y sont en chiffres.
- Si l'article renvoie à un autre article, un décret ou une convention, dis-le ("les modalités sont fixées par décret") sans inventer leur contenu.
- Pas de conseil personnalisé, pas de verdict ("vous avez droit à…" seulement si le texte le dit tel quel).
- Explique les mots juridiques difficiles entre parenthèses la première fois.
- Commence directement par la règle : pas de "Cet article dispose que", "Cet article encadre…".
Réponds en JSON strict : {"summary": "2 à 4 phrases : ce que l'article prévoit et pour qui", "points": ["2 à 5 points clés courts : conditions, délais, exceptions, sanctions"]}`;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { chat } = await import("../src/lib/openrouter");
  const { texteSha } = await import("../src/lib/articles");
  const { getLettres } = await import("../src/lib/lettres");
  const { refArticles } = await import("../src/lib/metiers");
  const { CODES } = await import("../src/lib/themes");

  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const limit = opt("limit") ? Number(opt("limit")) : Infinity;
  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");
  const model = process.env.OPENROUTER_BATCH_MODEL;
  const db = getDb();

  // Indexed pages: cited by FAQ answers (most-cited first), then by letters.
  const cited = db
    .prepare("SELECT j.value AS id, COUNT(*) AS n FROM faq, json_each(faq.article_ids) j GROUP BY j.value ORDER BY n DESC, j.value")
    .all() as { id: string; n: number }[];
  const ids = [...new Set([...cited.map((c) => c.id), ...refArticles(getLettres().flatMap((l) => l.tips.flatMap((t) => t.refs))).map((a) => a.id)])];
  const done = new Map((db.prepare("SELECT article_id, texte_sha FROM article_summaries").all() as { article_id: string; texte_sha: string }[]).map((r) => [r.article_id, r.texte_sha]));
  const load = db.prepare("SELECT * FROM articles WHERE id = ?");
  const questionsFor = db.prepare("SELECT question FROM faq WHERE EXISTS (SELECT 1 FROM json_each(faq.article_ids) WHERE value = ?) LIMIT 5");

  const todo = (opt("id") ? [opt("id")!] : ids)
    .map((id) => load.get(id) as Article | undefined)
    .filter((a): a is Article => !!a && a.texte.trim().length > 0)
    .filter((a) => force || !!opt("id") || done.get(a.id) !== texteSha(a.texte))
    .slice(0, limit);
  console.log(`${ids.length} indexed articles, ${todo.length} to summarize (${model})`);
  if (dryRun) return;

  // Hallucination guard: every number in the summary must appear in the official text (or the article number).
  // "12 000" and "12000" are the same number: thousands separators are removed on both sides.
  const nums = (s: string) => [...s.replace(/(\d)[\s\u00a0\u202f.](?=\d{3}\b)/g, "$1").matchAll(/\d+(?:,\d+)?/g)].map((m) => m[0]);
  const numbersOk = (a: Article, out: string) => {
    const allowed = new Set(nums(`${a.texte} ${a.num}`));
    return nums(out).every((n) => allowed.has(n));
  };

  let cost = 0;
  let ok = 0;
  const failed: string[] = [];
  const save = db.prepare(
    `INSERT INTO article_summaries (article_id, texte_sha, summary, points, model) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(article_id) DO UPDATE SET texte_sha = excluded.texte_sha, summary = excluded.summary, points = excluded.points, model = excluded.model, created_at = unixepoch()`,
  );

  async function one(a: Article) {
    const qs = (questionsFor.all(a.id) as { question: string }[]).map((q) => `- ${q.question}`).join("\n");
    const user = `Article ${a.num}, ${CODES[a.code as keyof typeof CODES]?.name ?? a.code}${a.section ? `\nSection : ${a.section}` : ""}
Texte officiel :
${a.texte.slice(0, 15_000)}${qs ? `\n\nQuestions de nos lecteurs pour lesquelles cet article sert (contexte seulement, n'y réponds pas) :\n${qs}` : ""}`;
    const res = await chat([{ role: "system", content: SYSTEM }, { role: "user", content: user }], { model, maxTokens: 2000, json: true, timeoutMs: 180_000, budget: false, extra: { usage: { include: true } } });
    // BYOK keys report cost 0; the provider's price is in cost_details.
    const u = res.usage as { cost?: number; cost_details?: { upstream_inference_cost?: number } } | undefined;
    cost += u?.cost || u?.cost_details?.upstream_inference_cost || 0;
    const json = JSON.parse(res.content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const points = Array.isArray(json?.points) ? json.points.filter((p: unknown): p is string => typeof p === "string" && !!p.trim()) : [];
    if (typeof json?.summary !== "string" || json.summary.trim().length < 40) throw new Error("bad shape: summary");
    const all = [json.summary, ...points].join(" ");
    if (!numbersOk(a, all)) throw new Error("number not in the official text");
    if (/\[[A-Z_]{3,}\]/.test(all)) throw new Error("placeholder in output"); // seen once: "[ADDRESS]"
    save.run(a.id, texteSha(a.texte), json.summary.trim(), JSON.stringify(points.slice(0, 5)), res.model);
  }

  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const a = todo[next++];
      try {
        await one(a).catch(() => one(a)); // retry once
        ok++;
        if (ok % 50 === 0) console.log(`… ${ok}/${todo.length}  $${cost.toFixed(2)}`);
      } catch (e) {
        failed.push(a.id);
        console.error(`✗ ${a.num} (${a.id}): ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`\nDone: ${ok}  Failed: ${failed.length}  Cost: $${cost.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
