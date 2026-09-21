import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { SITE_URL, contentUpdatedAt } from "@/lib/seo";
import { THEMES, faqUrl } from "@/lib/themes";
import { getTopics } from "@/lib/topics";
import { getMetiers } from "@/lib/metiers";
import { getLettres, lettreUrl } from "@/lib/lettres";
import { conventionUrl, getConventions } from "@/lib/conventions";

export const revalidate = 3600;

// ponytail: single file (a few thousand URLs today); switch to generateSitemaps once it nears 45k URLs.
export default function sitemap(): MetadataRoute.Sitemap {
  const db = getDb();
  const lastModified = contentUpdatedAt();
  const url = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") =>
    ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency, priority });

  const faqs = db.prepare("SELECT theme, slug, topic FROM faq ORDER BY id").all() as { theme: string; slug: string; topic: string | null }[];
  // Articles cited by at least one answer; uncited ones are noindex (thin raw text).
  const articles = db
    .prepare("SELECT DISTINCT a.id, a.date_debut FROM faq, json_each(faq.article_ids) j JOIN articles a ON a.id = j.value")
    .all() as { id: string; date_debut: string | null }[];

  return [
    url("/", 1, "daily"),
    ...THEMES.map((t) => url(`/${t.slug}`, 0.9, "daily")),
    url("/sujets", 0.9, "daily"),
    url("/pour", 0.8),
    ...getMetiers().map((m) => url(`/pour/${m.slug}`, 0.9)),
    url("/modeles-lettres", 0.8),
    ...getLettres().map((l) => url(lettreUrl(l), 0.9)),
    ...getTopics().map((t) => url(`/sujets/${t.slug}`, 0.8)),
    ...getConventions().map((c) => url(conventionUrl(c), 0.8)),
    ...faqs.map((f) => url(faqUrl(f), 0.7)),
    ...articles.map((a) => ({ ...url(`/article/${a.id}`, 0.4, "monthly"), ...(a.date_debut && { lastModified: new Date(a.date_debut) }) })),
    url("/a-propos", 0.3, "monthly"),
    url("/tarifs", 0.6, "monthly"),
    url("/cgv", 0.2, "monthly"),
    url("/mentions-legales", 0.2, "monthly"),
  ];
}
