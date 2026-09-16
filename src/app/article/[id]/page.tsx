import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { Empty, FaqIndex, btnPrimary, container, display, label } from "@/components/ui";
import { JsonLd, abs, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const load = (id: string) => getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as Article | undefined;
/** "Article L1237-19", or the section title for convention articles without a number. */
const artLabel = (a: Article) => (a.num ? `Article ${a.num}` : (a.section?.split(" > ").pop() ?? "Article"));
const codeName = (a: Article) => CODES[a.code as keyof typeof CODES]?.name ?? a.code;

/** "du Code du travail" / "de la convention collective Syntec (IDCC 1486)" for titles. */
function ofCode(a: Article) {
  const name = codeName(a);
  if (name.startsWith("Code")) return `du ${name}`;
  if (a.code === "loi-89-462") return "de la loi du 6 juillet 1989";
  return `de la ${name.replace(/^Convention collective /, "CCN ").replace(/,.*?(\(IDCC)/, " $1")}`;
}
const citedBy = (id: string) =>
  getDb().prepare("SELECT theme, topic, slug, emoji, question, short FROM faq WHERE EXISTS (SELECT 1 FROM json_each(faq.article_ids) WHERE value = ?)").all(id) as Faq[];

export async function generateMetadata({ params }: PageProps<"/article/[id]">): Promise<Metadata> {
  const a = load((await params).id);
  if (!a) return {};
  const title = `${artLabel(a)} ${ofCode(a)} expliqué`;
  const first = a.texte.split(/(?<=[.;:])\s|\n/)[0] ?? a.texte;
  const meta = pageMetadata({ title, description: clip(`${first} Texte officiel en vigueur et explications simples.`), path: `/article/${a.id}`, type: "article" });
  // Only articles cited by an answer are worth indexing; the other ~35k are raw legal text (thin pages).
  return { ...meta, title: title.length > 52 ? { absolute: title } : title, ...(citedBy(a.id).length ? {} : { robots: { index: false, follow: true } }) };
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const a = load((await params).id);
  if (!a) notFound();

  const related = citedBy(a.id);
  const code = CODES[a.code as keyof typeof CODES];
  const jsonLd = [
    breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: codeName(a), path: `/article/${a.id}` }, { name: artLabel(a), path: `/article/${a.id}` }]),
    {
      "@context": "https://schema.org",
      "@type": "Legislation",
      name: `${artLabel(a)} ${ofCode(a)}`,
      legislationIdentifier: a.id,
      legislationJurisdiction: "FR",
      legislationLegalForce: "InForce",
      inLanguage: "fr-FR",
      ...(a.date_debut && { legislationDate: a.date_debut.slice(0, 10) }),
      url: abs(`/article/${a.id}`),
      isBasedOn: a.url,
      sameAs: a.url,
      text: a.texte,
      ...(code && { isPartOf: { "@type": "Legislation", name: code.name, legislationIdentifier: code.legitext, legislationJurisdiction: "FR" } }),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
            <Link href="/" className="hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4">
              Accueil
            </Link>
            <span aria-hidden>/</span>
            <span>{codeName(a)}</span>
          </nav>
          <p className={`${label} mt-12 flex items-center gap-3`}>
            <span aria-hidden className="h-0.5 w-8 bg-signal" />
            {codeName(a)}
          </p>
          <h1 className={`${display} mt-4 text-[clamp(3.25rem,10vw,7rem)] leading-[0.92]`}>Article {a.num}</h1>
          {a.section && (
            <p className="mt-5 max-w-3xl font-serif text-xl leading-snug text-fg-2 italic">{a.section.split(" > ").join(" › ")}</p>
          )}
        </div>
      </section>

      <article className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_16rem]`}>
        <div className="rounded-2xl border-2 border-fg bg-surface p-6 sm:p-10">
          <div className="max-w-[68ch] space-y-5 text-[1.0625rem] leading-[1.8] sm:text-lg">
            {a.texte
              .split(/\n+/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        </div>

        <aside className="space-y-6 lg:pt-2">
          {a.date_debut && (
            <div className="border-t-2 border-fg pt-4">
              <p className={`${label} text-fg-2`}>En vigueur depuis</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]">
                {new Date(a.date_debut).toLocaleDateString("fr-FR")}
              </p>
            </div>
          )}
          <a href={a.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Voir sur Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </aside>
      </article>

      <section aria-labelledby="related-title" className={`${container} pb-20 sm:pb-28`}>
        <header className="border-t-2 border-fg pt-5">
          <p className={`${label} text-fg-2`}>Pour aller plus loin</p>
          <h2 id="related-title" className={`${display} mt-4 text-3xl leading-none sm:text-5xl`}>
            Questions liées
          </h2>
        </header>
        <div className="mt-10">
          {related.length > 0 ? <FaqIndex faqs={related} showTheme /> : <Empty>Aucune question ne cite encore cet article.</Empty>}
        </div>
      </section>
    </>
  );
}
