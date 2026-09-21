import { getDb, type Article } from "./db";

export type Decision = {
  id: string; source: string; juridiction: string; formation: string | null; date: string; numero: string | null;
  solution: string | null; titre: string; ecli: string | null; publie: number; sommaire: string | null; texte: string; url: string;
};
export type DecisionSummary = { decision_id: string; summary: string; points: string; model: string | null; created_at: number };

const FORMATIONS: Record<string, [string, string]> = {
  CHAMBRE_SOCIALE: ["Chambre sociale", "soc."],
  CHAMBRE_CIVILE_1: ["1re chambre civile", "civ. 1re"],
  CHAMBRE_CIVILE_2: ["2e chambre civile", "civ. 2e"],
  CHAMBRE_CIVILE_3: ["3e chambre civile", "civ. 3e"],
  CHAMBRE_COMMERCIALE: ["Chambre commerciale", "com."],
  CHAMBRE_CRIMINELLE: ["Chambre criminelle", "crim."],
  ASSEMBLEE_PLENIERE: ["Assemblée plénière", "ass. plén."],
  CHAMBRE_MIXTE: ["Chambre mixte", "ch. mixte"],
  AVIS: ["Avis", "avis"],
};
export const formationLabel = (f: string | null) => (f && FORMATIONS[f]?.[0]) || "Cour de cassation";
/** "23-20428" → "23-20.428" (how pourvoi numbers are cited). */
export const pourvoi = (n: string | null) => (n ?? "").replace(/^(\d{2}-\d{2})(\d{3})$/, "$1.$2");
const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
/** Short citation, e.g. "Cass. soc., 2 juillet 2025, n° 23-20.428". */
export const citation = (d: Pick<Decision, "formation" | "date" | "numero">) =>
  `Cass. ${(d.formation && FORMATIONS[d.formation]?.[1]) || ""}, ${frDate(d.date)}${d.numero ? `, n° ${pourvoi(d.numero)}` : ""}`.replace("Cass. ,", "Cass.,");
export const decisionUrl = (d: Pick<Decision, "id">) => `/jurisprudence/${d.id}`;

export const getDecision = (id: string) => getDb().prepare("SELECT * FROM decisions WHERE id = ?").get(id) as Decision | undefined;

export function decisionSummary(id: string): { summary: string; points: string[] } | undefined {
  const row = getDb().prepare("SELECT * FROM decision_summaries WHERE decision_id = ?").get(id) as DecisionSummary | undefined;
  if (!row) return undefined;
  try {
    return { summary: row.summary, points: JSON.parse(row.points) as string[] };
  } catch {
    return { summary: row.summary, points: [] };
  }
}

/** Most recent decisions applying an article, and how many there are in total. */
export function decisionsForArticle(articleId: string, limit = 6) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.id, d.formation, d.date, d.numero, d.solution, d.sommaire FROM decision_articles da JOIN decisions d ON d.id = da.decision_id
       WHERE da.article_id = ? ORDER BY d.date DESC LIMIT ?`,
    )
    .all(articleId, limit) as Pick<Decision, "id" | "formation" | "date" | "numero" | "solution" | "sommaire">[];
  const total = (db.prepare("SELECT COUNT(*) n FROM decision_articles WHERE article_id = ?").get(articleId) as { n: number }).n;
  return { rows, total };
}

/** Articles a decision applies (only those present on Loilà). */
export const decisionArticles = (id: string) =>
  getDb()
    .prepare("SELECT a.* FROM decision_articles da JOIN articles a ON a.id = da.article_id WHERE da.decision_id = ? ORDER BY a.code, a.num")
    .all(id) as Article[];

/** Other decisions sharing the most articles with this one, most recent first on ties. */
export const relatedDecisions = (id: string, limit = 5) =>
  getDb()
    .prepare(
      `SELECT d.id, d.formation, d.date, d.numero, d.solution, COUNT(*) AS shared FROM decision_articles me
       JOIN decision_articles o ON o.article_id = me.article_id AND o.decision_id <> me.decision_id
       JOIN decisions d ON d.id = o.decision_id
       WHERE me.decision_id = ? GROUP BY d.id ORDER BY shared DESC, d.date DESC LIMIT ?`,
    )
    .all(id, limit) as (Pick<Decision, "id" | "formation" | "date" | "numero" | "solution"> & { shared: number })[];

/** First sentence(s) of the official abstract, for lists. */
export const teaser = (s: string | null, max = 280) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, t.lastIndexOf(" ", max))}…`;
};

// ---------- Legal graph reads (bounded: pages never load thousands of relations) ----------

export type ArticleStats = { decisions: number; first_date: string | null; last_date: string | null; by_year: Record<string, number>; by_formation: Record<string, number> };
export function articleStats(articleId: string): ArticleStats | undefined {
  const r = getDb().prepare("SELECT decisions, first_date, last_date, by_year, by_formation FROM article_stats WHERE article_id = ?").get(articleId) as
    | { decisions: number; first_date: string | null; last_date: string | null; by_year: string; by_formation: string }
    | undefined;
  return r && { ...r, by_year: JSON.parse(r.by_year), by_formation: JSON.parse(r.by_formation) };
}

/** Articles most often cited together with this one in case law (co-citation graph, cosine score). */
export const coCitedByCaseLaw = (articleId: string, limit = 8) =>
  getDb()
    .prepare(
      `SELECT a.id, a.code, a.num, r.shared, r.score FROM article_relations r JOIN articles a ON a.id = r.b_id
       WHERE r.a_id = ? AND r.kind = 'co_citation' ORDER BY r.score DESC LIMIT ?`,
    )
    .all(articleId, limit) as { id: string; code: string; num: string; shared: number; score: number }[];

/** Previous / next article in the code's order (import order follows the code's structure). */
export function articleNeighbors(articleId: string) {
  const db = getDb();
  const cur = db.prepare("SELECT rowid AS r, code FROM articles WHERE id = ?").get(articleId) as { r: number; code: string } | undefined;
  if (!cur) return {};
  const prev = db.prepare("SELECT id, num FROM articles WHERE code = ? AND rowid < ? ORDER BY rowid DESC LIMIT 1").get(cur.code, cur.r) as { id: string; num: string } | undefined;
  const next = db.prepare("SELECT id, num FROM articles WHERE code = ? AND rowid > ? ORDER BY rowid LIMIT 1").get(cur.code, cur.r) as { id: string; num: string } | undefined;
  return { prev, next };
}

/** Keyset pagination over an article's decisions, most recent first. Cursor: "YYYY-MM-DD_JURITEXT…" of the last row. */
export function decisionsPage(articleId: string, cursor?: string, limit = 20) {
  const [date, id] = (cursor ?? "").split("_");
  const rows = getDb()
    .prepare(
      `SELECT d.id, d.juridiction, d.formation, d.date, d.numero, d.solution, d.publie, d.sommaire FROM decision_articles da JOIN decisions d ON d.id = da.decision_id
       WHERE da.article_id = ? ${cursor ? "AND (d.date < ? OR (d.date = ? AND d.id < ?))" : ""} ORDER BY d.date DESC, d.id DESC LIMIT ?`,
    )
    .all(...(cursor ? [articleId, date, date, id, limit + 1] : [articleId, limit + 1])) as Pick<Decision, "id" | "juridiction" | "formation" | "date" | "numero" | "solution" | "publie" | "sommaire">[];
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  return { rows: page, next: more ? `${page.at(-1)!.date}_${page.at(-1)!.id}` : null };
}

/** Relations stated by the data: same case, decisions it cites / that cite it, decision under appeal. */
export function decisionLinks(id: string) {
  const db = getDb();
  const out = db
    .prepare(
      `SELECT r.kind, r.target_ref, r.to_id, d.formation, d.date, d.numero, d.solution FROM decision_relations r
       LEFT JOIN decisions d ON d.id = r.to_id WHERE r.from_id = ? ORDER BY r.kind, d.date DESC LIMIT 30`,
    )
    .all(id) as { kind: string; target_ref: string; to_id: string | null; formation: string | null; date: string | null; numero: string | null; solution: string | null }[];
  const citedBy = db
    .prepare(
      `SELECT d.id, d.formation, d.date, d.numero, d.solution FROM decision_relations r JOIN decisions d ON d.id = r.from_id
       WHERE r.to_id = ? AND r.kind = 'cites' ORDER BY d.date DESC LIMIT 10`,
    )
    .all(id) as Pick<Decision, "id" | "formation" | "date" | "numero" | "solution">[];
  const appeal = out.find((r) => r.kind === "appeal_from");
  const [appealCourt, appealDate] = appeal ? appeal.target_ref.split("|") : [];
  return {
    sameCase: out.filter((r) => r.kind === "same_case" && r.to_id),
    cites: out.filter((r) => r.kind === "cites" && r.to_id),
    citedBy,
    appeal: appeal ? { court: appealCourt, date: appealDate } : undefined,
  };
}
