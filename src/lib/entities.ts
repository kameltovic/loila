// Entity resolution: one internal id per real-world entity, with every external identifier mapped to it.
// Vertical tables (companies, addresses, parcels…) own their data; entities/entity_ids only say "this is
// the same thing", so a SIREN cited by BODACC, the DSN file and the API is never duplicated.
import type Database from "better-sqlite3";
import { getDb } from "./db";

export type EntityType = "company" | "establishment" | "address" | "parcel" | "agreement" | "jurisdiction" | "dpe" | "decision" | "article";

/** External id schemes Loilà knows how to resolve. */
export type IdScheme = "siren" | "siret" | "idcc" | "naf" | "insee" | "ban" | "idu" | "dpe" | "bodacc" | "rge" | "legiarti" | "juritext";

export type Entity = { id: string; type: EntityType; label: string | null; canonical: string | null };

/** Internal, opaque id: "<type>:<canonical>". Stable as long as the canonical key is. */
export const entityId = (type: EntityType, canonical: string) => `${type}:${canonical}`;

export function ensureEntity(db: Database.Database, type: EntityType, canonical: string, label?: string | null): string {
  const id = entityId(type, canonical);
  db.prepare(
    `INSERT INTO entities (id, type, canonical, label) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = COALESCE(excluded.label, entities.label), updated_at = unixepoch()`,
  ).run(id, type, canonical, label ?? null);
  return id;
}

/** Maps an external identifier to an entity, creating the entity when needed. */
export function linkExternalId(
  db: Database.Database,
  scheme: IdScheme,
  value: string,
  type: EntityType,
  canonical: string,
  label?: string | null,
): string {
  const id = ensureEntity(db, type, canonical, label);
  db.prepare("INSERT INTO entity_ids (scheme, value, entity_id) VALUES (?, ?, ?) ON CONFLICT(scheme, value) DO UPDATE SET entity_id = excluded.entity_id").run(
    scheme,
    value,
    id,
  );
  return id;
}

export const resolveExternal = (scheme: IdScheme, value: string): string | undefined =>
  (getDb().prepare("SELECT entity_id FROM entity_ids WHERE scheme = ? AND value = ?").get(scheme, value) as { entity_id: string } | undefined)?.entity_id;

export const entityExternalIds = (id: string): { scheme: string; value: string }[] =>
  getDb().prepare("SELECT scheme, value FROM entity_ids WHERE entity_id = ? ORDER BY scheme, value").all(id) as { scheme: string; value: string }[];

export const getEntity = (id: string): Entity | undefined => getDb().prepare("SELECT * FROM entities WHERE id = ?").get(id) as Entity | undefined;

/** Normalizes an IDCC to the 4-digit form used by Loilà ("16" → "0016", "1486" → "1486"). 9999 = "not declared".
 *  Returns "" when there is no digit at all (never a bogus "0000"). */
export const normalizeIdcc = (v: string | number) => {
  const d = String(v).trim().replace(/\D/g, "");
  return d ? d.padStart(4, "0") : "";
};
export const IDCC_UNKNOWN = "9999";
