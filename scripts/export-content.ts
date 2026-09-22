// Bundles legal texts + reviewed FAQ rows (+ article summaries with --summaries) for production (applied at startup by importContent in src/lib/db.ts).
// npx tsx scripts/export-content.ts <bundle-name> [--codes code-a,code-b] [--faq seed/generated/x.json ...]
//   --decisions: every decision and its article links (case law, ≈30 MB: rarely re-exported, see scripts/ingest-juri.ts)
//   --decision-summaries: every decision summary (small: re-export this one after scripts/batch-decisions.ts)
//   --jorf: the Journal officiel layer (jorf_texts, article/decision links, provenance), a snapshot that replaces the
//           links on import (scripts/legal-jorf.ts builds it from the LEGI cache and the JORF dump, absent in production)
//   --summaries: every row of article_summaries (upserts, so re-exporting the same bundle name is enough)
//   --diff-from <old.db>: with --codes, only articles added or changed since that DB, plus ids to delete (after a re-ingest)
//   → seed/content/<bundle-name>.json.gz   (re-export after changes: a new hash re-applies the bundle)
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const JORF_SHIPPED = `(t.nature IN ('LOI', 'LOI_ORGANIQUE', 'LOI_CONSTIT', 'LOI_PROGRAMME', 'ORDONNANCE')
  OR EXISTS (SELECT 1 FROM jorf_article_links l WHERE l.jorf_text_id = t.id) OR EXISTS (SELECT 1 FROM jorf_decision_links d WHERE d.jorf_text_id = t.id))`;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const argv = process.argv.slice(2);
  const name = argv[0];
  if (!name || name.startsWith("--")) throw new Error("usage: export-content.ts <bundle-name> [--codes a,b] [--faq file.json ...]");
  const codes = (argv[argv.indexOf("--codes") + 1] ?? "").split(",").filter((c) => argv.includes("--codes") && c);
  const faqFiles = argv.flatMap((a, i) => (argv[i - 1] === "--faq" ? [a] : []));
  const db = getDb();
  let articles = codes.flatMap((c) => db.prepare("SELECT * FROM articles WHERE code = ? ORDER BY id").all(c)) as { id: string; code: string }[];
  let deleteArticleIds: string[] = [];
  const diffFrom = argv[argv.indexOf("--diff-from") + 1];
  if (argv.includes("--diff-from")) {
    const Database = (await import("better-sqlite3")).default;
    const old = new Database(diffFrom, { readonly: true });
    const sig = (r: Record<string, unknown>) => JSON.stringify([r.code, r.num, r.section, r.texte, r.date_debut, r.url]);
    const before = new Map(codes.flatMap((c) => old.prepare("SELECT * FROM articles WHERE code = ?").all(c) as Record<string, unknown>[]).map((r) => [r.id as string, sig(r)]));
    const now = new Set(articles.map((a) => a.id));
    deleteArticleIds = [...before.keys()].filter((id) => !now.has(id));
    articles = articles.filter((a) => before.get(a.id) !== sig(a as unknown as Record<string, unknown>));
  }
  const summaries = argv.includes("--summaries") ? db.prepare("SELECT article_id, texte_sha, summary, points, model FROM article_summaries ORDER BY article_id").all() : [];
  const withDecisions = argv.includes("--decisions");
  const decisions = withDecisions ? db.prepare("SELECT * FROM decisions ORDER BY id").all() : [];
  // Raw decisions only: citations, relations, co-citations and stats are re-derived on import (legal-graph.ts).
  const decisionNumbers = withDecisions ? db.prepare("SELECT decision_id, numero FROM decision_numbers ORDER BY decision_id").all() : [];
  const decisionProvenance = withDecisions ? db.prepare("SELECT * FROM provenance WHERE entity_type = 'decision' ORDER BY entity_id").all() : [];
  const decisionSummaries = argv.includes("--decision-summaries") ? db.prepare("SELECT decision_id, summary, points, model FROM decision_summaries ORDER BY decision_id").all() : [];
  const withJorf = argv.includes("--jorf");
  const jorf = withJorf
    ? {
        // Texts the graph links to, plus every loi/ordonnance (searchable by number); unlinked décrets stay local.
        jorfTexts: db.prepare(`SELECT * FROM jorf_texts t WHERE ${JORF_SHIPPED} ORDER BY id`).all(),
        jorfArticleLinks: db.prepare("SELECT article_id, jorf_text_id, jorf_article, relation FROM jorf_article_links ORDER BY article_id").all(),
        jorfDecisionLinks: db.prepare("SELECT decision_id, jorf_text_id, mentions FROM jorf_decision_links ORDER BY decision_id").all(),
        jorfProvenance: db.prepare(`SELECT p.* FROM provenance p JOIN jorf_texts t ON t.id = p.entity_id WHERE p.entity_type = 'jorf_text' AND ${JORF_SHIPPED} ORDER BY p.entity_id`).all(),
      }
    : {};
  const faq = faqFiles.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")) as unknown[]);
  const missing = argv.includes("--diff-from") ? [] : codes.filter((c) => !articles.some((a) => a.code === c));
  if (missing.length) throw new Error(`no articles for: ${missing.join(", ")} (ingest first)`);
  const out = path.join("seed", "content", `${name}.json.gz`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const buf = gzipSync(JSON.stringify({ articles, faq, ...(summaries.length ? { summaries } : {}), ...(withDecisions ? { decisions, decisionNumbers, decisionProvenance } : {}), ...(decisionSummaries.length ? { decisionSummaries } : {}), ...jorf, ...(deleteArticleIds.length ? { deleteArticleIds } : {}) }), { level: 9 });
  fs.writeFileSync(out, buf);
  if (withJorf) console.log(`jorf: ${jorf.jorfTexts?.length} texts, ${jorf.jorfArticleLinks?.length} article links, ${jorf.jorfDecisionLinks?.length} decision links`);
  console.log(`${out}: ${articles.length} articles, ${faq.length} faq, ${summaries.length} summaries, ${decisions.length} decisions, ${decisionSummaries.length} decision summaries, ${deleteArticleIds.length} deletions, ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
