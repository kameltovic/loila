// npx tsx scripts/check-search.ts — asserts known articles surface in the top 5.
import assert from "node:assert/strict";
import { getArticleByNum, searchArticles, toFtsQuery } from "../src/lib/search";

assert.equal(toFtsQuery(`le "NEAR(" AND *) ^:`), `"near"* OR "and"`);
assert.deepEqual(searchArticles(`" * ( ) : ^ -`), []);

const cases: [string, string, string][] = [
  ["rupture conventionnelle", "code-du-travail", "L1237-19"],
  ["dépôt de garantie restitution", "loi-89-462", "22"],
  ["permis de construire extension 20 m2", "code-urbanisme", "R421-14"],
];
let failed = 0;
for (const [q, code, num] of cases) {
  const target = getArticleByNum(code, num);
  assert.ok(target, `${code} ${num} missing from DB`);
  const hits = searchArticles(q, { codes: [code], limit: 5 });
  const ok = hits.some((h) => h.id === target.id);
  console.log(`${ok ? "PASS" : "FAIL"} "${q}" -> ${hits.map((h) => h.num).join(", ")} (want ${num})`);
  if (!ok) failed++;
}
assert.equal(failed, 0, `${failed} search check(s) failed`);
