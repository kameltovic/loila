import { createHash } from "node:crypto";
import { getDb, type Article, type Faq } from "./db";
import { THEMES } from "./themes";
import { chat, type ChatMessage } from "./openrouter";
import { searchArticles } from "./search";

export type AskArticle = { id: string; num: string; code: string; url: string };
export type AskResult = {
  source: "faq" | "cache" | "llm" | "none";
  answer_md: string;
  faq?: { slug: string; theme: string; question: string };
  articles: AskArticle[];
};
export type LlmCall = (messages: ChatMessage[]) => Promise<{ content: string; model: string }>;

export class AskValidationError extends Error {}

// ponytail: naive token-overlap heuristic; upgrade path = embeddings + cosine similarity.
const FAQ_MIN_JACCARD = 0.5;
const MAX_ARTICLES = 6;
const ARTICLE_CHARS = 1500;

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
- Utilise UNIQUEMENT les articles fournis. N'invente jamais rien (ni article, ni délai, ni montant).
- Cite les numéros d'articles entre parenthèses, par exemple (art. L1237-19).
- Si les articles fournis ne permettent pas de conclure, dis-le clairement.
- Si l'enjeu est important, termine en conseillant de vérifier auprès d'un professionnel (avocat, inspection du travail, ADIL, mairie selon le cas).
- Réponds en français, en Markdown.`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function ask(question: string, theme?: string, llm: LlmCall = (m) => chat(m)): Promise<AskResult> {
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
      faq: { slug: faq.slug, theme: faq.theme, question: faq.question },
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

  // 3. LLM over retrieved articles
  const found: Article[] = searchArticles(q, { codes: themeDef ? [...themeDef.codes] : undefined, limit: MAX_ARTICLES });
  if (!found.length) {
    return {
      source: "none",
      answer_md:
        "Désolé, je n'ai pas trouvé d'article de loi correspondant à votre question. Essayez de la reformuler avec d'autres mots (par exemple « préavis », « dépôt de garantie », « permis de construire »).",
      articles: [],
    };
  }

  const context = found
    .map((a) => `### Article ${a.num} (${a.code})\n${a.texte.length > ARTICLE_CHARS ? a.texte.slice(0, ARTICLE_CHARS) + "…" : a.texte}`)
    .join("\n\n");
  const { content, model } = await llm([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Articles :\n\n${context}\n\nQuestion : ${q}` },
  ]);

  const cited = found.filter((a) => new RegExp(`(?<![\\w-])${escapeRe(a.num)}(?![\\w-])`).test(content));
  const used = cited.length ? cited : found;
  db.prepare("INSERT OR REPLACE INTO qa_cache (hash, question, answer_md, article_ids, model) VALUES (?, ?, ?, ?, ?)").run(
    hash, q, content, JSON.stringify(used.map((a) => a.id)), model,
  );
  return { source: "llm", answer_md: content, articles: used.map(({ id, num, code, url }) => ({ id, num, code, url })) };
}
