// Legal knowledge graph consistency checks: npx tsx scripts/check-legal-graph.ts
// 1. Fixture DB: idempotent extraction, ambiguous references never linked, old civil law not linked to today's
//    articles, co-citation scores symmetric. 2. Real DB (data/loila.db, when populated): invariants.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const real = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "loila.db");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-graph-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // before db.ts is imported

async function fixture() {
  const { getDb } = await import("../src/lib/db");
  const G = await import("../src/lib/legal-graph");
  const db = getDb();
  const art = db.prepare("INSERT INTO articles (id, code, num, section, texte, date_debut, url) VALUES (?, ?, ?, NULL, ?, ?, '')");
  art.run("A1240", "code-civil", "1240", "Tout fait quelconque…", "2016-10-01");
  art.run("A1103", "code-civil", "1103", "Les contrats légalement formés…", "2016-10-01");
  art.run("A1134", "code-civil", "1134", "(article actuel 1134, autre sens)", "2016-10-01");
  art.run("AL1235", "code-du-travail", "L1235-3", "…", "2017-09-24");
  art.run("AR15120", "code-urbanisme", "R. 151-20", "…", "2016-01-01"); // stored with a space: num_norm fixes it
  G.backfillArticles(db);
  const resolve = G.articleResolver(db);

  const d1 = { id: "D1", date: "2019-05-02", sommaire: null, texte: "Vu les articles 1240 et 1103 du code civil ; Vu l'article L. 1235-3 du code du travail et l'article R. 151-20 du code de l'urbanisme ; article 700 ; article 700 du code de procédure civile" };
  const c1 = G.extractCitations(d1, resolve);
  G.saveCitations(db, "D1", c1);
  const links = () => (db.prepare("SELECT article_id FROM decision_articles WHERE decision_id = 'D1' ORDER BY article_id").all() as { article_id: string }[]).map((r) => r.article_id);
  assert.deepEqual(links(), ["A1103", "A1240", "AL1235", "AR15120"], "resolved links, including the non-normalized stored number");
  // Idempotent: re-saving gives the same rows.
  const snap = () => JSON.stringify(db.prepare("SELECT article_id, code_id, num, location, status FROM citations WHERE decision_id = 'D1' ORDER BY id").all());
  const first = snap();
  G.saveCitations(db, "D1", G.extractCitations(d1, resolve));
  assert.equal(snap(), first, "extraction is idempotent");
  // Ambiguous references are stored but never linked.
  const statuses = (db.prepare("SELECT status, COUNT(*) n FROM citations WHERE decision_id = 'D1' GROUP BY status").all() as { status: string; n: number }[]);
  assert.ok(statuses.some((s) => s.status === "no_code"), "article 700 without code kept");
  assert.ok(statuses.some((s) => s.status === "code_not_carried"), "code de procédure civile recognized");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM decision_articles da JOIN citations c ON c.decision_id = da.decision_id AND c.article_id = da.article_id WHERE c.status <> 'resolved'").get() as { n: number }).n, 0);

  // Old civil law regime: a decision citing 1134 (landmark) does not link 1240 either.
  const d2 = { id: "D2", date: "2020-01-15", sommaire: null, texte: "Vu les articles 1134 et 1240 du code civil ;" };
  G.saveCitations(db, "D2", G.extractCitations(d2, resolve));
  assert.equal((db.prepare("SELECT COUNT(*) n FROM decision_articles WHERE decision_id = 'D2'").get() as { n: number }).n, 0, "old regime: nothing linked");

  // Co-citations: symmetric, with a score, only for pairs sharing ≥ 2 decisions.
  db.prepare("INSERT INTO decisions (id, source, juridiction, date, titre, texte, url) VALUES ('D1', 'cass', 'Cour de cassation', '2019-05-02', 't', 't', ''), ('D3', 'cass', 'Cour de cassation', '2021-03-01', 't', 't', '')").run();
  const d3 = { id: "D3", date: "2021-03-01", sommaire: null, texte: "Vu les articles 1240 et 1103 du code civil ;" };
  G.saveCitations(db, "D3", G.extractCitations(d3, resolve));
  G.buildCoCitations(db);
  const rel = db.prepare("SELECT a_id, b_id, shared, score FROM article_relations WHERE kind = 'co_citation' ORDER BY a_id, b_id").all() as { a_id: string; b_id: string; shared: number; score: number }[];
  assert.deepEqual(rel.map((r) => `${r.a_id}-${r.b_id}:${r.shared}`), ["A1103-A1240:2", "A1240-A1103:2"], "one pair, both directions");
  assert.ok(rel[0].score > 0 && rel[0].score <= 1 && rel[0].score === rel[1].score);

  // Internal search: text + article + date filters, number lookup, FTS input never injects syntax.
  const S = await import("../src/lib/legal-search");
  db.prepare("INSERT INTO decisions (id, source, juridiction, formation, date, numero, titre, texte, url) VALUES ('D4', 'cass', 'Cour de cassation', 'CHAMBRE_CIVILE_3', '2022-06-01', '22-15536', 'Cass. civ. 3e', 'La clause d''exclusion de garantie des vices cachés est écartée : le vendeur est un professionnel.', '')").run();
  db.prepare("INSERT INTO decision_numbers (decision_id, numero) VALUES ('D4', '22-15536')").run();
  G.saveCitations(db, "D4", G.extractCitations({ id: "D4", date: "2022-06-01", sommaire: null, texte: "Vu l'article 1240 du code civil" }, resolve));
  assert.deepEqual(S.searchDecisions({ q: "clause exclusion vices cachés professionnel", since: "2020-01-01" }).rows.map((r) => r.id), ["D4"]);
  assert.deepEqual(S.searchDecisions({ q: "vices cachés", articleIds: ["A1103"] }).rows.map((r) => r.id), [], "article filter applies");
  assert.deepEqual(S.searchDecisions({ numero: "22-15.536" }).rows.map((r) => r.id), ["D4"], "number in any written form");
  assert.equal(S.searchDecisions({ q: 'vices" OR * NEAR(' }).rows.length >= 0, true, "no FTS syntax error");
  assert.ok(S.decisionPassages("D4", "vendeur professionnel").some((p) => p.includes("professionnel")));

  // Republished duplicates (same court, date, number, near-identical text) merge into the lowest id, provenance kept.
  const addDec = db.prepare("INSERT INTO decisions (id, source, juridiction, date, titre, texte, url) VALUES (?, 'jade', 'CAA de LYON', '2021-05-04', 't', ?, '')");
  addDec.run("CETATEXT1", "x".repeat(1000));
  addDec.run("CETATEXT2", "x".repeat(1005)); // republication
  addDec.run("CETATEXT3", "y".repeat(3000)); // same number and date, different decision
  for (const id of ["CETATEXT1", "CETATEXT2", "CETATEXT3"]) db.prepare("INSERT INTO decision_numbers (decision_id, numero) VALUES (?, '21LY00001')").run(id);
  db.prepare("INSERT INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, extractor, extractor_version) VALUES ('decision', 'CETATEXT2', 'JADE', 'DILA', 'u', 'r2', 'x', '1')").run();
  assert.equal(G.mergeRepublished(db), 1);
  assert.deepEqual((db.prepare("SELECT id FROM decisions WHERE id LIKE 'CETATEXT%' ORDER BY id").all() as { id: string }[]).map((r) => r.id), ["CETATEXT1", "CETATEXT3"]);
  assert.ok(db.prepare("SELECT 1 FROM provenance WHERE entity_id = 'CETATEXT1' AND origin_ref LIKE '%CETATEXT2%'").get(), "provenance of the merged copy kept");

  // Checksum change detection: a different raw text gives a different checksum.
  assert.notEqual(G.sha256("<xml>a</xml>"), G.sha256("<xml>b</xml>"));
  // Pourvoi numbers normalize to one form (stable relation keys).
  for (const s of ["23-20.428", "23-20428", "23-20 428"]) assert.equal(G.normalizePourvoi(s), "23-20428");
  assert.equal(G.normalizePourvoi("25LY03408"), "25LY03408", "CAA request numbers are kept");
  assert.equal(G.normalizePourvoi("499377"), "499377");
}

function invariants(file: string) {
  // Separate connection to the real DB (read-only).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(file, { readonly: true });
  const has = (t: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t);
  if (!has("citations") || !(db.prepare("SELECT COUNT(*) n FROM decisions").get() as { n: number }).n) return console.log("check-legal-graph: real DB empty, invariants skipped");
  const zero = (sql: string, msg: string) => assert.equal((db.prepare(sql).get() as { n: number }).n, 0, msg);
  zero("SELECT COUNT(*) - COUNT(DISTINCT id) n FROM decisions", "duplicate decision ids");
  zero("SELECT COUNT(*) n FROM (SELECT ecli FROM decisions WHERE ecli <> '' GROUP BY ecli HAVING COUNT(*) > 1)", "duplicate ECLI");
  zero("SELECT COUNT(*) n FROM decision_articles da WHERE NOT EXISTS (SELECT 1 FROM articles a WHERE a.id = da.article_id)", "link to a missing article");
  zero("SELECT COUNT(*) n FROM decision_articles da WHERE NOT EXISTS (SELECT 1 FROM decisions d WHERE d.id = da.decision_id)", "link from a missing decision");
  zero(
    "SELECT COUNT(*) n FROM decision_articles da WHERE NOT EXISTS (SELECT 1 FROM citations c WHERE c.decision_id = da.decision_id AND c.article_id = da.article_id AND c.status = 'resolved' AND c.confidence >= 0.9)",
    "link without a resolved citation behind it",
  );
  zero("SELECT COUNT(*) n FROM citations WHERE status <> 'resolved' AND article_id IS NOT NULL", "unresolved citation pointing to an article");
  zero("SELECT COUNT(*) n FROM decisions d WHERE NOT EXISTS (SELECT 1 FROM provenance p WHERE p.entity_type = 'decision' AND p.entity_id = d.id)", "decision without provenance");
  zero(
    "SELECT COUNT(*) n FROM article_relations r WHERE NOT EXISTS (SELECT 1 FROM article_relations s WHERE s.a_id = r.b_id AND s.b_id = r.a_id AND s.kind = r.kind AND s.score = r.score)",
    "asymmetric article relation",
  );
  zero("SELECT COUNT(*) n FROM decisions WHERE url NOT LIKE 'https://www.legifrance.gouv.fr/%'", "decision without official URL");
  console.log("check-legal-graph: real DB invariants OK");
}

fixture()
  .then(() => {
    console.log("check-legal-graph: fixture OK");
    if (fs.existsSync(real)) invariants(real);
  })
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
