// Company vertical: identity, establishments, announcements (BODACC), RGE certifications and the
// collective agreements an employer declares. Data comes from open, key-less official sources
// (DINUM recherche-entreprises, DILA BODACC, ADEME RGE) and is cached in SQLite with provenance.
// Directors (RNE) are deliberately NOT stored: we index the company, never a directory of people.
import type Database from "better-sqlite3";
import { getDb } from "./db";
import { fetchJson, getSourceRecord, isFresh, saveSourceRecord, SOURCES, type MatchQuality } from "./sources";
import { IDCC_UNKNOWN, linkExternalId, normalizeIdcc, resolveExternal } from "./entities";

const RE = SOURCES["DINUM:recherche-entreprises"];
const BODACC = SOURCES["DILA:bodacc"];
const RGE = SOURCES["ADEME:rge"];

const RE_BASE = "https://recherche-entreprises.api.gouv.fr";
const BODACC_BASE = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const RGE_BASE = "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";

const digits = (s: string) => s.replace(/\D/g, "");
export const isSiren = (s: string) => /^\d{9}$/.test(digits(s)) && digits(s).length === 9;
export const isSiret = (s: string) => /^\d{14}$/.test(digits(s)) && digits(s).length === 14;

type ReEtab = {
  siret?: string; est_siege?: boolean; etat_administratif?: string; activite_principale?: string; activite_principale_naf25?: string;
  numero_voie?: string; type_voie?: string; libelle_voie?: string; complement_adresse?: string; code_postal?: string;
  commune?: string; libelle_commune?: string; departement?: string; latitude?: string; longitude?: string;
  liste_idcc?: string[]; liste_enseignes?: string[] | null; nom_commercial?: string | null; date_creation?: string; date_debut_activite?: string; date_fermeture?: string | null;
};
type ReCompany = {
  siren: string; nom_complet?: string; nom_raison_sociale?: string | null; sigle?: string | null; nature_juridique?: string;
  categorie_entreprise?: string; activite_principale?: string; activite_principale_naf25?: string; section_activite_principale?: string;
  etat_administratif?: string; date_creation?: string; date_fermeture?: string | null; tranche_effectif_salarie?: string;
  annee_tranche_effectif_salarie?: string | number; caractere_employeur?: string; tva?: string[]; statut_diffusion?: string;
  siege?: ReEtab; matching_etablissements?: ReEtab[]; complements?: Record<string, unknown>;
  date_mise_a_jour?: string; date_mise_a_jour_insee?: string; date_mise_a_jour_rne?: string;
};

const listIdcc = (c: ReCompany): string[] => {
  const raw = [...((c.complements?.liste_idcc as string[] | undefined) ?? []), ...(c.siege?.liste_idcc ?? [])];
  return [...new Set(raw.map((v) => normalizeIdcc(v)).filter((v) => v && v !== IDCC_UNKNOWN))];
};

function upsertEstablishment(db: Database.Database, c: ReCompany, e: ReEtab, siren: string, sourceId: string, expires: number | null) {
  if (!e.siret) return;
  const eid = linkExternalId(db, "siret", e.siret, "establishment", e.siret, e.libelle_commune ?? undefined);
  db.prepare(
    `INSERT INTO establishments (siret, siren, entity_id, est_siege, enseigne, activite_principale, etat_administratif,
       numero_voie, type_voie, libelle_voie, complement_adresse, code_postal, commune_code, libelle_commune, departement,
       latitude, longitude, liste_idcc, date_creation, date_debut_activite, date_fermeture, source_record_id, fetched_at, expires_at)
     VALUES (@siret, @siren, @entity, @estSiege, @enseigne, @naf, @etat, @num, @typeVoie, @voie, @comp, @cp, @insee, @ville, @dep,
       @lat, @lon, @idcc, @crea, @debut, @fermeture, @src, unixepoch(), @expires)
     ON CONFLICT(siret) DO UPDATE SET est_siege = excluded.est_siege, enseigne = excluded.enseigne, activite_principale = excluded.activite_principale,
       etat_administratif = excluded.etat_administratif, code_postal = excluded.code_postal, libelle_commune = excluded.libelle_commune,
       latitude = excluded.latitude, longitude = excluded.longitude, liste_idcc = excluded.liste_idcc, source_record_id = excluded.source_record_id,
       fetched_at = unixepoch(), expires_at = excluded.expires_at`,
  ).run({
    siret: e.siret, siren, entity: eid, estSiege: e.est_siege ? 1 : 0,
    enseigne: e.liste_enseignes?.[0] ?? e.nom_commercial ?? null,
    naf: e.activite_principale ?? null, etat: e.etat_administratif ?? null,
    num: e.numero_voie ?? null, typeVoie: e.type_voie ?? null, voie: e.libelle_voie ?? null, comp: e.complement_adresse ?? null,
    cp: e.code_postal ?? null, insee: e.commune ?? null, ville: e.libelle_commune ?? null, dep: e.departement ?? null,
    lat: e.latitude ? Number(e.latitude) : null, lon: e.longitude ? Number(e.longitude) : null,
    idcc: e.liste_idcc ? JSON.stringify(e.liste_idcc) : null,
    crea: e.date_creation ?? null, debut: e.date_debut_activite ?? null, fermeture: e.date_fermeture ?? null,
    src: sourceId, expires,
  });
}

/** Fetch one company from the DINUM API and store it (identity + establishments + declared IDCC). */
export async function syncCompany(query: string, db: Database.Database = getDb()): Promise<string | undefined> {
  const q = query.trim();
  const url = `${RE_BASE}/search?q=${encodeURIComponent(q)}&per_page=1`;
  const data = await fetchJson<{ results?: ReCompany[] }>(url);
  const c = data.results?.[0];
  if (!c?.siren) return undefined;
  // A SIREN/SIRET lookup must return that exact legal unit, never the search engine's nearest match.
  if ((isSiren(q) || isSiret(q)) && c.siren !== digits(q).slice(0, 9)) return undefined;
  // Non-diffusible legal units (protection of the person) are never cached nor displayed.
  if (c.statut_diffusion === "P") return undefined;
  const siren = c.siren;
  const srcId = saveSourceRecord(db, RE, siren, c, {
    officialUrl: url,
    matchQuality: "CERTAIN",
    updatedAt: c.date_mise_a_jour ?? null,
  });
  const rec = getSourceRecord(srcId);
  const expires = rec?.expires_at ?? null;
  const eid = linkExternalId(db, "siren", siren, "company", siren, c.nom_complet ?? undefined);
  db.prepare(
    `INSERT INTO companies (siren, entity_id, nom_complet, nom_raison_sociale, sigle, nature_juridique, categorie_entreprise,
       activite_principale, activite_principale_naf25, section_activite, etat_administratif, date_creation, date_fermeture,
       tranche_effectif, annee_tranche_effectif, caractere_employeur, tva, statut_diffusion, siege_siret, complements,
       date_mise_a_jour_insee, date_mise_a_jour_rne, source_record_id, fetched_at, expires_at)
     VALUES (@siren, @entity, @nom, @raison, @sigle, @nature, @cat, @naf, @naf25, @section, @etat, @crea, @fermeture,
       @tranche, @annee, @employeur, @tva, @diffusion, @siege, @complements, @majInsee, @majRne, @src, unixepoch(), @expires)
     ON CONFLICT(siren) DO UPDATE SET nom_complet = excluded.nom_complet, nom_raison_sociale = excluded.nom_raison_sociale,
       sigle = excluded.sigle, nature_juridique = excluded.nature_juridique, categorie_entreprise = excluded.categorie_entreprise,
       activite_principale = excluded.activite_principale, activite_principale_naf25 = excluded.activite_principale_naf25,
       section_activite = excluded.section_activite, etat_administratif = excluded.etat_administratif, date_creation = excluded.date_creation,
       date_fermeture = excluded.date_fermeture, tranche_effectif = excluded.tranche_effectif, annee_tranche_effectif = excluded.annee_tranche_effectif,
       caractere_employeur = excluded.caractere_employeur, tva = excluded.tva, statut_diffusion = excluded.statut_diffusion,
       siege_siret = excluded.siege_siret, complements = excluded.complements, date_mise_a_jour_insee = excluded.date_mise_a_jour_insee,
       date_mise_a_jour_rne = excluded.date_mise_a_jour_rne, source_record_id = excluded.source_record_id, fetched_at = unixepoch(), expires_at = excluded.expires_at`,
  ).run({
    siren, entity: eid, nom: c.nom_complet ?? null, raison: c.nom_raison_sociale ?? null, sigle: c.sigle ?? null,
    nature: c.nature_juridique ?? null, cat: c.categorie_entreprise ?? null, naf: c.activite_principale ?? null,
    naf25: c.activite_principale_naf25 ?? null, section: c.section_activite_principale ?? null, etat: c.etat_administratif ?? null,
    crea: c.date_creation ?? null, fermeture: c.date_fermeture ?? null, tranche: c.tranche_effectif_salarie ?? null,
    annee: c.annee_tranche_effectif_salarie ? Number(c.annee_tranche_effectif_salarie) : null,
    employeur: c.caractere_employeur ?? null, tva: c.tva ? JSON.stringify(c.tva) : null, diffusion: c.statut_diffusion ?? null,
    siege: c.siege?.siret ?? null, complements: JSON.stringify(c.complements ?? {}),
    majInsee: c.date_mise_a_jour_insee ?? null, majRne: c.date_mise_a_jour_rne ?? null, src: srcId, expires,
  });
  if (c.siege) upsertEstablishment(db, c, c.siege, siren, srcId, expires);
  for (const e of c.matching_etablissements ?? []) upsertEstablishment(db, c, e, siren, srcId, expires);

  // Declared conventions: aggregated at legal-unit level → PROBABLE (CERTAIN needs the DSN file, imported separately).
  const now = Math.floor(Date.now() / 1000);
  const up = db.prepare(
    `INSERT INTO company_agreements (siret, siren, idcc, method, confidence, declared_month, source, source_record_id, fetched_at)
     VALUES (?, ?, ?, 'api_recherche_entreprises', 'PROBABLE', ?, ?, ?, ?)
     ON CONFLICT(siret, idcc, method) DO UPDATE SET confidence = excluded.confidence, source_record_id = excluded.source_record_id, fetched_at = excluded.fetched_at`,
  );
  const siret = c.siege?.siret ?? "";
  for (const idcc of listIdcc(c)) up.run(siret, siren, idcc, c.date_mise_a_jour?.slice(0, 7) ?? null, RE.name, srcId, now);
  return siren;
}

/** BODACC announcements for a SIREN (procedures collectives, changes, account filings…). */
export async function syncBodacc(siren: string, db: Database.Database = getDb()): Promise<number> {
  const s = digits(siren);
  const url = `${BODACC_BASE}?limit=100&where=${encodeURIComponent(`registre="${s}"`)}&order_by=${encodeURIComponent("dateparution desc")}`;
  const data = await fetchJson<{ results?: Record<string, unknown>[] }>(url);
  const rows = data.results ?? [];
  const srcId = saveSourceRecord(db, BODACC, s, rows, { officialUrl: url, matchQuality: "CERTAIN" });
  const eid = resolveExternal("siren", s);
  const ins = db.prepare(
    `INSERT INTO company_announcements (bodacc_id, siren, entity_id, dateparution, familleavis, familleavis_lib, typeavis, typeavis_lib,
       numeroannonce, tribunal, departement, ville, code_postal, commercant, url_complete, jugement, source_record_id, fetched_at)
     VALUES (@id, @siren, @entity, @date, @fam, @famLib, @type, @typeLib, @num, @tribunal, @dep, @ville, @cp, @commercant, @url, @jugement, @src, unixepoch())
     ON CONFLICT(bodacc_id) DO UPDATE SET dateparution = excluded.dateparution, familleavis = excluded.familleavis, jugement = excluded.jugement,
       source_record_id = excluded.source_record_id, fetched_at = unixepoch()`,
  );
  db.transaction(() => {
    for (const r of rows) {
      const id = String(r.id ?? "");
      if (!id) continue;
      const j = r.jugement;
      ins.run({
        id, siren: s, entity: eid ?? null,
        date: (r.dateparution as string) ?? null, fam: (r.familleavis as string) ?? null, famLib: (r.familleavis_lib as string) ?? null,
        type: (r.typeavis as string) ?? null, typeLib: (r.typeavis_lib as string) ?? null,
        num: r.numeroannonce ? Number(r.numeroannonce) : null, tribunal: (r.tribunal as string) ?? null,
        dep: (r.numerodepartement as string) ?? null, ville: (r.ville as string) ?? null, cp: (r.cp as string) ?? null,
        commercant: (r.commercant as string) ?? null, url: (r.url_complete as string) ?? null,
        jugement: j ? (typeof j === "string" ? j : JSON.stringify(j)) : null, src: srcId,
      });
    }
  })();
  return rows.length;
}

/** ADEME RGE certifications for a SIRET. */
export async function syncRge(siret: string, db: Database.Database = getDb()): Promise<number> {
  const s = digits(siret);
  const url = `${RGE_BASE}?qs=${encodeURIComponent(`siret:${s}`)}&size=50`;
  const data = await fetchJson<{ results?: Record<string, unknown>[] }>(url);
  const rows = data.results ?? [];
  const srcId = saveSourceRecord(db, RGE, s, rows, { officialUrl: url, matchQuality: "CERTAIN" });
  const siren = s.slice(0, 9);
  const eid = resolveExternal("siret", s);
  const ins = db.prepare(
    `INSERT INTO rge_certifications (siret, siren, entity_id, nom_entreprise, organisme, domaine, meta_domaine, code_qualification,
       nom_qualification, nom_certificat, url_qualification, particulier, lien_date_debut, lien_date_fin, source_record_id)
     VALUES (@siret, @siren, @entity, @nom, @org, @domaine, @meta, @code, @qualif, @cert, @url, @part, @debut, @fin, @src)
     ON CONFLICT(siret, domaine, nom_qualification, organisme, lien_date_debut) DO UPDATE SET nom_certificat = excluded.nom_certificat,
       url_qualification = excluded.url_qualification, lien_date_fin = excluded.lien_date_fin, source_record_id = excluded.source_record_id`,
  );
  db.transaction(() => {
    for (const r of rows) {
      ins.run({
        siret: s, siren, entity: eid ?? null, nom: (r.nom_entreprise as string) ?? null, org: (r.organisme as string) ?? null,
        domaine: (r.domaine as string) ?? null, meta: (r.meta_domaine as string) ?? null, code: (r.code_qualification as string) ?? null,
        qualif: (r.nom_qualification as string) ?? null, cert: (r.nom_certificat as string) ?? null,
        url: (r.url_qualification as string) ?? null, part: r.particulier ? 1 : 0,
        debut: (r.lien_date_debut as string) ?? null, fin: (r.lien_date_fin as string) ?? null, src: srcId,
      });
    }
  })();
  return rows.length;
}

// ---------- Reads (never call the network) ----------

export type Company = {
  siren: string; entity_id: string; nom_complet: string | null; nom_raison_sociale: string | null; sigle: string | null;
  nature_juridique: string | null; categorie_entreprise: string | null; activite_principale: string | null;
  activite_principale_naf25: string | null; section_activite: string | null; etat_administratif: string | null;
  date_creation: string | null; date_fermeture: string | null; tranche_effectif: string | null; annee_tranche_effectif: number | null;
  caractere_employeur: string | null; tva: string | null; statut_diffusion: string | null; siege_siret: string | null;
  complements: string | null; date_mise_a_jour_insee: string | null; date_mise_a_jour_rne: string | null;
  source_record_id: string | null; fetched_at: number | null; expires_at: number | null;
};

export const getCompany = (siren: string) => getDb().prepare("SELECT * FROM companies WHERE siren = ?").get(digits(siren)) as Company | undefined;

export const companyEstablishments = (siren: string) =>
  getDb().prepare("SELECT * FROM establishments WHERE siren = ? ORDER BY est_siege DESC, etat_administratif, code_postal").all(digits(siren)) as {
    siret: string; est_siege: number; enseigne: string | null; activite_principale: string | null; etat_administratif: string | null;
    code_postal: string | null; commune_code: string | null; libelle_commune: string | null; liste_idcc: string | null;
  }[];

export const companyAnnouncements = (siren: string, limit = 30) =>
  getDb()
    .prepare("SELECT * FROM company_announcements WHERE siren = ? ORDER BY dateparution DESC LIMIT ?")
    .all(digits(siren), limit) as {
    bodacc_id: string; dateparution: string | null; familleavis: string | null; familleavis_lib: string | null;
    typeavis_lib: string | null; tribunal: string | null; commercant: string | null; url_complete: string | null; jugement: string | null;
  }[];

export const companyRge = (siren: string) =>
  getDb().prepare("SELECT * FROM rge_certifications WHERE siren = ? ORDER BY lien_date_fin DESC").all(digits(siren)) as {
    siret: string; domaine: string | null; nom_qualification: string | null; nom_certificat: string | null; organisme: string | null;
    lien_date_debut: string | null; lien_date_fin: string | null; url_qualification: string | null;
  }[];

export const companyAgreements = (siren: string) =>
  getDb()
    .prepare(
      `SELECT ca.siret, ca.idcc, ca.method, ca.confidence, ca.declared_month, ca.source,
              a.titre, a.titre_court, a.etat, a.legitext
       FROM company_agreements ca LEFT JOIN collective_agreements a ON a.idcc = ca.idcc
       WHERE ca.siren = ? AND ca.idcc <> ? ORDER BY ca.confidence, ca.idcc`,
    )
    .all(digits(siren), IDCC_UNKNOWN) as {
    siret: string; idcc: string; method: string; confidence: MatchQuality; declared_month: string | null; source: string;
    titre: string | null; titre_court: string | null; etat: string | null; legitext: string | null;
  }[];

export const companySource = (id: string | null) => (id ? getSourceRecord(id) : undefined);

/** Is the local copy still usable, or should a sync job refresh it? */
export const companyFresh = (c: Company) => isFresh(c);

/** Deterministic indexability (docs/research/2026-09-seo-search.md §3.5): a company page is indexable only
 * when at least one sourced Loilà content block is attached — an announcement, an RGE certification or a
 * declared convention. A bare SIREN record stays noindex (thin, duplicates the Annuaire des Entreprises). */
export function companyIndexable(siren: string): boolean {
  const db = getDb();
  const s = digits(siren);
  const c = getCompany(s);
  if (!c || c.etat_administratif !== "A" || c.statut_diffusion === "P") return false;
  const n = (sql: string) => (db.prepare(sql).get(s) as { n: number }).n;
  return (
    n("SELECT COUNT(*) n FROM company_announcements WHERE siren = ?") > 0 ||
    n("SELECT COUNT(*) n FROM rge_certifications WHERE siren = ?") > 0 ||
    n("SELECT COUNT(*) n FROM company_agreements WHERE siren = ?") > 0
  );
}

/** Full-text-ish search over locally cached companies (name or exact SIREN). Non-diffusibles excluded. */
export function searchCompanies(query: string, limit = 8) {
  const db = getDb();
  const q = query.trim();
  if (isSiren(q) || isSiret(q)) {
    const s = digits(q).slice(0, 9);
    const row = db
      .prepare("SELECT siren, nom_complet, etat_administratif, activite_principale, siege_siret FROM companies WHERE siren = ? AND COALESCE(statut_diffusion, 'O') <> 'P'")
      .get(s);
    return row ? [row as { siren: string; nom_complet: string | null; etat_administratif: string | null; activite_principale: string | null; siege_siret: string | null }] : [];
  }
  if (q.length < 2) return [];
  return db
    .prepare(
      "SELECT siren, nom_complet, etat_administratif, activite_principale, siege_siret FROM companies WHERE nom_complet LIKE ? ESCAPE '\\' AND COALESCE(statut_diffusion, 'O') <> 'P' ORDER BY length(nom_complet) LIMIT ?",
    )
    .all(`%${q.replace(/[\\%_]/g, "\\$&")}%`, limit) as { siren: string; nom_complet: string | null; etat_administratif: string | null; activite_principale: string | null; siege_siret: string | null }[];
}

/**
 * Caches the identity of a search hit (from the DINUM name search) so its detail page can render
 * without a live call at render. No blocks are attached, so the page stays noindex until a real
 * sourced block exists. Non-diffusibles are never stored.
 */
export function cacheCompanyHit(hit: { siren: string; nom_complet: string | null; etat_administratif: string | null; activite_principale: string | null; siege_siret: string | null }, db: Database.Database = getDb()) {
  if (!/^\d{9}$/.test(hit.siren)) return;
  const eid = linkExternalId(db, "siren", hit.siren, "company", hit.siren, hit.nom_complet ?? undefined);
  db.prepare(
    `INSERT INTO companies (siren, entity_id, nom_complet, activite_principale, etat_administratif, siege_siret, fetched_at, expires_at)
     VALUES (@siren, @entity, @nom, @naf, @etat, @siret, unixepoch(), NULL)
     ON CONFLICT(siren) DO UPDATE SET nom_complet = COALESCE(excluded.nom_complet, companies.nom_complet),
       activite_principale = COALESCE(excluded.activite_principale, companies.activite_principale),
       etat_administratif = COALESCE(excluded.etat_administratif, companies.etat_administratif),
       siege_siret = COALESCE(excluded.siege_siret, companies.siege_siret)`,
  ).run({ siren: hit.siren, entity: eid, nom: hit.nom_complet, naf: hit.activite_principale, etat: hit.etat_administratif, siret: hit.siege_siret });
}
