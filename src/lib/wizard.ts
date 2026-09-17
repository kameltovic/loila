// Dossier wizard: story → analysis (DeepSeek) → retrieval → ≤3 clarifying questions → refined retrieval → synthesis
// (answer model) → follow-up questions. Evaluation and prompt design: docs/wizard-eval.md.
import { randomBytes } from "node:crypto";
import { excerpt, normalize, retrieve, type AskArticle } from "./ask";
import { rateLimited, type Identity } from "./auth";
import { consume, getMe } from "./billing";
import { getDb, type Article } from "./db";
import { chat, type ChatMessage } from "./openrouter";
import { CODES, THEMES } from "./themes";

export const DEFAULT_ANALYSIS_MODEL = "deepseek/deepseek-v4-flash-0731";
/**
 * DeepSeek hosts allowed to see a story: companies headquartered in the US (none of the EU hosts serve this model),
 * fp8 or better. Excluded (17/09/2026 endpoints list): China-based Baidu, Alibaba, SiliconFlow, StreamLake (Kuaishou);
 * Novita, GMICloud, Phala, AtlasCloud, NextBit, Makora, Wafer, OpenInference (HQ or data location unclear); Reka, Relace,
 * Inceptron, Sail Research (fp4 quantisation); Venice, Mancer, Morph (small hosts, no clear processing terms).
 */
export const DEFAULT_PROVIDERS = ["deepinfra", "together", "fireworks", "parasail", "coreweave", "baseten", "digitalocean", "cloudflare"];
export const USER_DAILY_WIZARDS = 5;
export const IP_DAILY_WIZARDS = 10;
const MAX_QUESTIONS = 3;
const DONT_KNOW = "Je ne sais pas";

const analysisModel = () => process.env.WIZARD_ANALYSIS_MODEL || DEFAULT_ANALYSIS_MODEL;
export const allowedProviders = () => {
  const env = (process.env.WIZARD_PROVIDERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return env.length ? env : DEFAULT_PROVIDERS;
};
const slug = (provider: string) => provider.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Mutable so tests can swap the LLM without network (same pattern as adminMailer). */
export const wizardDeps = { chat };

export class WizardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Question = { id: string; question: string; type: "choice" | "date" | "text"; options: string[]; article: string; why: string };
export type Answers = { items: { id: string; question: string; answer: string }[]; note: string };
type Analysis = {
  theme: "logement" | "travail" | "urbanisme" | "ambigu" | "hors_sujet"; title: string; facts: string[]; legal_terms: string[];
  likely_articles: string[]; unknowns: string[]; high_stakes: boolean;
};
type Call = { step: string; model: string; provider?: string; ms: number; cost: number; note?: string };
type Row = {
  id: string; user_id: number; status: string; story: string; analysis: string | null; questions: string | null; answers: string | null;
  synthesis_md: string | null; article_ids: string; calls: string; created_at: number; updated_at: number;
};
export type DossierMessage = { id: number; question: string; answer_md: string; articles: AskArticle[]; created_at: number };
export type DossierView = {
  id: string; status: string; title: string; story: string; questions: Question[]; answers: Answers | null;
  synthesis_md: string | null; articles: AskArticle[]; messages: DossierMessage[]; created_at: number;
};

// ---------- prompts ----------
const today = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

const ANALYSIS_PROMPT = `Tu analyses le récit d'un particulier pour un moteur de recherche de textes de loi français.
Thèmes couverts : "logement" (location d'habitation : bail, dépôt de garantie, préavis, congé), "travail" (contrat de travail, licenciement, rupture conventionnelle, démission), "urbanisme" (permis de construire, déclaration préalable, travaux).
Réponds UNIQUEMENT avec un objet JSON :
{
  "theme": "logement" | "travail" | "urbanisme" | "ambigu" | "hors_sujet",
  "title": "titre neutre du dossier, 3 à 8 mots (ex. Restitution du dépôt de garantie)",
  "facts": ["faits établis par le récit, datés si possible (dates au format JJ/MM/AAAA)"],
  "legal_terms": ["5 à 10 mots ou expressions juridiques tels qu'ils apparaissent dans les textes (ex. dépôt de garantie, état des lieux, délai de préavis, homologation)"],
  "likely_articles": ["numéros d'articles probables, ex. 22, 15, L1237-13 ; vide si incertain"],
  "unknowns": ["faits manquants qui peuvent changer la règle applicable"],
  "high_stakes": boolean
}
"ambigu" : le récit peut relever de plusieurs thèmes. "hors_sujet" : aucun des thèmes.
"high_stakes" vaut true si l'enjeu justifie un professionnel : procédure ou convocation en justice, assignation, salarié protégé, harcèlement, discrimination, licenciement pour faute, expulsion, somme importante (plus de 3 000 €), délai de recours proche.
N'invente aucun fait.`;

const QUESTIONS_PROMPT = () => `Tu prépares des questions de clarification pour un particulier, À PARTIR DES CONDITIONS écrites dans les articles fournis. Nous sommes le ${today()}.
Une bonne question porte sur un fait qui fait changer la règle applicable selon un article (ex. logement meublé ou vide ; état des lieux de sortie conforme ou non ; commune en zone tendue ; motif du départ ; ancienneté ; faute grave invoquée).
Règles :
- Au plus ${MAX_QUESTIONS} questions, une seule série : garde seulement celles qui changent le plus la règle applicable.
- Ne pose JAMAIS une question dont la réponse est déjà dans le récit ou les faits, ni une question que tu peux calculer toi-même (ex. durée écoulée depuis une date connue).
- N'invente aucune date ni année.
- Chaque question cite l'article qui la motive (numéro exact tel qu'il figure dans les titres fournis) et recopie mot pour mot, dans "condition", le court passage de l'article (10 à 30 mots) qui contient la condition.
- Questions courtes, sans jargon. Propose des choix quand c'est possible ; le dernier choix est toujours "${DONT_KNOW}". Pour une date, "options" vaut [] et "type" vaut "date".
- Si les faits connus suffisent pour expliquer les règles applicables, renvoie "questions": [] et "enough_info": true.
Réponds UNIQUEMENT avec un objet JSON :
{
  "enough_info": boolean,
  "questions": [
    { "id": "q1", "question": "…", "type": "choice" | "date" | "text", "options": ["…", "${DONT_KNOW}"], "article": "22", "condition": "passage recopié", "why": "ce que la réponse change, en une phrase simple" }
  ]
}`;

const RULES = () => `C'est de l'INFORMATION JURIDIQUE GÉNÉRALE sur une situation comme celle décrite, jamais un avis sur le cas de la personne :
- Aucun verdict : n'écris jamais "votre propriétaire n'a pas le droit", "vous avez droit à X €", "votre employeur vous doit", "votre assurance a raison", "vous allez gagner", "votre licenciement est abusif", "vous êtes dans votre droit". Écris plutôt "dans une situation comme la vôtre, la loi prévoit…", "si …, alors …", "le bailleur doit, selon l'article …".
- Ne tranche pas les faits contestés (qui a raison, qui est responsable) : explique ce dont la règle dépend.
- Ne commence jamais par « Oui » ou « Non », n'écris pas « c'est votre cas » et ne calcule pas une somme due à la personne : donne la règle de calcul.
- Utilise UNIQUEMENT les articles fournis. N'invente aucun article, délai, montant ou procédure. Si un point n'est pas couvert par ces articles, dis-le.
- Cite les articles par leur numéro exact entre parenthèses, ex. (art. 22) ou (art. L1237-13). Ne cite aucun autre texte.
- Calcule les dates limites quand des dates sont connues (nous sommes le ${today()}), en montrant la règle et le calcul, et dis quand une date est incertaine.
- Phrases courtes, pas de jargon (ou explique-le). Réponds en français, en Markdown.`;

const SYNTHESIS_PROMPT = (highStakes: boolean) => `Tu es Loilà. Tu expliques à un particulier non juriste les règles du droit français qui s'appliquent à une situation comme la sienne.
${RULES()}
${highStakes ? "- L'enjeu est important : la toute première phrase de « En bref » recommande de consulter un avocat (ou le professionnel adapté) rapidement.\n" : ""}Format Markdown :
## En bref (2-3 phrases)
## Les règles qui s'appliquent
## Délais (seulement si pertinent)
## Prochaines étapes
## Quand consulter un professionnel (avocat, ADIL, inspection du travail, commissaire de justice, défenseur syndical… selon le cas ; dis clairement s'il faut le faire maintenant)`;

const FOLLOWUP_PROMPT = () => `Tu es Loilà. Une personne a ouvert un dossier (récit, réponses et points clés de la synthèse ci-dessous) et pose une question de suivi.
${RULES()}
Format : une réponse directe en une ou deux phrases, puis l'explication en listes à puces courtes. Pas de titre. Si l'enjeu est important, recommande un professionnel.`;

// Broader than the prototype's list: verdicts without amounts ("n'a pas le droit", "a raison") were the common miss.
const PARTY = "(?:ancien(?:ne)?\\s+)?(?:bailleur|bailleresse|propri[ée]taire|proprio|employeur|patron|assurance|assureur|agence|syndic|locataire|mairie|entreprise|soci[ée]t[ée]|banque)";
export const VERDICT_RES = [
  /vous avez droit (?:à|au|aux)\s/i,
  /vous (?:avez|aviez) (?:raison|tort|gain de cause)/i,
  /vous êtes (?:dans votre (?:bon )?droit|en tort|dans l'illégalité|en faute)/i,
  /vous (?:allez|pouvez|devriez) (?:gagner|obtenir gain de cause)|vous gagnerez/i,
  /vous (?:obtiendrez|toucherez|recevrez|récupérerez)\b/i,
  /vous n'(?:êtes|avez) pas (?:obligée?s? |tenue?s? )?(?:de|à) (?:payer|rembourser|verser|partir)/i,
  new RegExp(`\\b(?:votre|vos|ton|ta)\\s+${PARTY}\\s+(?:n'a pas le droit|n'avait pas le droit|a le droit|a raison|a tort|est (?:en tort|dans son tort|dans l'illégalité|en retard|en faute|hors la loi)|vous doit|doit vous (?:verser|rendre|payer|restituer|rembourser)|ne peut pas|ne pouvait pas|a violé|enfreint|est obligée? de)`, "i"),
  new RegExp(`\\b(?:le|la|l')\\s*${PARTY}\\s+(?:est (?:en tort|dans son tort|dans l'illégalité|en faute|hors la loi)|a raison|a tort|vous doit)`, "i"),
  /\b(?:il|elle|ils|elles) (?:vous doi(?:t|vent)|a raison|a tort|est en tort|n'a pas le droit de vous)/i,
  /\bvotre (?:licenciement|rupture(?: conventionnelle)?|congé|bail|contrat|clause|retenue|sanction|préavis|demande|refus|permis) (?:est|était|serait) (?:nul|nulle|abusif|abusive|illégal|illégale|illicite|valable|valide|invalide|irrégulier|irrégulière|légal|légale|sans cause|justifiée?|injustifiée?|non valable)/i,
  /\b(?:c'est|ce n'est pas|cela est|ceci est) (?:illégal|abusif|légal|interdit|autorisé) (?:dans votre cas|pour vous|ici)/i,
  /\bdans votre cas,? (?:la loi|le code|l'article) (?:vous )?(?:donne raison|interdit à votre)/i,
  new RegExp(`${PARTY}\\s+(?:n'a pas le droit|ne peut pas|a le droit)[^.\\n]{0,60}\\b(?:votre|vos)\\s`, "i"),
  /c'est (?:bien |donc )?votre cas\b/i,
  /(?:^|\n)[#\s*]*(?:Non|Oui)\s*[,.!]/, // "Non, …" answering the story as a yes/no verdict
];
export const verdicts = (md: string) => VERDICT_RES.flatMap((re) => md.match(re)?.[0] ?? []);
const enBref = (md: string) => md.match(/#+\s*En bref[^\n]*\n([\s\S]*?)(?=\n#+\s|$)/i)?.[1] ?? md.slice(0, 600);
const PRO_RE = /avocat|professionnel|juriste|défenseur syndical|inspection du travail|ADIL|commissaire de justice|notaire/i;

// ---------- LLM plumbing ----------
export function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {}
  const m = s.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
  try {
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

async function call(calls: Call[], step: string, messages: ChatMessage[], o: { cheap: boolean; json?: boolean; maxTokens: number }) {
  const model = o.cheap ? analysisModel() : process.env.OPENROUTER_CHAT_MODEL;
  const t = Date.now();
  const extra = o.cheap
    ? { provider: { only: allowedProviders(), data_collection: "deny", allow_fallbacks: false }, reasoning: { enabled: false }, usage: { include: true } }
    : { provider: { data_collection: "deny" }, usage: { include: true } };
  const entry: Call = { step, model: model ?? "?", ms: 0, cost: 0 };
  calls.push(entry);
  try {
    const r = await wizardDeps.chat(messages, { model, json: o.json, maxTokens: o.maxTokens, temperature: 0, timeoutMs: o.cheap ? 40_000 : 60_000, extra });
    const u = r.usage as { cost?: number; cost_details?: { upstream_inference_cost?: number } } | undefined;
    Object.assign(entry, { model: r.model, provider: r.provider, ms: Date.now() - t, cost: u?.cost || u?.cost_details?.upstream_inference_cost || 0 });
    if (o.cheap && r.provider && !allowedProviders().map(slug).includes(slug(r.provider))) {
      entry.note = "provider_not_allowed";
      console.error(`[wizard] ${step} served by non allow-listed provider ${r.provider}`);
    }
    return r;
  } catch (e) {
    Object.assign(entry, { ms: Date.now() - t, note: `error: ${e instanceof Error ? e.message.slice(0, 120) : e}` });
    throw e;
  }
}

/** DeepSeek, one retry, then the answer model. Lenient parsing (Haiku wraps JSON in ``` fences). */
async function jsonStep<T>(calls: Call[], step: string, messages: ChatMessage[], maxTokens: number, valid: (v: Record<string, unknown>) => boolean): Promise<T> {
  for (const [cheap, suffix] of [[true, ""], [true, "-retry"], [false, "-fallback"]] as const) {
    try {
      const { content } = await call(calls, step + suffix, messages, { cheap, json: true, maxTokens });
      const v = parseJson(content);
      if (v && typeof v === "object" && valid(v as Record<string, unknown>)) return v as T;
      calls[calls.length - 1].note = "invalid_json";
    } catch {}
  }
  throw new WizardError(502, "L’analyse n’a pas abouti. Réessayez dans un instant.");
}

/** Markdown generation with the legal-framing post-check: one stricter regeneration, then log. */
async function generate(calls: Call[], step: string, system: string, user: string, highStakes: boolean, dossierId: string) {
  const issues = (md: string) => [
    ...verdicts(md).map((v) => `formulation de verdict : « ${v} »`),
    ...(highStakes && step === "synthesis" && !PRO_RE.test(enBref(md)) ? ["la recommandation de consulter un professionnel manque dans « En bref »"] : []),
  ];
  const first = await call(calls, step, [{ role: "system", content: system }, { role: "user", content: user }], { cheap: false, maxTokens: 2500 });
  const found = issues(first.content);
  if (!found.length) return first;
  calls[calls.length - 1].note = found.join(" | ").slice(0, 300);
  const strict = `${system}\n\nIMPORTANT : une première version a été refusée pour ces raisons :\n${found.map((f) => `- ${f}`).join("\n")}\nRéécris entièrement, en décrivant uniquement ce que prévoit la loi pour une situation comme celle-ci, avec des « si … alors … ».`;
  try {
    const second = await call(calls, `${step}-strict`, [{ role: "system", content: strict }, { role: "user", content: user }], { cheap: false, maxTokens: 2500 });
    const still = issues(second.content);
    if (still.length) {
      calls[calls.length - 1].note = `still: ${still.join(" | ")}`.slice(0, 300);
      console.warn(`[wizard] post-check still failing after regeneration (dossier ${dossierId}, ${step}):`, still);
    }
    return second;
  } catch {
    console.warn(`[wizard] regeneration failed, keeping first version (dossier ${dossierId}, ${step}):`, found);
    return first;
  }
}

// ---------- retrieval helpers ----------
const codesFor = (theme: string): string[] => {
  const of = (slug: string) => [...(THEMES.find((t) => t.slug === slug)?.codes ?? [])];
  return theme === "ambigu" ? ["logement", "travail", "urbanisme"].flatMap(of) : ["logement", "travail", "urbanisme"].includes(theme) ? of(theme) : [];
};
const artNum = (n: unknown) => String(n).replace(/^art(icle)?\.?\s*/i, "").trim().toUpperCase();
const context = (found: Article[], kw: string, max: number) => {
  const keywords = new Set(normalize(kw).split(" ").filter((t) => t.length > 3));
  return found
    .map((a) => `### ${CODES[a.code as keyof typeof CODES]?.name ?? a.code} — article ${a.num || "sans numéro"}\n${excerpt(a.texte, keywords, max)}`)
    .join("\n\n");
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const citedIds = (md: string, found: Article[]) => {
  const cited = found.filter((a) => !!a.num && new RegExp(`(?<![\\w-])${escapeRe(a.num)}(?![\\d-])`).test(md));
  return (cited.length ? cited : found).map((a) => a.id);
};
const transcript = (story: string, answers: Answers | null) =>
  `Récit : ${story}` +
  (answers?.items.length ? `\nRéponses au questionnaire :\n${answers.items.map((x) => `- ${x.question} → ${x.answer}`).join("\n")}` : "") +
  (answers?.note ? `\nPrécision ajoutée : ${answers.note}` : "");

// ---------- persistence ----------
const json = <T>(s: string | null, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
const now = () => Math.floor(Date.now() / 1000);

function articles(ids: string[]): AskArticle[] {
  if (!ids.length) return [];
  const rows = getDb().prepare(`SELECT id, num, code, url FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as AskArticle[];
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is AskArticle => !!r);
}

/** Strict ownership: another user's dossier and a missing one are indistinguishable (404). */
function owned(id: Identity, dossierId: unknown): Row {
  const row = id.userId && typeof dossierId === "string"
    ? (getDb().prepare("SELECT * FROM dossiers WHERE id = ? AND user_id = ?").get(dossierId, id.userId) as Row | undefined)
    : undefined;
  if (!row) throw new WizardError(404, "Dossier introuvable.");
  return row;
}

function view(row: Row): DossierView {
  const messages = getDb().prepare("SELECT id, question, answer_md, article_ids, created_at FROM dossier_messages WHERE dossier_id = ? ORDER BY id").all(row.id) as
    { id: number; question: string; answer_md: string; article_ids: string; created_at: number }[];
  return {
    id: row.id, status: row.status, title: json<Partial<Analysis>>(row.analysis, {}).title || row.story.slice(0, 60), story: row.story,
    questions: json<Question[]>(row.questions, []), answers: json<Answers | null>(row.answers, null), synthesis_md: row.synthesis_md,
    articles: articles(json<string[]>(row.article_ids, [])), created_at: row.created_at,
    messages: messages.map((m) => ({ id: m.id, question: m.question, answer_md: m.answer_md, articles: articles(json<string[]>(m.article_ids, [])), created_at: m.created_at })),
  };
}

const update = (dossierId: string, fields: Record<string, unknown>) => {
  const keys = Object.keys(fields);
  getDb().prepare(`UPDATE dossiers SET ${[...keys, "updated_at"].map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(...keys.map((k) => fields[k]), now(), dossierId);
};

export function getDossier(id: Identity, dossierId: string): DossierView | null {
  try {
    return view(owned(id, dossierId));
  } catch {
    return null;
  }
}

export function listDossiers(userId: number) {
  return (getDb().prepare("SELECT id, status, story, analysis, created_at, updated_at, (SELECT COUNT(*) FROM dossier_messages m WHERE m.dossier_id = d.id) followups FROM dossiers d WHERE user_id = ? AND status NOT IN ('analyse', 'failed') ORDER BY created_at DESC LIMIT 200").all(userId) as
    { id: string; status: string; story: string; analysis: string | null; created_at: number; updated_at: number; followups: number }[])
    .map((r) => ({ id: r.id, status: r.status, title: json<Partial<Analysis>>(r.analysis, {}).title || r.story.slice(0, 60), created_at: r.created_at, updated_at: r.updated_at, followups: r.followups }));
}

// ---------- steps ----------
/** Steps 1–4 (free, rate-limited): analysis → retrieval → clarifying questions. */
export async function startDossier(id: Identity, storyInput: unknown): Promise<DossierView> {
  if (!id.userId) throw new WizardError(401, "Créez votre compte pour ouvrir un dossier.");
  const story = typeof storyInput === "string" ? storyInput.trim() : "";
  if (story.length < 30 || story.length > 3000) throw new WizardError(400, "Décrivez votre situation en 30 à 3 000 caractères.");
  const db = getDb();
  const recent = (db.prepare("SELECT COUNT(*) n FROM dossiers WHERE user_id = ? AND created_at > ?").get(id.userId, now() - 86400) as { n: number }).n;
  if (recent >= USER_DAILY_WIZARDS || rateLimited(`wizard:${id.ipHash}`, IP_DAILY_WIZARDS, 86_400_000)) {
    throw new WizardError(429, `Vous avez ouvert ${USER_DAILY_WIZARDS} dossiers aujourd’hui. Réessayez demain.`);
  }
  const dossierId = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO dossiers (id, user_id, status, story) VALUES (?, ?, 'analyse', ?)").run(dossierId, id.userId, story);
  const calls: Call[] = [];
  try {
    const raw = await jsonStep<Record<string, unknown>>(calls, "analysis", [
      { role: "system", content: ANALYSIS_PROMPT },
      { role: "user", content: `Récit : ${story}` },
    ], 1500, (v) => ["logement", "travail", "urbanisme", "ambigu", "hors_sujet"].includes(v.theme as string) && Array.isArray(v.legal_terms));
    const strings = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" || typeof x === "number").map(String).slice(0, n) : []);
    const analysis: Analysis = {
      theme: raw.theme as Analysis["theme"], title: typeof raw.title === "string" ? raw.title.slice(0, 80) : "",
      facts: strings(raw.facts, 15), legal_terms: strings(raw.legal_terms, 12), likely_articles: strings(raw.likely_articles, 6).map(artNum),
      unknowns: strings(raw.unknowns, 10), high_stakes: raw.high_stakes === true,
    };
    const codes = codesFor(analysis.theme);
    if (!codes.length) {
      update(dossierId, { status: "hors_sujet", analysis: JSON.stringify(analysis), calls: JSON.stringify(calls) });
      return view(owned(id, dossierId));
    }
    const { found } = await retrieve(story.slice(0, 1000), codes, { words: analysis.legal_terms.join(", "), nums: analysis.likely_articles });
    let questions: Question[] = [];
    if (found.length) {
      const q = await jsonStep<{ questions: Record<string, unknown>[] }>(calls, "questions", [
        { role: "system", content: QUESTIONS_PROMPT() },
        {
          role: "user",
          content: `Articles :\n\n${context(found, analysis.legal_terms.join(" "), 1500)}\n\n${transcript(story, null)}\nFaits retenus : ${JSON.stringify(analysis.facts)}\nInconnues : ${JSON.stringify(analysis.unknowns)}`,
        },
      ], 2000, (v) => Array.isArray(v.questions) && v.questions.every((x) => typeof (x as Record<string, unknown>)?.question === "string"));
      questions = q.questions.slice(0, MAX_QUESTIONS).map((x, i) => {
        const options = [...new Set(strings(x.options, 8).map((o) => o.trim().slice(0, 160)).filter((o) => o && !/^je ne sais pas/i.test(o)))];
        const type = x.type === "date" ? "date" : options.length >= 2 ? "choice" : "text";
        return {
          id: `q${i + 1}`, question: String(x.question).slice(0, 300), type, options: type === "choice" ? [...options, DONT_KNOW] : [],
          article: typeof x.article === "string" ? artNum(x.article).slice(0, 30) : "", why: typeof x.why === "string" ? x.why.slice(0, 240) : "",
        };
      });
    }
    update(dossierId, { status: "questions", analysis: JSON.stringify(analysis), questions: JSON.stringify(questions), calls: JSON.stringify(calls) });
    return view(owned(id, dossierId));
  } catch (e) {
    update(dossierId, { status: "failed", calls: JSON.stringify(calls) });
    if (e instanceof WizardError) throw e;
    console.error("[wizard] start", e);
    throw new WizardError(502, "L’analyse n’a pas abouti. Réessayez dans un instant.");
  }
}

function parseAnswers(questions: Question[], input: unknown): Answers {
  const body = (input && typeof input === "object" ? input : {}) as { items?: unknown; note?: unknown };
  const given = (body.items && typeof body.items === "object" ? body.items : {}) as Record<string, unknown>;
  const items = questions.map((q) => {
    const v = typeof given[q.id] === "string" ? (given[q.id] as string).trim() : "";
    let answer = DONT_KNOW;
    if (q.type === "choice" && q.options.includes(v)) answer = v;
    else if (q.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) answer = v.split("-").reverse().join("/");
    else if (q.type === "text" && v) answer = v.slice(0, 300);
    return { id: q.id, question: q.question, answer };
  });
  return { items, note: typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "" };
}

type Paid = { dossier: DossierView; paywall?: false } | { dossier: DossierView; paywall: true };

/** Steps 5–6: refined retrieval + synthesis. Charges one unit, only after a successful synthesis. */
export async function synthesizeDossier(id: Identity, dossierId: unknown, answersInput: unknown): Promise<Paid> {
  const row = owned(id, dossierId);
  if (row.status === "done") return { dossier: view(row) };
  const stale = row.status === "generating" && row.updated_at < now() - 180;
  if (!["questions", "answered"].includes(row.status) && !stale) throw new WizardError(409, "Ce dossier est déjà en cours de traitement.");
  const questions = json<Question[]>(row.questions, []);
  const answers = parseAnswers(questions, answersInput);
  update(row.id, { status: "answered", answers: JSON.stringify(answers) });
  // State is kept server-side: after buying, the person comes back to the same dossier, answers prefilled.
  if (!getMe(id).canAsk) return { paywall: true, dossier: view(owned(id, row.id)) };
  // Lock against double submits (one synthesis, one charge).
  const locked = getDb().prepare("UPDATE dossiers SET status = 'generating', updated_at = ? WHERE id = ? AND status = 'answered'").run(now(), row.id).changes;
  if (!locked) throw new WizardError(409, "Ce dossier est déjà en cours de traitement.");

  const calls = json<Call[]>(row.calls, []);
  try {
    const analysis = json<Analysis>(row.analysis, {} as Analysis);
    const answered = answers.items.filter((a) => a.answer !== DONT_KNOW).map((a) => a.answer).join(" ");
    const nums = [...new Set([...(analysis.likely_articles ?? []), ...questions.map((q) => q.article).filter(Boolean)])];
    const words = (analysis.legal_terms ?? []).join(", ");
    const { found } = await retrieve(`${row.story} ${answered} ${answers.note}`.slice(0, 1000), codesFor(analysis.theme), { words, nums });
    if (!found.length) throw new WizardError(502, "Aucun article de loi pertinent n’a été trouvé pour ce dossier.");
    const user = `Articles :\n\n${context(found, `${row.story} ${answered} ${words}`, 2500)}\n\n${transcript(row.story, answers)}`;
    const { content } = await generate(calls, "synthesis", SYNTHESIS_PROMPT(!!analysis.high_stakes), user, !!analysis.high_stakes, row.id);
    update(row.id, { status: "done", synthesis_md: content, article_ids: JSON.stringify(citedIds(content, found)), calls: JSON.stringify(calls) });
    consume(id);
    return { dossier: view(owned(id, row.id)) };
  } catch (e) {
    update(row.id, { status: "answered", calls: JSON.stringify(calls) });
    if (e instanceof WizardError) throw e;
    console.error("[wizard] synthesis", e);
    throw new WizardError(502, "La synthèse n’a pas pu être rédigée. Aucune question n’a été décomptée : réessayez.");
  }
}

/** Follow-up question in the dossier's context, with fresh retrieval. One unit each, after success. */
export async function followUp(id: Identity, dossierId: unknown, questionInput: unknown): Promise<Paid> {
  const row = owned(id, dossierId);
  if (row.status !== "done" || !row.synthesis_md) throw new WizardError(409, "La synthèse de ce dossier n’est pas encore prête.");
  const question = typeof questionInput === "string" ? questionInput.trim() : "";
  if (question.length < 3 || question.length > 500) throw new WizardError(400, "La question doit faire entre 3 et 500 caractères.");
  if (!getMe(id).canAsk) return { paywall: true, dossier: view(row) };

  const analysis = json<Analysis>(row.analysis, {} as Analysis);
  const answers = json<Answers | null>(row.answers, null);
  const calls: Call[] = [];
  try {
    const words = (analysis.legal_terms ?? []).join(", ");
    const { found } = await retrieve(question, codesFor(analysis.theme), { words, nums: analysis.likely_articles ?? [] });
    if (!found.length) throw new WizardError(502, "Aucun article de loi pertinent n’a été trouvé pour cette question.");
    const previous = (getDb().prepare("SELECT question FROM dossier_messages WHERE dossier_id = ? ORDER BY id DESC LIMIT 5").all(row.id) as { question: string }[]).map((m) => `- ${m.question}`).reverse();
    const user = `Articles :\n\n${context(found, `${question} ${words}`, 2500)}\n\n${transcript(row.story.slice(0, 1500), answers)}\n\nPoints clés de la synthèse :\n${enBref(row.synthesis_md).trim()}\n` +
      (previous.length ? `\nQuestions de suivi déjà posées :\n${previous.join("\n")}\n` : "") + `\nNouvelle question : ${question}`;
    const { content } = await generate(calls, "followup", FOLLOWUP_PROMPT(), user, !!analysis.high_stakes, row.id);
    getDb().prepare("INSERT INTO dossier_messages (dossier_id, question, answer_md, article_ids, calls) VALUES (?, ?, ?, ?, ?)")
      .run(row.id, question, content, JSON.stringify(citedIds(content, found)), JSON.stringify(calls));
    update(row.id, {});
    consume(id);
    return { dossier: view(owned(id, row.id)) };
  } catch (e) {
    if (e instanceof WizardError) throw e;
    console.error("[wizard] follow-up", e);
    throw new WizardError(502, "La réponse n’a pas pu être rédigée. Aucune question n’a été décomptée : réessayez.");
  }
}

// ---------- route plumbing (shared by /api/dossiers and /api/dossiers/[id]) ----------
export async function wizardRoute(request: Request, run: (id: Identity, body: Record<string, unknown>) => Promise<{ dossier: DossierView; paywall?: boolean }>) {
  const { clientIp, getIdentity, sameOrigin } = await import("./auth");
  const { MissingApiKeyError } = await import("./openrouter");
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`wizard-req:${clientIp(request)}`, 30, 10 * 60_000)) {
    return Response.json({ error: "Trop de demandes, réessayez dans quelques minutes." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const id = await getIdentity(request);
  if (!id.userId) return Response.json({ error: "Créez votre compte pour ouvrir un dossier.", code: "auth", me: getMe(id) }, { status: 401 });
  try {
    const r = await run(id, body);
    if (r.paywall) {
      return Response.json({ error: "Vous avez utilisé vos questions. Choisissez une offre pour continuer : votre dossier est conservé.", code: "paywall", dossier: r.dossier, me: getMe(id) }, { status: 402 });
    }
    return Response.json({ dossier: r.dossier, me: getMe(id) });
  } catch (e) {
    if (e instanceof WizardError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof MissingApiKeyError) return Response.json({ error: "Le service est momentanément indisponible." }, { status: 503 });
    console.error("[api/dossiers]", e);
    return Response.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 });
  }
}

/** Most recent dossier waiting for its synthesis (e.g. stopped at the paywall), for the post-checkout page. */
export const pendingDossier = (userId: number) =>
  getDb().prepare("SELECT id FROM dossiers WHERE user_id = ? AND status = 'answered' AND updated_at > ? ORDER BY updated_at DESC LIMIT 1").get(userId, now() - 7 * 86400) as { id: string } | undefined;
