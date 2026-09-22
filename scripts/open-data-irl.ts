// Import the Indice de référence des loyers (INSEE BDM, series 001515333, SDMX, no key, Licence Ouverte 2.0)
// into legal_indices (kind 'irl'). Definitive values only. Quarterly. Run: npx tsx scripts/open-data-irl.ts
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

const URL_SDMX = "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/001515333";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const db = getDb();
  const meta = SOURCES["INSEE:irl"];
  const res = await fetch(URL_SDMX, { headers: { Accept: "application/xml", "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${URL_SDMX}`);
  const xml = await res.text();
  if (!xml.includes('IDBANK="001515333"')) throw new Error("unexpected SDMX payload");
  const attr = (s: string, k: string) => s.match(new RegExp(`${k}="([^"]*)"`))?.[1];
  const obs = [...xml.matchAll(/<Obs ([^>]+)\/>/g)]
    .map((m) => ({ period: attr(m[1], "TIME_PERIOD"), value: Number(attr(m[1], "OBS_VALUE")), qual: attr(m[1], "OBS_QUAL"), jo: attr(m[1], "DATE_JO") }))
    .filter((o) => o.period && /^\d{4}-Q[1-4]$/.test(o.period) && Number.isFinite(o.value) && o.value > 0 && o.qual === "DEF");
  if (obs.length < 40) throw new Error(`only ${obs.length} definitive quarters`);

  const article = (db.prepare("SELECT id FROM articles WHERE code = 'loi-89-462' AND num = '17-1'").get() as { id: string } | undefined)?.id ?? null;
  const srcId = recordImport(db, meta, "001515333", { officialUrl: URL_SDMX, matchQuality: "CERTAIN", updatedAt: attr(xml, "LAST_UPDATE") });
  const up = db.prepare(
    `INSERT INTO legal_indices (kind, period, value, unit, article_id, source_name, source_url, valid_from, source_record_id)
     VALUES ('irl', ?, ?, 'index', ?, ?, ?, ?, ?)
     ON CONFLICT(kind, period) DO UPDATE SET value = excluded.value, article_id = excluded.article_id,
       valid_from = excluded.valid_from, source_record_id = excluded.source_record_id`,
  );
  db.transaction(() => { for (const o of obs) up.run(o.period, o.value, article, meta.name, meta.url, o.jo ?? null, srcId); })();
  const last = obs.reduce((a, b) => (a.period! > b.period! ? a : b));
  console.log(`[open-data-irl] ${obs.length} trimestres · dernier ${last.period} = ${last.value} (JO ${last.jo})`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
