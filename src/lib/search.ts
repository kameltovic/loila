import { getDb, type Article } from "./db";

const STOPWORDS = new Set(
  `a à au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur leurs lui ma mais me
  même mes moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une
  vos votre vous y d l j m n s t c est sont été être avoir ai as avez ont eu fait faire peut puis-je puis dois doit
  quand comment quel quelle quels quelles quoi si plus moins tout tous toute toutes très sans sous entre vers chez
  alors donc car ni or aussi bien comme cela ça ceci celui celle ceux mon ma mes`.split(/\s+/),
);

// Codes spell numbers and units in words ("vingt mètres carrés"); users type "20 m2".
// ponytail: tiny hand-made lay->legal expansion list, grow it from real failed queries.
const NUMBERS = "zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept dix-huit dix-neuf vingt".split(" ");
const TENS: Record<string, string> = { 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante", 100: "cent", 150: "cent cinquante" };
const EXPAND: Record<string, string> = {
  m2: "mètres carrés", "m²": "mètres carrés", m: "mètres", km: "kilomètres",
  extension: "surface plancher emprise", agrandissement: "surface plancher emprise", agrandir: "surface plancher emprise",
  caution: "dépôt garantie", proprio: "bailleur", propriétaire: "bailleur",
  virer: "licenciement", viré: "licenciement", chômage: "privation emploi",
};

/** Turn arbitrary user text into a safe FTS5 query: quoted terms, OR-joined, prefix * for words >= 4 chars. */
export function toFtsQuery(input: string): string {
  const terms = new Set<string>();
  const words = input.toLowerCase().replace(/m²/g, " m2 ").split(/[^\p{L}\p{N}]+/u);
  for (const w of [...words]) {
    const n = /^\d+$/.test(w) ? +w : NaN;
    const extra = EXPAND[w] ?? (n <= 20 ? NUMBERS[n] : TENS[w]);
    if (extra) words.push(...extra.split(/[\s-]+/));
  }
  for (const w of words) {
    if (!w || STOPWORDS.has(w) || (w.length < 2 && !/\d/.test(w))) continue;
    terms.add(w.length >= 4 ? `"${w}"*` : `"${w}"`);
  }
  return [...terms].join(" OR ");
}

export function searchArticles(
  query: string,
  opts: { codes?: string[]; limit?: number } = {},
): (Article & { snippet: string })[] {
  const match = toFtsQuery(query);
  if (!match) return [];
  const codes = opts.codes?.length ? opts.codes : null;
  const sql = `SELECT a.*, snippet(articles_fts, 2, '<mark>', '</mark>', '…', 24) AS snippet
    FROM articles_fts JOIN articles a ON a.rowid = articles_fts.rowid
    WHERE articles_fts MATCH ? ${codes ? `AND a.code IN (${codes.map(() => "?").join(",")})` : ""}
    ORDER BY bm25(articles_fts, 2.0, 1.5, 1.0) LIMIT ?`;
  return getDb().prepare(sql).all(match, ...(codes ?? []), opts.limit ?? 10) as (Article & { snippet: string })[];
}

export function getArticle(id: string): Article | undefined {
  return getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as Article | undefined;
}

export function getArticleByNum(code: string, num: string): Article | undefined {
  return getDb().prepare("SELECT * FROM articles WHERE code = ? AND num = ?").get(code, num) as Article | undefined;
}
