// Address / property vertical: the deterministic chain
// ADDRESS → coordinates (BAN) → parcel (cadastre) → transactions (DVF) → DPE (ADEME) → risks
// (Géorisques) → planning zone (GPU), all cached in SQLite with provenance and match quality.
// Network only happens in sync* (server jobs and the user-triggered POST /api/address); page
// rendering reads SQLite only. We never claim a transaction belongs to a precise dwelling:
// a match quality travels with every row (CERTAIN > PROBABLE > POSSIBLE > UNKNOWN).
import type Database from "better-sqlite3";
import { getDb } from "./db";
import { fetchJson, getSourceRecord, isFresh, saveSourceRecord, SOURCES, type MatchQuality, type SourceRecord } from "./sources";
import { linkExternalId, resolveExternal } from "./entities";

const BAN = SOURCES["IGN:ban"];
const CADASTRE = SOURCES["IGN:cadastre"];
const DVF = SOURCES["DGFiP:dvf"];
const DPE = SOURCES["ADEME:dpe"];
const GEORISQUES = SOURCES["BRGM:georisques"];
const GPU = SOURCES["IGN:gpu"];

const GEOCODER = "https://data.geopf.fr/geocodage/search";
const CADASTRE_API = "https://apicarto.ign.fr/api/cadastre/parcelle";
const DVF_API = "https://dvf-api.data.gouv.fr";
const DPE_API = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines";
const GEORISQUES_API = "https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque";
const GPU_API = "https://apicarto.ign.fr/api/gpu/zone-urba";

// A BAN id is the geocoder's `id` (e.g. 95127_1448_00008): the same key DPE exposes as
// `identifiant_ban`, so it is used as the canonical address key across the vertical.
export type GeoFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    label?: string; id?: string; banId?: string; housenumber?: string; street?: string;
    postcode?: string; citycode?: string; city?: string; score?: number; type?: string;
  };
};

export type GeoCandidate = {
  banId: string; label: string; housenumber: string | null; postcode: string | null; city: string | null;
  score: number | null; type: string | null;
};

const geocodeUrl = (q: string, limit: number) => `${GEOCODER}?q=${encodeURIComponent(q)}&limit=${limit}`;

/** Match quality of a geocoded address: a precise housenumber is CERTAIN, anything else POSSIBLE. */
export const geocodeQuality = (type: string | null | undefined): MatchQuality => (type === "housenumber" ? "CERTAIN" : "POSSIBLE");

/** Geocode a free-text query. Network — server jobs and POST /api/address only. */
export async function geocode(query: string, limit = 5): Promise<GeoCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await fetchJson<{ features?: GeoFeature[] }>(geocodeUrl(q, limit));
  return (data.features ?? [])
    .map((f) => f.properties)
    .filter((p): p is NonNullable<GeoFeature["properties"]> => !!p?.id && !!p.label)
    .map((p) => ({
      banId: p.id as string,
      label: p.label as string,
      housenumber: p.housenumber ?? null,
      postcode: p.postcode ?? null,
      city: p.city ?? null,
      score: typeof p.score === "number" ? p.score : null,
      type: p.type ?? null,
    }));
}

// ---------- Sync (network + writes) ----------

/** Geocode a query and cache the best match, linking the address entity. Returns its BAN id. */
export async function syncAddress(query: string, db: Database.Database = getDb()): Promise<string | undefined> {
  const q = query.trim();
  if (q.length < 2) return undefined;
  const url = geocodeUrl(q, 5);
  const data = await fetchJson<{ features?: GeoFeature[] }>(url);
  const best = data.features?.[0]?.properties;
  if (!best?.id || !best.label) return undefined;
  const banId = best.id;
  const quality = geocodeQuality(best.type);
  const srcId = saveSourceRecord(db, BAN, banId, best, { officialUrl: url, matchQuality: quality });
  const expires = getSourceRecord(srcId)?.expires_at ?? null;
  const eid = linkExternalId(db, "ban", banId, "address", banId, best.label);
  const [lon, lat] = data.features?.[0]?.geometry?.coordinates ?? [null, null];
  db.prepare(
    `INSERT INTO addresses (ban_id, entity_id, label, housenumber, street, postcode, citycode, city, lat, lon, score, source_record_id, fetched_at, expires_at)
     VALUES (@banId, @entity, @label, @housenumber, @street, @postcode, @citycode, @city, @lat, @lon, @score, @src, unixepoch(), @expires)
     ON CONFLICT(ban_id) DO UPDATE SET entity_id = excluded.entity_id, label = excluded.label, housenumber = excluded.housenumber,
       street = excluded.street, postcode = excluded.postcode, citycode = excluded.citycode, city = excluded.city,
       lat = excluded.lat, lon = excluded.lon, score = excluded.score, source_record_id = excluded.source_record_id,
       fetched_at = unixepoch(), expires_at = excluded.expires_at`,
  ).run({
    banId, entity: eid, label: best.label, housenumber: best.housenumber ?? null, street: best.street ?? null,
    postcode: best.postcode ?? null, citycode: best.citycode ?? null, city: best.city ?? null,
    lat: lat ?? null, lon: lon ?? null, score: typeof best.score === "number" ? best.score : null, src: srcId, expires,
  });
  return banId;
}

type ParcelProps = {
  idu?: string; contenance?: number; section?: string; numero?: string; code_insee?: string; prefixe?: string; com_abs?: string;
};

/** Point-in-polygon parcel lookup at the address coordinates. CERTAIN (the idu identifies the parcel). */
export async function syncParcelForAddress(banId: string, db: Database.Database = getDb()): Promise<{ idu: string } | undefined> {
  const a = getAddress(banId, db);
  if (!a?.lat || !a?.lon) return undefined;
  const url = `${CADASTRE_API}?geom=${encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [a.lon, a.lat] }))}`;
  const data = await fetchJson<{ features?: { properties?: ParcelProps; geometry?: { type?: string } }[] }>(url);
  const p = data.features?.[0]?.properties;
  const geom = data.features?.[0]?.geometry;
  // Outline kept for the map; a parcel is a few KB, anything huge (railway land…) is not worth storing.
  const geometry = geom && /Polygon$/.test(geom.type ?? "") && JSON.stringify(geom).length < 60_000 ? JSON.stringify(geom) : null;
  if (!p?.idu) return undefined;
  const idu = p.idu;
  const srcId = saveSourceRecord(db, CADASTRE, idu, p, { officialUrl: url, matchQuality: "CERTAIN" });
  const eid = linkExternalId(db, "idu", idu, "parcel", idu, `${p.section ?? ""}${p.numero ?? ""}`.trim() || idu);
  db.prepare(
    `INSERT INTO parcels (idu, entity_id, citycode, prefixe, section, numero, contenance, lat, lon, geometry, source_record_id, fetched_at)
     VALUES (@idu, @entity, @citycode, @prefixe, @section, @numero, @contenance, @lat, @lon, @geometry, @src, unixepoch())
     ON CONFLICT(idu) DO UPDATE SET entity_id = excluded.entity_id, citycode = excluded.citycode, prefixe = excluded.prefixe,
       section = excluded.section, numero = excluded.numero, contenance = excluded.contenance, lat = excluded.lat,
       lon = excluded.lon, geometry = COALESCE(excluded.geometry, geometry), source_record_id = excluded.source_record_id, fetched_at = unixepoch()`,
  ).run({
    idu, entity: eid, citycode: p.code_insee ?? idu.slice(0, 5), prefixe: p.prefixe ?? idu.slice(5, 8),
    section: p.section ?? idu.slice(8, 10), numero: p.numero ?? idu.slice(10, 14),
    contenance: typeof p.contenance === "number" ? p.contenance : null, lat: a.lat, lon: a.lon, geometry, src: srcId,
  });
  db.prepare(
    `INSERT INTO parcel_addresses (parcel_id, ban_id, match_quality, method) VALUES (@idu, @banId, 'CERTAIN', 'point_in_polygon')
     ON CONFLICT(parcel_id, ban_id, method) DO UPDATE SET match_quality = 'CERTAIN'`,
  ).run({ idu, banId });
  return { idu };
}

type DvfRow = {
  id_mutation?: string; date_mutation?: string; nature_mutation?: string; valeur_fonciere?: number;
  adresse_numero?: number | string | null; adresse_nom_voie?: string | null; code_postal?: string | null;
  code_commune?: string | null; nom_commune?: string | null; id_parcelle?: string | null;
  code_type_local?: string | null; type_local?: string | null; surface_reelle_bati?: number | null;
  nombre_pieces_principales?: number | null; lot1_surface_carrez?: number | null; nombre_lots?: number | null;
};

const isIdu = (ref: string) => /^\d{5}\d{3}[0-9A-Z]{2}\d{4}$/.test(ref);

/** DVF mutations for a parcel: the API is queried per section, then filtered on the exact idu.
 *  Match quality stays POSSIBLE: a mutation can cover several lots/parcels and never names a dwelling. */
export async function syncDvfForParcel(parcel: { idu: string } | string, db: Database.Database = getDb()): Promise<number> {
  const idu = typeof parcel === "string" ? parcel : parcel.idu;
  if (!isIdu(idu)) return 0;
  const insee = idu.slice(0, 5);
  const section = idu.slice(5, 10);
  const url = `${DVF_API}/mutations/${insee}/${section}`;
  const data = await fetchJson<{ data?: DvfRow[] }>(url, { retries: 2 });
  const rows = (data.data ?? []).filter((r) => r.id_parcelle === idu && r.id_mutation);
  const srcId = saveSourceRecord(db, DVF, idu, rows, { officialUrl: url, matchQuality: "POSSIBLE" });
  const eid = resolveExternal("idu", idu) ?? null;
  const ins = db.prepare(
    `INSERT INTO transactions (id_mutation, id_parcelle, entity_id, date_mutation, nature_mutation, valeur_fonciere,
       adresse_numero, adresse_nom_voie, code_postal, citycode, nom_commune, type_local, surface_reelle_bati,
       nombre_pieces, lot1_surface_carrez, match_quality, source_record_id)
     VALUES (@id, @idu, @entity, @date, @nature, @valeur, @numero, @voie, @cp, @citycode, @commune, @type,
       @surface, @pieces, @carrez, 'POSSIBLE', @src)
     ON CONFLICT(id_mutation, id_parcelle, type_local) DO UPDATE SET date_mutation = excluded.date_mutation,
       nature_mutation = excluded.nature_mutation, valeur_fonciere = excluded.valeur_fonciere, adresse_numero = excluded.adresse_numero,
       adresse_nom_voie = excluded.adresse_nom_voie, code_postal = excluded.code_postal, citycode = excluded.citycode,
       nom_commune = excluded.nom_commune, surface_reelle_bati = excluded.surface_reelle_bati, nombre_pieces = excluded.nombre_pieces,
       lot1_surface_carrez = excluded.lot1_surface_carrez, source_record_id = excluded.source_record_id`,
  );
  db.transaction(() => {
    for (const r of rows) {
      ins.run({
        id: r.id_mutation as string, idu, entity: eid, date: r.date_mutation ?? null, nature: r.nature_mutation ?? null,
        valeur: typeof r.valeur_fonciere === "number" ? r.valeur_fonciere : null,
        numero: r.adresse_numero != null ? String(r.adresse_numero) : null, voie: r.adresse_nom_voie ?? null,
        cp: r.code_postal ?? null, citycode: r.code_commune ?? insee, commune: r.nom_commune ?? null,
        type: r.type_local ?? "", surface: r.surface_reelle_bati ?? null, pieces: r.nombre_pieces_principales ?? null,
        carrez: r.lot1_surface_carrez ?? null, src: srcId,
      });
    }
  })();
  return rows.length;
}

type DpeRow = {
  numero_dpe?: string; identifiant_ban?: string | null; adresse_ban?: string | null; code_postal_ban?: string | null;
  code_insee_ban?: string | null; etiquette_dpe?: string | null; etiquette_ges?: string | null;
  date_etablissement_dpe?: string | null; surface_habitable_logement?: number | null; type_batiment?: string | null;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** DPE for an address: filter on the exact BAN id, fall back to full-text then re-filter. PROBABLE. */
export async function syncDpeForAddress(address: { ban_id: string; label: string }, db: Database.Database = getDb()): Promise<number> {
  const banId = address.ban_id;
  let rows: DpeRow[] = [];
  let url = `${DPE_API}?qs=${encodeURIComponent(`identifiant_ban:${banId}`)}&size=20`;
  try {
    const data = await fetchJson<{ results?: DpeRow[] }>(url);
    rows = (data.results ?? []).filter((r) => r.identifiant_ban === banId && r.numero_dpe);
  } catch (e) {
    console.warn("[address] dpe exact filter failed", e instanceof Error ? e.message : e);
  }
  if (rows.length === 0) {
    url = `${DPE_API}?q=${encodeURIComponent(address.label)}&size=20`;
    try {
      const data = await fetchJson<{ results?: DpeRow[] }>(url);
      const wanted = norm(address.label);
      rows = (data.results ?? []).filter((r) => r.numero_dpe && (r.identifiant_ban === banId || (!!r.adresse_ban && norm(r.adresse_ban) === wanted)));
    } catch (e) {
      console.warn("[address] dpe text fallback failed", e instanceof Error ? e.message : e);
      return 0;
    }
  }
  const srcId = saveSourceRecord(db, DPE, banId, rows, { officialUrl: url, matchQuality: "PROBABLE" });
  const ins = db.prepare(
    `INSERT INTO dpe_diagnostics (numero_dpe, ban_id, entity_id, adresse_ban, code_postal, citycode, etiquette_dpe, etiquette_ges,
       date_etablissement, surface_habitable, conso_energie, type_batiment, match_quality, source_record_id, fetched_at)
     VALUES (@num, @banId, @entity, @adresse, @cp, @citycode, @dpe, @ges, @date, @surface, NULL, @type, @quality, @src, unixepoch())
     ON CONFLICT(numero_dpe) DO UPDATE SET ban_id = excluded.ban_id, entity_id = excluded.entity_id, adresse_ban = excluded.adresse_ban,
       code_postal = excluded.code_postal, citycode = excluded.citycode, etiquette_dpe = excluded.etiquette_dpe,
       etiquette_ges = excluded.etiquette_ges, date_etablissement = excluded.date_etablissement, surface_habitable = excluded.surface_habitable,
       type_batiment = excluded.type_batiment, match_quality = excluded.match_quality, source_record_id = excluded.source_record_id,
       fetched_at = unixepoch()`,
  );
  const eid = resolveExternal("ban", banId) ?? null;
  // Most recent first: the latest diagnosis per dwelling is what a seller/tenant must present.
  const sorted = [...rows].sort((a, b) => (b.date_etablissement_dpe ?? "").localeCompare(a.date_etablissement_dpe ?? ""));
  db.transaction(() => {
    for (const r of sorted) {
      ins.run({
        num: r.numero_dpe as string, banId, entity: eid, adresse: r.adresse_ban ?? null, cp: r.code_postal_ban ?? null,
        citycode: r.code_insee_ban ?? null, dpe: r.etiquette_dpe ?? null, ges: r.etiquette_ges ?? null,
        date: r.date_etablissement_dpe ?? null, surface: r.surface_habitable_logement ?? null, type: r.type_batiment ?? null,
        quality: r.identifiant_ban === banId ? "PROBABLE" : "POSSIBLE", src: srcId,
      });
    }
  })();
  return rows.length;
}

type RiskItem = { present?: boolean; libelle?: string; libelleStatutCommune?: string | null; libelleStatutAdresse?: string | null; specifique?: string | null };
type RiskReport = {
  commune?: { codeInsee?: string | null };
  risquesNaturels?: Record<string, RiskItem>;
  risquesTechnologiques?: Record<string, RiskItem>;
};

/** Risks for an address. Géorisques is flaky: retries, and a failure degrades to 0 rows, never a crash. */
export async function syncRisksForAddress(address: { ban_id: string; lat: number | null; lon: number | null; citycode: string | null }, db: Database.Database = getDb()): Promise<number> {
  if (address.lat == null || address.lon == null) return 0;
  const { ban_id: banId } = address;
  // CAREFUL: Géorisques expects lon,lat (inverted → empty report, no error).
  const url = `${GEORISQUES_API}?latlon=${address.lon},${address.lat}`;
  let report: RiskReport;
  try {
    report = await fetchJson<RiskReport>(url, { retries: 4, timeoutMs: 20_000, headers: { "Accept": "application/json" } });
  } catch (e) {
    console.warn("[address] georisques unavailable", e instanceof Error ? e.message : e);
    return 0;
  }
  const srcId = saveSourceRecord(db, GEORISQUES, banId, report, { officialUrl: url, matchQuality: "POSSIBLE" });
  const citycode = address.citycode ?? report.commune?.codeInsee ?? null;
  const rows: { risk: string; category: string; code: string }[] = [];
  for (const [code, item] of Object.entries(report.risquesNaturels ?? {})) {
    if (item?.present) rows.push({ risk: item.libelle ?? code, category: "naturel", code });
  }
  for (const [code, item] of Object.entries(report.risquesTechnologiques ?? {})) {
    if (item?.present) rows.push({ risk: item.libelle ?? code, category: "technologique", code });
  }
  db.prepare("DELETE FROM risks WHERE ban_id = ?").run(banId);
  const ins = db.prepare(
    `INSERT INTO risks (ban_id, citycode, lat, lon, risk, category, source_id, match_quality, source_record_id, fetched_at)
     VALUES (@banId, @citycode, @lat, @lon, @risk, @category, @code, 'POSSIBLE', @src, unixepoch())`,
  );
  db.transaction(() => {
    for (const r of rows) ins.run({ banId, citycode, lat: address.lat, lon: address.lon, risk: r.risk, category: r.category, code: r.code, src: srcId });
  })();
  return rows.length;
}

type ZoneProps = {
  libelle?: string; libelong?: string; typezone?: string; idurba?: string; nomfic?: string; urlfic?: string;
  datvalid?: string; gpu_doc_id?: string; partition?: string;
};

/** Planning zone at the address point (point-in-polygon). CERTAIN. */
export async function syncZonesForAddress(address: { ban_id: string; lat: number | null; lon: number | null; citycode: string | null }, db: Database.Database = getDb()): Promise<number> {
  if (address.lat == null || address.lon == null) return 0;
  const { ban_id: banId } = address;
  const url = `${GPU_API}?geom=${encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [address.lon, address.lat] }))}`;
  const data = await fetchJson<{ features?: { properties?: ZoneProps }[] }>(url);
  const zones = (data.features ?? []).map((f) => f.properties).filter((p): p is ZoneProps => !!p?.libelle);
  const srcId = saveSourceRecord(db, GPU, banId, data, { officialUrl: url, matchQuality: "CERTAIN" });
  db.prepare("DELETE FROM urban_zones WHERE ban_id = ?").run(banId);
  const ins = db.prepare(
    `INSERT INTO urban_zones (ban_id, lat, lon, citycode, typezone, libelle, libelong, document, nomfic, urlfic, datvalid, match_quality, source_record_id, fetched_at)
     VALUES (@banId, @lat, @lon, @citycode, @typezone, @libelle, @libelong, @document, @nomfic, @urlfic, @datvalid, 'CERTAIN', @src, unixepoch())`,
  );
  db.transaction(() => {
    for (const z of zones) {
      ins.run({
        banId, lat: address.lat, lon: address.lon, citycode: address.citycode, typezone: z.typezone ?? null,
        libelle: z.libelle ?? null, libelong: z.libelong ?? null, document: z.gpu_doc_id ?? null,
        nomfic: z.nomfic ?? null, urlfic: z.urlfic || null, datvalid: z.datvalid ?? null, src: srcId,
      });
    }
  })();
  return zones.length;
}

export type AddressSyncSummary = { banId: string; parcel?: string; transactions: number; dpe: number; risks: number; zones: number };

/** Run the whole chain for one query: address, parcel, transactions, DPE, risks, planning zone.
 *  Each downstream block degrades to 0 on failure; a source outage never aborts the sync. */
export async function syncAddressFull(query: string, db: Database.Database = getDb()): Promise<AddressSyncSummary | undefined> {
  const banId = await syncAddress(query, db);
  if (!banId) return undefined;
  const a = getAddress(banId, db);
  if (!a) return undefined;
  let parcel: { idu: string } | undefined;
  try {
    parcel = await syncParcelForAddress(banId, db);
  } catch (e) {
    console.warn("[address] parcel failed", e instanceof Error ? e.message : e);
  }
  const [transactions, dpe, risks, zones] = await Promise.all([
    parcel ? syncDvfForParcel(parcel, db).catch(() => 0) : Promise.resolve(0),
    syncDpeForAddress(a, db).catch(() => 0),
    syncRisksForAddress(a, db).catch(() => 0),
    syncZonesForAddress(a, db).catch(() => 0),
  ]);
  return { banId, parcel: parcel?.idu, transactions, dpe, risks, zones };
}

// ---------- Reads (SQLite only, never the network) ----------

export type Address = {
  ban_id: string; entity_id: string; label: string; housenumber: string | null; street: string | null;
  postcode: string | null; citycode: string | null; city: string | null; lat: number | null; lon: number | null;
  score: number | null; source_record_id: string | null; fetched_at: number | null; expires_at: number | null;
};

export type Parcel = {
  idu: string; entity_id: string; citycode: string | null; prefixe: string | null; section: string | null;
  numero: string | null; contenance: number | null; lat: number | null; lon: number | null; geometry: string | null;
  source_record_id: string | null; fetched_at: number | null;
};

export type Transaction = {
  id_mutation: string; id_parcelle: string; date_mutation: string | null; nature_mutation: string | null;
  valeur_fonciere: number | null; adresse_numero: string | null; adresse_nom_voie: string | null;
  code_postal: string | null; citycode: string | null; nom_commune: string | null; type_local: string | null;
  surface_reelle_bati: number | null; nombre_pieces: number | null; lot1_surface_carrez: number | null;
  match_quality: MatchQuality; source_record_id: string | null;
};

export type Dpe = {
  numero_dpe: string; ban_id: string | null; adresse_ban: string | null; code_postal: string | null; citycode: string | null;
  etiquette_dpe: string | null; etiquette_ges: string | null; date_etablissement: string | null;
  surface_habitable: number | null; type_batiment: string | null; match_quality: MatchQuality; source_record_id: string | null;
};

export type Risk = {
  id: number; ban_id: string | null; citycode: string | null; risk: string; category: string | null;
  source_id: string | null; match_quality: MatchQuality; source_record_id: string | null; fetched_at: number | null;
};

export type UrbanZone = {
  id: number; ban_id: string | null; citycode: string | null; typezone: string | null; libelle: string | null;
  libelong: string | null; document: string | null; nomfic: string | null; urlfic: string | null;
  datvalid: string | null; match_quality: MatchQuality; source_record_id: string | null; fetched_at: number | null;
};

export const getAddress = (banId: string, db: Database.Database = getDb()) =>
  db.prepare("SELECT * FROM addresses WHERE ban_id = ?").get(banId) as Address | undefined;

export const getParcel = (idu: string, db: Database.Database = getDb()) =>
  db.prepare("SELECT * FROM parcels WHERE idu = ?").get(idu) as Parcel | undefined;

/** The parcel the address point falls in (point-in-polygon link). */
export const addressParcel = (banId: string, db: Database.Database = getDb()) =>
  db
    .prepare(
      `SELECT p.* FROM parcels p JOIN parcel_addresses pa ON pa.parcel_id = p.idu
       WHERE pa.ban_id = ? ORDER BY CASE pa.match_quality WHEN 'CERTAIN' THEN 0 WHEN 'PROBABLE' THEN 1 ELSE 2 END LIMIT 1`,
    )
    .get(banId) as Parcel | undefined;

/** Transactions for a BAN id or an idu directly. `ref` may be either; an idu is detected by its shape. */
export function addressTransactions(ref: string, limit = 20, db: Database.Database = getDb()): Transaction[] {
  const idu = isIdu(ref) ? ref : addressParcel(ref, db)?.idu;
  if (!idu) return [];
  return db
    .prepare("SELECT * FROM transactions WHERE id_parcelle = ? ORDER BY date_mutation DESC LIMIT ?")
    .all(idu, limit) as Transaction[];
}

export const addressDpe = (banId: string, db: Database.Database = getDb()) =>
  db.prepare("SELECT * FROM dpe_diagnostics WHERE ban_id = ? ORDER BY date_etablissement DESC").all(banId) as Dpe[];

export const addressRisks = (banId: string, db: Database.Database = getDb()) =>
  db.prepare("SELECT * FROM risks WHERE ban_id = ? ORDER BY category, risk").all(banId) as Risk[];

export const addressZones = (banId: string, db: Database.Database = getDb()) =>
  db.prepare("SELECT * FROM urban_zones WHERE ban_id = ? ORDER BY libelle").all(banId) as UrbanZone[];

export const addressSource = (id: string | null): SourceRecord | undefined => (id ? getSourceRecord(id) : undefined);
export const addressFresh = (a: Address) => isFresh(a);

/** Deterministic indexability (no AI): an address page is indexable only once at least one sourced
 *  block is attached — DPE, a transaction, a risk or a planning zone. A bare geocoded address stays noindex. */
export function addressIndexable(banId: string, db: Database.Database = getDb()): boolean {
  const n = (sql: string) => (db.prepare(sql).get(banId) as { n: number }).n;
  return (
    n("SELECT COUNT(*) n FROM dpe_diagnostics WHERE ban_id = ?") > 0 ||
    n("SELECT COUNT(*) n FROM risks WHERE ban_id = ?") > 0 ||
    n("SELECT COUNT(*) n FROM urban_zones WHERE ban_id = ?") > 0 ||
    n("SELECT COUNT(*) n FROM transactions t JOIN parcel_addresses pa ON pa.parcel_id = t.id_parcelle WHERE pa.ban_id = ?") > 0
  );
}

/** Search over the local address cache (label, postcode or city). */
export function searchAddresses(query: string, limit = 8, db: Database.Database = getDb()) {
  const q = query.trim();
  if (q.length < 2) return [];
  return db
    .prepare("SELECT ban_id, label, postcode, city, citycode FROM addresses WHERE label LIKE ? OR postcode LIKE ? OR city LIKE ? ORDER BY length(label) LIMIT ?")
    .all(`%${q}%`, `%${q}%`, `%${q}%`, limit) as { ban_id: string; label: string; postcode: string | null; city: string | null; citycode: string | null }[];
}
