import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";
import { SourceBadge } from "@/components/SourceBadge";
import { SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import { irlSeries, quarterLabel, reviseRent } from "@/lib/irl";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { SOURCES, getSourceRecord } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SRC = SOURCES["INSEE:irl"];
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const frDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

export async function generateMetadata(): Promise<Metadata> {
  const last = irlSeries(1)[0];
  return pageMetadata({
    title: last ? `Révision de loyer : calcul avec l’IRL (${quarterLabel(last.period)} = ${last.value.toLocaleString("fr-FR")})` : "Révision de loyer : calcul avec l’IRL",
    description:
      "Calculez la révision annuelle de votre loyer avec l’indice de référence des loyers publié par l’INSEE, selon l’article 17-1 de la loi du 6 juillet 1989. Gratuit, sources officielles.",
    path: "/revision-loyer",
  });
}

export default async function RevisionLoyer({ searchParams }: PageProps<"/revision-loyer">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const series = irlSeries();
  const latest = series[0];
  const rentRaw = one(sp.loyer).replace(",", ".").replace(/[^\d.]/g, "");
  const quarter = Number(one(sp.t)) || (latest ? Number(latest.period.slice(-1)) : 1);
  const latestYearFor = (q: number) => Number(series.find((p) => p.period.endsWith(`Q${q}`))?.period.slice(0, 4) ?? new Date().getFullYear());
  const year = Number(one(sp.annee)) || latestYearFor(quarter);
  const submitted = rentRaw !== "";
  const result = submitted ? reviseRent(Number(rentRaw), quarter, year, series) : undefined;
  const rec = getSourceRecord(latest?.source_record_id ?? "");
  const years = [...new Set(series.map((p) => Number(p.period.slice(0, 4))))].slice(0, 8);
  const table = series.slice(0, 12).map((p) => ({ ...p, prev: series.find((x) => x.period === `${Number(p.period.slice(0, 4)) - 1}${p.period.slice(4)}`) }));

  const field = "mt-2 block w-full border-2 border-fg bg-bg px-3 py-2.5 text-lg";

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Logement", path: "/logement" }, { name: "Révision de loyer", path: "/revision-loyer" }]),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calcul de la révision de loyer (IRL)",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            inLanguage: "fr-FR",
          },
        ]}
      />
      <section className={`${block("logement")} border-b-2 border-ink`}>
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3`}>
            <ThemeIcon slug="logement" className="size-8 shrink-0" />
            Outil gratuit · indice officiel INSEE
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>Réviser un loyer avec l’IRL</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Si le bail le prévoit, le loyer peut être révisé une fois par an, dans la limite de la variation de l’indice de référence des loyers.
            {latest && <> Dernier indice publié : <strong>{quarterLabel(latest.period)} = {latest.value.toLocaleString("fr-FR")}</strong>.</>}
          </p>

          <form method="get" className="mt-10 grid max-w-3xl gap-4 border-2 border-ink bg-bg p-5 text-fg sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              Loyer actuel hors charges (€)
              <input name="loyer" inputMode="decimal" required defaultValue={rentRaw} placeholder="850" className={field} />
            </label>
            <label className="text-sm font-semibold">
              Trimestre du bail
              <select name="t" defaultValue={String(quarter)} className={field}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q === 1 ? "1er" : `${q}e`} trimestre</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Année de révision
              <select name="annee" defaultValue={String(year)} className={field}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <button type="submit" className={`${btnPrimary} py-3`}>Calculer</button>
          </form>

          {result && (
            <div role="status" className="mt-6 max-w-3xl border-2 border-ink bg-bg p-5 text-fg">
              {"error" in result ? (
                <p className="font-semibold">{result.error}</p>
              ) : (
                <>
                  <p className={`${label} text-fg-2`}>Loyer révisé maximum</p>
                  <p className="mt-2 font-display text-5xl font-extrabold tracking-[-0.03em]">{eur(result.newRent)}</p>
                  <p className="mt-2 text-fg-2">
                    soit {eur(result.newRent - result.rent)} de plus par mois ({pct(result.variation)}).
                  </p>
                  <p className="mt-4 font-mono text-sm">
                    {eur(result.rent)} × {result.to.value.toLocaleString("fr-FR")} ({quarterLabel(result.to.period)}) ÷ {result.from.value.toLocaleString("fr-FR")} ({quarterLabel(result.from.period)})
                  </p>
                  <p className="mt-4 text-sm text-fg-2">
                    Plafond légal : le bailleur peut demander moins, jamais plus. La révision ne s’applique qu’à partir de sa demande, sans effet rétroactif.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="regles-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Ce que dit la loi" id="regles-title" title="Les règles de la révision" />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              { t: "Une clause dans le bail", d: "Sans clause de révision, le loyer ne peut pas être révisé en cours de bail. La révision a lieu une fois par an, à la date prévue ou à la date anniversaire du bail." },
              { t: "Le trimestre de référence", d: "C’est celui indiqué dans le bail. À défaut, celui du dernier indice publié à la signature. On compare l’indice de ce trimestre à celui du même trimestre un an plus tôt." },
              { t: "Un an pour la demander", d: "Le bailleur qui ne demande pas la révision dans l’année qui suit sa date d’effet y renonce pour l’année écoulée. Elle joue à partir de la demande, sans rattrapage." },
              { t: "Pas de hausse pour les passoires", d: "Un logement classé F ou G au DPE ne peut pas voir son loyer révisé ni majoré (III de l’article 17-1)." },
            ].map((x) => (
              <li key={x.t} className="border-2 border-fg bg-surface p-6">
                <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{x.t}</h3>
                <p className="mt-3 text-fg-2">{x.d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm font-semibold">
            <Link href="/article/loi-89-462/17-1" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
              Lire l’article 17-1 de la loi du 6 juillet 1989 <ArrowRight aria-hidden className="size-4" />
            </Link>
          </p>
        </div>
      </section>

      {table.length > 0 && (
        <section aria-labelledby="irl-title" className="border-t border-rule py-16 sm:py-24">
          <div className={container}>
            <SectionHead num="02" kicker="Indice officiel" id="irl-title" title="Les derniers IRL publiés" />
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-fg font-mono text-xs uppercase text-fg-2">
                    <th className="py-3 pr-4 font-bold">Trimestre</th>
                    <th className="py-3 pr-4 font-bold">IRL</th>
                    <th className="py-3 pr-4 font-bold">Sur un an</th>
                    <th className="py-3 font-bold">Publié au JO</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((p) => (
                    <tr key={p.period} className="border-b border-rule">
                      <td className="py-3 pr-4 font-semibold">{quarterLabel(p.period)}</td>
                      <td className="py-3 pr-4 font-mono">{p.value.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pr-4 font-mono">{p.prev ? pct(p.value / p.prev.value - 1) : "—"}</td>
                      <td className="py-3 text-fg-2">{frDate(p.valid_from)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SourceBadge name={SRC.name} url={SRC.url} licence={SRC.licence} retrievedAt={rec?.retrieved_at} matchQuality="CERTAIN" note="Valeurs définitives publiées par l’INSEE. Du 3e trimestre 2022 au 1er trimestre 2024, la hausse annuelle était plafonnée par la loi (bouclier loyer), avec des plafonds propres à la Corse et à l’outre-mer." />
          </div>
        </section>
      )}
    </>
  );
}
