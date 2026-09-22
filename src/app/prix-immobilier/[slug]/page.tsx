import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import HousingZoneCard from "@/components/HousingZoneCard";
import JurisdictionCard from "@/components/JurisdictionCard";
import PriceChart from "@/components/PriceChart";
import PriceMap from "@/components/PriceMap";
import { SourceBadge } from "@/components/SourceBadge";
import ThemeIcon from "@/components/ThemeIcon";
import { SectionHead, block, btnPrimary, container, display, label } from "@/components/ui";
import {
  KIND_LABEL, type Kind, type Place, arrondissementCity, change, getPlace, neighbours, sectionPrices, mainKind, placeFromSlug, placeIndexable, placeName, placeUrl, pointsOf, priceYears,
} from "@/lib/prices";
import { JsonLd, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";
import { SOURCES } from "@/lib/sources";
import { housingZone } from "@/lib/zones";

export const dynamic = "force-dynamic";

const SRC = SOURCES["ETALAB:dvf-stats"];
const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("fr-FR")} %`;
// Départements take varying articles (du Nord, de la Somme…): the neutral "dans le 59 (Nord)" is idiomatic.
const inName = (p: Place) => (p.level === "departement" ? `dans le ${p.code} (${p.name})` : `à ${placeName(p)}`);

/** Everything a page says, computed once for metadata and body. */
function facts(p: Place) {
  const rows = priceYears(p.code);
  const kind = mainKind(rows);
  const points = pointsOf(rows, kind);
  const other: Kind = kind === "apt" ? "house" : "apt";
  const otherPoints = pointsOf(rows, other, 20); // the secondary type only when it rests on real volumes
  const last = points.at(-1);
  const prev = points.at(-2);
  const first = points[0];
  const parent = p.level === "commune" ? getPlace(p.dep ?? "") : getPlace("FR");
  const parentRows = parent ? priceYears(parent.code) : [];
  const parentPoints = pointsOf(parentRows, kind);
  const parentLast = parentPoints.find((q) => q.year === last?.year);
  return { rows, kind, points, other, otherPoints, last, prev, first, parent, parentPoints, parentLast };
}

export async function generateMetadata({ params }: PageProps<"/prix-immobilier/[slug]">): Promise<Metadata> {
  const p = placeFromSlug((await params).slug);
  if (!p || p.level === "nation") return { title: "Page introuvable" };
  const f = facts(p);
  const where = p.level === "departement" ? `${p.name} (${p.code})` : placeName(p);
  const title = f.last ? `Prix immobilier ${where} : ${eur(f.last.median)}/m² en ${f.last.year}` : `Prix immobilier ${where}`;
  const meta = pageMetadata({
    title,
    description: clip(
      f.last
        ? `Prix au m² des ${KIND_LABEL[f.kind]} ${inName(p)} : ${eur(f.last.median)} en ${f.last.year}${f.prev ? ` (${pct(change(f.prev.median, f.last.median))} sur un an)` : ""}. Évolution depuis ${f.first?.year}, ventes officielles DVF, règles de location et tribunaux compétents.`
        : `Prix immobilier ${inName(p)} d’après les ventes officielles DVF.`,
      160,
    ),
    path: placeUrl(p),
  });
  return { ...meta, title: { absolute: `${clip(title, 62)} · Loilà` }, ...(placeIndexable(p, f.rows) ? {} : { robots: { index: false, follow: true } }) };
}

export default async function PricePage({ params }: PageProps<"/prix-immobilier/[slug]">) {
  const { slug } = await params;
  const p = placeFromSlug(slug);
  if (!p || p.level === "nation") notFound();
  if (slug !== p.slug) permanentRedirect(placeUrl(p));
  const f = facts(p);
  const isCommune = p.level === "commune";
  const where = isCommune ? placeName(p) : `${p.name} (${p.code})`;
  const siblings = neighbours(p, isCommune ? 13 : 300).filter((c) => c.code !== p.code);
  const zone = isCommune ? housingZone(p.code) : undefined;
  // Section map: the commune, or the whole city for an arrondissement, or all of Paris on the 75 page.
  const city = isCommune ? arrondissementCity(p.code) : null;
  const mapCommunes = city ? neighbours(p, 0).map((c) => c.code) : isCommune ? [p.code] : siblings.length && siblings.every((c) => arrondissementCity(c.code)) ? siblings.map((c) => c.code) : [];
  const sectionMap = sectionPrices(mapCommunes, f.kind);
  const parentName = f.parent ? (f.parent.level === "nation" ? "France" : `${f.parent.name} (${f.parent.code})`) : "";
  const parentIn = f.parent?.level === "nation" ? "nationale" : `du ${f.parent?.code} (${f.parent?.name})`;
  const vsParent = f.last && f.parentLast ? change(f.parentLast.median, f.last.median) : null;
  const kindLabel = KIND_LABEL[f.kind];
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Prix immobilier", path: "/prix-immobilier" },
    ...(isCommune && f.parent ? [{ name: `${f.parent.name} (${f.parent.code})`, path: placeUrl(f.parent) }] : []),
    { name: where, path: placeUrl(p) },
  ];
  const faq = f.last
    ? [
        {
          q: `Quel est le prix au m² ${inName(p)} en ${f.last.year} ?`,
          a: `Le prix médian des ${kindLabel} vendus ${inName(p)} en ${f.last.year} est de ${eur(f.last.median)} le m², sur ${f.last.sales.toLocaleString("fr-FR")} ventes enregistrées par l’administration fiscale (DVF).`,
        },
        ...(f.first && f.first.year !== f.last.year
          ? [{
              q: `Comment évoluent les prix de l’immobilier ${inName(p)} ?`,
              a: `Depuis ${f.first.year}, le prix médian au m² des ${kindLabel} est passé de ${eur(f.first.median)} à ${eur(f.last.median)}, soit ${pct(change(f.first.median, f.last.median))}.${f.prev ? ` Sur la dernière année : ${pct(change(f.prev.median, f.last.median))}.` : ""}`,
            }]
          : []),
        ...(zone
          ? [{
              q: `${placeName(p)} : zone tendue ou non ?`,
              a: zone.zone === 1
                ? `Oui. ${placeName(p)} est classée en zone tendue : le locataire d’un logement vide peut partir avec un préavis d’un mois, et la hausse du loyer est encadrée à la relocation.`
                : zone.zone === 2
                  ? `${placeName(p)} est classée zone touristique et tendue : la taxe d’habitation des résidences secondaires peut y être majorée, mais le préavis du locataire reste de trois mois.`
                  : `Non. ${placeName(p)} n’est pas en zone tendue : le préavis du locataire d’un logement vide est de trois mois, sauf cas de réduction prévus par la loi.`,
            }]
          : []),
      ]
    : [];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          ...(faq.length
            ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }]
            : []),
        ]}
      />
      <section className={`${block("logement")} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            {crumbs.slice(0, -1).map((c) => (
              <span key={c.path} className="flex items-center gap-2">
                <Link href={c.path} className="underline-offset-4 hover:underline">{c.name}</Link>
                <span aria-hidden>/</span>
              </span>
            ))}
          </nav>
          <p className={`${label} mt-10 flex items-center gap-3`}>
            <ThemeIcon slug="logement" className="size-8 shrink-0" />
            Ventes officielles DVF · {f.first?.year}–{f.last?.year}
          </p>
          <h1 className={`${display} mt-5 max-w-5xl text-[clamp(2.4rem,6.5vw,5rem)] leading-[0.95] text-balance`}>Prix immobilier {inName(p)}</h1>
          {f.last && (
            <div className="mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              <div className="border-2 border-ink bg-bg p-5 shadow-[5px_5px_0_0_var(--fg)] sm:col-span-2">
                <p className="font-mono text-xs font-bold uppercase tracking-wide">Prix médian au m² · {kindLabel} · {f.last.year}</p>
                <p className="mt-1 font-display text-6xl font-extrabold tracking-[-0.04em]">
                  {f.last.median.toLocaleString("fr-FR")}&nbsp;€<span className="text-3xl">/m²</span>
                </p>
                <p className="mt-2 text-sm">
                  {f.prev && <><strong>{pct(change(f.prev.median, f.last.median))}</strong> sur un an · </>}
                  {f.first && f.first.year !== f.last.year && <><strong>{pct(change(f.first.median, f.last.median))}</strong> depuis {f.first.year}</>}
                </p>
              </div>
              <div className="grid gap-4">
                {f.otherPoints.at(-1) && (
                  <div className="border-2 border-ink bg-bg p-4">
                    <p className="font-mono text-xs uppercase tracking-wide">{KIND_LABEL[f.other]} · {f.otherPoints.at(-1)!.year}</p>
                    <p className="mt-1 font-display text-2xl font-extrabold">{eur(f.otherPoints.at(-1)!.median)}/m²</p>
                  </div>
                )}
                <div className="border-2 border-ink bg-bg p-4">
                  <p className="font-mono text-xs uppercase tracking-wide">Ventes {f.first?.year}–{f.last.year}</p>
                  <p className="mt-1 font-display text-2xl font-extrabold">{p.sales.toLocaleString("fr-FR")}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className={`${container} grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_18rem]`}>
        <div className="min-w-0 space-y-16">
          <section aria-labelledby="evolution-title">
            <SectionHead num="01" kicker="Évolution" id="evolution-title" title={`Le prix au m² ${inName(p)}, année par année`} />
            {f.last && (
              <p className="mt-6 max-w-3xl text-lg text-pretty">
                En {f.last.year}, les {kindLabel} se sont vendus {inName(p)} à <strong>{eur(f.last.median)} le m²</strong> en valeur médiane
                {f.prev ? `, ${change(f.prev.median, f.last.median) >= 0 ? "en hausse" : "en baisse"} de ${Math.abs(change(f.prev.median, f.last.median)).toLocaleString("fr-FR")} % sur un an` : ""}
                {f.first && f.first.year !== f.last.year ? ` (${pct(change(f.first.median, f.last.median))} depuis ${f.first.year})` : ""}.
                {vsParent != null && f.parentLast && ` C’est ${Math.abs(vsParent).toLocaleString("fr-FR")} % ${vsParent >= 0 ? "de plus" : "de moins"} que la médiane ${parentIn} (${eur(f.parentLast.median)}).`}
              </p>
            )}
            <div className="mt-8">
              <PriceChart
                title={`Prix médian au m² des ${kindLabel}`}
                series={[
                  { key: "a", name: where, points: f.points },
                  ...(f.parentPoints.length >= 2 ? [{ key: "b" as const, name: parentName, points: f.parentPoints }] : []),
                ]}
              />
            </div>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-fg font-mono text-xs uppercase text-fg-2">
                    <th className="py-3 pr-4 font-bold">Année</th>
                    <th className="py-3 pr-4 font-bold">Appartements</th>
                    <th className="py-3 pr-4 font-bold">Maisons</th>
                  </tr>
                </thead>
                <tbody>
                  {f.rows.map((r) => (
                    <tr key={r.year} className="border-b border-rule">
                      <td className="py-3 pr-4 font-mono font-semibold">{r.year}</td>
                      {(["apt", "house"] as const).map((k) => {
                        const pt = pointsOf([r], k, k === f.kind ? 5 : 20)[0];
                        return (
                          <td key={k} className="py-3 pr-4 font-mono">
                            {pt ? <>{eur(pt.median)}/m² <span className="text-fg-2">· {pt.sales.toLocaleString("fr-FR")} ventes</span></> : <span className="text-fg-2">trop peu de ventes</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SourceBadge
              name={SRC.name}
              url={SRC.url}
              licence={SRC.licence}
              matchQuality="CERTAIN"
              note="Médianes mensuelles de la DGFiP, moyennées sur l’année selon le nombre de ventes. Années de moins de 5 ventes (20 pour le type secondaire) non affichées. Hors Alsace-Moselle et Mayotte, absents de DVF."
            />
          </section>

          {sectionMap.breaks.length === 4 && (
            <section aria-labelledby="carte-title">
              <SectionHead num="02" kicker="Quartiers" id="carte-title" title={`Le prix au m² quartier par quartier${city ? "" : ` ${inName(p)}`}`} />
              <p className="mt-6 max-w-3xl text-fg-2">
                Chaque zone est une section cadastrale, quelques pâtés de maisons. Couleur : prix médian au m² des {kindLabel} sur les trois dernières années,
                pour les sections d’au moins 5 ventes. Survolez une zone pour son prix.
              </p>
              <div className="mt-8">
                <PriceMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} communes={mapCommunes} focus={isCommune ? p.code : ""} sections={sectionMap.sections} breaks={sectionMap.breaks} kind={kindLabel} />
              </div>
            </section>
          )}

          {siblings.length > 0 && (
            <section aria-labelledby="communes-title">
              <SectionHead
                num={sectionMap.breaks.length === 4 ? "03" : "02"}
                kicker={isCommune ? "Autour" : "Communes"}
                id="communes-title"
                title={isCommune ? (arrondissementCity(p.code) ? "Prix dans les autres arrondissements" : `Prix dans les autres communes ${f.parent ? parentIn : ""}`) : "Prix au m² commune par commune"}
              />
              <ul className="mt-8 grid gap-x-8 sm:grid-cols-2">
                {siblings.map((c) => {
                  const pts = pointsOf(priceYears(c.code), f.kind);
                  const lastPt = pts.at(-1);
                  return (
                    <li key={c.code}>
                      <Link href={placeUrl(c)} className="group flex items-baseline justify-between gap-4 border-b border-rule py-3 hover:bg-surface sm:px-2">
                        <span className="font-semibold group-hover:underline">{placeName(c)}</span>
                        <span className="font-mono text-sm text-fg-2">{lastPt ? `${eur(lastPt.median)}/m²` : `${c.sales} ventes`}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="faq-title">
            <SectionHead num={String(2 + (siblings.length ? 1 : 0) + (sectionMap.breaks.length === 4 ? 1 : 0)).padStart(2, "0")} kicker="Questions" id="faq-title" title="En bref" />
            <dl className="mt-8 space-y-6">
              {faq.map((x) => (
                <div key={x.q} className="border-b border-rule pb-6">
                  <dt className="font-display text-xl font-bold tracking-[-0.02em]">{x.q}</dt>
                  <dd className="mt-2 max-w-3xl text-fg-2">{x.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-8 lg:pt-2">
          {isCommune && (
            <>
              <HousingZoneCard citycode={p.code} />
              <JurisdictionCard citycode={p.code} city={placeName(p)} kinds={["tj", "tprx", "cph", "ca"]} />
            </>
          )}
          <div className="border-t-2 border-fg pt-4">
            <h2 className={`${label} text-fg-2`}>Une adresse précise ?</h2>
            <p className="mt-3 text-sm">Parcelle, ventes de l’immeuble, DPE, risques et urbanisme, à partir des sources officielles.</p>
            <Link href="/verifier-un-bien" className={`${btnPrimary} mt-4 w-full`}>
              Vérifier un bien <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="border-t-2 border-fg pt-4 text-sm">
            <h2 className={`${label} text-fg-2`}>Louer</h2>
            <ul className="mt-3 space-y-2">
              <li><Link href="/revision-loyer" className="underline underline-offset-2">Calculer une révision de loyer (IRL)</Link></li>
              <li><Link href="/logement" className="underline underline-offset-2">Vos droits de locataire et de bailleur</Link></li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
