import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import { Empty, FaqIndex, block, btnPrimary, container, display, label } from "@/components/ui";
import { LettreCards } from "@/components/Lettres";
import JorfHistory from "@/components/JorfHistory";
import { articleSummary, coCitedArticles, linkRefs } from "@/lib/articles";
import { articleIndexable } from "@/lib/eligibility";
import { lettresForArticle } from "@/lib/lettres";
import { getTopic } from "@/lib/topics";
import { articleNeighbors, articleStats, citation, coCitedByCaseLaw, decisionUrl, decisionsForArticle, teaser } from "@/lib/decisions";
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
  const description = articleSummary(a)?.summary ?? `${first} Texte officiel en vigueur et explications simples.`;
  const meta = pageMetadata({ title, description: clip(description), path: `/article/${a.id}`, type: "article" });
  // SEO_ELIGIBLE (src/lib/eligibility.ts): one rule, shared with the sitemap. Raw legal text stays noindex.
  return { ...meta, title: title.length > 52 ? { absolute: title } : title, ...(articleIndexable(a) ? {} : { robots: { index: false, follow: true } }) };
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const a = load((await params).id);
  if (!a) notFound();

  const related = citedBy(a.id);
  const summary = articleSummary(a);
  const lettres = lettresForArticle(a.id);
  const topics = [...new Set(related.map((f) => f.topic).filter((t): t is string => !!t))].map(getTopic).filter((t) => !!t);
  const coCited = coCitedArticles(a.id);
  const juri = decisionsForArticle(a.id);
  const stats = juri.total ? articleStats(a.id) : undefined;
  // Case-law co-citation graph first (deterministic, scored); the FAQ-based neighbours only when case law has none.
  const caseLawCoCited = coCitedByCaseLaw(a.id);
  const { prev, next } = articleNeighbors(a.id);
  const ownTheme = THEMES.find((t) => (t.codes as readonly string[]).includes(a.code));
  const askHref = ownTheme ? `/${ownTheme.slug}#question` : "/#question";
  const code = CODES[a.code as keyof typeof CODES];
  // Summary block colour: the theme owning this code (Code civil etc. fall back to the logement yellow).
  const themeSlug = THEMES.find((t) => (t.codes as readonly string[]).includes(a.code))?.slug ?? "logement";
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
      ...(summary && { abstract: summary.summary }),
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
        <div className="min-w-0 space-y-8">
          {summary && (
            <section aria-labelledby="en-clair-title" className={`${block(themeSlug)} border-2 border-ink p-6 shadow-[6px_6px_0_0_var(--fg)] sm:p-10`}>
              <p className={`${label} inline-flex items-center gap-2 bg-ink px-3 py-1.5 text-paper`}>
                <span aria-hidden className="size-2 rounded-full bg-signal" />
                En clair
              </p>
              <h2 id="en-clair-title" className="sr-only">Ce que dit cet article, en clair</h2>
              <p className="mt-6 max-w-[62ch] font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-pretty sm:text-2xl">{summary.summary}</p>
              {summary.points.length > 0 && (
                <>
                  <h3 className={`${label} mt-8 border-t-2 border-ink pt-5`}>Points clés</h3>
                  <ul className="mt-4 max-w-[68ch] space-y-3 text-[1.0625rem] leading-relaxed">
                    {summary.points.map((pt) => (
                      <li key={pt} className="flex gap-3"><span aria-hidden className="mt-2.5 size-2 shrink-0 bg-ink" />{pt}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-8 text-sm text-ink/70">Résumé rédigé par Loilà à partir du texte officiel ci-dessous, qui seul fait foi.</p>
            </section>
          )}
          <div className="rounded-2xl border-2 border-fg bg-surface p-6 sm:p-10">
            {summary && (
              <h2 className={`${label} mb-6 inline-flex items-center gap-2 border-2 border-fg px-3 py-1.5`}>Texte officiel · Légifrance</h2>
            )}
            <div className="max-w-[68ch] space-y-5 text-[1.0625rem] leading-[1.8] sm:text-lg">
              {a.texte
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i}>
                    {linkRefs(p, a).map((part, j) =>
                      part.id ? (
                        <Link key={j} href={`/article/${part.id}`} className="underline decoration-signal decoration-2 underline-offset-4 hover:bg-signal/20">{part.text}</Link>
                      ) : (
                        part.text
                      ),
                    )}
                  </p>
                ))}
            </div>
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
          <JorfHistory articleId={a.id} />
          <a href={a.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Voir sur Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
          <Link href={askHref} className="flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
            Poser une question à Loilà <ArrowRight aria-hidden className="size-4" />
          </Link>
          {(prev || next) && (
            <nav aria-label="Articles voisins" className="flex justify-between gap-3 border-t-2 border-fg pt-4 font-mono text-sm">
              {prev ? <Link href={`/article/${prev.id}`} rel="prev" className="hover:underline">← Art. {prev.num}</Link> : <span />}
              {next && <Link href={`/article/${next.id}`} rel="next" className="hover:underline">Art. {next.num} →</Link>}
            </nav>
          )}
        </aside>
      </article>

      {juri.rows.length > 0 && (
        <section aria-labelledby="juri-title" className={`${container} pb-16 sm:pb-20`}>
          <header className="border-t-2 border-fg pt-5">
            <p className={`${label} text-fg-2`}>Jurisprudence</p>
            <h2 id="juri-title" className={`${display} mt-4 text-3xl leading-none sm:text-5xl`}>
              Ce qu’en disent <span className="font-serif font-normal italic">les juges</span>
            </h2>
            <p className="mt-4 text-fg-2">
              <strong className="text-fg">{juri.total} décision{juri.total > 1 ? "s" : ""} de justice</strong> référence{juri.total > 1 ? "nt" : ""} cet article
              {stats?.first_date && stats.last_date && stats.first_date.slice(0, 4) !== stats.last_date.slice(0, 4) && <> (de {stats.first_date.slice(0, 4)} à {stats.last_date.slice(0, 4)})</>}
              {juri.total > juri.rows.length && <> · les {juri.rows.length} plus récentes :</>}
            </p>
          </header>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {juri.rows.map((d) => (
              <li key={d.id}>
                <Link href={decisionUrl(d)} className="group flex h-full flex-col border-2 border-fg bg-surface p-5 transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm shadow-hard motion-reduce:transition-none">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{citation(d)}</span>
                    {d.solution && <span className="font-mono text-xs uppercase text-fg-2">{d.solution}</span>}
                  </span>
                  {d.sommaire && <span className="mt-3 line-clamp-4 text-[0.9375rem] text-fg-2">{teaser(d.sommaire)}</span>}
                  <span className="mt-auto flex items-center gap-1.5 pt-4 font-mono text-xs font-bold uppercase">
                    Lire la décision <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {juri.total > juri.rows.length && (
            <p className="mt-6">
              <Link href={`/article/${a.id}/jurisprudence`} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                Voir toute la jurisprudence ({juri.total} décisions) <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          )}
        </section>
      )}

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

        {lettres.length > 0 && (
          <div className="mt-16">
            <h2 className={`${display} text-2xl leading-none sm:text-4xl`}>Modèles de lettres</h2>
            <div className="mt-8"><LettreCards lettres={lettres} from={`/article/${a.id}`} /></div>
          </div>
        )}

        {topics.length > 0 && (
          <div className="mt-16">
            <h2 className={`${display} text-2xl leading-none sm:text-4xl`}>Sujets liés</h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {topics.map((t) => (
                <li key={t.slug}>
                  <Link href={`/sujets/${t.slug}`} className="inline-flex items-center gap-2 border-2 border-fg px-4 py-2 font-semibold hover:bg-fg hover:text-bg">
                    {t.title} <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(caseLawCoCited.length > 0 || coCited.length > 0) && (
          <div className="mt-16">
            <h2 className={`${display} text-2xl leading-none sm:text-4xl`}>
              {caseLawCoCited.length > 0 ? <>Articles fréquemment cités avec l’article {a.num}</> : "Souvent cités avec cet article"}
            </h2>
            {caseLawCoCited.length > 0 && <p className="mt-3 text-fg-2">Dans les mêmes décisions de justice.</p>}
            <ul className="mt-6 flex flex-wrap gap-2">
              {(caseLawCoCited.length > 0 ? caseLawCoCited : coCited).map((c) => (
                <li key={c.id}>
                  <Link href={`/article/${c.id}`} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-fg px-3 py-1 font-mono text-sm font-semibold hover:bg-fg hover:text-bg">
                    Art. {c.num} · {(CODES[c.code as keyof typeof CODES]?.name ?? c.code).replace(/ \(.*\)$/, "")}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
