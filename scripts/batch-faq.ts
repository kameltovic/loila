// Pre-generates FAQ answers for seed/questions.json.
// npx tsx scripts/batch-faq.ts [--theme travail] [--limit N] [--force] [--dry-run]
// Topic questions (seed/topics.json -> faq rows with topic): npx tsx scripts/batch-faq.ts --topics [--topic <slug>] [--limit N] [--force] [--dry-run]
import fs from "node:fs";
import path from "node:path";

import type { Article } from "../src/lib/db";

try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

async function main() {
  // Dynamic imports so DATABASE_PATH from .env is set before db.ts reads it.
  const { getDb } = await import("../src/lib/db");
  const { THEMES } = await import("../src/lib/themes");
  const { searchArticles, getArticleByNum } = await import("../src/lib/search");
  const { chat } = await import("../src/lib/openrouter");

  const { getTopics } = await import("../src/lib/topics");

  // codes: explicit retrieval scope (topics); hints may be "code-slug:num" for an exact article.
  type Seed = { theme: string; slug: string; emoji: string | null; question: string; hints: string[]; topic?: string; codes?: string[] };

  const argv = process.argv.slice(2);
  const flag = (name: string) => argv.includes(`--${name}`);
  const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const themeFilter = opt("theme");
  const topicsMode = flag("topics") || !!opt("topic");
  const topicFilter = opt("topic");
  const limit = opt("limit") ? Number(opt("limit")) : Infinity;
  const force = flag("force");
  const dryRun = flag("dry-run");

  const ARTICLE_NUM = /^[LRDA]?\d+(-\d+)*$/;

  const SYSTEM = `Tu es Loilà, un site qui explique le droit français à des non-juristes (salariés, locataires, propriétaires).
  Règles :
  - Réponds en français simple, phrases courtes, tutoiement interdit (vouvoiement), pas de jargon non expliqué.
  - Utilise UNIQUEMENT les articles fournis. N'invente aucune règle, aucun chiffre, aucun numéro d'article.
  - Cite l'article après chaque règle sous la forme (art. X).
  - Si les articles fournis ne suffisent pas, ou si la réponse dépend d'une convention collective, du PLU ou d'un décret non fourni, dis-le clairement.
  - Quand c'est utile, conseille un professionnel (avocat, inspection du travail, ADIL, service urbanisme de la mairie).
  Réponds en JSON strict : {"short": "1 à 2 phrases, la réponse en bref", "answer_md": "réponse complète en markdown (titres ###, listes)", "cited_nums": ["numéros des articles effectivement cités"]}`;

  async function retrieve(s: Seed): Promise<Article[]> {
    const codes = s.codes ?? [...(THEMES.find((t) => t.slug === s.theme)?.codes ?? [])];
    const qualified = (h: string) => /^[a-z0-9-]+:/.test(h) && ARTICLE_NUM.test(h.split(":")[1]);
    const exact = s.hints
      .flatMap((h) => qualified(h) ? [getArticleByNum(h.split(":")[0], h.split(":")[1])]
        : ARTICLE_NUM.test(h) ? codes.map((code) => getArticleByNum(code, h)) : [])
      .filter((a): a is Article => !!a);
    const words = s.hints.filter((h) => !ARTICLE_NUM.test(h) && !qualified(h)).join(" ");
    const found = await searchArticles(`${s.question} ${words}`, { codes, limit: 8 });
    const byId = new Map<string, Article>();
    for (const a of [...exact, ...found]) byId.set(a.id, a);
    return [...byId.values()];
  }

  function parseAnswer(text: string) {
    const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (typeof json?.short !== "string" || !json.short.trim()) throw new Error("bad shape: short");
    if (typeof json?.answer_md !== "string" || !json.answer_md.trim()) throw new Error("bad shape: answer_md");
    if (!Array.isArray(json?.cited_nums)) throw new Error("bad shape: cited_nums");
    return json as { short: string; answer_md: string; cited_nums: unknown[] };
  }

  const norm = (n: string) => n.replace(/^art(icle)?\.?\s*/i, "").trim();

  let approxTokens = 0;

  async function processOne(s: Seed) {
    const articles = await retrieve(s);
    if (dryRun) {
      console.log(`\n# [${s.topic ?? s.theme}] ${s.slug} — ${articles.length} article(s)\n  Q: ${s.question}`);
      for (const a of articles) console.log(`  ${a.code} ${a.num}  ${a.texte.slice(0, 90).replace(/\s+/g, " ")}…`);
      return;
    }
    if (!articles.length) throw new Error("no articles retrieved");

    const context = articles
      .map((a) => `--- Article ${a.num} (${a.code})${a.section ? ` — ${a.section}` : ""}\n${a.texte}`)
      .join("\n\n");
    const messages = [
      { role: "system" as const, content: SYSTEM },
      { role: "user" as const, content: `Articles :\n\n${context}\n\nQuestion : ${s.question}` },
    ];
    const { content } = await chat(messages, { model: process.env.OPENROUTER_BATCH_MODEL, maxTokens: 2000, json: true, timeoutMs: 120_000 });
    // ponytail: chat() doesn't expose OpenRouter usage, so ~4 chars/token estimate.
    approxTokens += Math.round((messages.reduce((n, m) => n + m.content.length, 0) + content.length) / 4);
    const ans = parseAnswer(content);

    const byNum = new Map(articles.map((a) => [a.num, a.id]));
    const ids = [...new Set(ans.cited_nums.map((n) => byNum.get(norm(String(n)))).filter((id): id is string => !!id))];

    getDb().prepare(`
      INSERT INTO faq (theme, topic, slug, emoji, question, short, answer_md, article_ids)
      VALUES (@theme, @topic, @slug, @emoji, @question, @short, @answer_md, @article_ids)
      ON CONFLICT(slug) DO UPDATE SET theme=excluded.theme, topic=excluded.topic, emoji=excluded.emoji, question=excluded.question,
        short=excluded.short, answer_md=excluded.answer_md, article_ids=excluded.article_ids
    `).run({ theme: s.theme, topic: s.topic ?? null, slug: s.slug, emoji: s.emoji, question: s.question, short: ans.short, answer_md: ans.answer_md, article_ids: JSON.stringify(ids) });
  }

  // Topic question theme: the first non-convention theme owning one of its codes, else "sujets".
  const themeFor = (codes: string[]) =>
    codes.map((c) => THEMES.find((t) => t.slug !== "conventions" && (t.codes as readonly string[]).includes(c))?.slug).find(Boolean) ?? "sujets";
  const seeds: Seed[] = topicsMode
    ? getTopics()
        .filter((t) => !topicFilter || t.slug === topicFilter)
        .flatMap((t) => t.questions.map((q) => ({ ...q, theme: themeFor(t.codes), emoji: null, topic: t.slug, codes: t.codes })))
    : JSON.parse(fs.readFileSync(path.join(process.cwd(), "seed", "questions.json"), "utf8"));
  const existing = new Set((getDb().prepare("SELECT slug FROM faq").all() as { slug: string }[]).map((r) => r.slug));
  const articleCount = (getDb().prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number }).n;
  if (!articleCount) console.warn("⚠️  articles table is empty — run `npm run ingest` first.");

  let skipped = 0;
  const todo = seeds
    .filter((s) => !themeFilter || s.theme === themeFilter)
    .filter((s) => { if (!force && !dryRun && existing.has(s.slug)) { skipped++; return false; } return true; })
    .slice(0, limit);

  let done = 0;
  const failed: string[] = [];
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const s = todo[next++];
      try {
        await processOne(s).catch((e) => { if (dryRun) throw e; return processOne(s); }); // retry once
        done++;
        if (!dryRun) console.log(`✓ ${s.slug}`);
      } catch (e) {
        failed.push(s.slug);
        console.error(`✗ ${s.slug}: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: dryRun ? 1 : 3 }, worker));

  console.log(`\nDone: ${done}  Skipped: ${skipped}  Failed: ${failed.length}${failed.length ? ` (${failed.join(", ")})` : ""}`);
  if (!dryRun) console.log(`Tokens (approx.): ~${approxTokens}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
