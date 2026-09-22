// SEO_ELIGIBLE: the single source of truth for "is this page worth indexing?".
// Both generateMetadata and the sitemap consume it, so the sitemap can never list a noindex URL
// (docs/research/2026-09-seo-search.md §3). Every rule is deterministic and reads stored rows only.
import { getDb } from "./db";
import { texteSha } from "./articles";
import { getLettres } from "./lettres";
import { getArticleByNum } from "./search";

export type IndexableArticle = { id: string; date_debut: string | null };

/** Articles cited by a letter's legal tips, resolved once (batch, no per-letter DB round-trip storm). */
function letterCitedArticleIds(): Set<string> {
  const ids = new Set<string>();
  for (const l of getLettres()) {
    for (const ref of l.tips.flatMap((t) => t.refs)) {
      const i = ref.indexOf(":");
      if (i <= 0) continue;
      const a = getArticleByNum(ref.slice(0, i), ref.slice(i + 1));
      if (a) ids.add(a.id);
    }
  }
  return ids;
}

/**
 * Indexable articles (§3.1): cited by a FAQ answer OR by a letter tip OR (a fresh "En clair" summary
 * AND at least one linked decision). The other ~100k raw articles stay noindex.
 */
export function indexableArticles(): IndexableArticle[] {
  const db = getDb();
  const out = new Map<string, string | null>();
  for (const r of db
    .prepare("SELECT DISTINCT a.id, a.date_debut FROM faq, json_each(faq.article_ids) j JOIN articles a ON a.id = j.value")
    .all() as IndexableArticle[]) {
    out.set(r.id, r.date_debut);
  }
  for (const id of letterCitedArticleIds()) {
    if (out.has(id)) continue;
    const a = db.prepare("SELECT date_debut FROM articles WHERE id = ?").get(id) as { date_debut: string | null } | undefined;
    if (a) out.set(id, a.date_debut);
  }
  const withSummary = db
    .prepare(
      `SELECT a.id, a.date_debut, a.texte, s.texte_sha FROM articles a JOIN article_summaries s ON s.article_id = a.id
       WHERE EXISTS (SELECT 1 FROM decision_articles da WHERE da.article_id = a.id)`,
    )
    .all() as { id: string; date_debut: string | null; texte: string; texte_sha: string }[];
  for (const r of withSummary) if (texteSha(r.texte) === r.texte_sha) out.set(r.id, r.date_debut);
  return [...out].map(([id, date_debut]) => ({ id, date_debut }));
}

/** Single-article variant for generateMetadata. */
export function articleIndexable(a: { id: string; texte: string }): boolean {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM faq, json_each(faq.article_ids) j WHERE j.value = ? LIMIT 1").get(a.id)) return true;
  if (letterCitedArticleIds().has(a.id)) return true;
  const s = db.prepare("SELECT texte_sha FROM article_summaries WHERE article_id = ?").get(a.id) as { texte_sha: string } | undefined;
  if (s && s.texte_sha === texteSha(a.texte)) {
    return (db.prepare("SELECT COUNT(*) n FROM decision_articles WHERE article_id = ?").get(a.id) as { n: number }).n > 0;
  }
  return false;
}

/** Indexable decisions (§3.2): only those carrying our own plain-language summary. */
export function indexableDecisions(): { id: string; date: string }[] {
  return getDb()
    .prepare("SELECT d.id, d.date FROM decisions d JOIN decision_summaries s ON s.decision_id = d.id")
    .all() as { id: string; date: string }[];
}

export const decisionIndexable = (id: string): boolean =>
  !!getDb().prepare("SELECT 1 FROM decision_summaries WHERE decision_id = ? LIMIT 1").get(id);

/** Full case-law lists (§3.3): indexable only when the parent article is indexable AND it has decisions. */
export function indexableJurisprudenceLists(): { id: string }[] {
  const stats = getDb().prepare("SELECT article_id AS id FROM article_stats WHERE decisions > 6").all() as { id: string }[];
  const articles = new Map(indexableArticles().map((a) => [a.id, true]));
  return stats.filter((s) => articles.has(s.id));
}

/** Jurisprudence list of one article, for its own generateMetadata. */
export function jurisprudenceListIndexable(articleId: string, article: { id: string; texte: string }): boolean {
  const n = (getDb().prepare("SELECT decisions FROM article_stats WHERE article_id = ?").get(articleId) as { decisions: number } | undefined)?.decisions ?? 0;
  return n > 6 && articleIndexable(article); // ≤ 6: the article page already shows them all (duplicate list)
}

/** Companies with at least one sourced block (mirrors company.ts, kept here so sitemap has one entry point). */
export function indexableCompanies(): { siren: string; fetched_at: number | null }[] {
  return getDb()
    .prepare(
      `SELECT c.siren, c.fetched_at FROM companies c
       WHERE c.etat_administratif = 'A' AND COALESCE(c.statut_diffusion, 'O') <> 'P'
         AND (EXISTS (SELECT 1 FROM company_announcements a WHERE a.siren = c.siren)
           OR EXISTS (SELECT 1 FROM rge_certifications r WHERE r.siren = c.siren)
           OR EXISTS (SELECT 1 FROM company_agreements g WHERE g.siren = c.siren))`,
    )
    .all() as { siren: string; fetched_at: number | null }[];
}

/** Addresses with at least one sourced block (DPE/risk/PLU, or a DVF transaction on the linked parcel).
 *  Mirrors `addressIndexable` exactly so the sitemap can never list a noindex address page. */
export function indexableAddresses(): { ban_id: string; fetched_at: number | null }[] {
  return getDb()
    .prepare(
      `SELECT a.ban_id, a.fetched_at FROM addresses a
       WHERE EXISTS (SELECT 1 FROM dpe_diagnostics d WHERE d.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM risks r WHERE r.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM urban_zones z WHERE z.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM transactions t JOIN parcel_addresses pa ON pa.parcel_id = t.id_parcelle WHERE pa.ban_id = a.ban_id)`,
    )
    .all() as { ban_id: string; fetched_at: number | null }[];
}

// Journal officiel texts (/jo/<id>): indexable only with the official JORF title AND a real graph footprint:
// ≥ 2 articles created/modified/repealed/moved/codified by the text, or ≥ 3 decisions citing it. Pure citations don't count.
// Joined to articles/decisions: the links snapshot may name rows this database doesn't carry (production has fewer decisions).
const JORF_INDEXABLE = `t.fetched_at > 0 AND (
  (SELECT COUNT(DISTINCT l.article_id) FROM jorf_article_links l JOIN articles a ON a.id = l.article_id
     WHERE l.jorf_text_id = t.id AND l.relation IN ('cree', 'modifie', 'abroge', 'deplace', 'codifie')) >= 2
  OR (SELECT COUNT(*) FROM jorf_decision_links d JOIN decisions x ON x.id = d.decision_id WHERE d.jorf_text_id = t.id) >= 3)`;

export const jorfIndexable = (id: string): boolean =>
  !!getDb().prepare(`SELECT 1 FROM jorf_texts t WHERE t.id = ? AND ${JORF_INDEXABLE}`).get(id);

export const indexableJorfTexts = (): { id: string; date_publi: string | null }[] =>
  getDb().prepare(`SELECT t.id, t.date_publi FROM jorf_texts t WHERE ${JORF_INDEXABLE} ORDER BY t.date_publi DESC`).all() as { id: string; date_publi: string | null }[];
