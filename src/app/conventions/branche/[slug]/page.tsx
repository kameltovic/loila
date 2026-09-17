import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Chat from "@/components/Chat";
import { Empty, FaqIndex, SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import { getDb, type Article, type Faq } from "@/lib/db";
import { faqUrl } from "@/lib/themes";
import { conventionHeading, conventionLegifranceUrl, conventionUrl, getConvention, getConventions } from "@/lib/conventions";
import { JsonLd, abs, breadcrumbJsonLd, clip, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Accord = { title: string; n: number };
type FaqRow = Pick<Faq, "theme" | "slug" | "question" | "short"> & { topic: string | null };

function load(slug: string) {
  const c = getConvention(slug);
  if (!c) return undefined;
  const db = getDb();
  const { n: articles } = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE code = ?").get(c.code) as { n: number };
  // Convention collective texts have no article number for most entries: the section is the accord/annexe title.
  const accords = db
    .prepare(
      `SELECT CASE WHEN instr(section, ' > ') > 0 THEN substr(section, 1, instr(section, ' > ') - 1) ELSE section END AS title, COUNT(*) AS n
       FROM articles WHERE code = ? AND section IS NOT NULL AND section <> ''
       GROUP BY title ORDER BY n DESC LIMIT 12`,
    )
    .all(c.code) as Accord[];
  const faqs = db
    .prepare(
      `SELECT DISTINCT f.theme, f.topic, f.slug, f.emoji, f.question, f.short, f.article_ids
       FROM faq f JOIN json_each(f.article_ids) j JOIN articles a ON a.id = j.value
       WHERE a.code = ? ORDER BY f.id`,
    )
    .all(c.code) as FaqRow[];
  const cited = db
    .prepare(
      `SELECT DISTINCT a.* FROM faq f JOIN json_each(f.article_ids) j JOIN articles a ON a.id = j.value
       WHERE a.code = ? ORDER BY a.num`,
    )
    .all(c.code) as Article[];
  return { c, articles, accords, faqs, cited };
}

export async function generateMetadata({ params }: PageProps<"/conventions/branche/[slug]">): Promise<Metadata> {
  const c = getConvention((await params).slug);
  if (!c) return {};
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM articles WHERE code = ?").get(c.code) as { n: number };
  const title = `Convention collective ${c.short} (IDCC ${c.idcc})`;
  const meta = pageMetadata({
    title,
    description: clip(
      `${c.short} (IDCC ${c.idcc}) : réponses claires sur les règles de la branche, chaque règle sourcée par l’article officiel. ${n.toLocaleString("fr-FR")} articles de la convention publique.`,
    ),
    path: conventionUrl(c),
  });
  // Long names skip the " · Loilà" suffix so the IDCC isn’t truncated in results.
  return title.length > 52 ? { ...meta, title: { absolute: title } } : meta;
}

export default async function ConventionPage({ params }: PageProps<"/conventions/branche/[slug]">) {
  const data = load((await params).slug);
  if (!data) notFound();
  const { c, articles, accords, faqs, cited } = data;

  const path = conventionUrl(c);
  const legifrance = conventionLegifranceUrl(c);
  const others = getConventions().filter((o) => o.slug !== c.slug);
  const jsonLd = [
    breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Conventions collectives", path: "/conventions" }, { name: c.short, path }]),
    {
      "@context": "https://schema.org",
      "@type": "Legislation",
      name: c.name,
      legislationIdentifier: `IDCC ${c.idcc}`,
      legislationJurisdiction: "FR",
      legislationLegalForce: "InForce",
      inLanguage: "fr-FR",
      url: abs(path),
      isBasedOn: legifrance,
      sameAs: legifrance,
    },
    ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
  ];

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${block("conventions")} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/conventions" className="underline-offset-4 hover:underline">Conventions collectives</Link>
          </nav>
          <p className={`${label} mt-12 flex items-center gap-3 sm:mt-16`}>
            <span aria-hidden className="h-0.5 w-8 bg-signal" />
            IDCC {c.idcc}
          </p>
          <h1 className={`${display} mt-5 max-w-5xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            {conventionHeading(c)}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Cette convention collective de branche complète le Code du travail pour les salariés des entreprises concernées.
            Loilà en explique les règles clés en français clair, articles officiels à l’appui.
          </p>
          <dl className="mt-10 grid max-w-xl grid-cols-2 border-t-2 border-ink">
            <div className="py-4 pr-4 sm:pr-8">
              <dt className={label}>Articles officiels</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{articles.toLocaleString("fr-FR")}</dd>
            </div>
            <div className="border-l-2 border-ink py-4 pl-4 sm:pl-8">
              <dt className={label}>Questions expliquées</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{faqs.length}</dd>
            </div>
          </dl>
          <a href={legifrance} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} mt-8`}>
            Lire le texte officiel <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </div>
      </section>

      {accords.length > 0 && (
        <section aria-labelledby="accords-title" className="py-16 sm:py-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Sommaire" id="accords-title" title="Ce que couvre cette convention" />
            <ul className="mt-12 grid border-t-2 border-l-2 border-fg sm:grid-cols-2 lg:grid-cols-3">
              {accords.map((a) => (
                <li key={a.title} className="flex items-baseline justify-between gap-4 border-r-2 border-b-2 border-fg p-5 sm:p-6">
                  <span className="font-display text-lg leading-tight font-bold tracking-[-0.02em]">{a.title}</span>
                  <span className="shrink-0 font-mono text-sm text-fg-2">{a.n.toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-fg-2">
              Les intitulés proviennent du texte officiel de la convention, découpé en accords et annexes.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="faq-title" className={accords.length ? "pb-16 sm:pb-24" : "py-16 sm:py-24"}>
        <div className={container}>
          <SectionHead num={num()} kicker="Questions fréquentes" id="faq-title" title="Les réponses essentielles" />
          <div className="mt-12">
            {faqs.length > 0 ? (
              <FaqIndex faqs={faqs} />
            ) : (
              <Empty>Aucune réponse publiée sur cette convention pour l’instant.</Empty>
            )}
          </div>
        </div>
      </section>

      <section id="question" aria-labelledby="ask-title" className="scroll-mt-20 pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead
            num={num()}
            kicker="Votre cas"
            id="ask-title"
            title={<>Une question sur cette <span className="font-serif font-normal italic">branche</span> ?</>}
          />
          <p className="mt-4 max-w-xl text-lg text-fg-2">Décrivez votre situation, la réponse cite les articles utilisés.</p>
          <div className="mt-10 max-w-4xl">
            <Chat theme="conventions" title="" />
          </div>
        </div>
      </section>

      {cited.length > 0 && (
        <section aria-labelledby="cited-title" className="pb-16 sm:pb-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Sources" id="cited-title" title="Articles cités dans nos réponses" />
            <ul className="mt-12 border-t border-fg">
              {cited.map((a) => (
                <li key={a.id} className="border-b border-rule">
                  <Link href={`/article/${a.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-6 transition-colors hover:bg-surface sm:px-2">
                    <span className="min-w-0">
                      <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em] sm:text-2xl">
                        {a.num ? `Article ${a.num}` : (a.section?.split(" > ").pop() ?? "Texte officiel")}
                      </span>
                      <span className="mt-2 line-clamp-2 max-w-[68ch] text-fg-2">{a.texte}</span>
                    </span>
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="others-title" className="pb-20 sm:pb-28">
        <div className={container}>
          <SectionHead num={num()} kicker="Branches" id="others-title" title="Autres conventions collectives" />
          <ul className="mt-8 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={conventionUrl(o)} className="inline-flex rounded-full border-2 border-fg px-4 py-2 font-semibold transition hover:bg-fg hover:text-bg">
                  {o.short}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
