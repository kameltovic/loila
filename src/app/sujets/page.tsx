import type { Metadata } from "next";
import Link from "next/link";
import Chat from "@/components/Chat";
import TopicIndex from "@/components/TopicIndex";
import { SectionHead, container, display, label } from "@/components/ui";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { getCategories, getTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: `Droit au quotidien : ${getTopics().length} sujets expliqués simplement (${new Date().getFullYear()})`,
    description: "Naissance, congés, location, voisinage, piscine, forêt, animaux, retraite : toutes les règles de la vie courante, expliquées et sourcées.",
    path: "/sujets",
  });
}

export default function SujetsPage() {
  const categories = getCategories().map((c) => ({
    ...c,
    topics: c.topics.map(({ slug, title, h1, keywords }) => ({ slug, title, h1, keywords })),
  }));
  const total = categories.reduce((n, c) => n + c.topics.length, 0);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Sujets", path: "/sujets" }])} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex items-center gap-2 text-fg-2`}>
            <Link href="/" className="underline-offset-4 hover:text-fg hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Sujets</span>
          </nav>
          <h1 className={`${display} mt-12 max-w-5xl text-[clamp(3.5rem,12vw,8.5rem)] leading-[0.9] sm:mt-16`}>
            Tous les <span className="font-serif font-normal tracking-[-0.02em] italic">sujets.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-2 sm:text-xl">
            {total} situations de la vie courante, de la naissance à la retraite, en passant par le jardin, les voisins ou la forêt.
            Les règles expliquées une bonne fois pour toutes, articles de loi à l’appui.
          </p>
          <nav aria-label="Catégories" className="mt-10">
            <ol className="flex flex-wrap gap-2">
              {categories.map((c, i) => (
                <li key={c.slug}>
                  <a
                    href={`#${c.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-fg px-3.5 py-1.5 text-sm font-semibold transition hover:bg-fg hover:text-bg"
                  >
                    <span className="font-mono text-xs text-fg-2">{String(i + 1).padStart(2, "0")}</span>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <div className="pt-10 pb-4 sm:pt-14">
        <TopicIndex categories={categories} />
      </div>

      <section id="question" aria-labelledby="ask-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className={container}>
          <SectionHead
            num="→"
            kicker="Votre cas"
            id="ask-title"
            title={<>Votre situation n’est pas <span className="font-serif font-normal italic">listée</span> ?</>}
          />
          <p className="mt-4 max-w-xl text-lg text-fg-2">Décrivez-la en quelques mots, la réponse cite les articles utilisés.</p>
          <div className="mt-10 max-w-4xl">
            <Chat title="" />
          </div>
        </div>
      </section>
    </>
  );
}
