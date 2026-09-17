import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import Chat from "@/components/Chat";
import RelatedFaqs from "@/components/RelatedFaqs";
import ThemeIcon from "@/components/ThemeIcon";
import { ArticleDrawerProvider } from "@/components/ArticleDrawer";
import FaqAnswer, { faqArticles } from "@/components/FaqAnswer";
import { display, label } from "@/components/ui";
import { JsonLd, SITE_NAME, SITE_URL, abs, breadcrumbJsonLd, clip, contentUpdatedAt, faqJsonLd, ogImagePath, pageMetadata, plain } from "@/lib/seo";

export const dynamic = "force-dynamic";

function load(theme: string, slug: string) {
  return getDb().prepare("SELECT * FROM faq WHERE theme = ? AND slug = ? AND topic IS NULL" /* topic questions live under /sujets */).get(theme, slug) as Faq | undefined;
}

export async function generateMetadata({ params }: PageProps<"/[theme]/[faq]">): Promise<Metadata> {
  const { theme, faq: slug } = await params;
  const faq = load(theme, slug);
  if (!faq) return {};
  const meta = pageMetadata({ title: faq.question, description: clip(faq.short), path: `/${faq.theme}/${faq.slug}`, type: "article" });
  // Long questions skip the " · Loilà" suffix so the question itself isn't truncated in results.
  return faq.question.length > 52 ? { ...meta, title: { absolute: faq.question } } : meta;
}

export default async function FaqPage({ params }: PageProps<"/[theme]/[faq]">) {
  const { theme: themeSlug, faq: slug } = await params;
  const theme = THEMES.find((t) => t.slug === themeSlug);
  const faq = theme && load(theme.slug, slug);
  if (!theme || !faq) notFound();

  const articles = faqArticles(faq);

  const path = `/${theme.slug}/${faq.slug}`;
  const updated = contentUpdatedAt();
  const jsonLd = [
    breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: theme.title, path: `/${theme.slug}` }, { name: faq.question, path }]),
    faqJsonLd([{ question: faq.question, answer: `${faq.short}\n\n${faq.answer_md}`, path }]),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: faq.question,
      description: plain(faq.short),
      inLanguage: "fr-FR",
      mainEntityOfPage: abs(path),
      image: abs(ogImagePath(path)),
      dateModified: updated.toISOString(),
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: abs("/icon") } },
      about: theme.title,
      citation: articles.map((a) => ({ "@type": "Legislation", name: `Article ${a.num}, ${CODES[a.code as keyof typeof CODES]?.name ?? a.code}`, url: a.url })),
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-24">
      <JsonLd data={jsonLd} />
      <ArticleDrawerProvider>
        <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
          <Link href="/" className="hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4">
            Accueil
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/${theme.slug}`}
            className="inline-flex items-center gap-1.5 hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4"
          >
            <ThemeIcon slug={theme.slug} size={14} />
            {theme.title}
          </Link>
        </nav>
        <h1 className={`${display} mt-8 text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] text-balance`}>{faq.question}</h1>

        <FaqAnswer faq={faq} articles={articles} updated={updated} />
      </ArticleDrawerProvider>

      <RelatedFaqs faq={faq} />

      <div className="mt-20">
        <Chat theme={theme.slug} title="Poser une autre question" />
      </div>
    </article>
  );
}
