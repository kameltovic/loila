import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import AddressSearch from "@/components/AddressSearch";
import { Empty, SectionHead, block, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Vérifier un bien immobilier : parcelle, ventes DVF, DPE, risques",
  description:
    "Saisissez une adresse : parcelle cadastrale, ventes DVF, diagnostics DPE, risques naturels et technologiques et zonage du PLU, sources officielles à l’appui.",
  path: "/verifier-un-bien",
});

/** Tool landing: address search + the sourced blocks the property graph can answer. */
export default function VerifierUnBien() {
  const cached = getDb()
    .prepare("SELECT ban_id, label, postcode, city FROM addresses ORDER BY fetched_at DESC LIMIT 24")
    .all() as { ban_id: string; label: string; postcode: string | null; city: string | null }[];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Vérifier un bien", path: "/verifier-un-bien" }]),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Vérifier un bien immobilier",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            inLanguage: "fr-FR",
          },
        ]}
      />
      <section className={`${block("urbanisme")} border-b-2 border-ink`}>
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3`}>
            <ThemeIcon slug="urbanisme" className="size-8 shrink-0" />
            Outil gratuit · sources officielles
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            Vérifier un bien immobilier
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Parcelle cadastrale, ventes DVF, diagnostics DPE, risques naturels et technologiques, zonage du PLU. Chaque
            information vient d’une source officielle, indique sa date et son niveau de confiance.
          </p>
          <div className="mt-10 max-w-3xl">
            <AddressSearch />
          </div>
        </div>
      </section>

      <section aria-labelledby="why-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Pourquoi vérifier" id="why-title" title="Ce que le chaînage permet de savoir" />
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { t: "Situer le bien", d: "Adresse officielle (BAN) et parcelle cadastrale au point exact, avec sa contenance." },
              { t: "Voir les ventes passées", d: "Mutations DVF rattachées à la parcelle, présentées comme des indices, jamais comme le prix d’un logement précis." },
              { t: "Connaître le cadre", d: "DPE, risques naturels et technologiques et zone d’urbanisme (PLU) au point de l’adresse." },
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
          <SectionHead num="02" kicker="Déjà vérifiées" id="cached-title" title="Dernières adresses consultées" />
          <div className="mt-10">
            {cached.length === 0 ? (
              <Empty>Aucune adresse en cache pour l’instant : lancez la première recherche.</Empty>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cached.map((a) => (
                  <li key={a.ban_id}>
                    <Link href={`/bien/${a.ban_id}`} className="inline-flex items-center gap-2 rounded-full border-2 border-fg px-4 py-2 font-semibold transition hover:bg-fg hover:text-bg">
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-10 text-sm text-fg-2">
            Loilà présente des faits sourcés, sans jugement ni estimation.{" "}
            <Link href="/a-propos" className="underline underline-offset-2">En savoir plus</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
