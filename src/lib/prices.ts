import { getDb } from "./db";

// /prix-immobilier pages: yearly DVF price per m² (scripts/open-data-prices.ts) for communes and départements.
export type Place = { code: string; level: "commune" | "departement" | "nation"; name: string; slug: string; dep: string | null; population: number | null; sales: number };
export type PriceYear = { year: number; apt_sales: number | null; apt_median: number | null; house_sales: number | null; house_median: number | null };

/** "Paris 19e Arrondissement" → "paris-19e-75119"; "L'Abergement-Clémenciat" → "l-abergement-clemenciat-01001". */
export const placeSlug = (name: string, code: string) =>
  `${name.replace(/ Arrondissement$/i, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${code.toLowerCase()}`;

/** Display name: "Paris 19e Arrondissement" → "Paris 19e". */
export const placeName = (p: Pick<Place, "name">) => p.name.replace(/ Arrondissement$/i, "");

export const placeUrl = (p: Pick<Place, "slug">) => `/prix-immobilier/${p.slug}`;

export const getPlace = (code: string) => getDb().prepare("SELECT * FROM places WHERE code = ?").get(code) as Place | undefined;

/** The slug carries the code at its end: resolve by code, then check the slug (canonical redirect otherwise). */
export const placeFromSlug = (slug: string) => {
  const code = slug.split("-").pop()?.toUpperCase() ?? "";
  return /^(\d{2}|2[AB]|\d{3}|\d{5}|2[AB]\d{3})$/.test(code) ? getPlace(code) : undefined;
};

export const priceYears = (code: string) =>
  getDb().prepare("SELECT year, apt_sales, apt_median, house_sales, house_median FROM price_years WHERE code = ? ORDER BY year").all(code) as PriceYear[];

export type Kind = "apt" | "house";
export const KIND_LABEL: Record<Kind, string> = { apt: "appartements", house: "maisons" };

/** Yearly points of one property type; years under `min` sales are dropped (a median of 3 sales is noise). */
export const pointsOf = (rows: PriceYear[], kind: Kind, min = 5) =>
  rows
    .map((r) => ({ year: r.year, median: (kind === "apt" ? r.apt_median : r.house_median) ?? 0, sales: (kind === "apt" ? r.apt_sales : r.house_sales) ?? 0 }))
    .filter((p) => p.median > 0 && p.sales >= min);

/** The property type that sells most in a place. */
export const mainKind = (rows: PriceYear[]): Kind =>
  rows.reduce((t, r) => t + (r.apt_sales ?? 0), 0) >= rows.reduce((t, r) => t + (r.house_sales ?? 0), 0) ? "apt" : "house";

// A commune page is indexable with a real series behind it: ≥ 60 sales over the period and ≥ 3 years of ≥ 5 sales
// of its main property type. Every département page is. One rule for page metadata and sitemap.
export function placeIndexable(p: Place, rows: PriceYear[] = priceYears(p.code)): boolean {
  if (p.level !== "commune") return p.level === "departement";
  return p.sales >= 60 && pointsOf(rows, mainKind(rows)).length >= 3;
}

export const indexablePlaces = (): Place[] => {
  const all = getDb().prepare("SELECT * FROM places WHERE level IN ('commune', 'departement') ORDER BY level DESC, sales DESC").all() as Place[];
  const rows = new Map<string, PriceYear[]>();
  for (const r of getDb().prepare("SELECT code, year, apt_sales, apt_median, house_sales, house_median FROM price_years ORDER BY year").all() as (PriceYear & { code: string })[]) {
    rows.set(r.code, [...(rows.get(r.code) ?? []), r]);
  }
  return all.filter((p) => placeIndexable(p, rows.get(p.code) ?? []));
};

export const communesOf = (dep: string, limit = 500) =>
  getDb().prepare("SELECT * FROM places WHERE level = 'commune' AND dep = ? ORDER BY sales DESC LIMIT ?").all(dep, limit) as Place[];

/** Paris, Lyon, Marseille arrondissements: 75101…75120, 69381…69389, 13201…13216. */
export const arrondissementCity = (code: string) => (/^751\d\d$/.test(code) ? "751" : /^6938\d$/.test(code) ? "6938" : /^132\d\d$/.test(code) ? "132" : null);

/** Sibling places listed on a page: every arrondissement of the same city in order, else the busiest communes of the département. */
export function neighbours(p: Place, limit: number): Place[] {
  const city = p.level === "commune" ? arrondissementCity(p.code) : null;
  if (city) return getDb().prepare("SELECT * FROM places WHERE level = 'commune' AND code LIKE ? ORDER BY code").all(`${city}%`) as Place[];
  const dep = p.level === "commune" ? p.dep ?? "" : p.code;
  const list = communesOf(dep, limit);
  // A département made only of arrondissements (Paris): number order reads better than sales order.
  return list.length && list.every((c) => arrondissementCity(c.code)) ? list.sort((a, b) => a.code.localeCompare(b.code)) : list;
}

export type SectionPrice = { code: string; median: number; sales: number };

/** Section prices of some communes for one property type (≥ 5 sales pooled over three years), plus 5-class quantile breaks. */
export function sectionPrices(communes: string[], kind: Kind): { sections: SectionPrice[]; breaks: number[] } {
  if (!communes.length) return { sections: [], breaks: [] };
  const [sales, median] = kind === "apt" ? ["apt_sales", "apt_median"] : ["house_sales", "house_median"];
  const sections = getDb()
    .prepare(`SELECT code, ${median} AS median, ${sales} AS sales FROM section_prices WHERE commune IN (${communes.map(() => "?").join(",")}) AND ${sales} >= 5 AND ${median} > 0`)
    .all(...communes) as SectionPrice[];
  const sorted = sections.map((s) => s.median).sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  return { sections, breaks: sorted.length >= 5 ? [q(0.2), q(0.4), q(0.6), q(0.8)] : [] };
}

export const departements = () =>
  getDb().prepare("SELECT * FROM places WHERE level = 'departement' ORDER BY code").all() as Place[];

/** Relative change between two values, rounded to 0.1 %. */
export const change = (from: number, to: number) => Math.round(((to - from) / from) * 1000) / 10;
