import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Chat from "@/components/Chat";
import { Empty, FaqIndex, SectionHead, TopicList, container, display, label } from "@/components/ui";
import { JsonLd, breadcrumbJsonLd, clip, faqJsonLd, pageMetadata } from "@/lib/seo";
import { faqUrl } from "@/lib/themes";
import { getCategories, getTopic, getTopicFaqs } from "@/lib/topics";
import { LettreCards } from "@/components/Lettres";
import { getLettres } from "@/lib/lettres";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/sujets/[topic]">): Promise<Metadata> {
  const topic = getTopic((await params).topic);
  if (!topic) return {};
  const meta = pageMetadata({
    title: `${topic.title} : ce que dit la loi (${new Date().getFullYear()})`,
    description: clip(topic.intro),
    path: `/sujets/${topic.slug}`,
  });
  return { ...meta, keywords: topic.keywords };
}

export default async function TopicPage({ params }: PageProps<"/sujets/[topic]">) {
  const topic = getTopic((await params).topic);
  if (!topic) notFound();

  const category = getCategories().find((c) => c.slug === topic.category);
  const faqs = getTopicFaqs(topic.slug);
  const related = (category?.topics ?? []).filter((t) => t.slug !== topic.slug);
  const faqSlugs = new Set(faqs.map((f) => f.slug));
  const lettres = getLettres().filter((l) => l.faqSlugs.some((s) => faqSlugs.has(s)));
  const path = `/sujets/${topic.slug}`;
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Sujets", path: "/sujets" }, { name: topic.title, path }]),
          ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
        ]}
      />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
            <Link href="/" className="underline-offset-4 hover:text-fg hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/sujets" className="underline-offset-4 hover:text-fg hover:underline">Sujets</Link>
            {category && (
              <>
                <span aria-hidden>/</span>
                <Link href={`/sujets#${category.slug}`} className="underline-offset-4 hover:text-fg hover:underline">{category.title}</Link>
              </>
            )}
          </nav>
          <p className={`${label} mt-12 flex items-center gap-3 sm:mt-16`}>
            <span aria-hidden className="h-0.5 w-8 bg-signal" />
            {topic.title}
          </p>
          <h1 className={`${display} mt-5 max-w-5xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.93] text-balance`}>{topic.h1}</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-2 sm:text-xl">{topic.intro}</p>
          <a href="#question" className="mt-8 inline-flex items-center gap-2 font-semibold underline decoration-signal decoration-2 underline-offset-4">
            Poser ma question sur ce sujet <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
          </a>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Questions" id="faq-title" title="Les questions" />
          <div className="mt-12">
            {faqs.length > 0 ? (
              <FaqIndex faqs={faqs} />
            ) : (
              <Empty>
                Les réponses détaillées sur ce sujet arrivent bientôt.{" "}
                <a href="#question" className="font-semibold text-fg underline decoration-signal decoration-2 underline-offset-4">Posez votre question dès maintenant.</a>
              </Empty>
            )}
          </div>
        </div>
      </section>

      {lettres.length > 0 && (
        <section aria-labelledby="lettres-title" className="pb-16 sm:pb-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Modèles de lettres" id="lettres-title" title="Passer à l’action" />
            <div className="mt-12"><LettreCards lettres={lettres} from={path} /></div>
          </div>
        </section>
      )}

      <section id="question" aria-labelledby="ask-title" className="scroll-mt-20 pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead
            num={num()}
            kicker="Votre cas"
            id="ask-title"
            title={<>Une question <span className="font-serif font-normal italic">précise</span> ?</>}
          />
          <p className="mt-4 max-w-xl text-lg text-fg-2">Décrivez votre situation, la réponse cite les articles utilisés.</p>
          <div className="mt-10 max-w-4xl">
            <Chat title="" />
          </div>
        </div>
      </section>

      {related.length > 0 && category && (
        <section aria-labelledby="related-title" className="pb-20 sm:pb-28">
          <div className={container}>
            <SectionHead num={num()} kicker={category.title} id="related-title" title="Sujets proches" />
            <TopicList topics={related} />
          </div>
        </section>
      )}
    </>
  );
}
