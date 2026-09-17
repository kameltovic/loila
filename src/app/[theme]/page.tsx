import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Chat from "@/components/Chat";
import ThemeIcon from "@/components/ThemeIcon";
import { getDb, type Faq } from "@/lib/db";
import { THEMES, faqUrl } from "@/lib/themes";
import { conventionUrl, getConventions } from "@/lib/conventions";
import { Empty, FaqIndex, SectionHead, block, container, display, label } from "@/components/ui";
import { JsonLd, breadcrumbJsonLd, clip, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const findTheme = (slug: string) => THEMES.find((t) => t.slug === slug);

// Search-intent copy per theme (title is absolute: ≤ 60 chars without the site suffix).
const SEO: Record<string, { title: string; lead: string }> = {
  travail: { title: "Droit du travail expliqué simplement : congés, licenciement", lead: "Congés payés, licenciement, rupture conventionnelle, heures sup :" },
  urbanisme: { title: "Permis de construire ou déclaration préalable ? Guide 2026", lead: "Permis de construire, déclaration préalable, PLU, abri de jardin :" },
  logement: { title: "Location : bail, dépôt de garantie, préavis expliqués (2026)", lead: "Bail, dépôt de garantie, préavis, hausse de loyer, état des lieux :" },
  conventions: { title: "Conventions collectives 2026 : salaires, primes, préavis", lead: "Syntec, HCR, métallurgie, BTP, services à la personne :" },
};

export async function generateMetadata({ params }: PageProps<"/[theme]">): Promise<Metadata> {
  const theme = findTheme((await params).theme);
  if (!theme) return {};
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM faq WHERE theme = ?").get(theme.slug) as { n: number };
  const seo = SEO[theme.slug] ?? { title: theme.title, lead: theme.tagline };
  const meta = pageMetadata({
    title: seo.title,
    description: clip(`${seo.lead} ${n} réponses claires, chaque règle sourcée par l’article de loi officiel. À jour ${new Date().getFullYear()}.`),
    path: `/${theme.slug}`,
  });
  return { ...meta, title: { absolute: seo.title } };
}

export default async function ThemePage({ params }: PageProps<"/[theme]">) {
  const theme = findTheme((await params).theme);
  if (!theme) notFound();

  const faqs = getDb()
    .prepare("SELECT theme, topic, slug, emoji, question, short FROM faq WHERE theme = ? ORDER BY id")
    .all(theme.slug) as Faq[];

  const counts = new Map(
    (getDb().prepare("SELECT code, COUNT(*) AS n FROM articles GROUP BY code").all() as { code: string; n: number }[]).map((r) => [r.code, r.n]),
  );
  const total = theme.codes.reduce((s, c) => s + (counts.get(c) ?? 0), 0);
  const conventions = theme.slug === "conventions" ? getConventions().map((c) => ({ ...c, n: counts.get(c.code) ?? 0 })) : [];
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: theme.title, path: `/${theme.slug}` }]),
          ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
        ]}
      />
      <section className={`${block(theme.slug)} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{theme.title}</span>
          </nav>
          <ThemeIcon slug={theme.slug} className="mt-12 size-12 sm:mt-16 sm:size-14" />
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3.25rem,10vw,7rem)] leading-[0.92] text-balance`}>{theme.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-pretty sm:text-xl">{theme.tagline}</p>
          <dl className="mt-10 grid max-w-xl grid-cols-2 border-t-2 border-ink">
            <div className="py-4 pr-4 sm:pr-8">
              <dt className={label}>Articles officiels</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{total.toLocaleString("fr-FR")}</dd>
            </div>
            <div className="border-l-2 border-ink py-4 pl-4 sm:pl-8">
              <dt className={label}>Questions expliquées</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{faqs.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {conventions.length > 0 && (
        <section aria-labelledby="branches-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Branches" id="branches-title" title="Les conventions couvertes" />
            <ul className="mt-12 grid border-t-2 border-l-2 border-fg sm:grid-cols-2 lg:grid-cols-3">
              {conventions.map((c) => (
                <li key={c.slug} className="border-r-2 border-b-2 border-fg">
                  <Link href={conventionUrl(c)} className="group flex h-full flex-col justify-between gap-6 p-5 transition-colors hover:bg-surface sm:p-6">
                    <p className="font-display text-xl leading-tight font-bold tracking-[-0.02em]">{c.short}</p>
                    <p className="flex items-center justify-between gap-3 text-sm text-fg-2">
                      <span className="rounded-full border-[1.5px] border-ink bg-conventions px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-ink uppercase">
                        IDCC {c.idcc}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {c.n.toLocaleString("fr-FR")} articles
                        <ArrowRight aria-hidden strokeWidth={1.75} className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="faq-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Questions fréquentes" id="faq-title" title="Les réponses essentielles" />
          <div className="mt-12">
            {faqs.length > 0 ? (
              <FaqIndex faqs={faqs} />
            ) : (
              <Empty>Aucune question publiée pour ce thème pour l’instant. Posez la vôtre ci-dessous.</Empty>
            )}
          </div>
        </div>
      </section>

      <section id="question" aria-labelledby="ask-title" className="scroll-mt-20 pb-20 sm:pb-28">
        <div className={container}>
          <SectionHead
            num={num()}
            kicker="Votre cas"
            id="ask-title"
            title={<>Votre question ne figure pas <span className="font-serif font-normal italic">ici</span> ?</>}
          />
          <p className="mt-4 max-w-xl text-lg text-fg-2">Décrivez votre situation, la réponse cite les articles utilisés.</p>
          <div className="mt-10 max-w-4xl">
            <Chat theme={theme.slug} title="" />
          </div>
        </div>
      </section>
    </>
  );
}
