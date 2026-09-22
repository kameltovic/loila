import { getDb } from "./db";

// Rent revision (art. 17-1 loi 89-462): new rent = rent × IRL(reference quarter, revision year)
//                                                  / IRL(same quarter, year before). Imported by scripts/open-data-irl.ts.
export type IrlPoint = { period: string; value: number; valid_from: string | null; source_record_id: string | null };

export const irlSeries = (limit = 400): IrlPoint[] =>
  getDb()
    .prepare("SELECT period, value, valid_from, source_record_id FROM legal_indices WHERE kind = 'irl' ORDER BY period DESC LIMIT ?")
    .all(limit) as IrlPoint[];

export const quarterLabel = (period: string) => `${period.slice(5).replace("Q", "T")} ${period.slice(0, 4)}`; // "2026-Q2" → "T2 2026"

export type Revision = { from: IrlPoint; to: IrlPoint; rent: number; newRent: number; variation: number };

/** Revised rent, or the reason it cannot be computed. Rounded to the cent, never below the current rent's precision. */
export function reviseRent(rent: number, quarter: number, year: number, series: IrlPoint[] = irlSeries()): Revision | { error: string } {
  if (!(rent > 0 && rent < 100_000)) return { error: "Indiquez un loyer hors charges positif." };
  if (![1, 2, 3, 4].includes(quarter)) return { error: "Choisissez le trimestre de référence indiqué dans le bail." };
  const at = (y: number) => series.find((p) => p.period === `${y}-Q${quarter}`);
  const to = at(year);
  const from = at(year - 1);
  if (!to) return { error: `L’IRL du ${quarter}e trimestre ${year} n’est pas encore publié.` };
  if (!from) return { error: `L’IRL du ${quarter}e trimestre ${year - 1} n’est pas disponible.` };
  const newRent = Math.round(rent * (to.value / from.value) * 100) / 100;
  return { from, to, rent, newRent, variation: to.value / from.value - 1 };
}
