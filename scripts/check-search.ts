// npx tsx scripts/check-search.ts — asserts known articles surface in the top 5.
import assert from "node:assert/strict";
import { getArticleByNum, mentionedConventions, searchArticles, toFtsQuery } from "../src/lib/search";
import { THEMES } from "../src/lib/themes";

assert.equal(toFtsQuery(`le "NEAR(" AND *) ^:`), `"near"* OR "and"`);
assert.deepEqual(searchArticles(`" * ( ) : ^ -`), []);

assert.deepEqual(mentionedConventions("préavis Syntec"), ["ccn-1486"]);
assert.deepEqual(mentionedConventions("IDCC 16 transport"), ["ccn-0016"]);
assert.deepEqual(mentionedConventions("permis de construire 20 m2"), []);

const ccn = [...THEMES.find((t) => t.slug === "conventions")!.codes];
// [query, expected code, expected num, search scope]
const cases: [string, string, string, string[]?][] = [
  ["rupture conventionnelle", "code-du-travail", "L1237-19"],
  ["dépôt de garantie restitution", "loi-89-462", "22"],
  ["permis de construire extension 20 m2", "code-urbanisme", "R421-14"],
  ["Quel préavis de démission en Syntec ?", "ccn-1486", "4.2", ccn],
  ["période d'essai IDCC 1979", "ccn-1979", "13", ccn],
  ["élagage arbres voisin distance plantation", "code-civil", "671"],
  ["congé de naissance paternité jours", "code-du-travail", "L1225-35"],
  ["obligation de débroussaillement autour des constructions", "code-forestier", "L134-6"],
  ["droit de rétractation quatorze jours contrat à distance", "code-consommation", "L221-18"],
];
let failed = 0;
for (const [q, code, num, scope] of cases) {
  assert.ok(getArticleByNum(code, num), `${code} ${num} missing from DB`);
  const hits = searchArticles(q, { codes: scope ?? [code], limit: 5 });
  const ok = hits.some((h) => h.code === code && h.num === num); // CCN nums repeat across attached texts
  console.log(`${ok ? "PASS" : "FAIL"} "${q}" -> ${hits.map((h) => h.num).join(", ")} (want ${num})`);
  if (!ok) failed++;
}
assert.equal(failed, 0, `${failed} search check(s) failed`);
