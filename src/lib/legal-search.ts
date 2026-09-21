// Internal legal search over the knowledge graph, independent of any UI (pages, API, future RAG / Loilà Pro).
// QUESTION → articles (FTS + expansion, ask.ts) → decisions (filters + FTS over the decisions) → passages (FTS
// snippets) → an answer written by the caller. The AI never is the source: every item here is a stored row.
import { getDb } from "./db";
import { citation, decisionUrl } from "./decisions";
import { normalizePourvoi } from "./legal-graph";

export type DecisionFilters = {
  q?: string; // full text (titre, sommaire, texte)
  articleIds?: string[]; // applies ANY of these articles
  codes?: string[]; // applies an article of ANY of these codes
  since?: string; // YYYY-MM-DD, inclusive
  until?: string;
  juridictions?: string[]; // exact labels, e.g. "Cour de cassation", "Conseil constitutionnel"
  formations?: string[]; // e.g. CHAMBRE_CIVILE_3, QPC
  sources?: string[]; // cass | inca | capp | jade | constit
  numero?: string; // pourvoi / requête, any written form
  solution?: string; // substring, case-insensitive: "cassation", "rejet"
  publie?: boolean;
  limit?: number; // default 20, max 100
  offset?: number; // relevance order (with q) pages by offset; date order by cursor
  cursor?: string; // "YYYY-MM-DD_ID" of the last row (date order only)
};

export type DecisionHit = {
  id: string; url: string; citation: string; juridiction: string; formation: string | null; date: string; numero: string | null;
  solution: string | null; publie: number; snippet: string | null; summary: string | null;
};

/** FTS5 query from free text: OR of quoted significant words (user input can never inject FTS syntax). */
export function ftsQuery(q: string, max = 12) {
  const words = [...new Set(q.toLowerCase().match(/[\p{L}\d]{4,}/gu) ?? [])].slice(0, max);
  return words.map((w) => `"${w}"`).join(" OR ");
}

export function searchDecisions(f: DecisionFilters): { rows: DecisionHit[]; next: string | null } {
  const limit = Math.min(Math.max(f.limit ?? 20, 1), 100);
  const where: string[] = [];
  const params: unknown[] = [];
  const inList = (col: string, vals: string[]) => {
    where.push(`${col} IN (${vals.map(() => "?").join(",")})`);
    params.push(...vals);
  };
  const fts = f.q ? ftsQuery(f.q) : "";
  if (f.articleIds?.length) {
    where.push(`d.id IN (SELECT decision_id FROM decision_articles WHERE article_id IN (${f.articleIds.map(() => "?").join(",")}))`);
    params.push(...f.articleIds);
  }
  if (f.codes?.length) {
    where.push(`d.id IN (SELECT da.decision_id FROM decision_articles da JOIN articles a ON a.id = da.article_id WHERE a.code IN (${f.codes.map(() => "?").join(",")}))`);
    params.push(...f.codes);
  }
  if (f.since) { where.push("d.date >= ?"); params.push(f.since); }
  if (f.until) { where.push("d.date <= ?"); params.push(f.until); }
  if (f.juridictions?.length) inList("d.juridiction", f.juridictions);
  if (f.formations?.length) inList("d.formation", f.formations);
  if (f.sources?.length) inList("d.source", f.sources);
  if (f.numero) { where.push("d.id IN (SELECT decision_id FROM decision_numbers WHERE numero = ?)"); params.push(normalizePourvoi(f.numero)); }
  if (f.solution) { where.push("d.solution LIKE ?"); params.push(`%${f.solution}%`); }
  if (f.publie !== undefined) { where.push("d.publie = ?"); params.push(f.publie ? 1 : 0); }
  const byDate = !fts;
  if (byDate && f.cursor) {
    const [date, id] = f.cursor.split("_");
    where.push("(d.date < ? OR (d.date = ? AND d.id < ?))");
    params.push(date, date, id);
  }
  const sql = fts
    ? `SELECT d.id, d.juridiction, d.formation, d.date, d.numero, d.solution, d.publie, s.summary,
              snippet(decisions_fts, -1, '«', '»', '…', 28) AS snippet
       FROM decisions_fts JOIN decisions d ON d.rowid = decisions_fts.rowid LEFT JOIN decision_summaries s ON s.decision_id = d.id
       WHERE decisions_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
       ORDER BY bm25(decisions_fts, 5, 3, 1), d.date DESC LIMIT ? OFFSET ?`
    : `SELECT d.id, d.juridiction, d.formation, d.date, d.numero, d.solution, d.publie, s.summary, NULL AS snippet
       FROM decisions d LEFT JOIN decision_summaries s ON s.decision_id = d.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY d.date DESC, d.id DESC LIMIT ? OFFSET ?`;
  const all = getDb()
    .prepare(sql)
    .all(...(fts ? [fts] : []), ...params, limit + 1, byDate ? 0 : (f.offset ?? 0)) as Omit<DecisionHit, "url" | "citation">[];
  const more = all.length > limit;
  const rows = all.slice(0, limit).map((r) => ({ ...r, url: decisionUrl(r), citation: citation(r) }));
  return { rows, next: more && byDate ? `${rows.at(-1)!.date}_${rows.at(-1)!.id}` : null };
}

/** The passages of one decision that match a question (FTS snippets over the full text), for RAG context. */
export function decisionPassages(id: string, q: string, max = 3): string[] {
  const fts = ftsQuery(q);
  if (!fts) return [];
  const row = getDb()
    .prepare(
      `SELECT snippet(decisions_fts, 2, '', '', '…', 48) AS a, snippet(decisions_fts, 1, '', '', '…', 48) AS b
       FROM decisions_fts JOIN decisions d ON d.rowid = decisions_fts.rowid WHERE decisions_fts MATCH ? AND d.id = ?`,
    )
    .get(fts, id) as { a: string | null; b: string | null } | undefined;
  return [row?.b, row?.a].filter((s): s is string => !!s && s.length > 20).slice(0, max);
}
