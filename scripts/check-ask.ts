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

  console.log("check-ask: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
