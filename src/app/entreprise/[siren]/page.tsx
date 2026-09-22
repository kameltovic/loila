import ThemeIcon from "@/components/ThemeIcon";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Scale, ShieldCheck, TriangleAlert } from "lucide-react";
import { Empty, SectionHead, block, container, display, label } from "@/components/ui";
import { SourceBadge } from "@/components/SourceBadge";
import {
  companyAgreements,
  companyAnnouncements,
  companyEstablishments,
  companyFresh,
  companyIndexable,
  companyRge,
  companySource,
  getCompany,
} from "@/lib/company";
import { getConventions, conventionUrl } from "@/lib/conventions";
import { normalizeIdcc } from "@/lib/entities";
import { JsonLd, abs, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";
import { SOURCES } from "@/lib/sources";

export const dynamic = "force-dynamic";

const RE = SOURCES["DINUM:recherche-entreprises"];
const BODACC = SOURCES["DILA:bodacc"];
const RGE = SOURCES["ADEME:rge"];

const frDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR") : "—");
const CONVENTION_BY_IDCC = new Map(getConventions().map((c) => [normalizeIdcc(c.idcc), c]));
const PROC = /collective|conciliation|liquidation|redressement|sauvegarde/i;

export async function generateMetadata({ params }: PageProps<"/entreprise/[siren]">): Promise<Metadata> {
  const siren = (await params).siren.replace(/\D/g, "");
  const c = getCompany(siren);
  if (!c || c.statut_diffusion === "P") return { title: "Entreprise introuvable", robots: { index: false, follow: true } };
  const title = `${c.nom_complet ?? siren} (SIREN ${siren}) : fiche entreprise et convention collective`;
  const meta = pageMetadata({
    title,
    description: clip(
      `${c.nom_complet ?? "Cette entreprise"} : état administratif, activité, établissements, annonces officielles BODACC, certifications RGE et convention collective déclarée, sources officielles à l'appui.`,
    ),
    path: `/entreprise/${siren}`,
  });
  return { ...meta, title: { absolute: title }, ...(companyIndexable(siren) ? {} : { robots: { index: false, follow: true } }) };
}

export default async function CompanyPage({ params }: PageProps<"/entreprise/[siren]">) {
  const siren = (await params).siren.replace(/\D/g, "");
  if (!/^\d{9}$/.test(siren)) notFound();
  const c = getCompany(siren);
  // Non-diffusible legal units are never shown (protection of the person).
  if (c && c.statut_diffusion === "P") notFound();

  if (!c) notFound(); // not in the cache: a real 404, not a soft 404 placeholder

  const src = companySource(c.source_record_id);
  const estabs = companyEstablishments(siren);
  const announcements = companyAnnouncements(siren, 40);
  const rge = companyRge(siren);
  const agreements = companyAgreements(siren);
  const procedures = announcements.filter((a) => a.familleavis === "collective" || PROC.test(a.familleavis_lib ?? ""));
  const fresh = companyFresh(c);
  const indexable = companyIndexable(siren);
  const path = `/entreprise/${siren}`;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Entreprises", path: "/entreprise" }, { name: c.nom_complet ?? siren, path }]),
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: c.nom_complet ?? undefined,
            legalName: c.nom_raison_sociale ?? undefined,
            identifier: `SIREN ${siren}`,
            url: abs(path),
            ...(c.date_creation && { foundingDate: c.date_creation.slice(0, 10) }),
            ...(c.siege_siret && { isBasedOn: `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}` }),
          },
        ]}
      />

      <section className={`${block("travail")} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/entreprise" className="underline-offset-4 hover:underline">Entreprises</Link>
          </nav>
          <p className={`${label} mt-12 flex flex-wrap items-center gap-2`}>
            <ThemeIcon slug="travail" className="size-8 shrink-0" />
            <span className="border-2 border-ink px-2 py-1">SIREN {siren}</span>
            <span className="border-2 border-ink px-2 py-1">{c.etat_administratif === "A" ? "Active" : "Cessée"}</span>
            {c.categorie_entreprise && <span className="border-2 border-ink px-2 py-1">{c.categorie_entreprise}</span>}
            {procedures.length > 0 && <span className="border-2 border-ink bg-ink px-2 py-1 text-paper">Procédure collective publiée</span>}
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] text-balance`}>
            {c.nom_complet ?? siren}
          </h1>
          {c.sigle && <p className="mt-3 font-serif text-xl italic">{c.sigle}</p>}
        </div>
      </section>

      <article className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_18rem]`}>
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="identite-title">
            <SectionHead num="01" kicker="Identité" id="identite-title" title="État civil de l’entreprise" />
            <dl className="mt-8 grid border-t-2 border-fg sm:grid-cols-2">
              {[
                ["Dénomination", c.nom_complet],
                ["Forme juridique", c.nature_juridique],
                ["Activité principale (NAF)", c.activite_principale],
                ["Catégorie", c.categorie_entreprise],
                ["Créée le", frDate(c.date_creation)],
                ["Effectif", c.tranche_effectif ? `Tranche ${c.tranche_effectif}${c.annee_tranche_effectif ? ` (${c.annee_tranche_effectif})` : ""}` : null],
                ["Siège (SIRET)", c.siege_siret],
                ["TVA intracommunautaire", safeList(c.tva)?.join(", ")],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="border-b border-rule py-4 sm:px-2">
                    <dt className={label}>{k}</dt>
                    <dd className="mt-1 font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
            <SourceBadge name={RE.name} url={src?.official_url ?? RE.url} licence={RE.licence} retrievedAt={c.fetched_at} />
            {!fresh && (
              <p className="mt-3 flex items-start gap-2 text-sm text-fg-2">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                Cette copie locale peut être périmée : relancez la vérification depuis l’outil.
              </p>
            )}
          </section>

          <section aria-labelledby="ccn-title">
            <SectionHead num="02" kicker="Convention collective" id="ccn-title" title="Convention collective déclarée" />
            {agreements.length === 0 ? (
              <div className="mt-8">
                <Empty>Aucune convention collective déclarée dans les sources officielles pour cette entreprise.</Empty>
              </div>
            ) : (
              <>
                <ul className="mt-8 border-t border-fg">
                  {agreements.map((a) => {
                    const conv = CONVENTION_BY_IDCC.get(a.idcc);
                    return (
                      <li key={`${a.siret}-${a.idcc}`} className="border-b border-rule py-5 sm:px-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <span className="font-display text-lg font-bold tracking-[-0.02em]">
                            {a.titre_court ?? a.titre ?? `Convention IDCC ${a.idcc}`}
                          </span>
                          <span className="flex items-center gap-2 font-mono text-xs uppercase text-fg-2">
                            IDCC {a.idcc}
                            <span className="border border-fg-2 px-1.5 py-0.5" title={confidenceLabel(a.confidence)}>
                              {a.confidence}
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-fg-2">
                          {a.method === "api_recherche_entreprises"
                            ? "Convention déclarée par l’employeur (DSN), agrégée par l’Annuaire des Entreprises."
                            : a.method === "dsn_declared"
                              ? "Convention déclarée par l’employeur dans la DSN."
                              : "Convention suggérée, à confirmer avec l’employeur."}
                          {a.declared_month && <> Données {a.declared_month}.</>}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                          {conv ? (
                            <Link href={conventionUrl(conv)} className="inline-flex items-center gap-1 underline decoration-signal decoration-2 underline-offset-4">
                              Voir la convention expliquée <ArrowRight aria-hidden className="size-4" />
                            </Link>
                          ) : a.legitext ? (
                            <a
                              href={`https://www.legifrance.gouv.fr/conv_coll/id/${a.legitext}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 underline underline-offset-4"
                            >
                              Texte officiel sur Légifrance <ArrowUpRight aria-hidden className="size-4" />
                            </a>
                          ) : (
                            <Link href="/conventions" className="inline-flex items-center gap-1 underline underline-offset-4">
                              Voir les conventions expliquées <ArrowRight aria-hidden className="size-4" />
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <SourceBadge
                  name={RE.name}
                  url={RE.url}
                  licence={RE.licence}
                  retrievedAt={c.fetched_at}
                  matchQuality="PROBABLE"
                  note="Un établissement peut déclarer plusieurs conventions : la liste complète est affichée. L’activité réelle de l’entreprise tranche en cas de doute."
                />
              </>
            )}
          </section>

          <section aria-labelledby="etab-title">
            <SectionHead num="03" kicker="Établissements" id="etab-title" title="Établissements connus" />
            {estabs.length === 0 ? (
              <div className="mt-8"><Empty>Aucun établissement dans le cache.</Empty></div>
            ) : (
              <ul className="mt-8 border-t border-fg">
                {estabs.map((e) => (
                  <li key={e.siret} className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                    <span>
                      <span className="font-semibold">{e.enseigne ?? e.libelle_commune ?? "Établissement"}</span>
                      {e.est_siege === 1 && <span className="ml-2 border border-fg-2 px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase">Siège</span>}
                      <span className="mt-1 block font-mono text-xs text-fg-2">
                        SIRET {e.siret}
                        {e.code_postal && <> · {e.code_postal} {e.libelle_commune}</>}
                        {e.activite_principale && <> · NAF {e.activite_principale}</>}
                      </span>
                    </span>
                    <span className="font-mono text-xs uppercase text-fg-2">{e.etat_administratif === "A" ? "ouvert" : "fermé"}</span>
                  </li>
                ))}
              </ul>
            )}
            <SourceBadge name={RE.name} url={RE.url} licence={RE.licence} retrievedAt={c.fetched_at} note="L’Annuaire des Entreprises n’expose pas toujours tous les établissements d’une unité légale." />
          </section>

          {announcements.length > 0 && (
            <section aria-labelledby="bodacc-title">
              <SectionHead num="04" kicker="Annonces officielles" id="bodacc-title" title="Annonces civiles et commerciales (BODACC)" />
              {procedures.length > 0 && (
                <p className="mt-6 flex items-start gap-2 border-2 border-fg bg-diagnostics px-4 py-3 text-ink">
                  <Scale aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <span>
                    <strong>{procedures.length} annonce{procedures.length > 1 ? "s" : ""} de procédure collective</strong> publiée{procedures.length > 1 ? "s" : ""} au BODACC.
                    Une procédure collective ne dit rien, à elle seule, de la situation actuelle : lisez chaque annonce et sa date.
                  </span>
                </p>
              )}
              <ul className="mt-8 border-t border-fg">
                {announcements.map((a) => (
                  <li key={a.bodacc_id} className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline sm:gap-4 sm:px-2">
                    <span className="font-mono text-xs text-fg-2">{frDate(a.dateparution)}</span>
                    <span>
                      <span className="font-semibold">{a.typeavis_lib ?? a.familleavis_lib ?? "Annonce"}</span>
                      {a.tribunal && <span className="text-fg-2"> · {a.tribunal}</span>}
                    </span>
                    {a.url_complete && (
                      <a href={a.url_complete} target="_blank" rel="noopener noreferrer" className="font-mono text-xs underline underline-offset-2">
                        {a.bodacc_id}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <SourceBadge name={BODACC.name} url={BODACC.url} licence={BODACC.licence} retrievedAt={announcements[0] ? c.fetched_at : null} matchQuality="CERTAIN" />
            </section>
          )}

          {rge.length > 0 && (
            <section aria-labelledby="rge-title">
              <SectionHead num="05" kicker="Certifications" id="rge-title" title="Reconnu Garant de l’Environnement (RGE)" />
              <ul className="mt-8 border-t border-fg">
                {rge.map((r, i) => (
                  <li key={`${r.siret}-${r.domaine}-${i}`} className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        <ShieldCheck aria-hidden className="size-4" /> {r.nom_qualification ?? r.domaine ?? "Qualification RGE"}
                      </span>
                      <span className="mt-1 block text-sm text-fg-2">
                        {r.organisme && <>Organisme : {r.organisme}. </>}
                        Valide du {frDate(r.lien_date_debut)} au {r.lien_date_fin?.startsWith("2099") ? "sans terme" : frDate(r.lien_date_fin)}.
                      </span>
                    </span>
                    {r.url_qualification && (
                      <a href={r.url_qualification} target="_blank" rel="noopener noreferrer" className="font-mono text-xs underline underline-offset-2">
                        attestation
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <SourceBadge name={RGE.name} url={RGE.url} licence={RGE.licence} retrievedAt={c.fetched_at} matchQuality="CERTAIN" />
            </section>
          )}
        </div>

        <aside className="space-y-8 lg:pt-2">
          <div className="border-t-2 border-fg pt-4">
            <h2 className={`${label} text-fg-2`}>Vérifier vous-même</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Annuaire des Entreprises (officiel)
                </a>
              </li>
              <li>
                <a href={`https://www.bodacc.fr/`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  BODACC
                </a>
              </li>
              <li>
                <Link href="/verifier-entreprise" className="underline underline-offset-2">
                  Vérifier une autre entreprise
                </Link>
              </li>
            </ul>
          </div>
          {!indexable && (
            <p className="border-2 border-dashed border-fg/40 p-4 text-sm text-fg-2">
              Fiche informative : elle n’est pas indexée tant qu’aucun contenu Loilà vérifié n’y est rattaché.
            </p>
          )}
          <p className="text-sm text-fg-2">
            Loilà présente des faits sourcés. Il ne porte aucun jugement sur cette entreprise et ne remplace pas l’Annuaire des
            Entreprises ni un professionnel.
          </p>
        </aside>
      </article>
    </>
  );
}

function safeList(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function confidenceLabel(c: string) {
  return c === "CERTAIN" ? "Convention déclarée (source officielle)" : c === "PROBABLE" ? "Convention déclarée, agrégée au niveau de l’unité légale" : "Convention suggérée, à confirmer";
}
