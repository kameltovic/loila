// Cascade self-check, no network: npx tsx scripts/check-ask.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-ask-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // must be set before db.ts is imported

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { ask, AskValidationError } = await import("../src/lib/ask");
  const db = getDb();

  db.prepare("INSERT INTO articles (id, code, num, section, texte, url) VALUES (?, ?, ?, ?, ?, ?)").run(
    "LEGIARTI1", "loi-89-462", "15", null,
    "Lorsqu'il émane du locataire, le délai de préavis applicable au congé est de trois mois pour un logement vide.",
    "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI1",
  );
  db.prepare("INSERT INTO faq (theme, slug, question, short, answer_md, article_ids) VALUES (?, ?, ?, ?, ?, ?)").run(
    "travail", "conges-payes", "Combien de jours de congés payés par an ?", "2,5 jours par mois.", "**30 jours ouvrables**.", "[]",
  );

  let llmCalls = 0;
  const fakeLlm = async () => {
    llmCalls++;
    return { content: "Trois mois (art. 15).", model: "fake" };
  };

  const faq = await ask("combien de jours de conges payes par an", "travail", fakeLlm);
  assert.equal(faq.source, "faq");
  assert.equal(faq.faq?.slug, "conges-payes");
  assert.equal(llmCalls, 0);

  const q = "Quel délai de préavis pour un logement vide ?";
  const first = await ask(q, "logement", fakeLlm);
  assert.equal(first.source, "llm");
  assert.deepEqual(first.articles.map((a) => a.id), ["LEGIARTI1"]);
  assert.equal(llmCalls, 1);

  const second = await ask("quel DELAI de preavis pour un logement vide", "logement", fakeLlm);
  assert.equal(second.source, "cache");
  assert.equal(second.answer_md, first.answer_md);
  assert.equal(llmCalls, 1);
  assert.equal((db.prepare("SELECT hits FROM qa_cache").get() as { hits: number }).hits, 2);

  const none = await ask("xylophone zébulon", "logement", fakeLlm);
  assert.equal(none.source, "none");
  assert.equal(llmCalls, 1);

  await assert.rejects(ask("  a ", undefined, fakeLlm), AskValidationError);
  await assert.rejects(ask("x".repeat(501), undefined, fakeLlm), AskValidationError);

  // Annexes (model conventions, "Annexes > …" sections) rank after the law, even with better keyword coverage;
  // collective-agreement annexes are normative and stay put. Rows shaped like the real DB ones.
  const { retrieve, excerpt, excerptBudgets, isAnnex, normalize } = await import("../src/lib/ask");
  const insert = db.prepare("INSERT INTO articles (id, code, num, section, texte, url) VALUES (?, ?, ?, ?, ?, 'u')");
  insert.run("LEGIARTI2", "code-construction-habitation", "Annexe III à l'article D353-200",
    "Annexes > Convention conclue en application des articles L. 353-1, L. 831-1 (3) et R. 353-200 du code de la construction et de l'habitation entre l'Etat et les bailleurs de logements.",
    "Article 8. Le bailleur s'engage à ce que le locataire puisse donner congé du logement à tout moment, sous réserve d'un délai de préavis de trois mois.");
  const { found } = await retrieve("délai de préavis du congé du locataire, logement du bailleur", ["loi-89-462", "code-construction-habitation"], { words: "", nums: [] });
  assert.deepEqual(found.map((a) => a.id), ["LEGIARTI1", "LEGIARTI2"]);
  assert.equal(isAnnex({ code: "code-securite-sociale", num: "Annexe", section: "ANNEXES > Tableau" }), true);
  assert.equal(isAnnex({ code: "ccn-1486", num: "", section: "Annexe III. Grille des rémunérations minimales brutes" }), false);
  assert.equal(isAnnex({ code: "loi-89-462", num: "15", section: "Titre Ier > Chapitre II" }), false);

  // Long article (art. 15 loi 89-462 structure): the 1-month list under a matching intro survives the cut
  // even though "état de santé" shares no word with the question; the long head is shortened; gaps are marked.
  const art15 = [
    "I. - Lorsque le bailleur donne congé à son locataire, ce congé doit être justifié soit par sa décision de reprendre ou de vendre le logement, soit par un motif légitime et sérieux. " + "Le congé donné par le bailleur doit indiquer le motif allégué et le bénéficiaire de la reprise. ".repeat(10),
    ...Array.from({ length: 12 }, (_, i) => `Alinéa ${i} sur la vente du logement : le congé pour vente vaut offre de vente au profit du locataire pendant deux mois, à peine de nullité, au prix et aux conditions de la vente projetée.`),
    "Lorsqu'il émane du locataire, le délai de préavis applicable au congé est de trois mois.",
    "Le délai de préavis est toutefois d'un mois :",
    "1° Sur les territoires mentionnés au premier alinéa du I de l'article 17 ;",
    "2° En cas d'obtention d'un premier emploi, de mutation, de perte d'emploi ou de nouvel emploi consécutif à une perte d'emploi ;",
    "3° Pour le locataire dont l'état de santé, constaté par un certificat médical, justifie un changement de domicile ;",
    "4° Pour les bénéficiaires du revenu de solidarité active ou de l'allocation adulte handicapé ;",
    ...Array.from({ length: 12 }, (_, i) => `III-${i}. Le bailleur ne peut s'opposer au renouvellement du contrat à l'égard de tout locataire âgé de plus de soixante-cinq ans dont les ressources annuelles sont inférieures à un plafond.`),
  ].join("\n\n");
  const kw = new Set(normalize("Mon père est entré en EHPAD, quel délai de préavis pour résilier son bail ? préavis réduit").split(" "));
  const cut = excerpt(art15, kw, 1500);
  assert.ok(cut.length <= 1500, `excerpt too long: ${cut.length}`);
  assert.ok(cut.includes("3° Pour le locataire dont l'état de santé"), cut);
  assert.ok(cut.includes("Le délai de préavis est toutefois d'un mois :"));
  assert.ok(cut.startsWith("I. - Lorsque le bailleur donne congé") && cut.includes("[…]"));
  assert.equal(excerpt("court", kw, 1500), "court");

  // Prompt budget: short articles whole, long ones share the rest, the top-ranked one gets more than the tail.
  const b = excerptBudgets([12_000, 800, 9_000, 9_000, 9_000, 9_000, 9_000, 9_000]);
  assert.equal(b[1], 800);
  assert.ok(b[0] > b[7] && b.reduce((x, y) => x + y) <= 16_000, String(b));

  // Admin cache purge: only answers citing a long article go, after a JSON backup.
  const { countCacheCitingLong, purgeCacheCitingLong } = await import("../src/lib/ask");
  const cacheRow = db.prepare("INSERT INTO qa_cache (hash, question, answer_md, article_ids, model) VALUES (?, ?, 'a', ?, 'm')");
  const longId = "PURGE-LONG", shortId = "PURGE-SHORT";
  db.prepare("INSERT INTO articles (id, code, num, texte, url) VALUES (?, 'loi-89-462', 'p1', ?, 'u'), (?, 'loi-89-462', 'p2', 'court', 'u')").run(longId, "x ".repeat(1300), shortId);
  db.prepare("DELETE FROM qa_cache").run();
  cacheRow.run("h-long", "q1", JSON.stringify([shortId, longId]));
  cacheRow.run("h-short", "q2", JSON.stringify([shortId]));
  assert.equal(countCacheCitingLong(), 1);
  const purge = purgeCacheCitingLong();
  assert.equal(purge.deleted, 1);
  assert.deepEqual((JSON.parse(fs.readFileSync(purge.backup!, "utf8")) as { hash: string }[]).map((r) => r.hash), ["h-long"]);
  assert.deepEqual(db.prepare("SELECT hash FROM qa_cache").all(), [{ hash: "h-short" }]);
  assert.deepEqual(purgeCacheCitingLong(), { deleted: 0, backup: null });

  // Content bundles: upserts once per hash, FTS stays in sync, a changed bundle re-applies.
  const { importContent } = await import("../src/lib/db");
  const { gzipSync } = await import("node:zlib");
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-content-"));
  const bundle = (texte: string, short: string) =>
    fs.writeFileSync(path.join(bundleDir, "test.json.gz"), gzipSync(JSON.stringify({
      articles: [{ id: "BUNDLE-1", code: "decret-67-223", num: "9", section: null, texte, date_debut: null, url: "u" }],
      faq: [{ theme: "sujets", topic: "organiser-ag", slug: "bundle-delai-convocation", emoji: null, question: "Quel délai pour convoquer l'AG ?", short, answer_md: "x", article_ids: ["BUNDLE-1"] }],
    })));
  bundle("La convocation est notifiée au moins vingt et un jours avant la date de la réunion zorblax.", "21 jours.");
  importContent(db, bundleDir);
  importContent(db, bundleDir); // same hash: no-op
  assert.equal((db.prepare("SELECT COUNT(*) n FROM articles_fts WHERE articles_fts MATCH 'zorblax'").get() as { n: number }).n, 1);
  assert.equal((db.prepare("SELECT article_ids FROM faq WHERE slug = 'bundle-delai-convocation'").get() as { article_ids: string }).article_ids, '["BUNDLE-1"]');
  bundle("Texte modifié quuxwort.", "Vingt et un jours.");
  importContent(db, bundleDir);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM articles_fts WHERE articles_fts MATCH 'zorblax'").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM articles_fts WHERE articles_fts MATCH 'quuxwort'").get() as { n: number }).n, 1);
  assert.equal((db.prepare("SELECT short FROM faq WHERE slug = 'bundle-delai-convocation'").get() as { short: string }).short, "Vingt et un jours.");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM faq WHERE slug = 'bundle-delai-convocation'").get() as { n: number }).n, 1);
  fs.writeFileSync(path.join(bundleDir, "test.json.gz"), gzipSync(JSON.stringify({ deleteArticleIds: ["BUNDLE-1", "NOT-THERE"] })));
  importContent(db, bundleDir);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM articles WHERE id = 'BUNDLE-1'").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM articles_fts WHERE articles_fts MATCH 'quuxwort'").get() as { n: number }).n, 0);

  console.log("check-ask: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
