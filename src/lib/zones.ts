import { getDb } from "./db";
import { communeCandidates } from "./jurisdictions";

// Zone tendue per commune (imported by scripts/open-data-zones.ts). 1 = zone tendue (urbanisation continue
// > 50 000 habitants: préavis d'un mois, art. 15 loi 89-462), 2 = zone touristique et tendue, 3 = non tendue.
export type HousingZone = { zone: 1 | 2 | 3; source_record_id: string | null };

export function housingZone(citycode: string | null | undefined): HousingZone | undefined {
  if (!citycode) return undefined;
  const q = getDb().prepare("SELECT zone, source_record_id FROM housing_zones WHERE citycode = ?");
  for (const c of communeCandidates(citycode)) {
    const row = q.get(c) as HousingZone | undefined;
    if (row) return row;
  }
  return undefined;
}
