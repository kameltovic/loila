import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import { citation, decisionArticles, decisionLinks, decisionSummary, decisionUrl, formationLabel, getDecision, pourvoi, relatedDecisions } from "@/lib/decisions";
import { JsonLd, abs, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";
import { CODES, THEMES } from "@/lib/themes";

export const dynamic = "force-dynamic";

const codeName = (c: string) => (CODES[c as keyof typeof CODES]?.name ?? c).replace(/ \(.*\)$/, "");
const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: PageProps<"/jurisprudence/[id]">): Promise<Metadata> {
  const d = getDecision((await params).id);
  if (!d) return {};
  const summary = decisionSummary(d.id);
  const title = `${citation(d)}${d.solution ? ` : ${d.solution.toLowerCase()}` : ""}`;
  const meta = pageMetadata({ title, description: clip(summary?.summary ?? d.sommaire ?? d.texte), path: decisionUrl(d), type: "article" });
  // Raw decisions duplicate Légifrance: only pages with our own plain-language summary are indexed.
  return { ...meta, title: { absolute: title }, ...(summary ? {} : { robots: { index: false, follow: true } }) };
}

export default async function DecisionPage({ params }: PageProps<"/jurisprudence/[id]">) {
  const d = getDecision((await params).id);
  if (!d) notFound();
  const summary = decisionSummary(d.id);
  const articles = decisionArticles(d.id);
  const related = relatedDecisions(d.id);
  const links = decisionLinks(d.id);
  const explicit = [
    ...links.sameCase.map((r) => ({ id: r.to_id!, label: "Même affaire", cite: citation({ formation: r.formation, date: r.date!, numero: r.numero }) })),
    ...links.cites.map((r) => ({ id: r.to_id!, label: "Arrêt cité", cite: citation({ formation: r.formation, date: r.date!, numero: r.numero }) })),
    ...links.citedBy.map((r) => ({ id: r.id, label: "Cité par", cite: citation(r) })),
  ];
  const themeSlug = THEMES.find((t) => articles.some((a) => (t.codes as readonly string[]).includes(a.code)))?.slug ?? "travail";
  // "L. 1221-1" in the text → link to that article's page when the decision is linked to it.
  const byNum = new Map(articles.map((a) => [a.num, a.id]));
  const linked = (p: string) =>
    p.split(/(\b[LRD]\.\s?\d{3,4}(?:-\d+)*)/g).map((part, i) => {
      const id = byNum.get(part.replace(/[.\s]/g, ""));
      return id ? <Link key={i} href={`/article/${id}`} className="underline decoration-signal decoration-2 underline-offset-4">{part}</Link> : part;
    });
  const path = decisionUrl(d);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Jurisprudence", path: "/jurisprudence" }, { name: citation(d), path }]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: d.titre,
            url: abs(path),
            inLanguage: "fr-FR",
            ...(summary && { abstract: summary.summary }),
            isBasedOn: d.url,
            citation: articles.map((a) => ({ "@type": "Legislation", name: `Article ${a.num}, ${codeName(a.code)}`, url: abs(`/article/${a.id}`) })),
          },
        ]}
      />

      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/jurisprudence" className="underline-offset-4 hover:underline">Jurisprudence</Link>
          </nav>
          <p className={`${label} mt-12 flex flex-wrap items-center gap-2`}>
            <span className="border-2 border-fg px-2 py-1">{d.juridiction}</span>
            <span className="border-2 border-fg px-2 py-1">{formationLabel(d.formation)}</span>
            {d.solution && <span className="border-2 border-fg bg-fg px-2 py-1 text-bg">{d.solution}</span>}
            {d.publie === 1 && <span className="border-2 border-fg px-2 py-1">Publié au Bulletin</span>}
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] text-balance`}>
            {formationLabel(d.formation)}, {frDate(d.date)}
          </h1>
          {d.numero && <p className="mt-4 font-mono text-lg text-fg-2">Pourvoi n° {pourvoi(d.numero)}{d.ecli && <> · {d.ecli}</>}</p>}
        </div>
      </section>

      <article className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_18rem]`}>
        <div className="min-w-0 space-y-8">
          {summary && (
            <section aria-labelledby="en-clair-title" className={`${block(themeSlug)} border-2 border-ink p-6 shadow-[6px_6px_0_0_var(--fg)] sm:p-10`}>
              <p className={`${label} inline-flex items-center gap-2 bg-ink px-3 py-1.5 text-paper`}>
                <span aria-hidden className="size-2 rounded-full bg-signal" />
                En clair
              </p>
              <h2 id="en-clair-title" className="sr-only">Ce que décide cet arrêt, en clair</h2>
              <p className="mt-6 max-w-[62ch] font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-pretty sm:text-2xl">{summary.summary}</p>
              {summary.points.length > 0 && (
                <>
                  <h3 className={`${label} mt-8 border-t-2 border-ink pt-5`}>À retenir</h3>
                  <ul className="mt-4 max-w-[68ch] space-y-3 text-[1.0625rem] leading-relaxed">
                    {summary.points.map((pt) => (
                      <li key={pt} className="flex gap-3"><span aria-hidden className="mt-2.5 size-2 shrink-0 bg-ink" />{pt}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-8 text-sm text-ink/70">Résumé rédigé par Loilà à partir de la décision ci-dessous, qui seule fait foi.</p>
            </section>
          )}

          {d.sommaire && (
            <section aria-labelledby="sommaire-title" className="border-2 border-fg bg-surface p-6 sm:p-10">
              <h2 id="sommaire-title" className={`${label} inline-flex border-2 border-fg px-3 py-1.5`}>Sommaire officiel · Cour de cassation</h2>
              <div className="mt-6 max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.75]">
                {d.sommaire.split(/\n+/).filter((p) => p.trim()).map((p, i) => <p key={i}>{linked(p)}</p>)}
              </div>
            </section>
          )}

          <section aria-labelledby="texte-title" className="rounded-2xl border-2 border-fg bg-surface p-6 sm:p-10">
            <h2 id="texte-title" className={`${label} mb-6 inline-flex border-2 border-fg px-3 py-1.5`}>Texte intégral</h2>
            <div className="max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.8]">
              {d.texte.split(/\n+/).filter((p) => p.trim()).map((p, i) => <p key={i}>{linked(p)}</p>)}
            </div>
          </section>
        </div>

        <aside className="space-y-8 lg:pt-2">
          {articles.length > 0 && (
            <div className="border-t-2 border-fg pt-4">
              <h2 className={`${label} text-fg-2`}>Articles appliqués</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {articles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/article/${a.id}`} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-fg px-2.5 py-0.5 font-mono text-xs font-semibold hover:bg-fg hover:text-bg">
                      Art. {a.num} · {codeName(a.code)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {links.appeal && (
            <div className="border-t-2 border-fg pt-4">
              <h2 className={`${label} text-fg-2`}>Décision attaquée</h2>
              <p className="mt-2">{links.appeal.court}, {frDate(links.appeal.date)}</p>
            </div>
          )}
          {explicit.length > 0 && (
            <div className="border-t-2 border-fg pt-4">
              <h2 className={`${label} text-fg-2`}>Décisions liées</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {explicit.map((e) => (
                  <li key={`${e.label}${e.id}`}>
                    <span className="block font-mono text-xs uppercase text-fg-2">{e.label}</span>
                    <Link href={decisionUrl({ id: e.id })} className="underline underline-offset-2">{e.cite}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href={d.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Voir sur Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
          <p className="text-sm text-fg-2">Décision pseudonymisée, issue des données ouvertes de la DILA (Légifrance).</p>
        </aside>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="pb-16">
          <div className={container}>
            <SectionHead num="→" kicker="Mêmes articles" id="related-title" title="Décisions appliquant les mêmes articles" />
            <ul className="mt-8 border-t border-fg">
              {related.map((r) => (
                <li key={r.id} className="border-b border-rule">
                  <Link href={decisionUrl(r)} className="group flex flex-wrap items-baseline justify-between gap-3 py-4 hover:bg-surface sm:px-2">
                    <span className="font-semibold">{citation(r)}</span>
                    <span className="flex items-center gap-2 font-mono text-xs text-fg-2 uppercase">
                      {r.solution} <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="pro-title" className="pb-20 sm:pb-28">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-surface p-6 shadow-[6px_6px_0_0_var(--signal)] sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className={`${label} text-fg-2`}>Avocats et juristes · bientôt</p>
              <h2 id="pro-title" className={`${display} mt-3 text-3xl leading-tight sm:text-5xl`}>
                Interrogez la jurisprudence <span className="font-serif font-normal italic">avec l’IA.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-fg-2">Posez une question de droit : l’IA cherche dans les décisions et les codes, et répond en citant chaque arrêt et chaque article.</p>
            </div>
            <Link href="/tarifs#pro" data-umami-event="juri-pro" className={`${btnPrimary} justify-self-start`}>
              Rejoindre la liste d’attente <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
