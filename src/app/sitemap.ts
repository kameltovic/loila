import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { THEMES, faqUrl } from "@/lib/themes";
import { getTopics } from "@/lib/topics";
import { getMetiers } from "@/lib/metiers";
import { getLettres, lettreUrl } from "@/lib/lettres";
import { conventionUrl, getConventions } from "@/lib/conventions";
import { indexableAddresses, indexableArticles, indexableCompanies, indexableDecisions, indexableJurisprudenceLists } from "@/lib/eligibility";

export const revalidate = 3600;

// Split by entity family so Google can diagnose coverage per section (docs/research/2026-09-seo-search.md §4).
// Production URLs: /sitemap/0.xml … /sitemap/4.xml (Next 16 `generateSitemaps`). Each section lists ONLY
// indexable entities: `src/lib/eligibility.ts` is the single gate shared with page metadata.
const SECTIONS = ["core", "articles", "decisions", "contenus", "entites"] as const;

export function generateSitemaps() {
  return SECTIONS.map((_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const section = SECTIONS[Number(await id)] ?? "core";
  const url = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", lastModified?: Date) =>
    ({ url: `${SITE_URL}${path}`, ...(lastModified && { lastModified }), changeFrequency, priority });
  const date = (d: string | number | null | undefined) => (d ? new Date(typeof d === "number" ? d * 1000 : `${d.slice(0, 10)}T12:00:00`) : undefined);

  if (section === "core") {
    return [
      url("/", 1, "daily"),
      ...THEMES.map((t) => url(`/${t.slug}`, 0.9, "daily")),
      url("/sujets", 0.9, "daily"),
      url("/pour", 0.8),
      ...getMetiers().map((m) => url(`/pour/${m.slug}`, 0.9)),
      url("/modeles-lettres", 0.8),
      url("/relance-amiable", 0.9),
      url("/jurisprudence", 0.8, "daily"),
      url("/avocats", 0.8, "weekly"),
      url("/entreprise", 0.7, "daily"),
      url("/verifier-entreprise", 0.8, "weekly"),
      url("/bien", 0.7, "daily"),
      url("/verifier-un-bien", 0.8, "weekly"),
      url("/a-propos", 0.3, "monthly"),
      url("/tarifs", 0.6, "monthly"),
      url("/cgv", 0.2, "monthly"),
      url("/mentions-legales", 0.2, "monthly"),
    ];
  }

  if (section === "articles") {
    const articles = indexableArticles();
    const lists = new Set(indexableJurisprudenceLists().map((l) => l.id));
    return [
      ...articles.map((a) => ({ ...url(`/article/${a.id}`, 0.4, "monthly", date(a.date_debut)) })),
      ...articles.filter((a) => lists.has(a.id)).map((a) => url(`/article/${a.id}/jurisprudence`, 0.4, "weekly", date(a.date_debut))),
    ];
  }

  if (section === "decisions") {
    return indexableDecisions().map((d) => ({ ...url(`/jurisprudence/${d.id}`, 0.5, "monthly", date(d.date)) }));
  }

  if (section === "contenus") {
    const faqs = getDb().prepare("SELECT theme, slug, topic FROM faq ORDER BY id").all() as { theme: string; slug: string; topic: string | null }[];
    return [
      ...getLettres().map((l) => url(lettreUrl(l), 0.9)),
      ...getTopics().map((t) => url(`/sujets/${t.slug}`, 0.8)),
      ...getConventions().map((c) => url(conventionUrl(c), 0.8)),
      ...faqs.map((f) => url(faqUrl(f), 0.7)),
    ];
  }

  // section === "entites"
  return [
    ...indexableCompanies().map((c) => ({ ...url(`/entreprise/${c.siren}`, 0.5, "weekly", date(c.fetched_at)) })),
    ...indexableAddresses().map((a) => ({ ...url(`/bien/${a.ban_id}`, 0.5, "weekly", date(a.fetched_at)) })),
  ];
}
