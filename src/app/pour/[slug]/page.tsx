import type { Metadata } from "next";
import Link from "next/link";
import { articlePath } from "@/lib/articles";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";
import { FaqIndex, SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import { getMetier, getMetiers, metierFaqs, refArticles } from "@/lib/metiers";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";
import { CODES, THEMES, faqUrl } from "@/lib/themes";

export const dynamic = "force-dynamic";

const codeName = (c: string) => CODES[c as keyof typeof CODES]?.name ?? c;

export async function generateMetadata({ params }: PageProps<"/pour/[slug]">): Promise<Metadata> {
  const m = getMetier((await params).slug);
  if (!m) return {};
  return { ...pageMetadata({ title: m.seo.title, description: m.seo.description, path: `/pour/${m.slug}` }), title: { absolute: m.seo.title } };
}

export default async function MetierPage({ params }: PageProps<"/pour/[slug]">) {
  const m = getMetier((await params).slug);
  if (!m) notFound();
  const faqs = metierFaqs(m);
  const obligations = m.obligations.map((o) => ({ ...o, articles: refArticles(o.refs) }));
  const theme = THEMES.find((t) => t.slug === m.theme);
  const others = getMetiers().filter((x) => x.slug !== m.slug);
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Pour les pros", path: "/pour" }, { name: m.title, path: `/pour/${m.slug}` }]),
          ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
        ]}
      />

      <section className={`${block(m.theme)} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/pour" className="underline-offset-4 hover:underline">Pour les pros</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{m.title}</span>
          </nav>
          <ThemeIcon slug={m.theme} className="mt-12 size-12 sm:mt-16 sm:size-14" />
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.92] text-balance`}>
            {m.h1} <span className="font-serif font-normal tracking-[-0.02em] italic">{m.h1Accent}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">{m.intro}</p>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Pour qui">
            {m.audience.map((a) => (
              <li key={a} className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-mono text-xs font-bold tracking-wide text-ink uppercase">{a}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dossier/nouveau" data-umami-event="metier-wizard" data-umami-event-metier={m.slug} className="inline-flex items-center gap-2 border-2 border-ink bg-ink px-5 py-3 font-mono text-sm font-bold uppercase text-paper shadow-[4px_4px_0_0_var(--color-paper)] transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-paper)] motion-reduce:transition-none">
              Décrire ma situation <ArrowRight aria-hidden className="size-4" />
            </Link>
            {faqs.length > 0 && (
              <a href="#questions" className="inline-flex items-center gap-2 border-2 border-ink bg-paper px-5 py-3 font-mono text-sm font-bold uppercase text-ink">
                Voir les {faqs.length} questions
              </a>
            )}
          </div>
        </div>
      </section>

      {obligations.length > 0 && (
        <section aria-labelledby="obligations-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="L’essentiel" id="obligations-title" title={<>Les règles à <span className="font-serif font-normal italic">connaître</span></>} />
            <ol className="mt-12 grid gap-5 md:grid-cols-2">
              {obligations.map((o, i) => (
                <li key={o.title} className="flex flex-col border-2 border-fg bg-surface p-5 sm:p-6">
                  <p className="font-mono text-sm font-bold text-fg-2">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 font-display text-2xl leading-tight font-bold tracking-[-0.025em]">{o.title}</h3>
                  <p className="mt-3 text-fg-2">{o.detail}</p>
                  {o.articles.length > 0 && (
                    <p className="mt-auto flex flex-wrap gap-2 pt-5">
                      {o.articles.map((a) => (
                        <Link key={a.id} href={articlePath(a)} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-fg px-2.5 py-0.5 font-mono text-xs font-semibold hover:bg-fg hover:text-bg">
                          Art. {a.num} · {codeName(a.code).replace(/ \(.*\)$/, "")}
                          <ArrowUpRight aria-hidden className="size-3.5" />
                        </Link>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-fg-2">Information juridique générale, à vérifier selon votre situation et les textes cités.</p>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section id="questions" aria-labelledby="questions-title" className="scroll-mt-20 pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Questions fréquentes" id="questions-title" title="Les questions que vous vous posez" />
            <div className="mt-12">
              <FaqIndex faqs={faqs} />
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="pro-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-surface p-6 shadow-[6px_6px_0_0_var(--signal)] sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className={`${label} text-fg-2`}>Offre Pro · bientôt</p>
              <h2 id="pro-title" className={`${display} mt-3 text-3xl leading-tight sm:text-5xl`}>
                Le droit, <span className="font-serif font-normal italic">toute l’année.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-fg-2">{m.proPitch}</p>
            </div>
            <Link href="/tarifs#pro" data-umami-event="metier-pro" data-umami-event-metier={m.slug} className={`${btnPrimary} justify-self-start`}>
              Rejoindre la liste d’attente <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {m.texts.length > 0 && (
        <section aria-labelledby="texts-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Sources" id="texts-title" title="Textes de référence" />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {m.texts.map((c) => (
                <li key={c} className="border-l-4 border-signal pl-4 font-semibold">{codeName(c)}</li>
              ))}
            </ul>
            {theme && (
              <p className="mt-8">
                <Link href={`/${theme.slug}`} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                  Toutes les questions « {theme.title} » <ArrowRight aria-hidden className="size-4" />
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="others-title" className="py-16 sm:py-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Autres métiers" id="others-title" title="Voir aussi" />
            <ul className="mt-10 flex flex-wrap gap-3">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/pour/${o.slug}`} className={`${block(o.theme)} inline-flex items-center gap-2 border-2 border-ink px-4 py-2 font-mono text-sm font-bold uppercase`}>
                    <ThemeIcon slug={o.theme} className="size-4" /> {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
