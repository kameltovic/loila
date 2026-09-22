import { getDb } from "./db";

// Journal officiel (JORF) layer of the legal graph. Edges come from the <LIENS> of LEGI/KALI articles
// (scripts/legal-jorf.ts); text metadata from the JORF dump (DILA). Relations, from the article's side:
export type JorfRelation = "cree" | "modifie" | "abroge" | "deplace" | "codifie" | "cite" | "cite_par" | "applique";

// typelien/sens as written in LEGI → relation. Verified on the dump: for MODIFIE/cible and CREE/cible the text is
// signed before the version's DATE_DEBUT in 99 % of cases ("modifié par", "créé par"); ABROGE/cible carries
// scheduled repeals (future dates). CONCORDANCE, TXT_SOURCE, RECTIFICATION… are bookkeeping and are skipped.
export const LEGI_RELATION: Record<string, JorfRelation> = {
  "CREE/cible": "cree", "CREATION/source": "cree",
  "MODIFIE/cible": "modifie", "MODIFICATION/source": "modifie",
  "ABROGE/cible": "abroge", "ABROGATION/source": "abroge",
  "DEPLACE/cible": "deplace", "DEPLACEMENT/source": "deplace", "TRANSFERE/cible": "deplace", "TRANSFERT/source": "deplace",
  "CODIFICATION/source": "codifie",
  "CITATION/cible": "cite", "CITATION/source": "cite_par",
  "SPEC_APPLI/source": "applique",
};

export type JorfLink = { cid: string; nature: string; num: string; nor: string; date: string; label: string; relation: JorfRelation; article: string };

const attr = (s: string, k: string) => s.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1] ?? "";

/** JORF links of one LEGI/KALI article XML (only JORFTEXT targets with a known relation). */
export function parseJorfLinks(xml: string): JorfLink[] {
  const block = xml.match(/<LIENS>([\s\S]*?)<\/LIENS>/)?.[1];
  if (!block) return [];
  const out: JorfLink[] = [];
  for (const m of block.matchAll(/<LIEN ([^>]*)>([^<]*)<\/LIEN>/g)) {
    const cid = attr(m[1], "cidtexte");
    const relation = LEGI_RELATION[`${attr(m[1], "typelien")}/${attr(m[1], "sens")}`];
    if (!cid.startsWith("JORFTEXT") || !relation) continue;
    const date = attr(m[1], "datesignatexte");
    out.push({
      cid, relation, nature: attr(m[1], "naturetexte"), num: attr(m[1], "numtexte"), nor: attr(m[1], "nortexte"),
      date: date.startsWith("2999") ? "" : date, label: m[2].trim(), article: relation === "codifie" ? "" : attr(m[1], "num"),
    });
  }
  return out;
}

export const NATURE_LABEL: Record<string, string> = {
  LOI: "Loi", LOI_ORGANIQUE: "Loi organique", ORDONNANCE: "Ordonnance", DECRET: "Décret", DECRET_LOI: "Décret-loi",
  ARRETE: "Arrêté", DECISION: "Décision", CONSTITUTION: "Constitution", DELIBERATION: "Délibération", CIRCULAIRE: "Circulaire",
};

const frDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^1 /, "1er ");

/** "Loi n° 2025-391 du 30 avril 2025" from the link attributes, else the cleaned LEGI label. */
export function shortTitle(l: Pick<JorfLink, "nature" | "num" | "date" | "label">): string {
  if (NATURE_LABEL[l.nature] && l.num && l.date) return `${NATURE_LABEL[l.nature]} n° ${l.num} du ${frDate(l.date)}`;
  return l.label.replace(/\s+-\s+art\..*$/, "").replace(/,?\s*v\. init\.?$/, "").replace(/\s*\([A-Za-z]{0,4}\)$/, "").trim() || l.label;
}

/** Object of the text without its "LOI n° … du …" prefix: "pour l'accès au logement et un urbanisme rénové". */
export const titleObject = (t: { titre_full: string | null }) =>
  (t.titre_full ?? "").replace(/^(loi(\s+organique)?|ordonnance|d[ée]cret(-loi)?|arr[êe]t[ée])(?=\s)[^]*?\sdu\s+\d{1,2}(er)?\s+\S+\s+\d{4}\s*,?\s*/i, "").trim();

const collator = new Intl.Collator("fr", { numeric: true });
/** Natural order of article numbers: L200-2 before L200-11. */
export const byArticleNum = (a: { num: string }, b: { num: string }) => collator.compare(a.num, b.num);

export const jorfUrl = (id: string) => `/jo/${id}`;
export const legifranceJorfUrl = (id: string) => `https://www.legifrance.gouv.fr/jorf/id/${id}`;

export type JorfText = {
  id: string; nature: string | null; num: string | null; nor: string | null; date_texte: string | null; date_publi: string | null;
  jo: string | null; titre: string; titre_full: string | null; eli: string | null; fetched_at: number | null;
};

export const getJorfText = (id: string) => getDb().prepare("SELECT * FROM jorf_texts WHERE id = ?").get(id) as JorfText | undefined;

export type JorfArticleRow = { article_id: string; code: string; num: string; jorf_article: string; relation: JorfRelation };

/** Articles of the graph linked to a JORF text, by relation. */
export const articlesForJorf = (id: string) =>
  getDb()
    .prepare(
      `SELECT l.article_id, a.code, a.num, l.jorf_article, l.relation
       FROM jorf_article_links l JOIN articles a ON a.id = l.article_id
       WHERE l.jorf_text_id = ? ORDER BY a.code, a.num_norm, a.num`,
    )
    .all(id) as JorfArticleRow[];

export type ArticleJorfRow = JorfText & { jorf_article: string; relation: JorfRelation };

/** JORF texts linked to one article (current version), most recent first. */
export const jorfForArticle = (articleId: string) =>
  getDb()
    .prepare(
      `SELECT t.*, l.jorf_article, l.relation FROM jorf_article_links l JOIN jorf_texts t ON t.id = l.jorf_text_id
       WHERE l.article_id = ? ORDER BY COALESCE(t.date_texte, '') DESC`,
    )
    .all(articleId) as ArticleJorfRow[];

export const decisionsForJorf = (id: string, limit = 30) =>
  getDb()
    .prepare(
      `SELECT d.id, d.source, d.juridiction, d.formation, d.date, d.numero, d.solution, d.titre, d.sommaire, l.mentions
       FROM jorf_decision_links l JOIN decisions d ON d.id = l.decision_id
       WHERE l.jorf_text_id = ? ORDER BY d.date DESC LIMIT ?`,
    )
    .all(id, limit) as { id: string; source: string; juridiction: string | null; formation: string | null; date: string; numero: string | null; solution: string | null; titre: string | null; sommaire: string | null; mentions: number }[];

export const decisionCountForJorf = (id: string) =>
  (getDb().prepare("SELECT COUNT(*) n FROM jorf_decision_links l JOIN decisions d ON d.id = l.decision_id WHERE l.jorf_text_id = ?").get(id) as { n: number }).n;

// "loi n° 89-462", "décret n°2016-472", "ordonnance n° 58-1067", "loi organique n° 2009-1523".
export const LAW_REF = /\b(loi\s+organique|loi|ordonnance|d[ée]cret)\s+n[°o]\s*(\d{2,4}-\d{1,5})\b/gi;
const FAMILY: Record<string, string[]> = { loi: ["LOI", "LOI_ORGANIQUE"], "loi organique": ["LOI_ORGANIQUE", "LOI"], ordonnance: ["ORDONNANCE"], decret: ["DECRET", "DECRET_LOI"] };

/** "loi n° X" mentions in a text, resolved against known JORF texts: Map<JORFTEXT, occurrences>. Ambiguous numbers are skipped. */
export function resolveLawRefs(text: string, byNum: Map<string, { id: string; nature: string | null }[]>): Map<string, number> {
  const found = new Map<string, number>();
  for (const m of text.matchAll(LAW_REF)) {
    const family = FAMILY[m[1].toLowerCase().replace("é", "e").replace(/\s+/g, " ")] ?? [];
    const hits = (byNum.get(m[2]) ?? []).filter((t) => family.includes(t.nature ?? ""));
    if (hits.length === 1) found.set(hits[0].id, (found.get(hits[0].id) ?? 0) + 1);
  }
  return found;
}
