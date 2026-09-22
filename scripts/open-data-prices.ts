// Price per m² by commune / département / nation for the /prix-immobilier pages.
// Source: Statistiques DVF (DGFiP, Etalab, Licence Ouverte 2.0), monthly medians 2021→, streamed (≈ 280 MB, no disk);
// yearly value = monthly medians weighted by their sales. Names and population: geo.api.gouv.fr (DINUM).
// Run: npx tsx scripts/open-data-prices.ts  (part of npm run open-data:refs; shipped by the 2026-09-refs bundle)
export {}; // every script declares its own main()
import readline from "node:readline";
import { Readable } from "node:stream";
try { process.loadEnvFile(); } catch { /* no .env */ }

const STATS = "https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/dvf/stats_dvf.csv";
const GEO = "https://geo.api.gouv.fr";
const UA = { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" };

/** One CSV line → fields (quoted fields may contain commas). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const { placeSlug } = await import("../src/lib/prices");
  const db = getDb();
  const t = Date.now();

  // 1. Official names: départements, communes, and the arrondissements of Paris, Lyon and Marseille.
  const get = async <T,>(path: string) => {
    const r = await fetch(`${GEO}${path}`, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
    return (await r.json()) as T;
  };
  type Com = { code: string; nom: string; codeDepartement: string; population?: number };
  const deps = await get<{ code: string; nom: string }[]>("/departements");
  const communes = await get<Com[]>("/communes?fields=nom,code,codeDepartement,population&format=json");
  const arrondissements = await get<Com[]>("/communes?type=arrondissement-municipal&fields=nom,code,codeDepartement,population&format=json");
  const names = new Map<string, { level: "commune" | "departement"; name: string; dep: string | null; population: number | null }>();
  for (const d of deps) names.set(d.code, { level: "departement", name: d.nom, dep: null, population: null });
  for (const c of [...communes, ...arrondissements]) names.set(c.code, { level: "commune", name: c.nom, dep: c.codeDepartement, population: c.population ?? null });
  console.log(`[prices] names: ${deps.length} départements, ${communes.length} communes, ${arrondissements.length} arrondissements`);

  // 2. Monthly medians → yearly, weighted by sales.
  type Acc = { as: number; aw: number; hs: number; hw: number };
  const acc = new Map<string, Acc>(); // key: code|year
  const res = await fetch(STATS, { headers: UA });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} on ${STATS}`);
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body as import("node:stream/web").ReadableStream) });
  let header: string[] | null = null;
  let rows = 0;
  for await (const line of rl) {
    const f = parseCsvLine(line);
    if (!header) { header = f; continue; }
    const col = (k: string) => f[header!.indexOf(k)];
    const level = col("echelle_geo");
    if (level !== "commune" && level !== "departement" && level !== "nation") continue;
    const code = level === "nation" ? "FR" : col("code_geo");
    const year = col("annee_mois")?.slice(0, 4);
    if (!/^\d{4}$/.test(year ?? "")) continue;
    const num = (k: string) => { const v = Number(col(k)); return Number.isFinite(v) && v > 0 ? v : 0; };
    const key = `${code}|${year}`;
    const a = acc.get(key) ?? { as: 0, aw: 0, hs: 0, hw: 0 };
    const as = num("nb_ventes_appartement"), am = num("med_prix_m2_appartement");
    const hs = num("nb_ventes_maison"), hm = num("med_prix_m2_maison");
    if (as && am) { a.as += as; a.aw += as * am; }
    if (hs && hm) { a.hs += hs; a.hw += hs * hm; }
    acc.set(key, a);
    rows++;
  }
  console.log(`[prices] ${rows} monthly rows read · ${acc.size} (place, year) pairs · ${((Date.now() - t) / 1000).toFixed(0)} s`);

  // 3. Store: price_years for every place, places for those with a name (and the nation).
  const sales = new Map<string, number>();
  const srcStats = recordImport(db, SOURCES["ETALAB:dvf-stats"], "stats_dvf.csv", { officialUrl: STATS, matchQuality: "CERTAIN" });
  recordImport(db, SOURCES["DINUM:geo"], "communes", { officialUrl: `${GEO}/communes`, matchQuality: "CERTAIN" });
  const py = db.prepare("INSERT INTO price_years (code, year, apt_sales, apt_median, house_sales, house_median) VALUES (?, ?, ?, ?, ?, ?)");
  const pl = db.prepare("INSERT INTO places (code, level, name, slug, dep, population, sales) VALUES (?, ?, ?, ?, ?, ?, ?)");
  db.transaction(() => {
    db.exec("DELETE FROM price_years; DELETE FROM places;");
    for (const [key, a] of acc) {
      const [code, year] = key.split("|");
      py.run(code, Number(year), a.as || null, a.as ? Math.round(a.aw / a.as) : null, a.hs || null, a.hs ? Math.round(a.hw / a.hs) : null);
      sales.set(code, (sales.get(code) ?? 0) + a.as + a.hs);
    }
    pl.run("FR", "nation", "France", "france", null, null, sales.get("FR") ?? 0);
    for (const [code, n] of names) {
      if (!sales.get(code)) continue; // no sale recorded: no page
      pl.run(code, n.level, n.name, placeSlug(n.name, code), n.dep, n.population, sales.get(code));
    }
  })();
  const c = db.prepare("SELECT level, COUNT(*) n FROM places GROUP BY level").all();
  console.log(`[prices] places ${JSON.stringify(c)} · source ${srcStats} · ${((Date.now() - t) / 1000).toFixed(0)} s`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
