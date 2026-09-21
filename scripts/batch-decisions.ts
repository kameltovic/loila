// "En clair" summaries of decisions: what the dispute was, what the Court decided, what to remember.
// npx tsx scripts/batch-decisions.ts [--limit N] [--all] [--model x/y] [--dry-run]
// Default scope: decisions applying an article that has its page indexed (cited by a FAQ), most recent first;
// --all: every decision. Already-summarized decisions are skipped. Then ship: export-content.ts <bundle> --decisions
import type { Decision } from "../src/lib/decisions";

try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

const SYSTEM = `Tu es Loilà, un site qui explique le droit français à des non-juristes.
On te donne UNE décision de la Cour de cassation (sommaire officiel et extraits). Explique-la en français simple, au vouvoiement.
Règles :
- Uniquement ce que dit CETTE décision. N'invente aucun fait, aucune règle, aucun chiffre.
- Recopie les chiffres, montants et délais exactement sous la forme du texte (en lettres s'ils y sont en lettres).
- Pas de noms de personnes (les parties sont anonymisées : dites "le salarié", "l'employeur", "le bailleur"…).
- Dites clairement qui a gagné devant la Cour de cassation et ce que cela change en pratique.
- Explique les mots juridiques difficiles entre parenthèses la première fois (ex. : cassation, pourvoi).
- Commence directement par l'affaire : pas de "Cette décision…", "Dans cet arrêt…".
Réponds en JSON strict : {"summary": "3 à 4 phrases : la situation, la question posée, la réponse de la Cour", "points": ["2 à 4 points à retenir, courts et pratiques"]}`;

/** Facts + the Court's answer and ruling, capped: enough to summarize, a third of the tokens of the full text. */
export function excerpt(texte: string, max = 9000) {
  const facts = texte.match(/Faits et procédure([\s\S]{0,2500})/i)?.[1] ?? texte.slice(0, 2000);
  const from = texte.search(/Réponse de la Cour|Vu l[’']article|PAR CES MOTIFS/i);
  const answer = from >= 0 ? texte.slice(from) : texte.slice(-6000);
  return `${facts.trim()}\n[…]\n${answer.trim()}`.slice(0, max);
}

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { chat } = await import("../src/lib/openrouter");
  const { citation, formationLabel } = await import("../src/lib/decisions");

  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const limit = opt("limit") ? Number(opt("limit")) : Infinity;
  const model = opt("model") ?? process.env.OPENROUTER_BATCH_MODEL;
  const db = getDb();

  const scope = argv.includes("--all")
    ? "SELECT d.* FROM decisions d"
    : `SELECT d.* FROM decisions d WHERE d.id IN (SELECT da.decision_id FROM decision_articles da
         WHERE da.article_id IN (SELECT DISTINCT j.value FROM faq, json_each(faq.article_ids) j))`;
  const todo = (db.prepare(`${scope} AND d.id NOT IN (SELECT decision_id FROM decision_summaries) ORDER BY d.date DESC`.replace(/^(SELECT d\.\* FROM decisions d) AND/, "$1 WHERE")).all() as Decision[]).slice(0, limit);
  console.log(`${todo.length} decisions to summarize (${model})`);
  if (argv.includes("--dry-run")) return;

  // Same guards as the article summaries: numbers must come from the decision, no "[ADDRESS]"-style placeholders.
  const nums = (s: string) => [...s.replace(/(\d)[\s  .](?=\d{3}\b)/g, "$1").matchAll(/\d+(?:,\d+)?/g)].map((m) => m[0]);
  const save = db.prepare(
    `INSERT INTO decision_summaries (decision_id, summary, points, model) VALUES (?, ?, ?, ?)
     ON CONFLICT(decision_id) DO UPDATE SET summary = excluded.summary, points = excluded.points, model = excluded.model, created_at = unixepoch()`,
  );
  const articlesOf = db.prepare("SELECT a.num, a.code FROM decision_articles da JOIN articles a ON a.id = da.article_id WHERE da.decision_id = ?");

  let cost = 0, ok = 0;
  const failed: string[] = [];
  async function one(d: Decision) {
    const arts = (articlesOf.all(d.id) as { num: string; code: string }[]).map((a) => `${a.num} (${a.code})`).join(", ");
    const user = `${citation(d)} · ${formationLabel(d.formation)} · ${d.solution ?? ""}
Articles appliqués : ${arts}
${d.sommaire ? `Sommaire officiel :\n${d.sommaire}\n` : ""}
Extraits de la décision :
${excerpt(d.texte)}`;
    const res = await chat([{ role: "system", content: SYSTEM }, { role: "user", content: user }], { model, maxTokens: 1500, json: true, timeoutMs: 180_000, budget: false, extra: { usage: { include: true } } });
    const u = res.usage as { cost?: number; cost_details?: { upstream_inference_cost?: number } } | undefined;
    cost += u?.cost || u?.cost_details?.upstream_inference_cost || 0;
    const json = JSON.parse(res.content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const points = Array.isArray(json?.points) ? json.points.filter((p: unknown): p is string => typeof p === "string" && !!p.trim()) : [];
    if (typeof json?.summary !== "string" || json.summary.trim().length < 60) throw new Error("bad shape: summary");
    const all = [json.summary, ...points].join(" ");
    const allowed = new Set(nums(`${d.texte} ${d.sommaire ?? ""} ${arts} ${d.date} ${d.numero ?? ""}`));
    if (!nums(all).every((n) => allowed.has(n))) throw new Error("number not in the decision");
    if (/\[[A-Z_]{3,}\]/.test(all)) throw new Error("placeholder in output");
    save.run(d.id, json.summary.trim(), JSON.stringify(points.slice(0, 4)), res.model);
  }

  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const d = todo[next++];
      try {
        await one(d).catch(() => one(d)); // retry once
        ok++;
        if (ok % 50 === 0) console.log(`… ${ok}/${todo.length}  $${cost.toFixed(2)}`);
      } catch (e) {
        failed.push(d.id);
        console.error(`✗ ${d.id}: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`\nDone: ${ok}  Failed: ${failed.length}  Cost: $${cost.toFixed(2)}${ok ? ` (~$${(cost / ok).toFixed(4)} per decision)` : ""}`);
}

if (process.argv[1]?.endsWith("batch-decisions.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
