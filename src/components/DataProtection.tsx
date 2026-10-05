import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CompanySearch from "@/components/CompanySearch";
import { SourceBadge } from "@/components/SourceBadge";
import { SectionHead, block, container, display, label } from "@/components/ui";
import { breachStats, cnilCount, cnilDecisions, cnilSubject } from "@/lib/cnil";
import { citation, decisionUrl } from "@/lib/decisions";
import { getDb, type Faq } from "@/lib/db";
import { faqUrl } from "@/lib/themes";
import { SOURCES } from "@/lib/sources";

// The question everyone asks after a leak in the news: featured at the top of the theme.
const FEATURED = "fuite-de-donnees-demander-dedommagement";

const pct = (n: number, total: number) => `${Math.round((100 * n) / total)} %`;

/** Featured question, right under the hero of /donnees-personnelles. */
export function FeaturedQuestion() {
  const f = getDb().prepare("SELECT theme, topic, slug, question, short FROM faq WHERE slug = ?").get(FEATURED) as Pick<Faq, "theme" | "topic" | "slug" | "question" | "short"> | undefined;
  if (!f) return null;
  return (
    <section aria-labelledby="featured-title" className="pt-16 sm:pt-24">
      <div className={container}>
        <Link href={faqUrl(f)} className={`${block("donnees-personnelles")} group block rounded-2xl border-2 border-ink p-6 shadow-hard-ink transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] sm:p-10 dark:border-paper motion-reduce:transition-none`}>
          <p className={label}>La question du moment</p>
          <h2 id="featured-title" className={`${display} mt-4 max-w-4xl text-3xl leading-[1.02] text-balance sm:text-5xl`}>{f.question}</h2>
          <p className="mt-5 max-w-3xl text-lg text-pretty">{f.short}</p>
          <p className="mt-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
            Lire la réponse complète <ArrowRight aria-hidden className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
          </p>
        </Link>
      </div>
    </section>
  );
}

/** CNIL open data on /donnees-personnelles: breaches notified, DPO finder, latest sanctions. */
export default function DataProtection({ nums }: { nums: string[] }) {
  const stats = breachStats();
  const sanctions = cnilDecisions("Sanction", 6);
  const nSanctions = cnilCount("Sanction");
  const nNotices = cnilCount("Mise en demeure");
  const V = SOURCES["CNIL:violations"];
  const max = Math.max(...(stats?.years.map((y) => y.total) ?? [1]));
  const last = stats?.years.at(-1);
  const informed = stats?.information.find((r) => /^oui/i.test(r.label))?.n ?? 0;
  // The CNIL caveat counts notifications caused by shared subcontractor incidents ("… pour un total cumulé de 11 635 …").
  const shared = stats?.note?.match(/total cumulé de ([\d\s  ]+)/)?.[1].trim();

  return (
    <>
      {stats && last && (
        <section aria-labelledby="breach-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={nums[0]} kicker="Chiffres officiels de la CNIL" id="breach-title" title={<>{last.total.toLocaleString("fr-FR")} fuites de données notifiées en {last.year}</>} />
            <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_20rem]">
              <figure>
                <figcaption className="sr-only">Notifications de violations de données reçues par la CNIL, par année</figcaption>
                <ol className="space-y-2">
                  {stats.years.map((y) => (
                    <li key={y.year} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                      <span className="font-mono">{y.year}</span>
                      <span className="h-5 border-2 border-fg">
                        <span className="block h-full bg-donnees-personnelles" style={{ width: `${(100 * y.total) / max}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums">{y.total.toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
                </ol>
                {shared && (
                  <p className="mt-4 text-sm text-fg-2">
                    Selon la CNIL, des incidents survenus chez des sous-traitants communs à de nombreux organismes comptent à eux seuls pour {shared} notifications : ils expliquent l’essentiel du pic.
                  </p>
                )}
              </figure>
              <dl className="grid content-start border-t-2 border-fg">
                {[
                  [pct(stats.causes.find((c) => /externe malveillant/i.test(c.label))?.n ?? 0, last.total), "des notifications citent un acte externe malveillant (piratage, rançongiciel, hameçonnage)"],
                  [stats.bigOnes.toLocaleString("fr-FR"), "violations touchaient chacune plus de 5 000 personnes"],
                  [pct(informed, last.total), "des notifications indiquent que les personnes concernées avaient déjà été prévenues"],
                ].map(([v, t]) => (
                  <div key={t} className="border-b border-rule py-4">
                    <dt className="font-display text-3xl font-extrabold tracking-[-0.04em]">{v}</dt>
                    <dd className="mt-1 text-fg-2">{t}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <SourceBadge name={V.name} url={V.url} licence={V.licence} note="Les notifications sont anonymes : la CNIL ne publie pas le nom des organismes concernés." />
          </div>
        </section>
      )}

      <section aria-labelledby="dpo-finder-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={nums[1]} kicker="Passer à l’action" id="dpo-finder-title" title="Trouver le DPO d’une entreprise" />
          <p className="mt-4 max-w-2xl text-lg text-fg-2">
            Nom ou SIREN : la fiche de l’entreprise indique si elle a déclaré un délégué à la protection des données à la CNIL, et comment le joindre.
            C’est à lui qu’on écrit pour savoir quelles données ont fuité ou pour exercer ses droits.
          </p>
          <div className="mt-8 max-w-3xl"><CompanySearch /></div>
        </div>
      </section>

      {sanctions.length > 0 && (
        <section aria-labelledby="cnil-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={nums[2]} kicker={`${nSanctions} sanctions · ${nNotices} mises en demeure publiques`} id="cnil-title" title="Les dernières sanctions de la CNIL" />
            <ul className="mt-10 border-t-2 border-fg">
              {sanctions.map((d) => (
                <li key={d.id} className="border-b border-rule">
                  <Link href={decisionUrl(d)} className="group grid gap-1 py-4 hover:bg-surface sm:grid-cols-[16rem_1fr_auto] sm:gap-6 sm:px-2">
                    <span className="font-semibold">{citation(d)}</span>
                    <span className="text-fg-2">{cnilSubject(d.titre)}</span>
                    <ArrowRight aria-hidden className="hidden size-4 self-center transition group-hover:translate-x-1 sm:block motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              <Link href="/jurisprudence#ch-cnil" className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                Toutes les délibérations de la CNIL <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </div>
        </section>
      )}
    </>
  );
}
