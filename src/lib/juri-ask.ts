// Case-law assistant (Pro): a legal question → the articles and Cour de cassation decisions that answer it → an answer
// citing each decision as [D1], [D2]… and each article as (art. X). Same retrieval as /api/ask for the articles.
import { expandQuery, retrieve, type LlmCall } from "./ask";
import { getDb, type Article } from "./db";
import { citation, decisionUrl, teaser, type Decision } from "./decisions";
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

type Row = Pick<Decision, "id" | "formation" | "date" | "numero" | "solution" | "sommaire" | "texte"> & { summary: string | null };
const COLS = "d.id, d.formation, d.date, d.numero, d.solution, d.sommaire, d.texte, s.summary";

/** Decisions applying the retrieved articles, then full-text matches; most relevant first, capped. */
export function findDecisions(q: string, words: string, articles: Pick<Article, "id">[], limit = MAX_DECISIONS): Row[] {
  const db = getDb();
  const byArticle = articles.length
    ? (db
        .prepare(
          `SELECT ${COLS}, COUNT(*) AS hits FROM decision_articles da JOIN decisions d ON d.id = da.decision_id
           LEFT JOIN decision_summaries s ON s.decision_id = d.id
           WHERE da.article_id IN (${articles.map(() => "?").join(",")}) GROUP BY d.id ORDER BY hits DESC, d.date DESC LIMIT 12`,
        )
        .all(...articles.map((a) => a.id)) as Row[])
    : [];
  // FTS5 query: OR of the distinct significant words (quoted, so user input can't inject FTS syntax).
  const terms = [...new Set(`${q} ${words}`.toLowerCase().match(/[\p{L}\d]{4,}/gu) ?? [])].slice(0, 12);
  const byText = terms.length
    ? (db
        .prepare(
          `SELECT ${COLS} FROM decisions_fts f JOIN decisions d ON d.rowid = f.rowid LEFT JOIN decision_summaries s ON s.decision_id = d.id
           WHERE decisions_fts MATCH ? ORDER BY bm25(decisions_fts, 5, 3, 1) LIMIT 12`,
        )
        .all(terms.map((t) => `"${t}"`).join(" OR ")) as Row[])
    : [];
  // Interleave: a decision found both ways ranks by its first appearance.
  const seen = new Set<string>();
  return Array.from({ length: 12 }, (_, i) => [byArticle[i], byText[i]])
    .flat()
    .filter((d): d is Row => !!d && !seen.has(d.id) && !!seen.add(d.id))
    .slice(0, limit);
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
