// SOURCE_RECORD: the common contract for every external open-data record Loilà fetches or imports.
// One row per fetched record, cached in SQLite, with its official URL, licence, checksum and freshness.
// Nothing is rendered verbatim: a page reads our own tables and points back here for provenance.
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";

export type Licence = "LOV2" | "fr-lo" | "ODbL" | "notspecified";

export const LICENCE_LABEL: Record<Licence, string> = {
  LOV2: "Licence Ouverte 2.0 (Etalab)",
  "fr-lo": "Licence Ouverte (DILA / Premier ministre)",
  ODbL: "Open Database License (ODbL)",
  notspecified: "Licence non spécifiée",
};

export type MatchQuality = "CERTAIN" | "PROBABLE" | "POSSIBLE" | "UNKNOWN";

export const MATCH_LABEL: Record<MatchQuality, string> = {
  CERTAIN: "Lien par identifiant officiel",
  PROBABLE: "Rapprochement fiable (identifiant de bâtiment ou d'adresse)",
  POSSIBLE: "Rapprochement par adresse ou par commune : indice, pas une preuve",
  UNKNOWN: "Rattachement incertain",
};

export type SourceMeta = {
  provider: string;
  dataset: string;
  /** Human name shown next to a data block. */
  name: string;
  url: string;
  licence: Licence;
  /** Freshness of the local cache, in seconds. */
  ttl: number;
};

// Registry of the sources Loilà is allowed to use. Keys are "<provider>:<dataset>".
export const SOURCES = {
  "DINUM:recherche-entreprises": {
    provider: "DINUM",
    dataset: "recherche-entreprises",
    name: "Annuaire des Entreprises (DINUM)",
    url: "https://recherche-entreprises.api.gouv.fr/docs/",
    licence: "LOV2",
    ttl: 30 * 86400,
  },
  "DINUM:idcc-metadata": {
    provider: "DINUM",
    dataset: "idcc-metadata",
    name: "Conventions collectives (référentiel IDCC, DINUM)",
    url: "https://recherche-entreprises.api.gouv.fr/idcc/metadata",
    licence: "LOV2",
    ttl: 90 * 86400, // re-run scripts/open-data-idcc.ts quarterly
  },
  "MINJUSTICE:competences-territoriales": {
    provider: "MINJUSTICE",
    dataset: "competences-territoriales",
    name: "Juridictions compétentes par commune (ministère de la Justice)",
    url: "https://www.data.gouv.fr/datasets/liste-des-juridictions-competentes-pour-les-communes-de-france",
    licence: "LOV2",
    ttl: 365 * 86400, // yearly vintage ("2026 juillet"): re-run scripts/open-data-jurisdictions.ts
  },
  "MTE:zonage-tlv": {
    provider: "MTE",
    dataset: "zonage-tlv",
    name: "Communes selon le zonage TLV / zones tendues (ministère de la Transition écologique)",
    url: "https://www.data.gouv.fr/datasets/liste-des-communes-selon-le-zonage-tlv-1",
    licence: "LOV2",
    ttl: 365 * 86400, // changes only with a décret amending décret 2013-392: re-run scripts/open-data-zones.ts
  },
  "INSEE:irl": {
    provider: "INSEE",
    dataset: "irl",
    name: "Indice de référence des loyers (INSEE, série 001515333)",
    url: "https://www.insee.fr/fr/statistiques/serie/001515333",
    licence: "LOV2",
    ttl: 92 * 86400, // quarterly: re-run scripts/open-data-irl.ts after each publication
  },
  "ETALAB:dvf-stats": {
    provider: "ETALAB",
    dataset: "dvf-stats",
    name: "Statistiques DVF (DGFiP, Etalab)",
    url: "https://www.data.gouv.fr/datasets/statistiques-dvf",
    licence: "LOV2",
    ttl: 30 * 86400,
  },
  "DILA:bodacc": {
    provider: "DILA",
    dataset: "bodacc",
    name: "BODACC (DILA)",
    url: "https://www.bodacc.fr/",
    licence: "fr-lo",
    ttl: 86400,
  },
  "ADEME:rge": {
    provider: "ADEME",
    dataset: "rge",
    name: "Liste des entreprises RGE (ADEME)",
    url: "https://data.ademe.fr/datasets/liste-des-entreprises-rge-2",
    licence: "LOV2",
    ttl: 7 * 86400,
  },
  "MTE:dsn-idcc": {
    provider: "MTE",
    dataset: "dsn-idcc",
    name: "Conventions collectives par entreprise (Ministère du Travail, DSN)",
    url: "https://www.data.gouv.fr/datasets/liste-des-conventions-collectives-par-entreprise-siret",
    licence: "LOV2",
    ttl: 0,
  },
  "DILA:kali": {
    provider: "DILA",
    dataset: "kali",
    name: "KALI, conventions collectives (DILA)",
    url: "https://www.data.gouv.fr/datasets/kali-conventions-collectives-nationales",
    licence: "fr-lo",
    ttl: 0,
  },
  "IGN:ban": {
    provider: "IGN",
    dataset: "ban",
    name: "Base Adresse Nationale (IGN / DINUM)",
    url: "https://data.geopf.fr/geocodage/",
    licence: "LOV2",
    ttl: 90 * 86400,
  },
  "IGN:cadastre": {
    provider: "IGN",
    dataset: "cadastre",
    name: "Cadastre (IGN, API Carto)",
    url: "https://apicarto.ign.fr/api/cadastre",
    licence: "LOV2",
    ttl: 90 * 86400,
  },
  "DGFiP:dvf": {
    provider: "DGFiP",
    dataset: "dvf",
    name: "Demandes de valeurs foncières (DGFiP / Etalab)",
    url: "https://dvf-api.data.gouv.fr",
    licence: "LOV2",
    ttl: 30 * 86400,
  },
  "ADEME:dpe": {
    provider: "ADEME",
    dataset: "dpe",
    name: "Diagnostics de performance énergétique (ADEME)",
    url: "https://data.ademe.fr/datasets/dpe03existant",
    licence: "LOV2",
    ttl: 14 * 86400,
  },
  "BRGM:georisques": {
    provider: "BRGM",
    dataset: "georisques",
    name: "Géorisques (BRGM / MTECT)",
    url: "https://www.georisques.gouv.fr/api/v1",
    licence: "LOV2",
    ttl: 30 * 86400,
  },
  "IGN:gpu": {
    provider: "IGN",
    dataset: "gpu",
    name: "Géoportail de l'urbanisme (IGN)",
    url: "https://apicarto.ign.fr/api/gpu",
    licence: "notspecified",
    ttl: 90 * 86400,
  },
} satisfies Record<string, SourceMeta>;

export type SourceKey = keyof typeof SOURCES;

export const sourceRecordId = (provider: string, dataset: string, externalId?: string | null) =>
  `${provider}:${dataset}:${externalId ?? "-"}`;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SourceRecord = {
  id: string; provider: string; dataset: string; external_id: string | null; official_url: string | null;
  licence: string; payload: string | null; checksum: string | null; match_quality: MatchQuality;
  published_at: string | null; updated_at: string | null; retrieved_at: number; expires_at: number | null;
};

/** Reads a cached record, whatever its age. Callers decide what to do with a stale one. */
export function getSourceRecord(id: string): SourceRecord | undefined {
  return getDb().prepare("SELECT * FROM source_records WHERE id = ?").get(id) as SourceRecord | undefined;
}

export const isFresh = (r: Pick<SourceRecord, "expires_at"> | undefined) => !!r && (r.expires_at === null || r.expires_at > Math.floor(Date.now() / 1000));

/** Inserts or refreshes one source record. `payload` is our cached copy of the official response. */
export function saveSourceRecord(
  db: Database.Database,
  meta: SourceMeta,
  externalId: string | null,
  payload: unknown,
  opts: { officialUrl?: string; matchQuality?: MatchQuality; ttl?: number | null; publishedAt?: string | null; updatedAt?: string | null } = {},
): string {
  const id = sourceRecordId(meta.provider, meta.dataset, externalId);
  const body = payload === null ? null : JSON.stringify(payload);
  const ttl = opts.ttl === undefined ? meta.ttl : opts.ttl;
  const expires = ttl === null ? null : Math.floor(Date.now() / 1000) + ttl;
  db.prepare(
    `INSERT INTO source_records (id, provider, dataset, external_id, official_url, licence, payload, checksum, match_quality, published_at, updated_at, retrieved_at, expires_at)
     VALUES (@id, @provider, @dataset, @externalId, @officialUrl, @licence, @payload, @checksum, @match, @publishedAt, @updatedAt, unixepoch(), @expires)
     ON CONFLICT(id) DO UPDATE SET official_url = excluded.official_url, licence = excluded.licence, payload = excluded.payload,
       checksum = excluded.checksum, match_quality = excluded.match_quality, published_at = excluded.published_at,
       updated_at = excluded.updated_at, retrieved_at = unixepoch(), expires_at = excluded.expires_at`,
  ).run({
    id,
    provider: meta.provider,
    dataset: meta.dataset,
    externalId,
    officialUrl: opts.officialUrl ?? meta.url,
    licence: meta.licence,
    payload: body,
    checksum: body === null ? null : sha256(body),
    match: opts.matchQuality ?? "CERTAIN",
    publishedAt: opts.publishedAt ?? null,
    updatedAt: opts.updatedAt ?? null,
    expires,
  });
  return id;
}

/** Records an import that carries no per-row payload (batch files): provenance only. */
export function recordImport(
  db: Database.Database,
  meta: SourceMeta,
  externalId: string | null,
  opts: { officialUrl?: string; matchQuality?: MatchQuality; updatedAt?: string } = {},
): string {
  return saveSourceRecord(db, meta, externalId, null, { ...opts, ttl: null });
}

const USER_AGENT = "Loila/1.0 (open data; +https://loila.fr/a-propos)";

/** JSON fetch with timeout and bounded retries (Géorisques and friends are flaky). */
export async function fetchJson<T = unknown>(url: string, opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...opts.headers },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** Attribution line for a data block, rendered next to the values. */
export function attribution(meta: SourceMeta, retrievedAt?: number | null) {
  const when = retrievedAt ? new Date(retrievedAt * 1000).toLocaleDateString("fr-FR") : undefined;
  return { name: meta.name, url: meta.url, licence: LICENCE_LABEL[meta.licence], retrievedAt: when };
}
