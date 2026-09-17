/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const -- throwaway evaluation script (docs/wizard-eval.md) */
// Wizard prototype + evaluation. Not product code.
//   npx tsx --env-file=.env scripts/wizard-proto.ts [caseId ...]
// Reads a COPY of the DB (DATABASE_PATH=./data/loila.db). Writes docs/wizard-results.json.
import fs from "node:fs";
import { excerpt, normalize, retrieve } from "../src/lib/ask";
import type { Article } from "../src/lib/db";
import { chat, type ChatMessage } from "../src/lib/openrouter";
import { getArticleByNum } from "../src/lib/search";
import { CODES, THEMES } from "../src/lib/themes";

const DS = "deepseek/deepseek-v4-flash-0731";
const NO_REASONING = { reasoning: { enabled: false } };
const LOW_REASONING = { reasoning: { effort: "low" } };
const HAIKU = "anthropic/claude-haiku-4.5"; // production OPENROUTER_CHAT_MODEL
const USER_SIM: Model = { id: "google/gemini-3.5-flash-lite" }; // same simulated user for every arm
const JUDGE: Model = { id: "google/gemini-3.5-flash", extra: LOW_REASONING }; // third family, judges question grounding
const BUDGET = 2;
const TODAY = "17 septembre 2026";
const MAX_ROUNDS = 2;

type Case = { id: string; topic: string; story: string; hidden_facts: string[]; expect: Record<string, unknown> };
type Call = { step: string; model: string; provider?: string; ms: number; in: number; out: number; reasoning: number; cost: number; strictJson?: boolean; retried?: boolean };

let spent = 0;
const calls: (Call & { arm: string; case: string })[] = [];

type Model = { id: string; extra?: Record<string, unknown> };
async function llm(ctx: { arm: string; case: string }, step: string, m: Model, messages: ChatMessage[], json: boolean, maxTokens: number) {
  const model = m.id;
  if (spent > BUDGET * 0.95) throw new Error(`BUDGET: spent $${spent.toFixed(3)}`);
  const t = Date.now();
  const r = await chat(messages, {
    model, json, maxTokens, temperature: 0, timeoutMs: 180_000,
    // DeepSeek endpoints vary 10x in speed: favour throughput (Haiku/Gemini have first-party providers anyway).
    extra: { provider: { data_collection: "deny", ...(model.startsWith("deepseek/") ? { sort: "throughput" } : {}) }, usage: { include: true }, ...m.extra },
  });
  const u = r.usage as any;
  // BYOK calls (Anthropic key) report cost 0: count the upstream cost instead.
  const cost = u?.cost || u?.cost_details?.upstream_inference_cost || 0;
  spent += cost;
  const c: Call = { step, model, provider: r.provider, ms: Date.now() - t, in: u?.prompt_tokens ?? 0, out: u?.completion_tokens ?? 0, reasoning: u?.completion_tokens_details?.reasoning_tokens ?? 0, cost };
  calls.push(Object.assign(c, ctx));
  return { content: r.content, call: c };
}

function parseJson(s: string): { value: any; strict: boolean } {
  try { return { value: JSON.parse(s), strict: true }; } catch {}
  const m = s.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
  try { return { value: m ? JSON.parse(m[0]) : null, strict: false }; } catch { return { value: null, strict: false }; }
}

async function llmJson(ctx: { arm: string; case: string }, step: string, model: Model, messages: ChatMessage[], maxTokens: number, valid: (v: any) => boolean = () => true) {
  let { content, call } = await llm(ctx, step, model, messages, true, maxTokens);
  let p = parseJson(content);
  call.strictJson = p.strict;
  (call as any).schemaValid = !!p.value && valid(p.value);
  if (!(call as any).schemaValid) {
    ({ content } = await llm(ctx, step + "-retry", model, messages, true, maxTokens));
    p = parseJson(content);
    call.retried = true;
  }
  return p.value;
}

// ---------- prompts ----------
export const ANALYSE_PROMPT = `Tu analyses le récit d'un particulier pour un moteur de recherche de textes de loi français.
Thèmes couverts : "logement" (location d'habitation : bail, dépôt de garantie, préavis, congé), "travail" (contrat de travail, licenciement, rupture conventionnelle, démission).
Réponds UNIQUEMENT avec un objet JSON :
{
  "theme": "logement" | "travail" | "ambigu" | "hors_sujet",
  "facts": ["faits établis par le récit, datés si possible (dates au format JJ/MM/AAAA)"],
  "legal_terms": ["5 à 10 mots ou expressions juridiques tels qu'ils apparaissent dans les textes (ex. dépôt de garantie, état des lieux, délai de préavis, homologation)"],
  "likely_articles": ["numéros d'articles probables, ex. 22, 15, L1237-13 ; vide si incertain"],
  "unknowns": ["faits manquants qui peuvent changer la règle applicable"]
}
"ambigu" : le récit peut relever des deux thèmes. "hors_sujet" : aucun des deux thèmes. N'invente aucun fait.`;

export const QUESTIONS_PROMPT = `Tu prépares des questions de clarification pour un particulier, À PARTIR DES CONDITIONS écrites dans les articles fournis.
Une bonne question porte sur un fait qui fait changer la règle applicable selon un article (ex. logement meublé ou vide ; état des lieux de sortie conforme ou non ; commune en zone tendue ; motif du départ ; ancienneté ; faute grave invoquée).
Règles :
- Ne pose JAMAIS une question dont la réponse est déjà dans le récit, les faits ou les réponses précédentes.
- Chaque question cite l'article qui la motive (numéro exact tel qu'il figure dans les titres fournis) et recopie mot pour mot, dans "condition", le court passage de l'article (10 à 30 mots) qui contient la condition.
- Questions courtes, sans jargon. Propose des choix quand c'est possible ; le dernier choix est toujours "Je ne sais pas". Pour une date, "options" vaut [] et "type" vaut "date".
- Si les faits connus suffisent pour expliquer les règles applicables, renvoie "questions": [] et "enough_info": true.
Réponds UNIQUEMENT avec un objet JSON :
{
  "enough_info": boolean,
  "questions": [
    { "id": "q1", "question": "…", "type": "choice" | "date" | "text", "options": ["…", "Je ne sais pas"], "article": "22", "condition": "passage recopié", "why": "ce que la réponse change" }
  ]
}`;

export const USER_SIM_PROMPT = `Tu joues un particulier qui répond à un questionnaire. Tu connais UNIQUEMENT les faits listés.
Pour chaque question : si les faits permettent de répondre ou de le déduire raisonnablement (ex. « départ le 31 mai » → clés rendues le 31 mai), choisis l'option qui correspond (recopie-la exactement) ou, pour une date/texte, réponds brièvement. Sinon réponds exactement "Je ne sais pas". N'invente rien.
Réponds UNIQUEMENT avec un objet JSON : {"answers": [{"id": "q1", "answer": "…"}]}`;

export const SYNTH_PROMPT = `Tu es Loilà. Tu expliques à un particulier non juriste les règles du droit français qui s'appliquent à une situation comme la sienne.
C'est de l'INFORMATION JURIDIQUE GÉNÉRALE, pas une consultation :
- Ne rends aucun verdict personnel : pas de "vous avez droit à X €", "votre bailleur vous doit", "vous allez gagner", "votre licenciement est abusif". Écris plutôt "dans une situation comme la vôtre, la loi prévoit…", "si … alors …".
- Utilise UNIQUEMENT les articles fournis. N'invente aucun article, délai, montant ou procédure. Si un point n'est pas couvert par ces articles, dis-le.
- Cite les articles par leur numéro exact entre parenthèses, ex. (art. 22) ou (art. L1237-13). Ne cite aucun autre texte.
- Calcule les dates limites quand des dates sont connues (nous sommes le ${TODAY}), en montrant le calcul et la règle, et précise quand une date est incertaine.
- Phrases courtes, pas de jargon (ou explique-le).
Format Markdown :
## En bref (2-3 phrases)
## Les règles qui s'appliquent
## Délais (seulement si pertinent)
## Prochaines étapes
## Quand consulter un professionnel (avocat, ADIL, inspection du travail, commissaire de justice, défenseur syndical… selon le cas ; dis clairement s'il faut le faire maintenant)`;

const JUDGE_PROMPT = `Tu évalues des questions de clarification posées par un assistant juridique. Pour chaque question, avec le récit et le texte des articles :
- "grounded": true si la condition sur laquelle porte la question figure réellement dans l'article cité.
- "outcome_relevant": true si la réponse change effectivement la règle applicable à CE récit (délai, montant plafond, procédure, droit ouvert).
- "already_known": true si la réponse est déjà dans le récit ou les réponses précédentes.
Réponds UNIQUEMENT en JSON : {"judgments": [{"id": "q1", "grounded": bool, "outcome_relevant": bool, "already_known": bool, "note": "≤15 mots"}]}`;

// ---------- pipeline ----------
const codesFor = (theme: string): string[] =>
  theme === "logement" ? [...THEMES[2].codes] : theme === "travail" ? [...THEMES[0].codes] : theme === "ambigu" ? [...THEMES[2].codes, ...THEMES[0].codes] : [];
// ponytail: conventions collectives left out of scope (searchArticles narrows to a named CCN and would drop the Code du travail).

const artTitle = (a: Article) => `${CODES[a.code as keyof typeof CODES]?.name ?? a.code} — article ${a.num}`;
const context = (found: Article[], kw: string, max = 2500) => {
  const keywords = new Set(normalize(kw).split(" ").filter((t) => t.length > 3));
  return found.map((a) => `### ${artTitle(a)}\n${excerpt(a.texte, keywords, max)}`).join("\n\n");
};
const transcript = (story: string, qa: { question: string; answer: string }[]) =>
  `Récit : ${story}` + (qa.length ? `\nRéponses au questionnaire :\n${qa.map((x) => `- ${x.question} → ${x.answer}`).join("\n")}` : "");

async function runWizard(c: Case, arm: string, model: Model) {
  const ctx = { arm, case: c.id };
  const qa: { id: string; question: string; answer: string; article?: string }[] = [];
  const rounds: any[] = [];
  let analysis: any, found: Article[] = [], words = "";
  for (let round = 0; ; round++) {
    analysis = await llmJson(ctx, `analyse${round}`, model, [
      { role: "system", content: ANALYSE_PROMPT },
      { role: "user", content: transcript(c.story, qa) },
    ], 4000, (v) => ["logement", "travail", "ambigu", "hors_sujet"].includes(v.theme) && Array.isArray(v.legal_terms));
    const codes = codesFor(analysis?.theme);
    if (!codes.length) return { analysis, rounds, qa, found: [], offTopic: true };
    const nums = (analysis.likely_articles ?? []).map((n: string) => String(n).replace(/^art(icle)?\.?\s*/i, "").toUpperCase());
    ({ words, found } = await retrieve(`${c.story} ${qa.map((x) => x.answer).join(" ")}`.slice(0, 1000), codes, { words: (analysis.legal_terms ?? []).join(", "), nums }));
    if (round >= MAX_ROUNDS) break;
    const q = await llmJson(ctx, `questions${round}`, model, [
      { role: "system", content: QUESTIONS_PROMPT },
      {
        role: "user",
        content: `Articles :\n\n${context(found, words, 1500)}\n\n${transcript(c.story, qa)}\nFaits retenus : ${JSON.stringify(analysis.facts)}\nInconnues : ${JSON.stringify(analysis.unknowns)}\n` +
          (round ? "C'est le 2e et dernier tour : pose au plus 2 questions, seulement si c'est indispensable." : "Pose 2 à 4 questions au maximum."),
      },
    ], 5000, (v) => Array.isArray(v.questions) && v.questions.every((q: any) => typeof q.question === "string"));
    const questions = (q?.questions ?? []).slice(0, round ? 2 : 4);
    const retrieved = new Map(found.map((a) => [a.num.toUpperCase(), a]));
    rounds.push({ round, retrieved: found.map((a) => `${a.code}:${a.num}`), questions, enough_info: q?.enough_info, retrievedMap: retrieved });
    if (!questions.length) break;
    const ans = await llmJson({ arm, case: c.id }, `user${round}`, USER_SIM, [
      { role: "system", content: USER_SIM_PROMPT },
      { role: "user", content: `Faits connus :\n${c.hidden_facts.map((f) => `- ${f}`).join("\n")}\n\nQuestions :\n${JSON.stringify(questions.map(({ id, question, options }: any) => ({ id, question, options })))}` },
    ], 800);
    for (const qq of questions) qa.push({ id: `r${round}${qq.id}`, question: qq.question, article: qq.article, answer: ans?.answers?.find((a: any) => a.id === qq.id)?.answer ?? "Je ne sais pas" });
  }
  return { analysis, rounds, qa, found, words, offTopic: false };
}

async function synthesize(c: Case, arm: string, model: Model, w: Awaited<ReturnType<typeof runWizard>>) {
  if (w.offTopic) return { md: "", ms: 0 };
  const { content, call } = await llm({ arm, case: c.id }, "synth", model, [
    { role: "system", content: SYNTH_PROMPT },
    { role: "user", content: `Articles :\n\n${context(w.found, w.words ?? "")}\n\n${transcript(c.story, w.qa)}` },
  ], false, 4000);
  return { md: content, ms: call.ms, cost: call.cost };
}

// ---------- automatic checks ----------
const numRe = /\b(?:art(?:icles?|\.)?)\s*((?:[LRD]\.?\s?\*?\d+(?:-\d+)*|\d+(?:-\d+)*)(?:\s*(?:,|et|à)\s*(?:[LRD]\.?\s?\d+(?:-\d+)*|\d+(?:-\d+)*))*)|\b([LRD]\.?\s?\d{3,4}(?:-\d+)+)\b/gi;
export function citedNums(md: string): string[] {
  const out = new Set<string>();
  // "art. L1234-1, 3°": ordinals are paragraphs, not articles.
  for (const m of md.replace(/\b\d+\s?°/g, "").matchAll(numRe)) for (const n of (m[1] ?? m[2]).split(/\s*(?:,|et|à)\s*/)) out.add(n.replace(/[.\s*]/g, "").toUpperCase());
  return [...out].filter(Boolean);
}
export const VERDICT_RES = [
  /vous avez droit à [^.\n]{0,40}\d[\d\s.,]*\s?(?:€|euros)/i,
  /(?:votre|le|la|l'|ton) (?:ancien(?:ne)? )?(?:bailleur|propriétaire|employeur|patron) (?:doit|devra|va devoir) vous (?:verser|rendre|payer|restituer|rembourser) [^.\n]{0,40}\d[\d\s.,]*\s?(?:€|euros)/i,
  /vous (?:allez|obtiendrez|toucherez|recevrez|récupérerez) (?:forcément |bien |donc )?(?:toucher |recevoir |récupérer |obtenir )?[^.\n]{0,30}\d[\d\s.,]*\s?(?:€|euros)/i,
  /vous (?:allez )?gagne(?:rez|r) (?:votre procès|au tribunal|aux prud)/i,
  /votre licenciement est (?:nul|abusif|illégal|sans cause)/i,
  /vous êtes dans votre (?:bon )?droit/i,
  /vous avez droit (?:à|au|aux) (?:une |la |l'|des )?(?:majoration|indemnit|restitution|rembours|dommages)/i,
  /(?:votre|le) (?:bailleur|propriétaire|employeur) est (?:dans son tort|en tort|dans l'illégalité)/i,
];
const verdicts = (md: string) => VERDICT_RES.flatMap((re) => md.match(re)?.[0] ?? []);

const tokenSet = (s: string) => new Set(normalize(s).split(" ").filter((t) => t.length > 2));
function quoteFound(condition: string, a?: Article) {
  if (!a || !condition) return false;
  const q = tokenSet(condition), t = tokenSet(a.texte);
  return q.size > 0 && [...q].filter((x) => t.has(x)).length / q.size >= 0.8;
}

// Cited numbers vs articles given to the synthesis. "Annexe III à l'article D353-200" counts as D353-200.
// A number absent from the given set but quoted inside a given article's text (e.g. "article 1731 du code civil"
// inside art. 3-2) is a relayed reference, not a hallucination.
export function citationCheck(md: string, found: Pick<Article, "num" | "texte">[]) {
  const given = new Set(found.map((a) => a.num.toUpperCase().replace(/^.*ARTICLE\s+/, "")));
  const texts = normalize(found.map((a) => a.texte).join(" "));
  const squashed = texts.replace(/ /g, "");
  const cited = citedNums(md);
  const citedNotRetrieved = cited.filter((n) => !given.has(n));
  const relayed = citedNotRetrieved.filter((n) =>
    /^\d+$/.test(n) ? new RegExp(`\\barticles? ${n}\\b`).test(texts) : squashed.includes(normalize(n).replace(/ /g, "")));
  const hallucinated = citedNotRetrieved.filter((n) => !relayed.includes(n));
  return {
    cited, citedNotRetrieved, relayed, hallucinated,
    nonexistent: hallucinated.filter((n) => !Object.keys(CODES).some((code) => getArticleByNum(code, n))),
    verdicts: verdicts(md),
  };
}

async function judge(c: Case, arm: string, round: any, qaBefore: string) {
  if (!round.questions.length) return [];
  const arts = [...new Set(round.questions.map((q: any) => String(q.article ?? "").toUpperCase()))]
    .map((n) => round.retrievedMap.get(n)).filter(Boolean) as Article[];
  const v = await llmJson({ arm, case: c.id }, "judge", JUDGE, [
    { role: "system", content: JUDGE_PROMPT },
    { role: "user", content: `${qaBefore}\n\nArticles cités :\n\n${context(arts, round.questions.map((q: any) => q.condition).join(" "), 2500) || "(aucun article cité n'a été retrouvé)"}\n\nQuestions :\n${JSON.stringify(round.questions.map(({ id, question, options, article, condition }: any) => ({ id, question, options, article, condition })))}` },
  ], 1500);
  return v?.judgments ?? [];
}

// ---------- main ----------
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()!); }));
}

async function main() {
  const only = process.argv.slice(2);
  const cases = (JSON.parse(fs.readFileSync("scripts/wizard-cases.json", "utf8")) as Case[]).filter((c) => !only.length || only.includes(c.id));
  const models: Record<string, Model> = { ds: { id: DS }, dsfast: { id: DS, extra: NO_REASONING }, haiku: { id: HAIKU } };
  // Wizard arm -> synthesis models run on its transcript (reasoning DS only synthesizes its own transcript, to save time).
  const plan: Record<string, string[]> = { ds: ["ds"], dsfast: ["dsfast", "haiku"], haiku: ["haiku", "dsfast"] };
  const prev = fs.existsSync("docs/wizard-results.json") && process.argv.includes("--resume") ? JSON.parse(fs.readFileSync("docs/wizard-results.json", "utf8")) : null;
  if (prev) { spent = prev.spent; calls.push(...prev.calls); }
  const results: any[] = prev ? prev.results.filter((r: any) => !r.error) : [];
  const todo = cases.flatMap((c) => Object.keys(plan).map((arm) => ({ c, arm, model: models[arm] }))).filter(({ c, arm }) => !results.some((r) => r.case === c.id && r.arm === arm));
  await pool(todo, 8, async ({ c, arm, model }) => {
    const t = Date.now();
    try {
      const w = await runWizard(c, arm, model);
      const wizardMs = Date.now() - t;
      const synth: Record<string, any> = {};
      for (const sArm of plan[arm]) {
        const sModel = models[sArm];
        const s = await synthesize(c, `${arm}>${sArm}`, sModel, w);
        synth[sArm] = { model: sModel.id, md: s.md, ms: s.ms, ...citationCheck(s.md, w.found) };
      }
      const judged = [];
      let qaSoFar: { question: string; answer: string }[] = [];
      for (const r of w.rounds) {
        const j = await judge(c, arm, r, transcript(c.story, qaSoFar));
        for (const q of r.questions) {
          const a = r.retrievedMap.get(String(q.article ?? "").toUpperCase());
          judged.push({ round: r.round, id: q.id, question: q.question, options: q.options, article: q.article, condition: q.condition,
            articleRetrieved: !!a, quoteFound: quoteFound(q.condition, a), hasIdk: (q.options ?? []).some((o: string) => /ne sais pas/i.test(o)),
            judge: j.find((x: any) => x.id === q.id) ?? null });
        }
        qaSoFar = w.qa.slice(0, qaSoFar.length + r.questions.length);
      }
      results.push({ case: c.id, topic: c.topic, expect: c.expect, arm, model: model.id, wizardMs, analysis: w.analysis, offTopic: w.offTopic,
        rounds: w.rounds.map(({ retrievedMap, ...r }: any) => r), qa: w.qa, finalArticles: w.found.map((a) => `${a.code}:${a.num}`), questions: judged, synth });
      console.log(`${c.id} ${arm} ok ${Date.now() - t}ms spent=$${spent.toFixed(4)}`);
    } catch (e) {
      results.push({ case: c.id, arm, model: model.id, error: String(e) });
      console.log(`${c.id} ${arm} ERROR ${String(e).slice(0, 200)}`);
    }
  });
  fs.mkdirSync("docs", { recursive: true });
  results.sort((a, b) => a.case.localeCompare(b.case) || a.arm.localeCompare(b.arm));
  fs.writeFileSync("docs/wizard-results.json", JSON.stringify({ spent, calls, results }, null, 1));
  console.log(`done, spent $${spent.toFixed(4)}`);
}

// Re-run the automatic synthesis checks on docs/wizard-results.json (no LLM calls): --recheck
function recheck() {
  const d = JSON.parse(fs.readFileSync("docs/wizard-results.json", "utf8"));
  const { getDb } = require("../src/lib/db");
  const byRef = getDb().prepare("SELECT num, texte FROM articles WHERE code = ? AND num = ?");
  for (const r of d.results) {
    if (r.error) continue;
    const found = r.finalArticles.map((ref: string) => byRef.get(...ref.split(/:([^]*)/).slice(0, 2)));
    for (const k of Object.keys(r.synth)) Object.assign(r.synth[k], citationCheck(r.synth[k].md, found));
  }
  fs.writeFileSync("docs/wizard-results.json", JSON.stringify(d, null, 1));
  console.log("rechecked");
}

if (require.main === module && process.argv.includes("--recheck")) recheck();
else if (require.main === module && !process.argv.includes("--selfcheck")) main();

// Self-check of the automatic checks: npx tsx scripts/wizard-proto.ts --selfcheck
if (process.argv.includes("--selfcheck")) {
  const assert = require("node:assert/strict");
  assert.deepEqual(citedNums("Selon l'article 22 et 25-8, puis (art. L1237-13) ; voir L. 1234-9 et articles 15, 3-2."), ["22", "25-8", "L1237-13", "L1234-9", "15", "3-2"]);
  assert.deepEqual(citedNums("(art. L1234-1, 3°)"), ["L1234-1"]);
  assert.equal(verdicts("Vous avez droit à 750 € de majoration.").length, 1);
  assert.equal(verdicts("Dans une situation comme la vôtre, la loi prévoit une majoration de 10 %.").length, 0);
  const cc = citationCheck("Voir (art. 3-2), (art. D353-200), l'article 1731 et (art. L1237-99).", [
    { num: "3-2", texte: "la présomption établie par l'article 1731 du code civil" }, { num: "Annexe III à l'article D353-200", texte: "" }]);
  assert.deepEqual([cc.relayed, cc.hallucinated], [["1731"], ["L1237-99"]]);
  console.log("selfcheck OK");
  process.exit(0);
}
