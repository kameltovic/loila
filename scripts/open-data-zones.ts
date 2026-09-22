// Import the official list of communes by housing zoning (ministère de la Transition écologique, décret
// 2013-392 as amended on 22/12/2025, Licence Ouverte 2.0) into `housing_zones`. The latest CSV of the dataset
// is used, and its last column (current zoning). Run: npx tsx scripts/open-data-zones.ts
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

const DATASET = "https://www.data.gouv.fr/api/1/datasets/657c88da2947e13be0597058/";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const db = getDb();
  const meta = SOURCES["MTE:zonage-tlv"];
  const headers = { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" };
  const ds = (await (await fetch(DATASET, { headers })).json()) as { resources: { format: string; url: string; title: string; last_modified: string }[] };
  const csv = ds.resources.find((r) => r.format?.toLowerCase() === "csv");
  if (!csv) throw new Error("no CSV resource in the dataset");
  const res = await fetch(csv.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${csv.url}`);
  const [head, ...lines] = (await res.text()).split(/\r?\n/).filter(Boolean);
  const cols = head.split(";");
  // Header: CODGEO25;DEP;LIBGEO;…;Zonage TLV post décret 22/12/2025 — the current zoning is the last column.
  if (!/^CODGEO/.test(cols[0]) || !/zonage/i.test(cols.at(-1) ?? "")) throw new Error(`unexpected CSV header: ${head.slice(0, 160)}`);

  const srcId = recordImport(db, meta, csv.title, { officialUrl: csv.url, matchQuality: "CERTAIN", updatedAt: csv.last_modified });
  const up = db.prepare("INSERT OR REPLACE INTO housing_zones (citycode, zone, city, source_record_id) VALUES (?, ?, ?, ?)");
  const count = { 1: 0, 2: 0, 3: 0 };
  db.transaction(() => {
    db.prepare("DELETE FROM housing_zones").run(); // a new décret replaces the whole list
    for (const line of lines) {
      const f = line.split(";");
      const zone = Number(f.at(-1)?.trim().charAt(0)); // "1. Zone tendue" | "2. Zone touristique et tendue" | "3. Non tendue"
      if (!/^\d[\dAB]\d{3}$/.test(f[0]) || ![1, 2, 3].includes(zone)) continue;
      up.run(f[0], zone, f[2] || null, srcId);
      count[zone as 1 | 2 | 3]++;
    }
  })();
  if (count[1] < 1000 || count[3] < 25_000) throw new Error(`implausible counts ${JSON.stringify(count)}`);
  console.log(`[open-data-zones] tendue ${count[1]} · touristique et tendue ${count[2]} · non tendue ${count[3]} · ${csv.title}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
