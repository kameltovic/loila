// Import the ministère de la Justice list of competent courts per commune (CSV, ~35 000 communes,
// Licence Ouverte 2.0) into `jurisdictions`: commune → tribunal judiciaire, tribunal de proximité,
// conseil de prud'hommes, cour d'appel. Yearly vintage. Run: npx tsx scripts/open-data-jurisdictions.ts
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

const DATASET = "https://www.data.gouv.fr/api/1/datasets/6392017edf7251532fda4bab/";
// CSV columns: Commune;Libellé;Orig. CA;N° CA;CA;Orig. TJ;N° TJ;TJ;Orig. TPRX;N° TPRX;TPRX;Orig. CPH;N° CPH;CPH
const COLS = { ca: 4, tj: 7, tprx: 10, cph: 13 } as const;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const db = getDb();
  const meta = SOURCES["MINJUSTICE:competences-territoriales"];
  const headers = { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" };

  // Latest CSV resource of the dataset (resources are listed newest first).
  const ds = (await (await fetch(DATASET, { headers })).json()) as { resources: { format: string; url: string; title: string; last_modified: string }[] };
  const csv = ds.resources.find((r) => r.format?.toLowerCase() === "csv");
  if (!csv) throw new Error("no CSV resource in the dataset");
  const res = await fetch(csv.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${csv.url}`);
  const [head, ...lines] = (await res.text()).split(/\r?\n/).filter(Boolean);
  if (!head.startsWith("Commune;") || head.split(";").length !== 14) throw new Error(`unexpected CSV header: ${head.slice(0, 120)}`);

  const srcId = recordImport(db, meta, csv.title, { officialUrl: csv.url, matchQuality: "CERTAIN", updatedAt: csv.last_modified });
  const up = db.prepare(
    `INSERT INTO jurisdictions (citycode, kind, label, city, source, source_record_id) VALUES (?, ?, ?, ?, 'minjustice', ?)
     ON CONFLICT(citycode, kind) DO UPDATE SET label = excluded.label, city = excluded.city, source_record_id = excluded.source_record_id`,
  );
  let communes = 0;
  db.transaction(() => {
    db.prepare("DELETE FROM jurisdictions WHERE source = 'minjustice'").run(); // a new vintage replaces the old one
    for (const line of lines) {
      const f = line.split(";");
      if (!/^\d[\dAB]\d{3}$/.test(f[0])) continue;
      for (const [kind, i] of Object.entries(COLS)) if (f[i]?.trim()) up.run(f[0], kind, f[i].trim(), f[1] || null, srcId);
      communes++;
    }
  })();
  if (communes < 30_000) throw new Error(`only ${communes} communes imported, expected ~35 000`);
  console.log(`[open-data-jurisdictions] ${communes} communes · ${csv.title} · source ${srcId}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
