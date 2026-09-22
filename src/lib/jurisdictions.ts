import { getDb } from "./db";

// Territorial competence per commune (ministère de la Justice, imported by scripts/open-data-jurisdictions.ts).
export type JurisdictionKind = "tj" | "tprx" | "cph" | "ca";
export type Jurisdiction = { kind: JurisdictionKind; label: string; source_record_id: string | null };

export const JURISDICTION_ROLE: Record<JurisdictionKind, string> = {
  tj: "Litiges civils : bail, voisinage, vente, construction, copropriété",
  tprx: "Chambre de proximité du tribunal judiciaire pour les petits litiges du quotidien",
  cph: "Litiges entre salarié et employeur nés du contrat de travail",
  ca: "Appel des jugements rendus par ces juridictions",
};
const ORDER: JurisdictionKind[] = ["tj", "tprx", "cph", "ca"];

// The dataset lists Paris as one commune and Lyon/Marseille by arrondissement; the geocoder may return either.
function candidates(citycode: string): string[] {
  if (/^751\d\d$/.test(citycode)) return [citycode, "75056"];
  if (citycode === "13055") return ["13201"];
  if (citycode === "69123") return ["69381"];
  return [citycode];
}

export function jurisdictionsFor(citycode: string | null | undefined): Jurisdiction[] {
  if (!citycode) return [];
  const q = getDb().prepare("SELECT kind, label, source_record_id FROM jurisdictions WHERE citycode = ?");
  for (const c of candidates(citycode)) {
    const rows = q.all(c) as Jurisdiction[];
    if (rows.length) return rows.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  }
  return [];
}
