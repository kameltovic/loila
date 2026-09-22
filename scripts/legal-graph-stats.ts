// Deterministic, read-only observability report of the whole Loilà graph: the legal knowledge graph
// (reusing graphMetrics) plus the row counts of every open-data table. Stores nothing, makes no network
// call. Never crashes on an empty DB. Run: npm run legal-graph:stats [-- --json]
export {}; // module scope: every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

// Every open-data table counted by the report (order is the printed/JSON order: deterministic).
const OPEN_DATA_TABLES = [
  "entities", "entity_ids", "source_records", "companies", "establishments", "company_announcements",
  "rge_certifications", "collective_agreements", "company_agreements", "addresses", "parcels",
  "transactions", "dpe_diagnostics", "risks", "urban_zones", "jurisdictions", "legal_indices",
  "housing_zones", "jorf_texts", "jorf_article_links", "jorf_decision_links",
] as const;

const OPEN_DATA_LABELS: Record<(typeof OPEN_DATA_TABLES)[number], string> = {
  housing_zones: "Zonage zones tendues (housing_zones)",
  jorf_texts: "Textes du Journal officiel (jorf_texts)",
  jorf_article_links: "Liens article ↔ texte JO (jorf_article_links)",
  jorf_decision_links: "Liens décision ↔ texte JO (jorf_decision_links)",
  entities: "Entités (entities)",
  entity_ids: "Identifiants externes (entity_ids)",
  source_records: "Enregistrements source (source_records)",
  companies: "Entreprises (companies)",
  establishments: "Établissements (establishments)",
  company_announcements: "Annonces BODACC (company_announcements)",
  rge_certifications: "Certifications RGE (rge_certifications)",
  collective_agreements: "Conventions collectives (collective_agreements)",
  company_agreements: "Rattachements IDCC (company_agreements)",
  addresses: "Adresses (addresses)",
  parcels: "Parcelles (parcels)",
  transactions: "Mutations DVF (transactions)",
  dpe_diagnostics: "DPE (dpe_diagnostics)",
  risks: "Risques (risks)",
  urban_zones: "Zones d'urbanisme (urban_zones)",
  jurisdictions: "Juridictions (jurisdictions)",
  legal_indices: "Indices légaux (legal_indices)",
};

async function main() {
  const { getDb } = await import("../src/lib/db");
  const G = await import("../src/lib/legal-graph");
  const db = getDb();
  const asJson = process.argv.includes("--json");

  // An absent or empty table must read as 0, never throw: this report is safe on a fresh DB.
  const count = (table: string) => {
    try {
      return (db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n;
    } catch {
      return 0;
    }
  };

  const m = G.graphMetrics(db);
  const openData = Object.fromEntries(OPEN_DATA_TABLES.map((t) => [t, count(t)])) as Record<(typeof OPEN_DATA_TABLES)[number], number>;

  const report = {
    articles: m.articles,
    decisions: m.decisions,
    decision_article_edges: m.decision_article_links,
    article_article_edges: m.article_relations,
    citations: m.citations,
    citations_by_status: m.citations_by_status,
    resolution_rate: m.resolution_rate,
    unresolved_references: m.unresolved_unknown_article,
    ambiguous_references: m.ambiguous_no_code,
    orphan_articles: m.orphan_articles,
    duplicate_decisions: m.potential_duplicate_decisions,
    companies: openData.companies,
    establishments: openData.establishments,
    collective_agreements: openData.collective_agreements,
    company_agreements: openData.company_agreements,
    addresses: openData.addresses,
    open_data: openData,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const n = (v: number) => v.toLocaleString("fr-FR");
  const line = (label: string, value: number) => console.log(`${label.padEnd(54)} ${n(value).padStart(12)}`);
  const rule = "─".repeat(68);

  const rows: [string, number][] = [
    ["ARTICLES", report.articles],
    ["DECISIONS", report.decisions],
    ["DECISION_ARTICLE_EDGES (liens résolus)", report.decision_article_edges],
    ["ARTICLE_ARTICLE_EDGES (co-citation)", report.article_article_edges],
    ["Citations détectées", report.citations],
    ["Taux de résolution (%)", report.resolution_rate],
    ["UNRESOLVED_REFERENCES (article inconnu)", report.unresolved_references],
    ["AMBIGUOUS_REFERENCES (sans code)", report.ambiguous_references],
    ["ORPHANS (articles orphelins)", report.orphan_articles],
    ["DUPLICATES (doublons potentiels de décisions)", report.duplicate_decisions],
  ];

  console.log("STATISTIQUES DU GRAPHE LOILÀ");
  console.log(rule);
  for (const [label, value] of rows) line(label, value);
  console.log(rule);
  const statuses = Object.entries(report.citations_by_status)
    .map(([k, v]) => `${k} ${n(v)}`)
    .join(" · ");
  console.log("Citations par statut :", statuses || "aucune");
  console.log("");
  console.log("DONNÉES OUVERTES (volumétrie)");
  console.log(rule);
  for (const t of OPEN_DATA_TABLES) line(OPEN_DATA_LABELS[t], openData[t]);
  console.log(rule);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
