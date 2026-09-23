import type { Metadata } from "next";
import Link from "next/link";
import { articlePath } from "@/lib/articles";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import LetterForm from "@/components/LetterForm";
import { LettreCards } from "@/components/Lettres";
import { FaqIndex, SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import { LETTRE_GROUPS, getLettre, getLettres, lettreFaqs, lettreUrl } from "@/lib/lettres";
import { refArticles } from "@/lib/metiers";
import { JsonLd, SITE_NAME, SITE_URL, abs, breadcrumbJsonLd, contentUpdatedAt, pageMetadata } from "@/lib/seo";
import { CODES, THEMES } from "@/lib/themes";

export const dynamic = "force-dynamic";

const codeName = (c: string) => CODES[c as keyof typeof CODES]?.name ?? c;

export async function generateMetadata({ params }: PageProps<"/modeles-lettres/[slug]">): Promise<Metadata> {
  const l = getLettre((await params).slug);
  if (!l) return {};
  return { ...pageMetadata({ title: l.seo.title, description: l.seo.description, path: lettreUrl(l) }), title: { absolute: l.seo.title } };
}

export default async function LettrePage({ params }: PageProps<"/modeles-lettres/[slug]">) {
  const l = getLettre((await params).slug);
  if (!l) notFound();
  const path = lettreUrl(l);
  const faqs = lettreFaqs(l);
  const tips = l.tips.map((t) => ({ ...t, articles: refArticles(t.refs) }));
  const cited = [...new Map(tips.flatMap((t) => t.articles).map((a) => [a.id, a])).values()];
  const theme = THEMES.find((t) => t.slug === l.theme);
  // Same family, then same theme first, so a tenant sees the other tenant letters before the employment ones.
  const near = (x: typeof l) => (l.group && x.group === l.group ? 2 : 0) + (x.theme === l.theme ? 1 : 0);
  const others = getLettres()
    .filter((x) => x.slug !== l.slug)
    .sort((a, b) => near(b) - near(a))
    .slice(0, l.group ? 6 : 3);
  const group = l.group ? LETTRE_GROUPS[l.group] : undefined;
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Modèles de lettres", path: "/modeles-lettres" },
            ...(group ? [{ name: group.title, path: group.href }] : []),
            { name: l.title, path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: l.seo.title,
            description: l.seo.description,
            inLanguage: "fr-FR",
            url: abs(path),
            dateModified: contentUpdatedAt().toISOString(),
            publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
            citation: cited.map((a) => ({ "@type": "Legislation", name: `Article ${a.num}, ${codeName(a.code)}`, url: a.url })),
          },
        ]}
      />

      <section className={`${block(l.theme)} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/modeles-lettres" className="underline-offset-4 hover:underline">Modèles de lettres</Link>
            <span aria-hidden>/</span>
            {group && (
              <>
                <Link href={group.href} className="underline-offset-4 hover:underline">{group.title}</Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span aria-current="page">{l.title}</span>
          </nav>
          <h1 className={`${display} mt-12 max-w-5xl text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] text-balance sm:mt-16`}>
            {l.h1} <span className="font-serif font-normal tracking-[-0.02em] italic">{l.h1Accent}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">{l.intro}</p>
          <ul className="mt-8 grid max-w-3xl gap-2" aria-label="Quand utiliser ce modèle">
            {l.when.map((w) => (
              <li key={w} className="flex gap-3"><span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-ink" />{w}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="form-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Le modèle" id="form-title" title={<>Complétez, <span className="font-serif font-normal italic">copiez, envoyez.</span></>} />
          <div className="mt-12">
            <LetterForm slug={l.slug} title={l.title} fields={l.fields} body={l.body} />
          </div>
        </div>
      </section>

      <section aria-labelledby="tips-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Avant d’envoyer" id="tips-title" title={<>Ce que dit <span className="font-serif font-normal italic">la loi</span></>} />
          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {tips.map((t, i) => (
              <li key={t.title} className="flex flex-col border-2 border-fg bg-surface p-5 sm:p-6">
                <p className="font-mono text-sm font-bold text-fg-2">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-display text-2xl leading-tight font-bold tracking-[-0.025em]">{t.title}</h3>
                <p className="mt-3 text-fg-2">{t.detail}</p>
                {t.link && (
                  <p className="mt-4">
                    <Link href={t.link.href} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                      {t.link.label} <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </p>
                )}
                {t.articles.length > 0 && (
                  <p className="mt-auto flex flex-wrap gap-2 pt-5">
                    {t.articles.map((a) => (
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
          <p className="mt-6 text-sm text-fg-2">Modèle d’information juridique générale, à adapter à votre situation. Il ne remplace pas le conseil d’un professionnel.</p>
        </div>
      </section>

      <section aria-labelledby="wizard-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-surface p-6 shadow-[6px_6px_0_0_var(--signal)] sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className={`${label} text-fg-2`}>Votre cas est plus compliqué ?</p>
              <h2 id="wizard-title" className={`${display} mt-3 text-3xl leading-tight sm:text-5xl`}>
                Faites analyser <span className="font-serif font-normal italic">votre situation.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-fg-2">Décrivez ce qui vous arrive : Loilà vous pose les bonnes questions et vous rend une analyse sourcée, article par article.</p>
            </div>
            <Link href="/dossier/nouveau" data-umami-event="lettre-wizard" data-umami-event-lettre={l.slug} className={`${btnPrimary} justify-self-start`}>
              Décrire ma situation <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section aria-labelledby="questions-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Questions fréquentes" id="questions-title" title="Les questions que vous vous posez" />
            <div className="mt-12"><FaqIndex faqs={faqs} /></div>
          </div>
        </section>
      )}

      <section aria-labelledby="others-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Autres modèles" id="others-title" title="Voir aussi" />
          <div className="mt-10"><LettreCards lettres={others} from={path} /></div>
          <p className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {group && (
              <Link href={group.href} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                Le guide : relancer un impayé étape par étape <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
            <Link href="/modeles-lettres" className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
              Tous les modèles de lettres <ArrowRight aria-hidden className="size-4" />
            </Link>
            {theme && (
              <Link href={`/${theme.slug}`} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                Toutes les questions « {theme.title} » <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
          </p>
        </div>
      </section>
    </>
  );
}
