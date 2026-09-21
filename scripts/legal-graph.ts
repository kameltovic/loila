// Legal knowledge graph: rebuild derived layers and print a readable report (with the change since last run).
export {}; // module scope: every script declares its own main()
// npm run legal-graph [-- --report-only]
// Rebuilds, all deterministic: codes, article backfill (normalized numbers, checksums, provenance), co-citations,
// per-article stats, topics. Each run stores a snapshot in graph_snapshots to follow the graph's growth.
try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const { getDb } = await import("../src/lib/db");
  const G = await import("../src/lib/legal-graph");
  const { getTopics } = await import("../src/lib/topics");
  const db = getDb();
  const reportOnly = process.argv.includes("--report-only");
  const t = Date.now();
  if (!reportOnly) {
    G.syncCodes(db);
    const b = G.backfillArticles(db);
    const pairs = G.buildCoCitations(db);
    const stats = G.buildArticleStats(db);
    G.buildTopics(db, getTopics());
    console.log(`rebuilt in ${((Date.now() - t) / 1000).toFixed(1)} s · articles backfilled ${b.changed} · co-citation pairs ${pairs} · article stats ${stats}\n`);
  }

  const m = G.graphMetrics(db);
  const prev = db.prepare("SELECT taken_at, metrics FROM graph_snapshots ORDER BY taken_at DESC LIMIT 1").get() as { taken_at: number; metrics: string } | undefined;
  const before = prev ? (JSON.parse(prev.metrics) as Record<string, unknown>) : {};
  const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("fr-FR") : JSON.stringify(v));
  const delta = (k: string, v: unknown) => {
    const p = before[k];
    return typeof v === "number" && typeof p === "number" && v !== p ? `  (${v > p ? "+" : ""}${(v - p).toLocaleString("fr-FR")})` : "";
  };
  const rows: [string, string][] = [
    ["Articles", "articles"],
    ["Décisions", "decisions"],
    ["Liens décision → article (résolus)", "decision_article_links"],
    ["Articles avec ≥ 1 décision", "articles_with_decision"],
    ["Décisions par article lié (moyenne)", "avg_decisions_per_linked_article"],
    ["Relations article ↔ article (co-citation)", "article_relations"],
    ["Relations décision ↔ décision", "decision_relations"],
    ["  dont résolues vers une décision Loilà", "decision_relations_resolved"],
    ["Citations détectées", "citations"],
    ["Taux de résolution (codes présents dans Loilà, %)", "resolution_rate"],
    ["Références ambiguës (sans code)", "ambiguous_no_code"],
    ["Références non résolues (article inconnu)", "unresolved_unknown_article"],
    ["Doublons potentiels de décisions", "potential_duplicate_decisions"],
    ["Décisions sans provenance", "decisions_without_provenance"],
    ["Articles sans provenance", "articles_without_provenance"],
    ["Articles venant seulement d'un miroir", "articles_from_mirror_only"],
    ["Articles orphelins (ni décision ni FAQ)", "orphan_articles"],
  ];
  console.log("LEGAL KNOWLEDGE GRAPH LOILÀ" + (prev ? ` · comparé au ${new Date(prev.taken_at * 1000).toLocaleString("fr-FR")}` : ""));
  console.log("─".repeat(72));
  for (const [label, k] of rows) {
    const v = (m as Record<string, unknown>)[k];
    console.log(`${label.padEnd(52)} ${fmt(v).padStart(10)}${delta(k, v)}`);
  }
  console.log("─".repeat(72));
  console.log("Citations par statut :", Object.entries(m.citations_by_status).map(([k, v]) => `${k} ${v.toLocaleString("fr-FR")}`).join(" · "));
  console.log("Codes absents les plus cités :", (m.top_unresolved_codes as { code_id: string; n: number }[]).map((c) => `${c.code_id.slice(1)} (${c.n})`).join(", "));
  if (!reportOnly) db.prepare("INSERT INTO graph_snapshots (taken_at, metrics) VALUES (unixepoch(), ?)").run(JSON.stringify(m));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
