import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import CompanySearch from "@/components/CompanySearch";
import { Empty, SectionHead, block, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Vérifier une entreprise : SIREN, SIRET, convention collective",
  description:
    "Saisissez un nom, un SIREN ou un SIRET : état administratif, activité, établissements, annonces BODACC, certifications RGE et convention collective déclarée, sources officielles à l’appui.",
  path: "/verifier-entreprise",
});

/** Tool landing: search + the legal questions the company graph can answer. */
export default function VerifierEntreprise() {
  const db = getDb();
  const cached = db
    .prepare("SELECT siren, nom_complet FROM companies ORDER BY fetched_at DESC LIMIT 24")
    .all() as { siren: string; nom_complet: string | null }[];
  const conventions = db
    .prepare("SELECT COUNT(*) n FROM collective_agreements WHERE actif = 1")
    .get() as { n: number };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Vérifier une entreprise", path: "/verifier-entreprise" }]),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Vérifier une entreprise",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            inLanguage: "fr-FR",
          },
        ]}
      />
      <section className={`${block("travail")} border-b-2 border-ink`}>
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3`}>
            <ThemeIcon slug="travail" className="size-8 shrink-0" />
            Outil gratuit · sources officielles
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            Vérifier une entreprise
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Identité, état administratif, activité, établissements, annonces BODACC, certifications RGE et convention collective
            déclarée. Chaque information vient d’une source officielle et indique sa date.
          </p>
          <div className="mt-10 max-w-3xl">
            <CompanySearch />
          </div>
        </div>
      </section>

      <section aria-labelledby="why-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Pourquoi vérifier" id="why-title" title="Ce que la fiche permet de faire" />
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { t: "Vérifier un partenaire", d: "État administratif, activité réelle (NAF), adresses des établissements, annonces au BODACC." },
              { t: "Trouver la convention collective", d: `La convention déclarée par l’employeur, reliée aux règles expliquées par Loilà (${conventions.n} conventions référencées).` },
              { t: "Repérer une procédure collective", d: "Les annonces officielles de redressement, liquidation ou conciliation, datées et liées au BODACC." },
            ].map((x) => (
              <li key={x.t} className="border-2 border-fg bg-surface p-6">
                <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{x.t}</h3>
                <p className="mt-3 text-fg-2">{x.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="cached-title" className="pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead num="02" kicker="Déjà vérifiées" id="cached-title" title="Dernières entreprises consultées" />
          <div className="mt-10">
            {cached.length === 0 ? (
              <Empty>Aucune fiche en cache pour l’instant : lancez la première recherche.</Empty>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cached.map((c) => (
                  <li key={c.siren}>
                    <Link href={`/entreprise/${c.siren}`} className="inline-flex items-center gap-2 rounded-full border-2 border-fg px-4 py-2 font-semibold transition hover:bg-fg hover:text-bg">
                      {c.nom_complet ?? c.siren}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-10 text-sm text-fg-2">
            Loilà présente des faits sourcés, sans jugement ni score de fiabilité.{" "}
            <Link href="/a-propos" className="underline underline-offset-2">En savoir plus</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
