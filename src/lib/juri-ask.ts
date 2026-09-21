// Case-law assistant (Pro): a legal question → the articles and Cour de cassation decisions that answer it → an answer
// citing each decision as [D1], [D2]… and each article as (art. X). Same retrieval as /api/ask for the articles.
import { expandQuery, retrieve, type LlmCall } from "./ask";
import { getDb, type Article } from "./db";
import { citation, decisionUrl, teaser, type Decision } from "./decisions";
import { searchDecisions } from "./legal-search";
import { chat } from "./openrouter";
import { CODES } from "./themes";

export type JuriSource = { ref: string; id: string; citation: string; solution: string | null; url: string };
export type JuriResult = { answer_md: string; decisions: JuriSource[]; articles: { id: string; num: string; code: string }[] };

const MAX_DECISIONS = 8;
const SYSTEM = `Tu es l'assistant de recherche juridique de Loilà, pour des avocats et juristes.
On te donne des articles de loi et des décisions de la Cour de cassation. Réponds à la question en t'appuyant UNIQUEMENT sur ces sources.
Règles :
- Cite chaque décision utilisée par son repère entre crochets, ex. [D2], et chaque article sous la forme (art. L1234-9).
- Distingue la règle posée par la Cour (attendu de principe, sommaire) des circonstances de l'espèce.
- Si les sources ne permettent pas de répondre, ou si une décision va en sens contraire, dis-le explicitement.
- N'invente aucune décision, aucun numéro, aucune date. Pas de pronostic sur l'issue d'un litige.
- Ne commente jamais les magistrats ni leurs pratiques.
- Style : professionnel, précis, structuré (titres ###, listes), en français.`;

const realLlm: LlmCall = (messages) =>
  chat(messages, { model: process.env.JURI_MODEL ?? process.env.OPENROUTER_BATCH_MODEL, maxTokens: 1800, timeoutMs: 90_000 });

type Row = Pick<Decision, "id" | "juridiction" | "formation" | "date" | "numero" | "solution" | "sommaire" | "texte"> & { summary: string | null };
const COLS = "d.id, d.juridiction, d.formation, d.date, d.numero, d.solution, d.sommaire, d.texte, s.summary";

/** Decisions applying the retrieved articles (most recent) interleaved with full-text matches (most relevant), via the
 * internal legal search service; then their stored fields for the model's context. */
export function findDecisions(q: string, words: string, articles: Pick<Article, "id">[], limit = MAX_DECISIONS): Row[] {
  const byArticle = articles.length ? searchDecisions({ articleIds: articles.map((a) => a.id), limit: 12 }).rows : [];
  const byText = searchDecisions({ q: `${q} ${words}`, limit: 12 }).rows;
  const seen = new Set<string>();
  const ids = Array.from({ length: 12 }, (_, i) => [byArticle[i], byText[i]])
    .flat()
    .filter((d): d is (typeof byText)[number] => !!d && !seen.has(d.id) && !!seen.add(d.id))
    .slice(0, limit)
    .map((d) => d.id);
  if (!ids.length) return [];
  const rows = getDb()
    .prepare(`SELECT ${COLS} FROM decisions d LEFT JOIN decision_summaries s ON s.decision_id = d.id WHERE d.id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

/** What the model sees for one decision: official abstract, our summary, then the Court's answer. */
function decisionContext(d: Row, ref: string) {
  const from = d.texte.search(/Réponse de la Cour|PAR CES MOTIFS/i);
  const answer = (from >= 0 ? d.texte.slice(from) : d.texte.slice(-2500)).slice(0, 2500);
  return [
    `--- [${ref}] ${citation(d)} · ${d.solution ?? ""}`,
    d.sommaire && `Sommaire officiel : ${d.sommaire}`,
    d.summary && `Résumé : ${d.summary}`,
    `Extrait : ${answer}`,
  ].filter(Boolean).join("\n");
}

export async function askJuri(question: string, llm: LlmCall = realLlm, expand = llm === realLlm ? expandQuery : undefined): Promise<JuriResult> {
  const q = question.trim();
  const codes = Object.keys(CODES).filter((c) => !c.startsWith("ccn-"));
  const { words, found } = await retrieve(q, codes, expand, 6);
  const decisions = findDecisions(q, words, found);
  if (!found.length && !decisions.length) {
    return { answer_md: "Aucune source trouvée pour cette question. Reformulez-la avec les termes juridiques en cause (ex. « licenciement pour inaptitude », « clause résolutoire »).", decisions: [], articles: [] };
  }
  const refs = decisions.map((d, i) => ({ d, ref: `D${i + 1}` }));
  const context = [
    found.length && `ARTICLES\n${found.map((a) => `--- Article ${a.num} (${CODES[a.code as keyof typeof CODES]?.name ?? a.code})\n${teaser(a.texte, 1800)}`).join("\n\n")}`,
    refs.length && `DÉCISIONS\n${refs.map(({ d, ref }) => decisionContext(d, ref)).join("\n\n")}`,
  ].filter(Boolean).join("\n\n");
  const messages = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: `${context}\n\nQuestion : ${q}` },
  ];
  // Some upstream providers mask "personal data" with tokens like [PERSON_NAME] (seen on "L'article"): retry once,
  // then drop any left. [D1]-style source refs are ours and kept.
  const MASK = /\[(?!D\d+\])[A-Z_]{3,}\]\s?/g;
  let { content } = await llm(messages);
  if (MASK.test(content)) content = (await llm(messages)).content;
  content = content.replace(MASK, "");
  // Keep only the sources the answer actually cites (all of them if it cites none, so the reader can check).
  const citedDec = refs.filter(({ ref }) => content.includes(`[${ref}]`));
  const citedArt = found.filter((a) => a.num && content.includes(a.num));
  return {
    answer_md: content,
    decisions: (citedDec.length ? citedDec : refs).map(({ d, ref }) => ({ ref, id: d.id, citation: citation(d), solution: d.solution, url: decisionUrl(d) })),
    articles: (citedArt.length ? citedArt : found).map(({ id, num, code }) => ({ id, num, code })),
  };
}
