import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Chat from "@/components/Chat";
import { ArticleDrawerProvider } from "@/components/ArticleDrawer";
import FaqAnswer, { faqArticles } from "@/components/FaqAnswer";
import { display, label } from "@/components/ui";
import { getDb, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { JsonLd, SITE_NAME, SITE_URL, abs, breadcrumbJsonLd, clip, contentUpdatedAt, faqJsonLd, pageMetadata, plain } from "@/lib/seo";
import { getTopic } from "@/lib/topics";

export const dynamic = "force-dynamic";

function load(topic: string, slug: string) {
  return getDb().prepare("SELECT * FROM faq WHERE topic = ? AND slug = ?").get(topic, slug) as Faq | undefined;
}

export async function generateMetadata({ params }: PageProps<"/sujets/[topic]/[question]">): Promise<Metadata> {
  const { topic, question } = await params;
  const faq = load(topic, question);
  if (!faq) return {};
  const meta = pageMetadata({ title: faq.question, description: clip(faq.short), path: `/sujets/${topic}/${faq.slug}`, type: "article" });
  // Long questions skip the " · Loilà" suffix so the question itself isn't truncated in results.
  return faq.question.length > 52 ? { ...meta, title: { absolute: faq.question } } : meta;
}

export default async function TopicQuestionPage({ params }: PageProps<"/sujets/[topic]/[question]">) {
  const { topic: topicSlug, question } = await params;
  const topic = getTopic(topicSlug);
  const faq = topic && load(topic.slug, question);
  if (!topic || !faq) notFound();

  const articles = faqArticles(faq);
  const path = `/sujets/${topic.slug}/${faq.slug}`;
  const updated = contentUpdatedAt();
  const jsonLd = [
    breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Sujets", path: "/sujets" }, { name: topic.title, path: `/sujets/${topic.slug}` }, { name: faq.question, path }]),
    faqJsonLd([{ question: faq.question, answer: `${faq.short}\n\n${faq.answer_md}`, path }]),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: faq.question,
      description: plain(faq.short),
      inLanguage: "fr-FR",
      mainEntityOfPage: abs(path),
      image: abs(`${path}/opengraph-image`),
      dateModified: updated.toISOString(),
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: abs("/icon") } },
      about: topic.title,
      citation: articles.map((a) => ({ "@type": "Legislation", name: `Article ${a.num}, ${CODES[a.code as keyof typeof CODES]?.name ?? a.code}`, url: a.url })),
    },
  ];
  const crumb = "hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4";

  return (
    <article className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-24">
      <JsonLd data={jsonLd} />
      <ArticleDrawerProvider>
        <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
          <Link href="/" className={crumb}>Accueil</Link>
          <span aria-hidden>/</span>
          <Link href="/sujets" className={crumb}>Sujets</Link>
          <span aria-hidden>/</span>
          <Link href={`/sujets/${topic.slug}`} className={crumb}>{topic.title}</Link>
        </nav>
        <h1 className={`${display} mt-8 text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] text-balance`}>{faq.question}</h1>
        <FaqAnswer faq={faq} articles={articles} updated={updated} />
      </ArticleDrawerProvider>

      <div className="mt-20">
        <Chat title="Poser une autre question" />
      </div>
    </article>
  );
}
