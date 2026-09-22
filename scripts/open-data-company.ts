// Sync one company into the local cache: identity + establishments + declared IDCC (DINUM),
// BODACC announcements (DILA), RGE certifications (ADEME). No API key. Run:
//   npx tsx scripts/open-data-company.ts 552081317
//   npx tsx scripts/open-data-company.ts --bodacc-only 552081317
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const arg = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const bodaccOnly = process.argv.includes("--bodacc-only");
  const query = arg[0];
  if (!query) throw new Error("usage: open-data-company.ts <SIREN|SIRET|nom> [--bodacc-only]");
  const { syncCompany, syncBodacc, syncRge, getCompany, companyEstablishments } = await import("../src/lib/company");
  const { isSiret } = await import("../src/lib/company");

  const siren = bodaccOnly ? query.replace(/\D/g, "").slice(0, 9) : await syncCompany(query);
  if (!siren) throw new Error(`aucune entreprise trouvée pour « ${query} »`);
  const c = getCompany(siren);
  console.log(`[open-data-company] ${c?.nom_complet ?? siren} (SIREN ${siren}) · ${c?.etat_administratif === "A" ? "active" : "cessée"}`);

  const siret = isSiret(query) ? query.replace(/\D/g, "") : c?.siege_siret ?? "";
  const [ann, rge] = await Promise.all([
    syncBodacc(siren).catch((e) => { console.error("[bodacc]", e instanceof Error ? e.message : e); return -1; }),
    siret ? syncRge(siret).catch((e) => { console.error("[rge]", e instanceof Error ? e.message : e); return -1; }) : Promise.resolve(0),
  ]);
  console.log(`[open-data-company] annonces BODACC: ${ann} · certifications RGE: ${rge} · établissements: ${companyEstablishments(siren).length}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
