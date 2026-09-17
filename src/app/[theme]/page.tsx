import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Chat from "@/components/Chat";
import ThemeIcon from "@/components/ThemeIcon";
import { getDb, type Faq } from "@/lib/db";
import { THEMES, faqUrl } from "@/lib/themes";
import { getCategories } from "@/lib/topics";
import { getMetiers } from "@/lib/metiers";
import { conventionUrl, getConventions } from "@/lib/conventions";
import { Empty, FaqIndex, SectionHead, block, container, display, label } from "@/components/ui";
import { JsonLd, breadcrumbJsonLd, clip, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const findTheme = (slug: string) => THEMES.find((t) => t.slug === slug);

// Theme FAQs, plus topic questions of the /sujets category sharing the theme slug (copropriete, construction).
function themeFaqs(slug: string) {
  const topics = getCategories().find((c) => c.slug === slug)?.topics.map((t) => t.slug) ?? [];
  return getDb()
    .prepare(`SELECT theme, topic, slug, emoji, question, short FROM faq WHERE theme = ?${topics.length ? ` OR topic IN (${topics.map(() => "?").join(",")})` : ""} ORDER BY id`)
    .all(slug, ...topics) as Faq[];
}

// Search-intent copy per theme (title is absolute: ≤ 60 chars without the site suffix).
const SEO: Record<string, { title: string; lead: string }> = {
  travail: { title: "Droit du travail expliqué simplement : congés, licenciement", lead: "Congés payés, licenciement, rupture conventionnelle, heures sup :" },
  urbanisme: { title: "Permis de construire ou déclaration préalable ? Guide 2026", lead: "Permis de construire, déclaration préalable, PLU, abri de jardin :" },
  logement: { title: "Location : bail, dépôt de garantie, préavis expliqués (2026)", lead: "Bail, dépôt de garantie, préavis, hausse de loyer, état des lieux :" },
  conventions: { title: "Conventions collectives 2026 : salaires, primes, préavis", lead: "Syntec, HCR, métallurgie, BTP, services à la personne :" },
  copropriete: { title: "Copropriété : AG, syndic, charges, travaux expliqués", lead: "Assemblée générale, syndic bénévole, charges impayées, travaux :" },
  diagnostics: { title: "DPE, amiante, plomb : diagnostics immobiliers expliqués", lead: "DPE et passoires thermiques, amiante, plomb, audit énergétique, vente et location :" },
  construction: { title: "BTP : garantie décennale, retenue de garantie, paiement", lead: "Assurance décennale, réception des travaux, sous-traitance, délais de paiement :" },
};

export async function generateMetadata({ params }: PageProps<"/[theme]">): Promise<Metadata> {
  const theme = findTheme((await params).theme);
  if (!theme) return {};
  const n = themeFaqs(theme.slug).length;
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

  const faqs = themeFaqs(theme.slug);
  const metiers = getMetiers().filter((m) => m.theme === theme.slug);

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

      {metiers.length > 0 && (
        <section aria-labelledby="metiers-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Pour les pros" id="metiers-title" title="Un espace pour votre métier" />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2">
              {metiers.map((m) => (
                <li key={m.slug}>
                  <Link href={`/pour/${m.slug}`} className="group flex h-full items-center justify-between gap-6 border-2 border-fg bg-surface p-5 shadow-hard transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm sm:p-6 motion-reduce:transition-none">
                    <span>
                      <span className={`${display} block text-2xl leading-tight sm:text-3xl`}>{m.title}</span>
                      <span className="mt-2 block text-fg-2">{m.audience.slice(0, 3).join(" · ")}</span>
                    </span>
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-7 shrink-0 transition group-hover:translate-x-1 motion-reduce:transition-none" />
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
