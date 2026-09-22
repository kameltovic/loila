// Open-data layer consistency checks: npx tsx scripts/check-open-data.ts
// Deterministic, against a fresh temp DB (never data/loila.db). Covers the entity-resolution /
// source-record / eligibility contracts that the open-data verticals all rely on.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-opendata-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // before db.ts is imported

const OPEN_DATA_TABLES = [
  "entities", "entity_ids", "source_records",
  "companies", "establishments", "company_announcements", "rge_certifications",
  "collective_agreements", "company_agreements",
  "addresses", "parcels", "parcel_addresses", "transactions", "dpe_diagnostics", "risks", "urban_zones",
  "jurisdictions", "legal_indices",
];

async function main() {
  const { getDb } = await import("../src/lib/db");
  const E = await import("../src/lib/entities");
  const S = await import("../src/lib/sources");
  const A = await import("../src/lib/articles");
  const C = await import("../src/lib/company");
  const EL = await import("../src/lib/eligibility");
  const db = getDb();

  // 1. Schema idempotency: every open-data table exists, and re-applying the schema is a no-op.
  const has = (d: Database.Database, t: string) => !!d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  for (const t of OPEN_DATA_TABLES) assert.ok(has(db, t), `missing table ${t}`);
  // Re-apply the schema on a second connection: every CREATE is IF NOT EXISTS, so this must not throw.
  const { default: Sqlite } = await import("better-sqlite3");
  const { SCHEMA } = await import("../src/lib/db");
  const dbAgain = new Sqlite(process.env.DATABASE_PATH!);
  dbAgain.exec(SCHEMA);
  for (const t of OPEN_DATA_TABLES) assert.ok(has(dbAgain, t), `table ${t} lost after schema re-run`);

  // 2. Entity resolution: linkExternalId / resolveExternal round-trip, shared entities, idempotent ensureEntity.
  const eid = E.linkExternalId(db, "siren", "552081317", "company", "552081317", "ACME");
  assert.equal(eid, "company:552081317");
  assert.equal(E.resolveExternal("siren", "552081317"), eid);
  assert.equal(E.linkExternalId(db, "siret", "55208131700027", "company", "552081317"), eid, "two schemes, one entity");
  assert.equal(E.resolveExternal("siret", "55208131700027"), eid);
  assert.equal(E.linkExternalId(db, "idcc", "1486", "agreement", "1486", "CCN test"), "agreement:1486");
  assert.equal(E.resolveExternal("idcc", "1486"), "agreement:1486");
  assert.equal(E.linkExternalId(db, "ban", "75107_9114_00095", "address", "75107_9114_00095", "1 rue X"), "address:75107_9114_00095");
  assert.equal(E.resolveExternal("ban", "75107_9114_00095"), "address:75107_9114_00095");
  assert.equal(E.linkExternalId(db, "idu", "75107000AB0013", "parcel", "75107000AB0013", null), "parcel:75107000AB0013");
  assert.equal(E.resolveExternal("idu", "75107000AB0013"), "parcel:75107000AB0013");
  // ensureEntity: a label update must not create a second row.
  E.ensureEntity(db, "company", "552081317", "Old Label");
  assert.equal(E.getEntity(eid)?.label, "Old Label");
  E.ensureEntity(db, "company", "552081317", "New Label");
  assert.equal(E.getEntity(eid)?.label, "New Label");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM entities WHERE id = ?").get(eid) as { n: number }).n, 1, "ensureEntity must be idempotent");

  // 3. normalizeIdcc: 4-digit, zero-padded; 9999 is the "not declared" sentinel and stays 9999.
  assert.equal(E.normalizeIdcc("16"), "0016");
  assert.equal(E.normalizeIdcc(1486), "1486");
  assert.equal(E.normalizeIdcc("9999"), "9999");

  // 4. Source records: TTL freshness, checksum, batch-import shape, licence.
  const RE = S.SOURCES["DINUM:recherche-entreprises"];
  const payload = { results: [{ siren: "552081317" }] };
  const expired = S.saveSourceRecord(db, RE, "552081317", payload, { ttl: 0 });
  const rec0 = S.getSourceRecord(expired)!;
  assert.equal(S.isFresh(rec0), false, "ttl=0 record is not fresh");
  assert.ok(rec0.checksum, "checksum present when a payload is stored");
  assert.equal(rec0.checksum, S.sha256(JSON.stringify(payload)), "checksum is the sha256 of the stored payload");
  const fresh = S.saveSourceRecord(db, RE, "552081317", payload, { ttl: 3600 });
  assert.equal(S.isFresh(S.getSourceRecord(fresh)), true, "ttl=3600 record is fresh");
  const imported = S.recordImport(db, RE, "552081317");
  const imp = S.getSourceRecord(imported)!;
  assert.equal(imp.checksum, null, "batch import carries no checksum");
  assert.equal(imp.expires_at, null, "batch import never expires");
  assert.equal(imp.licence, RE.licence, "licence stored");
  assert.equal(S.isFresh(undefined), false);

  // 5. articleIndexable: FAQ citation, stale/fresh summary, decision link.
  const art = db.prepare("INSERT INTO articles (id, code, num, texte, date_debut, url) VALUES (?, ?, ?, ?, ?, '')");
  art.run("ART_BARE", "code-travail", "X1", "texte bare", "2020-01-01");
  art.run("ART_FAQ", "code-travail", "X2", "texte faq", "2020-01-01");
  art.run("ART_STALE", "code-travail", "X3", "texte stale", "2020-01-01");
  art.run("ART_FRESH", "code-travail", "X4", "texte fresh", "2020-01-01");
  db.prepare("INSERT INTO faq (theme, slug, question, short, answer_md, article_ids) VALUES ('travail', 'faq-1', 'q', 's', 'a', ?)").run(JSON.stringify(["ART_FAQ"]));
  assert.equal(EL.articleIndexable({ id: "ART_BARE", texte: "texte bare" }), false, "bare article stays noindex");
  assert.equal(EL.articleIndexable({ id: "ART_FAQ", texte: "texte faq" }), true, "FAQ-cited article is indexable");
  db.prepare("INSERT INTO article_summaries (article_id, texte_sha, summary, points) VALUES ('ART_STALE', 'deadbeef', 's', '[]')").run();
  assert.equal(EL.articleIndexable({ id: "ART_STALE", texte: "texte stale" }), false, "stale summary (texte_sha mismatch) is not indexable");
  db.prepare("INSERT INTO article_summaries (article_id, texte_sha, summary, points) VALUES ('ART_FRESH', ?, 's', '[]')").run(A.texteSha("texte fresh"));
  assert.equal(EL.articleIndexable({ id: "ART_FRESH", texte: "texte fresh" }), false, "fresh summary without a linked decision is not indexable");
  db.prepare("INSERT INTO decision_articles (decision_id, article_id) VALUES ('D1', 'ART_FRESH')").run();
  assert.equal(EL.articleIndexable({ id: "ART_FRESH", texte: "texte fresh" }), true, "fresh summary + decision link is indexable");

  // 6. decisionIndexable: only with a decision_summaries row.
  assert.equal(EL.decisionIndexable("D1"), false);
  db.prepare("INSERT INTO decision_summaries (decision_id, summary, points) VALUES ('D1', 'sum', '[]')").run();
  assert.equal(EL.decisionIndexable("D1"), true);

  // 7. indexableCompanies / indexableAddresses: a page is indexable only with a sourced block attached.
  const mkCompany = (siren: string, statut: string) => {
    db.prepare("INSERT INTO companies (siren, entity_id, nom_complet, etat_administratif, statut_diffusion) VALUES (?, ?, ?, 'A', ?)")
      .run(siren, E.ensureEntity(db, "company", siren, siren), siren, statut);
  };
  mkCompany("111111111", "O"); // no block → excluded
  mkCompany("222222222", "O");
  db.prepare("INSERT INTO company_announcements (bodacc_id, siren, dateparution) VALUES ('A1', '222222222', '2024-01-01')").run();
  mkCompany("333333333", "P"); // statut_diffusion P → excluded even with a block
  db.prepare("INSERT INTO company_announcements (bodacc_id, siren, dateparution) VALUES ('A2', '333333333', '2024-01-01')").run();
  assert.deepEqual(EL.indexableCompanies().map((c) => c.siren).sort(), ["222222222"]);
  const mkAddress = (ban: string) => {
    db.prepare("INSERT INTO addresses (ban_id, entity_id, label) VALUES (?, ?, ?)").run(ban, E.ensureEntity(db, "address", ban, ban), `${ban} rue`);
  };
  mkAddress("addr-1"); // no block → excluded
  mkAddress("addr-2");
  db.prepare("INSERT INTO dpe_diagnostics (numero_dpe, ban_id) VALUES ('DPE1', 'addr-2')").run();
  assert.deepEqual(EL.indexableAddresses().map((a) => a.ban_id).sort(), ["addr-2"]);

  // 8. companyAgreements never returns idcc 9999 ("not declared") as a convention.
  db.prepare("INSERT INTO company_agreements (siret, siren, idcc, method, confidence, source) VALUES ('22222222200001', '222222222', '1486', 'dsn_declared', 'CERTAIN', 'dsn')").run();
  db.prepare("INSERT INTO company_agreements (siret, siren, idcc, method, confidence, source) VALUES ('22222222200001', '222222222', '9999', 'dsn_declared', 'UNKNOWN', 'dsn')").run();
  db.prepare("INSERT INTO collective_agreements (idcc, titre, source) VALUES ('1486', 'CCN test', 'dares')").run();
  assert.deepEqual(C.companyAgreements("222222222").map((a) => a.idcc).sort(), ["1486"], "9999 is filtered out at read time");

  // 9. searchCompanies: exact SIREN hits the cached row; an unknown SIREN yields nothing.
  const hit = C.searchCompanies("222222222");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].siren, "222222222");
  assert.deepEqual(C.searchCompanies("999999999"), []);

  // 10. SOURCES registry: every entry carries provider/dataset/url, an allowed licence and a numeric TTL.
  const LICENCES = new Set(["LOV2", "fr-lo", "ODbL", "notspecified"]);
  assert.ok(Object.keys(S.SOURCES).length > 0, "SOURCES must not be empty");
  for (const [key, meta] of Object.entries(S.SOURCES)) {
    assert.equal(key, `${meta.provider}:${meta.dataset}`, "registry key must match provider:dataset");
    assert.ok(meta.provider && meta.dataset && meta.url, `missing provider/dataset/url on ${key}`);
    assert.ok(LICENCES.has(meta.licence), `licence ${meta.licence} on ${key} not in the allowed set`);
    assert.equal(typeof meta.ttl, "number", `ttl on ${key} must be numeric`);
    assert.ok(Number.isFinite(meta.ttl) && meta.ttl >= 0, `ttl on ${key} must be a finite non-negative number`);
  }

  // 11. Jurisdictions: Paris arrondissements fall back to 75056, Marseille/Lyon communes to arrondissement 1.
  const J = await import("../src/lib/jurisdictions");
  const addJ = db.prepare("INSERT OR REPLACE INTO jurisdictions (citycode, kind, label, source) VALUES (?, ?, ?, 'test')");
  addJ.run("75056", "ca", "Cour d'Appel de Paris"); addJ.run("75056", "tj", "Tribunal judiciaire de Paris");
  addJ.run("13201", "tj", "Tribunal judiciaire de Marseille");
  assert.deepEqual(J.jurisdictionsFor("75107").map((j) => j.kind), ["tj", "ca"], "Paris arrondissement → 75056, ordered tj before ca");
  assert.equal(J.jurisdictionsFor("13055")[0]?.label, "Tribunal judiciaire de Marseille");
  assert.deepEqual(J.jurisdictionsFor("01001"), []);
  assert.deepEqual(J.jurisdictionsFor(null), []);

  console.log("check-open-data: OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
