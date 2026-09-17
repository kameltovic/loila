import fs from "node:fs";
import path from "node:path";
import { getDb, type Article, type Faq } from "./db";
import { getArticleByNum } from "./search";

// Audience landing pages (/pour/<slug>), one JSON per métier in seed/metiers (shipped via outputFileTracingIncludes).
export type Metier = {
  slug: string;
  title: string;
  theme: string;
  seo: { title: string; description: string };
  h1: string;
  h1Accent: string;
  intro: string;
  audience: string[];
  obligations: { title: string; detail: string; refs: string[] }[];
  faqSlugs: string[];
  texts: string[];
  proPitch: string;
};

const DIR = path.join(process.cwd(), "seed", "metiers");

let cache: Metier[] | undefined;
export function getMetiers(): Metier[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort() : [];
  return (cache = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Metier));
}

export const getMetier = (slug: string) => getMetiers().find((m) => m.slug === slug);

/** "code-slug:num" → article (unknown refs are dropped, so a missing ingest never breaks the page). */
export function refArticles(refs: string[]): Article[] {
  return refs
    .map((r) => {
      const i = r.indexOf(":");
      return i > 0 ? getArticleByNum(r.slice(0, i), r.slice(i + 1)) : undefined;
    })
    .filter((a): a is Article => !!a);
}

/** FAQs in the métier's order; slugs not in the DB (not generated yet) are skipped. */
export function metierFaqs(m: Metier): Faq[] {
  if (!m.faqSlugs.length) return [];
  const rows = getDb()
    .prepare(`SELECT * FROM faq WHERE slug IN (${m.faqSlugs.map(() => "?").join(",")})`)
    .all(...m.faqSlugs) as Faq[];
  const bySlug = new Map(rows.map((f) => [f.slug, f]));
  return m.faqSlugs.map((s) => bySlug.get(s)).filter((f): f is Faq => !!f);
}
