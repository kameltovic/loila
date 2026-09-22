// Journal officiel layer checks: npx tsx scripts/check-jorf.ts — deterministic, fresh temp DB.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-jorf-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // before db.ts is imported

async function main() {
  const { getDb } = await import("../src/lib/db");
  const J = await import("../src/lib/jorf");
  const EL = await import("../src/lib/eligibility");
  const db = getDb();

  // 1. LIENS parsing: JORFTEXT targets with a known relation only; "2999" dates are "no date"; codification has no article.
  const xml = `<ARTICLE><LIENS>
<LIEN cidtexte="JORFTEXT000032407491" datesignatexte="2016-04-14" id="LEGIARTI1" naturetexte="DECRET" nortexte="AGRT1527367D" num="2" numtexte="2016-472" sens="cible" typelien="MODIFIE">Décret n°2016-472 du 14 avril 2016 - art. 2</LIEN>
<LIEN cidtexte="JORFTEXT000051538879" datesignatexte="2025-04-30" id="LEGIARTI2" naturetexte="LOI" nortexte="ECOM2415026L" num="24" numtexte="2025-391" sens="cible" typelien="CREE">LOI n°2025-391 du 30 avril 2025 - art. 24 (V)</LIEN>
<LIEN cidtexte="JORFTEXT000026120331" datesignatexte="2999-01-01" id="" naturetexte="" nortexte="" num="" numtexte="" sens="source" typelien="CODIFICATION">Décret n°2012-836 du 29 juin 2012 (V)</LIEN>
<LIEN cidtexte="JORFTEXT000000207538" datesignatexte="2000-12-13" id="JORFTEXT000000207538" naturetexte="LOI" nortexte="" num="" numtexte="2000-1208" sens="source" typelien="CONCORDANCE">Loi 2000-1208 art. 29-4</LIEN>
<LIEN cidtexte="LEGITEXT000025244092" datesignatexte="2999-01-01" id="LEGIARTI3" naturetexte="CODE" num="R321-57" sens="cible" typelien="CITATION">Code forestier - art. R321-57</LIEN>
</LIENS></ARTICLE>`;
  const links = J.parseJorfLinks(xml);
  assert.deepEqual(links.map((l) => [l.cid, l.relation, l.article]), [
    ["JORFTEXT000032407491", "modifie", "2"],
    ["JORFTEXT000051538879", "cree", "24"],
    ["JORFTEXT000026120331", "codifie", ""],
  ]);
  assert.equal(links[2].date, "", "2999 is the 'no date' sentinel");
  assert.deepEqual(J.parseJorfLinks("<ARTICLE/>"), []);

  // 2. Titles: built from nature/num/date ("1er" for the first of the month), else the cleaned LEGI label.
  assert.equal(J.shortTitle(links[1]), "Loi n° 2025-391 du 30 avril 2025");
  assert.equal(J.shortTitle({ nature: "DECRET", num: "2016-400", date: "2016-04-01", label: "" }), "Décret n° 2016-400 du 1er avril 2016");
  assert.equal(J.shortTitle(links[2]), "Décret n°2012-836 du 29 juin 2012");
  assert.equal(J.shortTitle({ nature: "ARRETE", num: "", date: "2020-03-12", label: "Arrêté du 12 mars 2020 - art. 3 (VT)" }), "Arrêté du 12 mars 2020");

  assert.equal(J.titleObject({ titre_full: "LOI n° 2014-366 du 24 mars 2014 pour l'accès au logement et un urbanisme rénové" }), "pour l'accès au logement et un urbanisme rénové");
  assert.equal(J.titleObject({ titre_full: "Arrêté du 1er août 2006 fixant les dispositions" }), "fixant les dispositions");
  assert.equal(J.titleObject({ titre_full: null }), "");
  assert.deepEqual(["L200-11", "L200-2", "L200-1"].map((num) => ({ num })).sort(J.byArticleNum).map((a) => a.num), ["L200-1", "L200-2", "L200-11"]);

  // 3. "loi n° …" mentions in decisions: nature family must match, ambiguous numbers are skipped.
  const byNum = new Map([
    ["89-462", [{ id: "JORF_LOI", nature: "LOI" }]],
    ["2016-472", [{ id: "JORF_DEC", nature: "DECRET" }]],
    ["2020-1", [{ id: "A", nature: "LOI" }, { id: "B", nature: "LOI" }]],
  ]);
  const found = J.resolveLawRefs("vu la loi n° 89-462 et la loi n°89-462 ; le décret n° 2016-472 ; l'ordonnance n° 2016-472 ; la loi n° 2020-1", byNum);
  assert.deepEqual([...found], [["JORF_LOI", 2], ["JORF_DEC", 1]]);

  // 4. Indexability (one rule for page and sitemap): official metadata AND ≥ 2 structural links or ≥ 3 decisions.
  const text = db.prepare("INSERT INTO jorf_texts (id, nature, num, titre, fetched_at, date_publi) VALUES (?, 'LOI', ?, ?, ?, '2025-05-02')");
  text.run("T_TWO", "1", "two links", 1);
  text.run("T_ONE", "2", "one link", 1);
  text.run("T_UNFETCHED", "3", "not fetched", null);
  text.run("T_CITED", "4", "citations only", 1);
  text.run("T_JURI", "5", "case law", 1);
  for (const a of ["A1", "A2"]) db.prepare("INSERT INTO articles (id, code, num, texte, date_debut, url) VALUES (?, 'code-civil', ?, 't', '2020-01-01', '')").run(a, a);
  for (const d of ["D1", "D2", "D3"]) db.prepare("INSERT INTO decisions (id, source, juridiction, date, titre, texte, url) VALUES (?, 'cass', 'Cour de cassation', '2024-01-01', 't', 't', '')").run(d);
  const link = db.prepare("INSERT INTO jorf_article_links (article_id, jorf_text_id, jorf_article, relation) VALUES (?, ?, '', ?)");
  link.run("A1", "T_TWO", "modifie"); link.run("A2", "T_TWO", "cree");
  link.run("A1", "T_ONE", "modifie");
  link.run("A1", "T_UNFETCHED", "modifie"); link.run("A2", "T_UNFETCHED", "modifie");
  link.run("A1", "T_CITED", "cite"); link.run("A2", "T_CITED", "cite");
  for (const d of ["D1", "D2", "D3"]) db.prepare("INSERT INTO jorf_decision_links (decision_id, jorf_text_id) VALUES (?, 'T_JURI')").run(d);
  const expected = ["T_JURI", "T_TWO"];
  assert.deepEqual(EL.indexableJorfTexts().map((t) => t.id).sort(), expected);
  for (const id of ["T_TWO", "T_ONE", "T_UNFETCHED", "T_CITED", "T_JURI"]) assert.equal(EL.jorfIndexable(id), expected.includes(id), `${id}: page and sitemap disagree`);
  // Links to rows this database doesn't carry (production has fewer decisions) never count.
  text.run("T_GHOST", "6", "ghost links", 1);
  link.run("GHOST1", "T_GHOST", "modifie"); link.run("GHOST2", "T_GHOST", "modifie");
  for (const d of ["X1", "X2", "X3"]) db.prepare("INSERT INTO jorf_decision_links (decision_id, jorf_text_id) VALUES (?, 'T_GHOST')").run(d);
  assert.equal(EL.jorfIndexable("T_GHOST"), false);
  assert.equal(J.decisionCountForJorf("T_GHOST"), 0);
  assert.equal(J.decisionCountForJorf("T_JURI"), 3);

  console.log("check-jorf: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
