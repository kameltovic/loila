// Retrieval benchmark on the real DB (read-only).
//   DATABASE_PATH=./data/loila.db npx tsx --env-file=.env scripts/check-retrieval.ts [--expand] [-v]
// --expand calls the production expander for questions missing from scripts/retrieval-expansions.json
// (cheap model, ~$0.0002 each); without it, the cached expansions are used and nothing touches the network.
// Expected articles come from the law (what decides the case), not from what retrieve() returns.
import fs from "node:fs";
import path from "node:path";
import { buildContext, expandQuery, isAnnex, normalize, retrieve } from "../src/lib/ask";
import { getDb } from "../src/lib/db";
import { THEMES } from "../src/lib/themes";

type Case = { id: string; theme: string; q: string; expect: string[]; passage: [num: string, phrase: string] };

const L = "logement", T = "travail";
const wizard = JSON.parse(fs.readFileSync(path.join(__dirname, "wizard-cases.json"), "utf8")) as { id: string; story: string }[];
const story = (id: string) => wizard.find((c) => c.id === id)!.story;
// hs-01 (off-topic) and hs-02 (ambiguous, no retrievable answer before clarification) are skipped.
const CASES: Case[] = [
  { id: "dg-01-classique", theme: L, q: story("dg-01-classique"), expect: ["22"], passage: ["22", "délai maximal d'un mois à compter de la remise des clés"] },
  { id: "dg-02-retenues-meuble", theme: L, q: story("dg-02-retenues-meuble"), expect: ["22", "25-6", "7"], passage: ["7", "dégradations et pertes"] },
  { id: "dg-03-copro", theme: L, q: story("dg-03-copro"), expect: ["22"], passage: ["22", "arrêté annuel des comptes"] },
  { id: "dg-04-pas-dinfo", theme: L, q: story("dg-04-pas-dinfo"), expect: ["22"], passage: ["22", "délai maximal de deux mois"] },
  { id: "dg-05-pas-edl", theme: L, q: story("dg-05-pas-edl"), expect: ["3-2", "7", "22"], passage: ["3-2", "fait obstacle"] },
  { id: "dg-06-montant-trop-eleve", theme: L, q: story("dg-06-montant-trop-eleve"), expect: ["22"], passage: ["22", "un mois de loyer en principal"] },
  { id: "dg-07-avocat-litige-complexe", theme: L, q: story("dg-07-avocat-litige-complexe"), expect: ["22", "7"], passage: ["7", "dégradations et pertes"] },
  { id: "pr-01-zone-tendue", theme: L, q: story("pr-01-zone-tendue"), expect: ["15"], passage: ["15", "Sur les territoires mentionnés au premier alinéa du I de l'article 17"] },
  { id: "pr-02-mutation", theme: L, q: story("pr-02-mutation"), expect: ["15"], passage: ["15", "de mutation"] },
  { id: "pr-03-meuble", theme: L, q: story("pr-03-meuble"), expect: ["25-8", "15"], passage: ["25-8", "préavis d'un mois"] },
  { id: "pr-04-conge-bailleur-vente", theme: L, q: story("pr-04-conge-bailleur-vente"), expect: ["15"], passage: ["15", "soixante-cinq ans"] },
  { id: "pr-05-flou", theme: L, q: story("pr-05-flou"), expect: ["15"], passage: ["15", "le délai de préavis applicable au congé est de trois mois"] },
  { id: "pr-06-sante", theme: L, q: story("pr-06-sante"), expect: ["15"], passage: ["15", "état de santé, constaté par un certificat médical"] },
  { id: "tr-01-rupture-conv-delais", theme: T, q: story("tr-01-rupture-conv-delais"), expect: ["L1237-13", "L1237-14"], passage: ["L1237-13", "quinze jours"] },
  { id: "tr-02-licenciement-faute-grave", theme: T, q: story("tr-02-licenciement-faute-grave"), expect: ["L1232-2", "L1234-1", "L1234-9", "L1235-2"], passage: ["L1232-2", "convoque"] },
  { id: "tr-03-preavis-licenciement", theme: T, q: story("tr-03-preavis-licenciement"), expect: ["L1234-1", "L1234-9", "R1234-2"], passage: ["L1234-1", "deux mois"] },
  { id: "tr-04-rupture-refus", theme: T, q: story("tr-04-rupture-refus"), expect: ["L1237-11"], passage: ["L1237-11", "ne peut être imposée"] },
  { id: "tr-05-salarie-protege-harcelement", theme: T, q: story("tr-05-salarie-protege-harcelement"), expect: ["L1237-15", "L1152-1", "L1152-2"], passage: ["L1237-15", "autorisation"] },
  // FAQ-style questions, as typed on the site.
  { id: "faq-depot-delai", theme: L, q: "Combien de temps le propriétaire a-t-il pour rendre le dépôt de garantie ?", expect: ["22"], passage: ["22", "délai maximal d'un mois à compter de la remise des clés"] },
  { id: "faq-preavis-meuble", theme: L, q: "Quel est le préavis pour quitter un logement meublé ?", expect: ["25-8"], passage: ["25-8", "préavis d'un mois"] },
  { id: "faq-preavis-ehpad", theme: L, q: "Mon père part en maison de retraite, quel préavis pour résilier son bail ?", expect: ["15"], passage: ["15", "état de santé, constaté par un certificat médical"] },
  { id: "faq-preavis-rsa", theme: L, q: "Je touche le RSA, ai-je droit à un préavis réduit pour quitter mon appartement ?", expect: ["15"], passage: ["15", "revenu de solidarité active"] },
  { id: "faq-hausse-loyer", theme: L, q: "Mon propriétaire peut-il augmenter le loyer en cours de bail ?", expect: ["17-1"], passage: ["17-1", "révision"] },
  { id: "faq-conges", theme: T, q: "Combien de jours de congés payés par mois travaillé ?", expect: ["L3141-3"], passage: ["L3141-3", "deux jours et demi"] },
  { id: "faq-essai-cadre", theme: T, q: "Quelle est la durée maximale de la période d'essai d'un cadre en CDI ?", expect: ["L1221-19"], passage: ["L1221-19", "quatre mois"] },
  { id: "faq-extension", theme: "urbanisme", q: "Faut-il un permis de construire pour une extension de 30 m2 ?", expect: ["R421-14"], passage: ["R421-14", "vingt mètres carrés"] },
];

const CACHE = path.join(__dirname, "retrieval-expansions.json");
const verbose = process.argv.includes("-v");

async function main() {
  const cache: Record<string, { words: string; nums: string[] }> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const db = getDb();
  let calls = 0, annexes = 0, anyHit = 0, recall = 0, passages = 0, ctxChars = 0, maxCtx = 0;
  for (const c of CASES) {
    const codes = [...THEMES.find((t) => t.slug === c.theme)!.codes];
    const [pnum, phrase] = c.passage;
    const full = db.prepare("SELECT texte FROM articles WHERE code IN (" + codes.map(() => "?").join(",") + ") AND num = ?").get(...codes, pnum) as { texte: string } | undefined;
    if (!full || !normalize(full.texte).includes(normalize(phrase))) throw new Error(`${c.id}: phrase not in art. ${pnum}`);
    const key = `${c.theme}|${c.q}`;
    if (!cache[key]) {
      if (!process.argv.includes("--expand")) throw new Error(`${c.id}: no cached expansion, rerun with --expand`);
      cache[key] = await expandQuery(c.q, codes);
      calls++;
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1) + "\n");
    }
    const { words, found } = await retrieve(c.q, codes, cache[key]);
    const nums = found.map((a) => a.num);
    annexes += found.filter(isAnnex).length;
    const hits = c.expect.filter((n) => nums.includes(n));
    const ctx = buildContext(found, c.q, words);
    // The phrase must be in the key article's own block, not anywhere in the prompt.
    const block = ctx.split(/\n\n(?=### )/).find((b) => b.split("\n")[0].includes(` — article ${pnum}`) && new RegExp(` — article ${pnum}( —|$)`).test(b.split("\n")[0])) ?? "";
    const ok = normalize(block).includes(normalize(phrase));
    if (process.argv.includes("--show") && !ok) console.log(block.slice(0, 6000));
    anyHit += +!!hits.length; recall += hits.length / c.expect.length; passages += +ok; ctxChars += ctx.length; maxCtx = Math.max(maxCtx, ctx.length);
    console.log(`${c.id.padEnd(34)} key ${hits.length}/${c.expect.length} passage ${ok ? "yes" : "NO "} ctx ${ctx.length}${verbose ? `  [${nums.join(", ")}]` : ""}`);
  }
  const n = CASES.length;
  console.log(`\n${n} cases · any key@8 ${anyHit}/${n} · recall@8 ${(recall / n * 100).toFixed(0)}% · decisive passage in prompt ${passages}/${n} · annex slots ${annexes} · context chars avg ${Math.round(ctxChars / n)} max ${maxCtx} · expand calls ${calls}`);
}

main();
