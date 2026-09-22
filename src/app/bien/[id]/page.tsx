import { notFound } from "next/navigation";
import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Empty, SectionHead, block, container, display, label } from "@/components/ui";
import { SourceBadge } from "@/components/SourceBadge";
import JurisdictionCard from "@/components/JurisdictionCard";
import HousingZoneCard from "@/components/HousingZoneCard";
import PropertyMap from "@/components/PropertyMap";
import { housingZone } from "@/lib/zones";
import {
  addressDpe,
  addressIndexable,
  addressParcel,
  addressRisks,
  addressSource,
  addressTransactions,
  pricePerSqm,
  addressZones,
  getAddress,
} from "@/lib/address";
import { JsonLd, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";import { SOURCES } from "@/lib/sources";

export const dynamic = "force-dynamic";

const BAN = SOURCES["IGN:ban"];
const CADASTRE = SOURCES["IGN:cadastre"];
const DVF = SOURCES["DGFiP:dvf"];
const DPE = SOURCES["ADEME:dpe"];
const GEORISQUES = SOURCES["BRGM:georisques"];
const GPU = SOURCES["IGN:gpu"];

const frDate = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR") : "—");
const euro = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
const m2 = (n: number | null) => (n == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} m²`);

export async function generateMetadata({ params }: PageProps<"/bien/[id]">): Promise<Metadata> {
  const id = (await params).id;
  const a = getAddress(id);
  if (!a) return { title: "Adresse pas encore vérifiée", robots: { index: false, follow: true } };
  const title = `${a.label} : parcelle, ventes, DPE et risques`;
  const meta = pageMetadata({
    title,
    description: clip(
      `${a.label} : parcelle cadastrale, ventes DVF, diagnostics DPE, risques naturels et technologiques et zonage du PLU, sources officielles à l’appui.`,
    ),
    path: `/bien/${id}`,
  });
  return { ...meta, title: { absolute: title }, ...(addressIndexable(id) ? {} : { robots: { index: false, follow: true } }) };
}

export default async function BienPage({ params }: PageProps<"/bien/[id]">) {
  const id = (await params).id;
  const a = getAddress(id);

  if (!a) notFound(); // not in the cache: a real 404, not a soft 404 placeholder

  const parcel = addressParcel(id);
  const transactions = addressTransactions(id, 24);
  const ppm = pricePerSqm(addressTransactions(id, 500));
  const dpe = addressDpe(id);
  const risks = addressRisks(id);
  const zones = addressZones(id);
  const fresh = addressSource(a.source_record_id);
  const indexable = addressIndexable(id);
  const path = `/bien/${id}`;
  const hasBlocks = transactions.length > 0 || dpe.length > 0 || risks.length > 0 || zones.length > 0;

  const zone = housingZone(a.citycode);
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapFacts: { label: string; value: string }[] = [
    ...(parcel ? [{ label: "Parcelle", value: `${parcel.section ?? ""} ${parcel.numero ?? ""}${parcel.contenance ? ` · ${parcel.contenance.toLocaleString("fr-FR")} m²` : ""}`.trim() }] : []),
    ...(zones[0]?.libelle ? [{ label: "PLU", value: zones[0].libelle }] : []),
    ...(dpe[0]?.etiquette_dpe ? [{ label: "DPE", value: dpe[0].etiquette_dpe }] : []),
    ...(zone?.zone === 1 ? [{ label: "Location", value: "Zone tendue" }] : []),
  ];

  const blockSource = (sourceId: string | null | undefined) => addressSource(sourceId ?? null);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Biens", path: "/bien" }, { name: a.label, path }]),
          {
            "@context": "https://schema.org",
            "@type": "Place",
            name: a.label,
            identifier: a.ban_id,
            address: {
              "@type": "PostalAddress",
              streetAddress: [a.housenumber, a.street].filter(Boolean).join(" ") || a.label,
              ...(a.postcode && { postalCode: a.postcode }),
              ...(a.city && { addressLocality: a.city }),
              addressCountry: "FR",
            },
            ...(a.lat != null && a.lon != null && { geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lon } }),
          },
        ]}
      />

      {mapToken && a.lat != null && a.lon != null ? (
        <section className="relative border-b-2 border-ink">
          <PropertyMap token={mapToken} lat={a.lat} lon={a.lon} label={a.label} parcel={parcel?.geometry ?? null} className="h-[clamp(30rem,82vh,52rem)] w-full">
            {/* Overlay stops 2rem above the bottom edge: the Mapbox logo and attribution must stay visible. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
              <div className="bg-gradient-to-b from-bg/85 to-transparent pb-10">
                <nav aria-label="Fil d’Ariane" className={`${container} ${label} pointer-events-auto flex flex-wrap items-center gap-2 pt-6`}>
                  <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
                  <span aria-hidden>/</span>
                  <Link href="/bien" className="underline-offset-4 hover:underline">Biens</Link>
                </nav>
              </div>
              <div className="bg-gradient-to-t from-bg via-bg/80 to-transparent pt-24">
                <div className={container}>
                  <p className={`${label} flex flex-wrap items-center gap-2`}>
                    <ThemeIcon slug="urbanisme" className="size-7 shrink-0" />
                    {mapFacts.map((f) => (
                      <span key={f.label} className="border-2 border-ink bg-bg px-2 py-1">
                        <span className="text-fg-2">{f.label}</span> {f.value}
                      </span>
                    ))}
                  </p>
                  <h1 className={`${display} mt-5 max-w-4xl text-[clamp(2.25rem,6vw,4.75rem)] leading-[0.95] text-balance [text-shadow:0_1px_0_var(--bg)]`}>
                    {a.label}
                  </h1>
                  <p className="mt-3 pb-4 font-serif text-xl italic">
                    {a.city}{a.citycode ? ` (INSEE ${a.citycode})` : ""} · <span className="font-mono text-sm not-italic">BAN {a.ban_id}</span>
                  </p>
                </div>
              </div>
            </div>
          </PropertyMap>
        </section>
      ) : (
        <section className={`${block("urbanisme")} border-b-2 border-ink`}>
          <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
            <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
              <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
              <span aria-hidden>/</span>
              <Link href="/bien" className="underline-offset-4 hover:underline">Biens</Link>
            </nav>
            <p className={`${label} mt-12 flex flex-wrap items-center gap-2`}>
              <ThemeIcon slug="urbanisme" className="size-8 shrink-0" />
              <span className="border-2 border-ink px-2 py-1">BAN {a.ban_id}</span>
              {a.postcode && <span className="border-2 border-ink px-2 py-1">{a.postcode}</span>}
              {parcel && <span className="border-2 border-ink px-2 py-1">Parcelle {parcel.idu}</span>}
            </p>
            <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] text-balance`}>
              {a.label}
            </h1>
            {a.city && <p className="mt-3 font-serif text-xl italic">{a.city}{a.citycode ? ` (INSEE ${a.citycode})` : ""}</p>}
          </div>
        </section>
      )}

      <article className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_18rem]`}>
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="parcelle-title">
            <SectionHead num="01" kicker="Parcelle" id="parcelle-title" title="Parcelle cadastrale" />
            {parcel ? (
              <dl className="mt-8 grid border-t-2 border-fg sm:grid-cols-2">
                {[
                  ["Identifiant (idu)", parcel.idu],
                  ["Section / numéro", `${parcel.section ?? "—"} ${parcel.numero ?? ""}`.trim()],
                  ["Contenance", m2(parcel.contenance)],
                  ["Commune (INSEE)", parcel.citycode],
                ]
                  .filter(([, v]) => v && v !== "—")
                  .map(([k, v]) => (
                    <div key={k as string} className="border-b border-rule py-4 sm:px-2">
                      <dt className={label}>{k}</dt>
                      <dd className="mt-1 font-semibold">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <div className="mt-8"><Empty>Aucune parcelle rattachée : l’adresse n’a pas encore été géocodée au point exact.</Empty></div>
            )}
            <SourceBadge name={CADASTRE.name} url={parcel ? blockSource(parcel.source_record_id)?.official_url ?? CADASTRE.url : CADASTRE.url} licence={CADASTRE.licence} retrievedAt={blockSource(parcel?.source_record_id)?.retrieved_at} matchQuality="CERTAIN" note="Parcelle déterminée par point-in-polygon au point de l’adresse : l’idu identifie la parcelle." />
            <p className="mt-4 text-sm font-semibold">
              <Link href="/urbanisme" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                Le droit de l’urbanisme expliqué <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </section>

          <section aria-labelledby="ventes-title">
            <SectionHead num="02" kicker="Ventes" id="ventes-title" title="Ventes enregistrées (DVF)" />
            {ppm && (
              <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-2 border-ink bg-signal p-5 text-ink shadow-[5px_5px_0_0_var(--fg)] sm:p-6">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-wide">Prix moyen au m² · logements</p>
                  <p className="mt-1 font-display text-5xl font-extrabold tracking-[-0.04em] sm:text-6xl">
                    {ppm.value.toLocaleString("fr-FR")}&nbsp;€<span className="text-2xl sm:text-3xl">/m²</span>
                  </p>
                </div>
                <p className="max-w-xs text-sm font-medium">
                  Sur {ppm.sales} vente{ppm.sales > 1 ? "s" : ""} d’appartement ou de maison de la parcelle,{" "}
                  {ppm.from.slice(0, 4) === ppm.to.slice(0, 4) ? `en ${ppm.from.slice(0, 4)}` : `de ${ppm.from.slice(0, 4)} à ${ppm.to.slice(0, 4)}`}. Indicatif : prix total ÷ surface Carrez ou habitable.
                </p>
              </div>
            )}
            {transactions.length === 0 ? (
              <div className="mt-8"><Empty>Aucune mutation DVF en cache pour cette parcelle (l’historique DVF est semestriel et absent d’Alsace-Moselle et de Mayotte).</Empty></div>
            ) : (
              <ul className="mt-8 border-t border-fg">
                {transactions.map((t) => (
                  <li key={`${t.id_mutation}-${t.type_local}`} className="grid gap-2 border-b border-rule py-4 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline sm:gap-4 sm:px-2">
                    <span className="font-mono text-xs text-fg-2">{frDate(t.date_mutation)}</span>
                    <span>
                      <span className="font-semibold">{t.type_local || t.nature_mutation || "Mutation"}</span>
                      {t.surface_reelle_bati != null && <span className="text-fg-2"> · {m2(t.surface_reelle_bati)}</span>}
                      {t.nombre_pieces != null && <span className="text-fg-2"> · {t.nombre_pieces} pièces</span>}
                      <span className="mt-1 block text-sm text-fg-2">
                        {[t.adresse_numero, t.adresse_nom_voie].filter(Boolean).join(" ") || "Adresse non précisée"}
                        {t.nature_mutation && ` · ${t.nature_mutation}`}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-bold">{euro(t.valeur_fonciere)}</span>
                  </li>
                ))}
              </ul>
            )}
            <SourceBadge name={DVF.name} url={blockSource(transactions[0]?.source_record_id)?.official_url ?? DVF.url} licence={DVF.licence} retrievedAt={blockSource(transactions[0]?.source_record_id)?.retrieved_at} matchQuality="POSSIBLE" note="Ventes rattachées à la parcelle : une mutation peut couvrir plusieurs lots ou parcelles. Indice, jamais la preuve du prix d’un logement précis." />
            <p className="mt-4 text-sm font-semibold">
              <Link href="/logement" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                Vos droits sur le logement <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </section>

          <section aria-labelledby="dpe-title">
            <SectionHead num="03" kicker="Diagnostics" id="dpe-title" title="Diagnostics de performance énergétique" />
            {dpe.length === 0 ? (
              <div className="mt-8"><Empty>Aucun DPE en cache pour cette adresse. Les DPE antérieurs à juillet 2021 ne comportent pas d’adresse BAN et ne sont pas rattachables.</Empty></div>
            ) : (
              <ul className="mt-8 border-t border-fg">
                {dpe.map((d) => (
                  <li key={d.numero_dpe} className="grid gap-2 border-b border-rule py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                    <span>
                      <span className="font-semibold">{d.type_batiment ?? "Logement"}{d.surface_habitable != null ? ` · ${m2(d.surface_habitable)}` : ""}</span>
                      <span className="mt-1 block text-sm text-fg-2">
                        Établi le {frDate(d.date_etablissement)} · n° {d.numero_dpe}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-sm font-bold">
                      <span className="border-2 border-fg px-2 py-0.5">DPE {d.etiquette_dpe ?? "—"}</span>
                      <span className="border-2 border-fg px-2 py-0.5">GES {d.etiquette_ges ?? "—"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <SourceBadge name={DPE.name} url={blockSource(dpe[0]?.source_record_id)?.official_url ?? DPE.url} licence={DPE.licence} retrievedAt={blockSource(dpe[0]?.source_record_id)?.retrieved_at} matchQuality={dpe[0]?.match_quality ?? "POSSIBLE"} note="DPE rattachés à l’adresse BAN (bâtiment) : la correspondance n’est pas certifiée au logement précis." />
            <p className="mt-4 text-sm font-semibold">
              <Link href="/diagnostics" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                DPE et diagnostics expliqués <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </section>

          <section aria-labelledby="risques-title">
            <SectionHead num="04" kicker="Risques" id="risques-title" title="Risques naturels et technologiques" />
            {risks.length === 0 ? (
              <div className="mt-8"><Empty>Aucun risque renseigné en cache (la source Géorisques est ponctuellement indisponible).</Empty></div>
            ) : (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {risks.map((r) => (
                  <li key={r.id} className="border-2 border-fg bg-surface p-4">
                    <span className="font-semibold">{r.risk}</span>
                    <span className="mt-1 block font-mono text-xs uppercase text-fg-2">{r.category ?? "risque"}</span>
                  </li>
                ))}
              </ul>
            )}
            <SourceBadge name={GEORISQUES.name} url={blockSource(risks[0]?.source_record_id)?.official_url ?? GEORISQUES.url} licence={GEORISQUES.licence} retrievedAt={blockSource(risks[0]?.source_record_id)?.retrieved_at} matchQuality="POSSIBLE" note="Risques rapportés à l’adresse ou, à défaut, à la commune : un risque « non connu » à l’adresse n’exclut pas le risque." />
            <p className="mt-4 text-sm font-semibold">
              <Link href="/urbanisme" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                Construire en zone à risque <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </section>

          <section aria-labelledby="urbanisme-title">
            <SectionHead num="05" kicker="Urbanisme" id="urbanisme-title" title="Zonage d’urbanisme (PLU)" />
            {zones.length === 0 ? (
              <div className="mt-8"><Empty>Aucun zonage en cache (toutes les communes n’ont pas numérisé leur PLU sur le Géoportail de l’urbanisme).</Empty></div>
            ) : (
              <ul className="mt-8 border-t border-fg">
                {zones.map((z) => (
                  <li key={z.id} className="border-b border-rule py-4 sm:px-2">
                    <span className="font-semibold">{z.libelle ?? "Zone"}{z.libelong ? ` — ${z.libelong}` : ""}</span>
                    <span className="mt-1 block font-mono text-xs text-fg-2">
                      {z.typezone ? `Type ${z.typezone}` : ""}
                      {z.datvalid ? ` · valide au ${frDate(z.datvalid)}` : ""}
                    </span>
                    {z.nomfic && (
                      <span className="mt-2 block text-sm">
                        {z.urlfic ? (
                          <a href={z.urlfic} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            Règlement : {z.nomfic}
                          </a>
                        ) : (
                          <>Règlement : {z.nomfic}</>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <SourceBadge name={GPU.name} url={blockSource(zones[0]?.source_record_id)?.official_url ?? GPU.url} licence={GPU.licence} retrievedAt={blockSource(zones[0]?.source_record_id)?.retrieved_at} matchQuality="CERTAIN" note="Zonage déterminé par point-in-polygon au point de l’adresse, au document en vigueur." />
            <p className="mt-4 text-sm font-semibold">
              <Link href="/urbanisme" className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                Permis de construire et PLU <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </section>

          {!hasBlocks && (
            <p className="border-2 border-dashed border-fg/40 p-6 text-fg-2">
              L’adresse est géocodée mais aucun contenu sourcé n’y est encore rattaché. Relancez la vérification depuis l’outil
              pour tenter de récupérer parcelle, ventes, DPE, risques et urbanisme.
            </p>
          )}
        </div>

        <aside className="space-y-8 lg:pt-2">
          <HousingZoneCard citycode={a.citycode} />
          <JurisdictionCard citycode={a.citycode} city={a.city} kinds={["tj", "tprx", "ca"]} />
          <div className="border-t-2 border-fg pt-4">
            <h2 className={`${label} text-fg-2`}>Vérifier vous-même</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.label)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Voir l’adresse sur une carte
                </a>
              </li>
              <li>
                <a href={`https://portal.cadastre.gouv.fr/`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Cadastre (DGFiP)
                </a>
              </li>
              <li>
                <Link href="/verifier-un-bien" className="underline underline-offset-2">
                  Vérifier une autre adresse
                </Link>
              </li>
            </ul>
          </div>
          <div className="border-t border-rule pt-4 text-sm text-fg-2">
            <p>
              Adresse officielle : <span className="font-mono">{a.ban_id}</span>
            </p>
            {fresh?.retrieved_at && <p className="mt-2">Données récupérées le {new Date(fresh.retrieved_at * 1000).toLocaleDateString("fr-FR")}.</p>}
            <p className="mt-2">Source : {BAN.name} · {BAN.licence}</p>
          </div>
          {!indexable && (
            <p className="border-2 border-dashed border-fg/40 p-4 text-sm text-fg-2">
              Fiche informative : elle n’est pas indexée tant qu’aucun contenu Loilà vérifié n’y est rattaché.
            </p>
          )}
          <p className="text-sm text-fg-2">
            Loilà présente des faits sourcés. Il ne porte aucun jugement sur ce bien, ne réalise ni estimation ni diagnostic,
            et ne remplace pas un professionnel.
          </p>
        </aside>
      </article>
    </>
  );
}
