import { createHash } from "node:crypto";
import { getDb, type Article, type ArticleSummary } from "./db";
import { normalizeNum } from "./legal-refs";

export const texteSha = (texte: string) => createHash("sha256").update(texte).digest("hex");

// ponytail: computed once per process; articles only change on deploy (seed bundles), which restarts the server.
let ambiguous: Set<string> | undefined;
/** (code, num_norm) pairs shared by several articles: conventions reuse numbers across avenants, codes repeat annex numbers. */
const ambiguousNums = () =>
  (ambiguous ??= new Set(
    (getDb().prepare("SELECT code || '|' || num_norm k FROM articles GROUP BY code, num_norm HAVING COUNT(*) > 1").all() as { k: string }[]).map((r) => r.k),
  ));

/** Canonical URL: /article/code-civil/1643 when the number names one article of its code, else /article/<Légifrance id>. */
export function articlePath(a: Pick<Article, "id" | "code" | "num">): string {
  const n = a.num ? normalizeNum(a.num) : "";
  return n && !ambiguousNums().has(`${a.code}|${n}`) ? `/article/${a.code}/${encodeURIComponent(n)}` : `/article/${a.id}`;
}

/** Reverse of articlePath: the single article of `code` numbered `num` (any spelling normalizeNum accepts). */
export function articleByPath(code: string, num: string): Article | undefined {
  const rows = getDb().prepare("SELECT * FROM articles WHERE code = ? AND num_norm = ? LIMIT 2").all(code, normalizeNum(num)) as Article[];
  return rows.length === 1 ? rows[0] : undefined;
}

// Section headings that say nothing about the article ("Dispositions générales", "Section unique"…).
const GENERIC = /^(dispositions?\b|autres dispositions|chapitre unique|section unique|ordre public|champ d'application|d[ée]finitions?|principes?( g[ée]n[ée]raux)?|fonctionnement|organisation|composition|missions|sanctions|proc[ée]dure|constitution|contr[ôo]le|publicit[ée]|cotisations|saint-|partie |livre |titre )/i;
const STOP = /(?:\s+(?:de|des|du|la|le|les|l'|d'|et|à|au|aux|en|pour|par|sur|ou))+$/i;

/**
 * 3-to-5-word topic for the title, from the deepest meaningful section heading:
 * "Paragraphe 2 : De la garantie des défauts de la chose vendue." → "Garantie des défauts de la chose vendue".
 */
export function articleTopic(section: string | null, max: number): string | undefined {
  const seg = (section ?? "")
    .split(" > ")
    .reverse()
    .map((s) => (s.includes(" : ") ? s.slice(s.indexOf(" : ") + 3) : ""))
    .map((s) => s.replace(/\s*\(.*?\)|\.$/g, "").replace(/^(?:de la|de l'|du|des|le|la|les|l')\s*/i, "").replace(/ et (?:de la |de l'|du )/g, " et ").trim())
    .find((s) => s && !GENERIC.test(s));
  if (!seg) return;
  let t = seg;
  while (t.length > max && t.includes(" ")) t = t.slice(0, t.lastIndexOf(" ")).replace(STOP, "");
  return t.length > max ? undefined : t.charAt(0).toUpperCase() + t.slice(1);
}

/** "En clair" summary of an article, only if it was written from the text currently in force. */
export function articleSummary(a: Pick<Article, "id" | "texte">): { summary: string; points: string[] } | undefined {
  const row = getDb().prepare("SELECT * FROM article_summaries WHERE article_id = ?").get(a.id) as ArticleSummary | undefined;
  if (!row || row.texte_sha !== texteSha(a.texte)) return undefined;
  try {
    return { summary: row.summary, points: JSON.parse(row.points) as string[] };
  } catch {
    return { summary: row.summary, points: [] };
  }
}

// "L. 1234-9", "R.1237-3", "D. 3141-1" (code articles). Bare "article 22" is skipped: often another law's article.
const REF = /\b([LRD])\.\s?(\d{3,4}(?:-\d+)*)\b/g;

/** Splits an article's text into plain and linked parts: references to other articles of the same code become links. */
export function linkRefs(texte: string, a: Pick<Article, "id" | "code">): { text: string; id?: string; path?: string }[] {
  const nums = [...new Set([...texte.matchAll(REF)].map((m) => `${m[1]}${m[2]}`))];
  if (!nums.length) return [{ text: texte }];
  const rows = getDb()
    .prepare(`SELECT id, code, num FROM articles WHERE code = ? AND num IN (${nums.map(() => "?").join(",")})`)
    .all(a.code, ...nums) as { id: string; code: string; num: string }[];
  const ids = new Map(rows.filter((r) => r.id !== a.id).map((r) => [r.num, r]));
  const out: { text: string; id?: string; path?: string }[] = [];
  let last = 0;
  for (const m of texte.matchAll(REF)) {
    const r = ids.get(`${m[1]}${m[2]}`);
    if (!r) continue;
    if (m.index > last) out.push({ text: texte.slice(last, m.index) });
    out.push({ text: m[0], id: r.id, path: articlePath(r) });
    last = m.index + m[0].length;
  }
  if (last < texte.length) out.push({ text: texte.slice(last) });
  return out;
}

/** Articles most often cited in the same answers as this one. */
export function coCitedArticles(id: string, limit = 6) {
  return getDb()
    .prepare(
      `SELECT a.id, a.code, a.num, COUNT(*) AS n FROM faq
       JOIN json_each(faq.article_ids) me ON me.value = ?
       JOIN json_each(faq.article_ids) other ON other.value <> ?
       JOIN articles a ON a.id = other.value
       GROUP BY a.id ORDER BY n DESC, a.num LIMIT ?`,
    )
    .all(id, id, limit) as { id: string; code: string; num: string; n: number }[];
}
