// CNIL open data served by the pages: DPO contacts (cnil_dpo), breach statistics (cnil_breach_stats), deliberations
// (decisions with source 'cnil'). Imported by scripts/open-data-cnil.ts and scripts/ingest-juri.ts --source cnil.
import { getDb } from "./db";
import type { Decision } from "./decisions";

export type Dpo = {
  siren: string; nom: string | null; type_dpo: string | null; date_designation: string | null; dpo_siren: string | null; dpo_nom: string | null;
  email: string | null; url: string | null; telephone: string | null; adresse: string | null; source_record_id: string | null;
};

export const companyDpo = (siren: string) => getDb().prepare("SELECT * FROM cnil_dpo WHERE siren = ?").get(siren) as Dpo | undefined;

export type BreachYear = { year: string; total: number };
export type BreachStats = {
  years: BreachYear[];
  last: string;
  causes: { label: string; n: number }[];
  information: { label: string; n: number }[];
  bigOnes: number; // notifications affecting more than 5,000 people, last year
  note: string | null;
  source_record_id: string | null;
};

export function breachStats(): BreachStats | undefined {
  const rows = getDb().prepare("SELECT year, dimension, label, n, source_record_id FROM cnil_breach_stats").all() as { year: string; dimension: string; label: string; n: number; source_record_id: string | null }[];
  const years = rows.filter((r) => r.dimension === "total").map((r) => ({ year: r.year, total: r.n })).sort((a, b) => a.year.localeCompare(b.year));
  const last = years.at(-1)?.year;
  if (!last) return undefined;
  const of = (dim: string) => rows.filter((r) => r.year === last && r.dimension === dim).map(({ label, n }) => ({ label, n })).sort((a, b) => b.n - a.n);
  return {
    years,
    last,
    causes: of("cause"),
    information: of("information"),
    bigOnes: of("personnes").find((r) => /plus de 5000/i.test(r.label))?.n ?? 0,
    note: rows.find((r) => r.dimension === "note")?.label ?? null,
    source_record_id: rows[0]?.source_record_id ?? null,
  };
}

export type CnilDecision = Pick<Decision, "id" | "juridiction" | "formation" | "date" | "numero" | "titre">;
/** Latest CNIL sanctions (or another nature), newest first. */
export const cnilDecisions = (nature: string, limit = 8) =>
  getDb().prepare("SELECT id, juridiction, formation, date, numero, titre FROM decisions WHERE source = 'cnil' AND formation LIKE ? ORDER BY date DESC LIMIT ?").all(`${nature}%`, limit) as CnilDecision[];
export const cnilCount = (nature: string) =>
  (getDb().prepare("SELECT COUNT(*) n FROM decisions WHERE source = 'cnil' AND formation LIKE ?").get(`${nature}%`) as { n: number }).n;

/** "Délibération de la formation restreinte n° SAN-2024-009 du 22 juillet 2024 concernant la société X" → "la société X". */
export const cnilSubject = (titre: string) => titre.match(/(?:^|\s)(?:concernant|à l['’]encontre de|relative? à)\s+(.+)$/i)?.[1]?.replace(/\.$/, "") ?? titre;
