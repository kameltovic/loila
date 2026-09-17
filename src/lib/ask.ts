import { createHash } from "node:crypto";
import { getDb, type Article, type Faq } from "./db";
import { CODES, THEMES } from "./themes";
import { chat, type ChatMessage } from "./openrouter";
import { getArticleByNum, mentionedConventions, searchArticles } from "./search";

export type AskArticle = { id: string; num: string; code: string; url: string };
export type AskResult = {
  source: "faq" | "cache" | "llm" | "none" | "paywall";
  answer_md: string;
  faq?: { slug: string; theme: string; topic: string | null; question: string };
  articles: AskArticle[];
};
export type LlmCall = (messages: ChatMessage[]) => Promise<{ content: string; model: string }>;

export class AskValidationError extends Error {}

// ponytail: naive token-overlap heuristic; upgrade path = embeddings + cosine similarity.
const FAQ_MIN_JACCARD = 0.5;
const MAX_ARTICLES = 8;
const ARTICLE_CHARS = 2500;

const STOPWORDS = new Set(
  ("a au aux avec ce ces cet cette d dans de des du elle en est et il ils je j l la le les leur lui m ma mais me mes mon " +
    "n ne nous on ou par pas pour qu que qui s sa se ses si son sont sur t ta te tes toi ton tu un une vos votre vous y " +
    "c ca est-ce quoi quel quelle quels quelles comment combien quand peut peux puis dois doit faut il-faut mon ma mes " +
    "suis ai as avez avoir etre etc").split(" "),
);

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const tokens = (s: string) => new Set(normalize(s).split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t)));

export function jaccard(a: string, b: string) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function articlesByIds(ids: string[]): AskArticle[] {
  if (!ids.length) return [];
  const rows = getDb()
    .prepare(`SELECT id, num, code, url FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as AskArticle[];
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is AskArticle => !!r);
}

const parseIds = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

function matchFaq(question: string, theme?: string): Faq | undefined {
  const words = [...tokens(question)];
  if (!words.length) return;
  const match = words.map((w) => `"${w}"`).join(" OR ");
  const rows = getDb()
    .prepare(
      `SELECT faq.* FROM faq_fts JOIN faq ON faq.id = faq_fts.rowid
       WHERE faq_fts MATCH ? ${theme ? "AND faq.theme = ?" : ""} ORDER BY rank LIMIT 5`,
    )
    .all(...(theme ? [match, theme] : [match])) as Faq[];
  let best: Faq | undefined, bestScore = 0;
  for (const r of rows) {
    const s = jaccard(question, r.question);
    if (s > bestScore) [best, bestScore] = [r, s];
  }
  return bestScore >= FAQ_MIN_JACCARD ? best : undefined;
}

const SYSTEM_PROMPT = `Tu es Loilà, un assistant qui explique le droit français à des personnes qui ne sont pas juristes.
Règles :
- Commence par une réponse directe en une phrase.
- Puis explique simplement : phrases courtes, listes à puces, pas de jargon (ou explique-le).
- Utilise UNIQUEMENT les articles fournis. N'invente jamais rien (ni article, ni délai, ni montant, ni numéro IDCC) : le nom du texte et son IDCC sont indiqués dans le titre de chaque article.
- Cite les numéros d'articles entre parenthèses, par exemple (art. L1237-19).
- Si les articles fournis ne permettent pas de conclure, dis-le clairement.
- Si l'enjeu est important, termine en conseillant de vérifier auprès d'un professionnel (avocat, inspection du travail, ADIL, mairie selon le cas).
- Réponds en français, en Markdown.`;

const EXPAND_PROMPT = `Tu aides un moteur de recherche plein texte sur des textes de loi français.
Transforme la question d'un particulier en vocabulaire juridique tel qu'il apparaît dans les textes.
Réponds sur exactement deux lignes, sans rien d'autre :
mots: 5 à 10 mots ou expressions juridiques, séparés par des virgules
articles: numéros d'articles probables dans les textes indiqués (ex. 7, L3141-16, R421-14), séparés par des virgules, ou vide`;

// Question in plain words → legal vocabulary + likely article numbers (~100 tokens on the cheap model).
export async function expandQuery(q: string, codes: string[], retry = 1): Promise<{ words: string; nums: string[] }> {
  const texts = codes.map((c) => CODES[c as keyof typeof CODES]?.name).filter(Boolean).join(" ; ");
  try {
    const { content } = await chat(
      [{ role: "system", content: EXPAND_PROMPT }, { role: "user", content: `Textes : ${texts}\nQuestion : ${q}` }],
      { model: process.env.OPENROUTER_EXPAND_MODEL ?? "google/gemini-3.5-flash-lite", maxTokens: 150, temperature: 0, timeoutMs: 8_000 },
    );
    const words = content.replace(/^.*articles?\s*:.*$/gim, "").replace(/mots(-cl[ée]s)?\s*:/gi, "");
    const nums = content.matchAll(/(?:\bart(?:icles?)?\.?\s*|\b(?=[LRD]\*?\d))([LRD]?\*?\d+(?:[.-]\d+)*)/gi);
    return { words, nums: [...nums].slice(0, 6).map((m) => m[1].replace("*", "").toUpperCase()) };
  } catch {
    if (retry > 0) return expandQuery(q, codes, retry - 1);
    return { words: "", nums: [] }; // retrieval still works on the raw question
  }
}

// ponytail: phrase sniffing; upgrade path = ask the model for a JSON {answered: boolean}.
const isNonAnswer = (md: string) => /ne (me )?(permettent|traitent|mentionnent|abordent|précisent) pas|ne permet pas de (répondre|conclure)/i.test(md.slice(0, 400));

// Long articles: keep the first paragraph + the paragraphs sharing the most keywords, in original order.
export function excerpt(texte: string, keywords: Set<string>, max = ARTICLE_CHARS): string {
  if (texte.length <= max) return texte;
  const paras = texte.split(/\n+/);
  const score = (p: string) => [...tokens(p)].filter((t) => keywords.has(t) || [...keywords].some((k) => k.length > 4 && t.startsWith(k.slice(0, 5)))).length;
  const ranked = paras.map((p, i) => ({ i, s: i === 0 ? Infinity : score(p) })).sort((a, b) => b.s - a.s);
  const keep = new Set<number>();
  let len = 0;
  for (const { i, s } of ranked) {
    if (!s || len + paras[i].length > max) continue;
    keep.add(i);
    len += paras[i].length;
  }
  return paras.map((p, i) => (keep.has(i) ? p : null)).reduce<string[]>((out, p) => {
    if (p !== null) out.push(p);
    else if (out.at(-1) !== "[…]") out.push("[…]");
    return out;
  }, []).join("\n");
}

const realLlm: LlmCall = (m) => chat(m);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// beforeLlm: paywall hook, called only when the paid LLM step is about to run; false → { source: "paywall" }.
export async function ask(
  question: string, theme?: string, llm: LlmCall = realLlm, expand = llm === realLlm ? expandQuery : undefined,
  beforeLlm?: () => boolean | Promise<boolean>,
): Promise<AskResult> {
  const q = typeof question === "string" ? question.trim() : "";
  if (q.length < 3 || q.length > 500) throw new AskValidationError("La question doit faire entre 3 et 500 caractères.");
  const themeDef = theme ? THEMES.find((t) => t.slug === theme) : undefined;
  if (theme && !themeDef) throw new AskValidationError("Thème inconnu.");

  // 1. FAQ
  const faq = matchFaq(q, theme);
  if (faq) {
    return {
      source: "faq",
      answer_md: faq.answer_md,
      faq: { slug: faq.slug, theme: faq.theme, topic: faq.topic, question: faq.question },
      articles: articlesByIds(parseIds(faq.article_ids)),
    };
  }

  // 2. Cache
  const db = getDb();
  const hash = createHash("sha256").update(`${theme ?? ""}|${normalize(q)}`).digest("hex");
  const cached = db.prepare("SELECT answer_md, article_ids FROM qa_cache WHERE hash = ?").get(hash) as
    | { answer_md: string; article_ids: string }
    | undefined;
  if (cached) {
    db.prepare("UPDATE qa_cache SET hits = hits + 1 WHERE hash = ?").run(hash);
    return { source: "cache", answer_md: cached.answer_md, articles: articlesByIds(parseIds(cached.article_ids)) };
  }

  // 3. LLM over retrieved articles (paid)
  if (beforeLlm && !(await beforeLlm())) return { source: "paywall", answer_md: "", articles: [] };
  // Without a theme, conventions only join the scope when one is named: one random branch's "art. 4" misleads everyone else.
  let codes: string[] = themeDef ? [...themeDef.codes] : Object.keys(CODES).filter((c) => !c.startsWith("ccn-"));
  // A named convention ("Syntec", "IDCC 1486") narrows the scope, even outside the conventions theme.
  const named = mentionedConventions(q).filter((c) => !themeDef || codes.includes(c));
  if (named.length) codes = named;
  // Query expansion defaults on only with the real LLM, so tests with a fake stay offline.
  const { words, nums } = expand ? await expand(q, codes) : { words: "", nums: [] };
  // Convention article numbers repeat across avenants ("article 9" x25), so exact lookup only for codes and laws.
  const byNum = nums.flatMap((n) => codes.filter((c) => !c.startsWith("ccn-")).map((c) => getArticleByNum(c, n)).filter((a): a is Article => !!a));
  const scope = { codes, limit: MAX_ARTICLES };
  const seen = new Set<string>();
  const wide = { codes, limit: 20 };
  const byWords = words ? searchArticles(words, wide) : [];
  const byQuestion = searchArticles(q, wide);
  // Interleave both searches, then rerank by distinct keyword coverage: bm25 buries long articles
  // that cover the topic in depth. ponytail: stem = 5-char prefix; upgrade path = embeddings rerank.
  const stems = [...tokens(`${q} ${words}`)].filter((t) => t.length > 3).map((t) => t.slice(0, 5));
  const coverage = (a: Article) => {
    const seen = new Set(tokens(a.texte).values().map((t) => t.slice(0, 5)));
    return stems.filter((st) => seen.has(st)).length;
  };
  const mixed = Array.from({ length: 20 }, (_, i) => [byWords[i], byQuestion[i]])
    .flat()
    .filter((a): a is (typeof byQuestion)[number] => !!a)
    .map((a, i) => ({ a, i, c: coverage(a) }))
    .sort((x, y) => y.c - x.c || x.i - y.i)
    .map((x) => x.a);
  const found: Article[] = [...byNum, ...mixed]
    .filter((a) => !seen.has(a.id) && !!seen.add(a.id))
    .slice(0, MAX_ARTICLES);
  if (!found.length) {
    return {
      source: "none",
      answer_md:
        "Désolé, je n'ai pas trouvé d'article de loi correspondant à votre question. Essayez de la reformuler avec d'autres mots (par exemple « préavis », « dépôt de garantie », « permis de construire »).",
      articles: [],
    };
  }

  const keywords = tokens(`${q} ${words}`);
  const context = found
    .map((a) => `### ${CODES[a.code as keyof typeof CODES]?.name ?? a.code} — article ${a.num || "sans numéro"}${a.section ? ` — ${a.section}` : ""}\n${excerpt(a.texte, keywords)}`)
    .join("\n\n");
  const { content, model } = await llm([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Articles :\n\n${context}\n\nQuestion : ${q}` },
  ]);

  const cited = found.filter((a) => !!a.num && new RegExp(`(?<![\\w-])${escapeRe(a.num)}(?![\\d-])`).test(content));
  const used = cited.length ? cited : found;
  if (!isNonAnswer(content)) db.prepare("INSERT OR REPLACE INTO qa_cache (hash, question, answer_md, article_ids, model) VALUES (?, ?, ?, ?, ?)").run(
    hash, q, content, JSON.stringify(used.map((a) => a.id)), model,
  );
  return { source: "llm", answer_md: content, articles: used.map(({ id, num, code, url }) => ({ id, num, code, url })) };
}
