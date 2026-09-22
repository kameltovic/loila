import type { Metadata } from "next";
import Link from "next/link";
import ThemeIcon from "@/components/ThemeIcon";
import { SectionHead, block, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { type Place, departements, getPlace, mainKind, placeName, placeUrl, pointsOf, priceYears } from "@/lib/prices";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Prix immobilier au m² par commune et département (DVF)",
  description:
    "Prix au m² des appartements et maisons dans chaque commune de France, évolution depuis 2021 et carte par quartier, d’après les ventes officielles DVF.",
  path: "/prix-immobilier",
});

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
const latest = (p: Place) => {
  const rows = priceYears(p.code);
  return pointsOf(rows, mainKind(rows)).at(-1);
};

export default function PrixImmobilier() {
  const deps = departements();
  const cities = getDb().prepare("SELECT * FROM places WHERE level = 'commune' ORDER BY sales DESC LIMIT 30").all() as Place[];
  const france = getPlace("FR");
  const fr = france ? pointsOf(priceYears("FR"), "apt").at(-1) : undefined;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Prix immobilier", path: "/prix-immobilier" }])} />
      <section className={`${block("logement")} border-b-2 border-ink`}>
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3`}>
            <ThemeIcon slug="logement" className="size-8 shrink-0" />
            Ventes officielles DVF · toutes les communes
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>Prix immobilier au m²</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Le prix réel des ventes, commune par commune, d’après les actes enregistrés par l’administration fiscale. Avec, pour chaque ville,
            les règles de location et les tribunaux compétents.
            {fr && <> En France, un appartement s’est vendu <strong>{eur(fr.median)} le m²</strong> en médiane en {fr.year}.</>}
          </p>
        </div>
      </section>

      <section aria-labelledby="villes-title" className={`${container} py-16 sm:py-20`}>
        <SectionHead num="01" kicker="Villes" id="villes-title" title="Les villes où il se vend le plus" />
        <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => {
            const pt = latest(c);
            return (
              <li key={c.code}>
                <Link href={placeUrl(c)} className="group flex items-baseline justify-between gap-4 border-b border-rule py-3 hover:bg-surface sm:px-2">
                  <span className="font-semibold group-hover:underline">{placeName(c)}</span>
                  <span className="font-mono text-sm text-fg-2">{pt ? `${eur(pt.median)}/m²` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="deps-title" className={`${container} pb-20 sm:pb-28`}>
        <SectionHead num="02" kicker="Départements" id="deps-title" title="Tous les départements" />
        <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {deps.map((d) => {
            const pt = latest(d);
            return (
              <li key={d.code}>
                <Link href={placeUrl(d)} className="group flex items-baseline justify-between gap-4 border-b border-rule py-3 hover:bg-surface sm:px-2">
                  <span><span className="mr-2 font-mono text-xs text-fg-2">{d.code}</span><span className="font-semibold group-hover:underline">{d.name}</span></span>
                  <span className="font-mono text-sm text-fg-2">{pt ? `${eur(pt.median)}/m²` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-fg-2">Bas-Rhin, Haut-Rhin, Moselle et Mayotte ne sont pas couverts : leurs ventes ne sont pas publiées dans DVF.</p>
      </section>
    </>
  );
}
