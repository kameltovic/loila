import { statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import type { Metadata } from "next";

export const SITE_URL = (process.env.SITE_URL ?? "https://loila.fr").replace(/\/$/, "");
export const SITE_NAME = "Loilà";

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

const GENERIC_OG = ["/", "/tarifs", "/cgv", "/a-propos", "/mentions-legales", "/connexion", "/compte", "/merci"];
export const ogImagePath = (path: string) => (GENERIC_OG.includes(path) ? "/og/index.png" : `/og${path.replace(/\/$/, "")}.png`);

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  // Default share image: /og/<path>.png (rendered by src/app/og/[...slug]/route.ts); pages without their own design use the home image.
  const images = [{ url: abs(image ?? ogImagePath(path)), width: 1200, height: 630, alt: title, type: "image/png" }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

/** Trim to `max` chars on a word boundary, with an ellipsis. */
export function clip(text: string, max = 155): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.–—-]+$/, "") + "…";
}

/** Strip markdown to plain text (for JSON-LD answers and descriptions). */
export function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const legifranceUrl = (articleId: string) =>
  `https://www.legifrance.gouv.fr/codes/article_lc/${articleId}`;

export function JsonLd({ data }: { data: object | object[] }) {
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  });
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      ...(f.path && { url: abs(f.path) }),
      acceptedAnswer: { "@type": "Answer", text: plain(f.answer) },
    })),
  };
}

/**
 * Content freshness date (DB file mtime: FAQ batch + daily Légifrance sync write to it).
 * ponytail: DB-wide, not per page; add a faq.updated_at column when per-answer dates matter.
 */
export function contentUpdatedAt(): Date {
  try {
    return statSync(process.env.DATABASE_PATH ?? join(process.cwd(), "data", "loila.db")).mtime;
  } catch {
    return new Date();
  }
}
