// Article pages self-check, no network: npx tsx scripts/check-articles.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-articles-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // must be set before db.ts is imported

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { articlePath, articleSummary, articleTopic, linkRefs, texteSha } = await import("../src/lib/articles");
  const db = getDb();
  const art = db.prepare("INSERT INTO articles (id, code, num, section, texte, date_debut, url) VALUES (?, ?, ?, NULL, ?, NULL, '')");
  const texte = "Voir les articles L. 1234-9 et L.1234-20, ainsi que l'article R. 9999-1 et l'article 22.";
  art.run("A", "code-du-travail", "L1234-1", texte);
  art.run("B", "code-du-travail", "L1234-9", "…");
  art.run("C", "code-du-travail", "L1234-20", "…");
  art.run("D", "code-civil", "R9999-1", "…"); // other code: never linked
  art.run("E1", "ccn-1486", "7", "…"); // number shared inside a convention
  art.run("E2", "ccn-1486", "7", "…");
  db.prepare("UPDATE articles SET num_norm = num").run();

  // Only same-code articles that exist become links; the text is kept intact.
  const parts = linkRefs(texte, { id: "A", code: "code-du-travail" });
  assert.deepEqual(parts.filter((p) => p.id).map((p) => [p.text, p.id, p.path]), [["L. 1234-9", "B", "/article/code-du-travail/L1234-9"], ["L.1234-20", "C", "/article/code-du-travail/L1234-20"]]);
  assert.equal(parts.map((p) => p.text).join(""), texte);
  assert.deepEqual(linkRefs("Aucun renvoi.", { id: "A", code: "code-du-travail" }), [{ text: "Aucun renvoi." }]);

  // A summary is shown only while the official text is unchanged.
  db.prepare("INSERT INTO article_summaries (article_id, texte_sha, summary, points, model) VALUES ('A', ?, 'Résumé.', '[\"Point\"]', 'test')").run(texteSha(texte));
  assert.deepEqual(articleSummary({ id: "A", texte }), { summary: "Résumé.", points: ["Point"] });
  assert.equal(articleSummary({ id: "A", texte: `${texte} Modifié.` }), undefined);
  assert.equal(articleSummary({ id: "B", texte: "…" }), undefined);

  // Readable URL unless the number is shared inside its code (then the Légifrance id).
  assert.equal(articlePath({ id: "B", code: "code-du-travail", num: "L1234-9" }), "/article/code-du-travail/L1234-9");
  assert.equal(articlePath({ id: "E1", code: "ccn-1486", num: "7" }), "/article/E1");

  // Title topic: deepest meaningful section heading, trimmed on a word boundary.
  const sec = "Titre VI : De la vente > Section 3 : De la garantie. > Paragraphe 2 : De la garantie des défauts de la chose vendue.";
  assert.equal(articleTopic(sec, 60), "Garantie des défauts de la chose vendue");
  assert.equal(articleTopic(sec, 25), "Garantie des défauts");
  assert.equal(articleTopic("Chapitre Ier : Du cautionnement > Section 2 : De la formation et de l'étendue du cautionnement", 40), "Formation et étendue du cautionnement");
  assert.equal(articleTopic("Titre II : Des baux > Chapitre 1 : Dispositions générales", 40), "Baux");
  assert.equal(articleTopic(null, 40), undefined);

  console.log("check-articles: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
