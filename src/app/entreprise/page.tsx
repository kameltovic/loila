import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Empty, SectionHead, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { indexableCompanies } from "@/lib/eligibility";
import { JsonLd, abs, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Entreprises : fiches vérifiées et conventions collectives",
  description:
    "Les fiches d’entreprises consultées sur Loilà : état administratif, annonces BODACC, certifications RGE et convention collective déclarée, sources officielles à l’appui.",
  path: "/entreprise",
});

export default function EntreprisesHub() {
  const db = getDb();
  // Same deterministic gate as the sitemap (indexableCompanies): active, diffusable, with a sourced block.
  const eligible = indexableCompanies();
  const bySiren = new Map(
    (db.prepare(`SELECT siren, nom_complet, activite_principale, etat_administratif FROM companies`).all() as {
      siren: string; nom_complet: string | null; activite_principale: string | null; etat_administratif: string | null;
    }[]).map((r) => [r.siren, r]),
  );
  const rows = eligible
    .map((c) => bySiren.get(c.siren))
    .filter((r): r is { siren: string; nom_complet: string | null; activite_principale: string | null; etat_administratif: string | null } => !!r)
    .sort((a, b) => (a.nom_complet ?? "").localeCompare(b.nom_complet ?? ""))
    .slice(0, 200);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Entreprises", path: "/entreprise" }]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Entreprises vérifiées",
            url: abs("/entreprise"),
            mainEntity: { "@type": "ItemList", numberOfItems: rows.length, itemListElement: rows.slice(0, 50).map((r, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/entreprise/${r.siren}`) })) },
          },
        ]}
      />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <ThemeIcon slug="travail" className="size-8 shrink-0" />
            Entreprises
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            Les entreprises, <span className="font-serif font-normal italic">faits sourcés.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-2">
            Identité, activité, annonces officielles et convention collective déclarée. Recherchez n’importe quelle entreprise
            française par son nom, son SIREN ou son SIRET.
          </p>
          <Link href="/verifier-entreprise" className="mt-8 inline-flex items-center gap-2 font-semibold underline decoration-signal decoration-2 underline-offset-4">
            Vérifier une entreprise <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="list-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Fiches publiées" id="list-title" title="Entreprises avec un contenu rattaché" />
          <div className="mt-10">
            {rows.length === 0 ? (
              <Empty>Aucune fiche publiée pour l’instant.</Empty>
            ) : (
              <ul className="border-t border-fg">
                {rows.map((r) => (
                  <li key={r.siren} className="border-b border-rule">
                    <Link href={`/entreprise/${r.siren}`} className="group grid gap-1 py-4 hover:bg-surface sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                      <span>
                        <span className="font-semibold">{r.nom_complet ?? r.siren}</span>
                        <span className="mt-1 block font-mono text-xs text-fg-2">
                          SIREN {r.siren}
                          {r.activite_principale && <> · NAF {r.activite_principale}</>}
                          {r.etat_administratif && <> · {r.etat_administratif === "A" ? "active" : "cessée"}</>}
                        </span>
                      </span>
                      <ArrowRight aria-hidden className="hidden size-4 transition group-hover:translate-x-1 sm:block motion-reduce:transition-none" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
