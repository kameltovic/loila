import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Empty, SectionHead, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { JsonLd, abs, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Biens et adresses vérifiés : parcelle, ventes, DPE, risques",
  description:
    "Les adresses vérifiées sur Loilà : parcelle cadastrale, ventes DVF, diagnostics DPE, risques et zonage du PLU, sources officielles à l’appui.",
  path: "/bien",
});

export default function BiensHub() {
  const db = getDb();
  // Only addresses with an attached sourced block: a bare geocoded address stays out of the hub (thin content).
  const rows = db
    .prepare(
      `SELECT a.ban_id, a.label, a.postcode, a.city
       FROM addresses a
       WHERE EXISTS (SELECT 1 FROM dpe_diagnostics d WHERE d.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM risks r WHERE r.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM urban_zones z WHERE z.ban_id = a.ban_id)
          OR EXISTS (SELECT 1 FROM transactions t JOIN parcel_addresses pa ON pa.parcel_id = t.id_parcelle WHERE pa.ban_id = a.ban_id)
       ORDER BY a.label LIMIT 200`,
    )
    .all() as { ban_id: string; label: string; postcode: string | null; city: string | null }[];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Biens", path: "/bien" }]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Biens et adresses vérifiés",
            url: abs("/bien"),
            mainEntity: { "@type": "ItemList", numberOfItems: rows.length, itemListElement: rows.slice(0, 50).map((r, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/bien/${r.ban_id}`) })) },
          },
        ]}
      />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <ThemeIcon slug="urbanisme" className="size-8 shrink-0" />
            Biens
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            Les adresses, <span className="font-serif font-normal italic">faits sourcés.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-2">
            Parcelle, ventes, diagnostics, risques et urbanisme, rattachés à une adresse officielle. Vérifiez n’importe
            quelle adresse française.
          </p>
          <Link href="/verifier-un-bien" className="mt-8 inline-flex items-center gap-2 font-semibold underline decoration-signal decoration-2 underline-offset-4">
            Vérifier un bien <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="list-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Fiches publiées" id="list-title" title="Adresses avec un contenu rattaché" />
          <div className="mt-10">
            {rows.length === 0 ? (
              <Empty>Aucune fiche publiée pour l’instant.</Empty>
            ) : (
              <ul className="border-t border-fg">
                {rows.map((r) => (
                  <li key={r.ban_id} className="border-b border-rule">
                    <Link href={`/bien/${r.ban_id}`} className="group grid gap-1 py-4 hover:bg-surface sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                      <span>
                        <span className="font-semibold">{r.label}</span>
                        <span className="mt-1 block font-mono text-xs text-fg-2">
                          {r.postcode ?? ""} {r.city ?? ""} · {r.ban_id}
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
