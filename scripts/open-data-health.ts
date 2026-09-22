// Local health check of the SOURCE_RECORD cache (src/lib/sources.ts): per-source volume, last sync,
// freshness and TTL. READ-ONLY and LOCAL ONLY: it never calls the network, it only counts what SQLite
// already holds. Run: npm run open-data:health [-- --json]
// Exit code 1 if a source has rows but all of them are stale beyond twice its TTL, else 0.
export {}; // module scope: every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { SOURCES } = await import("../src/lib/sources");
  const db = getDb();
  const asJson = process.argv.includes("--json");
  const now = Math.floor(Date.now() / 1000);

  // One pass over the cache, grouped by the (provider, dataset) pair used as the registry key.
  type Agg = { provider: string; dataset: string; rows: number; last: number | null; fresh: number; stale: number };
  let aggs: Agg[] = [];
  try {
    aggs = db
      .prepare(
        `SELECT provider, dataset, COUNT(*) rows, MAX(retrieved_at) last,
                SUM(CASE WHEN expires_at IS NULL OR expires_at > ? THEN 1 ELSE 0 END) fresh,
                SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= ? THEN 1 ELSE 0 END) stale
         FROM source_records GROUP BY provider, dataset`,
      )
      .all(now, now) as Agg[];
  } catch {
    aggs = [];
  }
  const byKey = new Map(aggs.map((a) => [`${a.provider}:${a.dataset}`, a]));

  const count = (where = "") => {
    try {
      return (db.prepare(`SELECT COUNT(*) n FROM source_records ${where}`).get() as { n: number }).n;
    } catch {
      return 0;
    }
  };

  const fmtDate = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleDateString("fr-FR") : "—");
  const fmtTtl = (ttl: number) => (ttl <= 0 ? "import (pas de TTL)" : ttl % 86400 === 0 ? `${ttl / 86400} j` : `${Math.round(ttl / 3600)} h`);

  const sources = Object.entries(SOURCES).map(([key, meta]) => {
    const a = byKey.get(key);
    const rows = a?.rows ?? 0;
    const fresh = a?.fresh ?? 0;
    const stale = a?.stale ?? 0;
    const last = a?.last ?? null;
    // "Beyond 2× TTL": only a dated, expiring cache can be judged (imports carry no TTL and never expire).
    const overdue = rows > 0 && fresh === 0 && meta.ttl > 0 && last !== null && now - last > 2 * meta.ttl;
    const state = rows === 0 ? "aucune donnée" : meta.ttl <= 0 ? "import (pas de TTL)" : stale === 0 ? "à jour" : fresh === 0 ? "à rafraîchir" : "partiellement périmé";
    return {
      key, provider: meta.provider, dataset: meta.dataset, name: meta.name,
      licence: meta.licence, ttl: meta.ttl, rows, last_retrieved_at: last, last_sync: fmtDate(last),
      fresh, stale, state, overdue,
    };
  });

  // Rows written by a source that is not (or no longer) in the registry: surfaced, never silently dropped.
  const unknown = aggs
    .filter((a) => !(a.provider + ":" + a.dataset in SOURCES))
    .map((a) => ({ provider: a.provider, dataset: a.dataset, rows: a.rows }))
    .sort((x, y) => y.rows - x.rows);

  let entitiesByType: { type: string; n: number }[] = [];
  try {
    entitiesByType = db.prepare("SELECT type, COUNT(*) n FROM entities GROUP BY type ORDER BY type").all() as { type: string; n: number }[];
  } catch {
    entitiesByType = [];
  }
  const totals = {
    source_records: count(),
    with_payload: count("WHERE payload IS NOT NULL"),
    without_checksum_imports: count("WHERE checksum IS NULL"),
  };

  const anyOverdue = sources.some((s) => s.overdue);

  if (asJson) {
    console.log(JSON.stringify({
      read_only: true,
      network: false,
      generated_at: now,
      sources,
      unknown_sources: unknown,
      totals: { ...totals, entities_by_type: Object.fromEntries(entitiesByType.map((e) => [e.type, e.n])) },
      exit_code: anyOverdue ? 1 : 0,
    }, null, 2));
    process.exitCode = anyOverdue ? 1 : 0;
    return;
  }

  const rule = "─".repeat(72);
  console.log(`SANTÉ DES DONNÉES OUVERTES LOILÀ · ${new Date(now * 1000).toLocaleString("fr-FR")}`);
  console.log("Contrôle local (cache SQLite) — AUCUN appel réseau.");
  console.log(rule);
  for (const s of sources) {
    console.log(`${s.provider} / ${s.dataset}`);
    console.log(`  Nom      : ${s.name}`);
    console.log(`  Licence  : ${s.licence}`);
    console.log(`  Lignes   : ${s.rows.toLocaleString("fr-FR")} · Dernière synchro : ${s.last_sync}`);
    console.log(`  Fraîcheur: ${s.fresh.toLocaleString("fr-FR")} fraîches · ${s.stale.toLocaleString("fr-FR")} périmées · TTL ${fmtTtl(s.ttl)}`);
    console.log(`  État     : ${s.state}${s.overdue ? "  ⚠ au-delà de 2× le TTL" : ""}`);
  }
  console.log(rule);
  console.log("TOTAL source_records".padEnd(40), totals.source_records.toLocaleString("fr-FR"));
  console.log("  avec payload".padEnd(40), totals.with_payload.toLocaleString("fr-FR"));
  console.log("  sans checksum (imports)".padEnd(40), totals.without_checksum_imports.toLocaleString("fr-FR"));
  console.log("Entités par type :", entitiesByType.map((e) => `${e.type} ${e.n.toLocaleString("fr-FR")}`).join(" · ") || "aucune");
  if (unknown.length) console.log("Sources hors registre :", unknown.map((u) => `${u.provider}:${u.dataset} (${u.rows})`).join(", "));
  console.log(rule);
  console.log(anyOverdue ? "⚠ au moins une source a toutes ses lignes périmées au-delà de 2× le TTL (code 1)." : "✓ cache local sain (code 0).");
  process.exitCode = anyOverdue ? 1 : 0;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
