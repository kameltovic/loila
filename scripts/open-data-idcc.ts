// Import the official IDCC list (DINUM /idcc/metadata: 1 665 entries, Licence Ouverte 2.0) into
// collective_agreements, so any IDCC declared by an employer resolves to a title, a KALI container
// and an état. Batch job, no per-row TTL. Run: npx tsx scripts/open-data-idcc.ts
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

type Entry = { "titre de la convention"?: string; titre?: string; id_kali?: string; cc_ti?: string; nature?: string; etat?: string; debut?: string; fin?: string | null; url?: string };

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const { linkExternalId, normalizeIdcc } = await import("../src/lib/entities");
  const db = getDb();
  const meta = SOURCES["DINUM:idcc-metadata"];
  const res = await fetch("https://recherche-entreprises.api.gouv.fr/idcc/metadata", {
    headers: { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, Entry>;
  const srcId = recordImport(db, meta, null, { officialUrl: meta.url, matchQuality: "CERTAIN" });
  const up = db.prepare(
    `INSERT INTO collective_agreements (idcc, entity_id, titre, titre_court, legitext, etat, actif, regime, champ, date_signature, date_fin, source, source_record_id, fetched_at)
     VALUES (@idcc, @entity, @titre, @court, @legitext, @etat, @actif, NULL, NULL, @debut, @fin, @source, @src, unixepoch())
     ON CONFLICT(idcc) DO UPDATE SET entity_id = excluded.entity_id, titre = excluded.titre, titre_court = excluded.titre_court,
       legitext = excluded.legitext, etat = excluded.etat, actif = excluded.actif, date_signature = excluded.date_signature,
       date_fin = excluded.date_fin, source_record_id = excluded.source_record_id, fetched_at = unixepoch()`,
  );
  let n = 0;
  db.transaction(() => {
    for (const [rawIdcc, e] of Object.entries(data)) {
      if (e.cc_ti && e.cc_ti !== "IDCC") continue; // "TI" entries are standalone texts, not branch agreements
      const idcc = normalizeIdcc(rawIdcc);
      if (!idcc || idcc === "9999") continue; // 9999 = "not declared": never a convention
      const titre = e["titre de la convention"] ?? e.titre ?? `Convention collective ${idcc}`;
      const eid = linkExternalId(db, "idcc", idcc, "agreement", idcc, titre);
      up.run({
        idcc, entity: eid, titre, court: null, legitext: e.id_kali ?? null, etat: e.etat ?? null,
        actif: e.etat?.startsWith("VIGUEUR") ? 1 : 0, debut: e.debut?.slice(0, 10) ?? null, fin: e.fin?.slice(0, 10) ?? null,
        source: "recherche-entreprises", src: srcId,
      });
      n++;
    }
  })();
  console.log(`[open-data-idcc] ${n} conventions importées · source ${srcId}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
