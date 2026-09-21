// Legal reference normalization self-check, no DB: npx tsx scripts/check-legal-refs.ts
import assert from "node:assert/strict";
import { appliesOldCivilLaw, displayNum, normalizeNum, parseRefs } from "../src/lib/legal-refs";

// Numbers
for (const [raw, want] of [
  ["L. 3123-6", "L3123-6"], ["L3123-6", "L3123-6"], ["L 3123 6", "L3123-6"], ["L.3123-6", "L3123-6"],
  ["R.* 151-20", "R*151-20"], ["R. 151-20-1", "R151-20-1"], ["1643", "1643"], ["25-8", "25-8"], ["l. 1221-1", "L1221-1"],
]) assert.equal(normalizeNum(raw), want, raw);
assert.equal(displayNum("L1234-5"), "L. 1234-5");
assert.equal(displayNum("1643"), "1643");

const one = (text: string, date?: string) => parseRefs(text, date).map((r) => `${r.code}:${r.num}:${r.status}`);

// The same entity, written five ways.
for (const t of ["article 1643 du code civil", "art. 1643 C. civ.", "l'article 1643 du Code civil", "1643 C. civ."]) {
  assert.deepEqual(one(t), ["code-civil:1643:resolved"], t);
}
// "1643 cc": matched, but below the link threshold (lower confidence).
const cc = parseRefs("voir 1643 cc");
assert.equal(cc.length, 1);
assert.equal(cc[0].code, "code-civil");
assert.ok(cc[0].confidence < 0.9, "cc is too ambiguous to link automatically");

for (const t of ["L. 3123-6 du code du travail", "article L.3123-6 du Code du travail", "art. L 3123 6 C. trav."]) {
  assert.deepEqual(one(t.startsWith("L.") ? `article ${t}` : t), ["code-du-travail:L3123-6:resolved"], t);
}

// Lists, several codes, laws
assert.deepEqual(one("Vu les articles L. 1221-1 et L. 1235-3-1 du code du travail ;"), ["code-du-travail:L1221-1:resolved", "code-du-travail:L1235-3-1:resolved"]);
assert.deepEqual(one("articles 1103, 1104 et 1193 du code civil"), ["code-civil:1103:resolved", "code-civil:1104:resolved", "code-civil:1193:resolved"]);
assert.deepEqual(one("au visa de l'article 22 de la loi n° 89-462 du 6 juillet 1989"), ["loi-89-462:22:resolved"]);
assert.deepEqual(one("l'article 15 de la loi du 6 juillet 1989"), ["loi-89-462:15:resolved"]);
assert.deepEqual(one("l'article L. 221-24 du code de la consommation"), ["code-consommation:L221-24:resolved"]);
assert.deepEqual(one("article L. 600-1 du code de l'urbanisme"), ["code-urbanisme:L600-1:resolved"]);
assert.deepEqual(one("article L. 242-1 du code des assurances"), ["code-assurances:L242-1:resolved"]);

// "du même code" → last named code
assert.deepEqual(
  one("Vu l'article L. 1235-3 du code du travail et l'article L. 1235-4 du même code"),
  ["code-du-travail:L1235-3:resolved", "code-du-travail:L1235-4:resolved"],
);

// Historical wording: never today's article.
for (const t of [
  "l'article 1134 du code civil, dans sa rédaction antérieure à l'ordonnance n° 2016-131",
  "l'ancien article 1147 du code civil",
  "l'article L. 122-14-3 du code du travail, alors applicable",
  "l'article 1382 du code civil, devenu l'article 1240",
  "l'article 1147 du code civil, applicable à l'époque",
]) {
  const r = parseRefs(t);
  assert.ok(r.length >= 1 && r[0].status === "historical", `${t} → ${r[0]?.status}`);
}
// A specific version: flagged, the caller decides with dates.
assert.equal(parseRefs("l'article L. 1235-3 du code du travail, dans sa rédaction issue de l'ordonnance n° 2017-1387")[0].status, "versioned");

// Renumbering by date: a 2015 decision citing civil code 1134 or a 2005 one citing the labour code are historical.
assert.equal(parseRefs("article 1134 du code civil", "2015-03-02")[0].status, "historical");
assert.equal(parseRefs("article 1134 du code civil", "2019-03-02")[0].status, "resolved");
assert.equal(parseRefs("article 2224 du code civil", "2012-01-01")[0].status, "resolved", "outside the reformed range");
assert.equal(parseRefs("article L. 122-14 du code du travail", "2005-01-01")[0].status, "historical");

// No code: kept, never linked.
assert.deepEqual(one("en application de l'article 700"), ["null:700:no_code"]);

// Numeric false positives: amounts, dates, case numbers are not articles.
for (const t of ["la somme de 1 643 euros", "le 12 mars 2019", "pourvoi n° 23-20.428", "10 % du loyer", "1643 euros", "au 1er janvier 2020"]) {
  assert.deepEqual(one(t), [], t);
}

// "1er", subdivisions between the number and the code, codes Loilà does not carry, operative clauses.
assert.deepEqual(one("l'article 1er de la loi du 6 juillet 1989"), ["loi-89-462:1:resolved"]);
assert.deepEqual(one("l'article L. 1235-3, alinéa 2, du code du travail"), ["code-du-travail:L1235-3:resolved"]);
assert.deepEqual(one("l'article L. 411-1, I, 1°, du code de la sécurité sociale"), ["code-securite-sociale:L411-1:resolved"]);
assert.deepEqual(one("l'article 1240, dernier alinéa, du code civil"), ["code-civil:1240:resolved"]);
assert.deepEqual(one("l'article 700 du code de procédure civile"), ["~code-procedure-civile:700:code_not_carried"]);
assert.deepEqual(one("l'article L. 761-1 du code de justice administrative"), ["~code-justice-administrative:L761-1:code_not_carried"]);
assert.deepEqual(one("Article 1er : La requête de M. X... est rejetée."), []);
assert.deepEqual(one("l'article 700 du code de procédure civile et l'article 1240 du code civil"), ["~code-procedure-civile:700:code_not_carried", "code-civil:1240:resolved"]);

// "dans leur rédaction antérieure" (plural), and the decision-level old civil law regime.
assert.equal(parseRefs("les articles 1134 et 1147 du code civil, dans leur rédaction antérieure à l'ordonnance n° 2016-131")[0].status, "historical");
{
  const t1 = "Vu les articles 1134 et 1240 du code civil ;";
  assert.equal(appliesOldCivilLaw(t1, parseRefs(t1, "2019-01-01")), true, "1134 is an old-law landmark");
  const t2 = "Vu les articles 1240 et 1103 du code civil ;";
  assert.equal(appliesOldCivilLaw(t2, parseRefs(t2, "2019-01-01")), false, "only today's numbers");
  const t3 = "Vu l'article 1240 du code civil ; le contrat, soumis au droit antérieur à l'ordonnance n° 2016-131";
  assert.equal(appliesOldCivilLaw(t3, parseRefs(t3, "2019-01-01")), true, "old regime stated in the text");
}

// Provenance data is present.
const r = parseRefs("Vu l'article 1231-6 du code civil ;")[0];
assert.ok(r.raw.includes("1231-6") && r.context.includes("Vu l'article") && r.method === "code_name" && r.confidence >= 0.9);

console.log("check-legal-refs: OK");
