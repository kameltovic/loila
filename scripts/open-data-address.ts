// Full address/property chain for one address: BAN geocoding → cadastre parcel → DVF transactions →
// ADEME DPE → Géorisques risks → GPU planning zone, all cached in SQLite with provenance.
// Run: npx tsx scripts/open-data-address.ts "95 Avenue de Suffren 75007 Paris"
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (query.length < 3) {
    console.error('Usage : npx tsx scripts/open-data-address.ts "<adresse>"');
    process.exit(1);
  }
  const { getDb } = await import("../src/lib/db");
  const {
    getAddress, syncAddressFull, addressParcel, addressTransactions, addressDpe, addressRisks, addressZones, addressIndexable,
  } = await import("../src/lib/address");
  getDb();
  const t = Date.now();
  const summary = await syncAddressFull(query);
  if (!summary) {
    console.error(`[open-data-address] géocodage sans résultat pour « ${query} »`);
    process.exit(1);
  }
  const { banId } = summary;
  const a = getAddress(banId);
  const parcel = addressParcel(banId);
  const tx = addressTransactions(banId, 100);
  const dpe = addressDpe(banId);
  const risks = addressRisks(banId);
  const zones = addressZones(banId);

  console.log(`[open-data-address] « ${query} »
  BAN        : ${banId} · ${a?.label ?? "?"} · ${a?.postcode ?? ""} ${a?.city ?? ""} (${a?.lat}, ${a?.lon})
  Parcelle   : ${parcel?.idu ?? "—"}${parcel ? ` · ${parcel.contenance ?? "?"} m² · section ${parcel.section ?? "?"} ${parcel.numero ?? "?"}` : ""}
  Ventes DVF : ${tx.length} mutation(s)${tx[0] ? ` · dernière ${tx[0].date_mutation ?? "?"} ${tx[0].type_local ?? "?"} ${tx[0].valeur_fonciere ?? "?"} €` : ""}
  DPE        : ${dpe.length} diagnostic(s)${dpe[0] ? ` · ${dpe[0].etiquette_dpe ?? "?"}/${dpe[0].etiquette_ges ?? "?"} le ${dpe[0].date_etablissement ?? "?"}` : ""}
  Risques    : ${risks.length} · ${risks.map((r) => r.risk).join(", ") || "—"}
  Urbanisme  : ${zones.length} · ${zones.map((z) => `${z.libelle ?? "?"} (${z.typezone ?? "?"})`).join(", ") || "—"}
  Indexable  : ${addressIndexable(banId) ? "oui" : "non"}
  Source     : ${a?.source_record_id ?? "—"} · ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
