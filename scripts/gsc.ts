// Google Search Console stats in the terminal (same data as /admin/seo). Auth: see src/lib/gsc.ts.
//   npx tsx scripts/gsc.ts --sites                         list the properties the account can read
//   npx tsx scripts/gsc.ts [--dims page|query|date|page,query] [--days 28] [--page /article/] [--query préavis] [--limit 25]
// Data lags ~2 days behind today.
try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const { gscDay, gscPath, gscQuery, gscSections, gscSites } = await import("../src/lib/gsc");
  const argv = process.argv.slice(2);
  const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

  if (argv.includes("--sites")) {
    for (const s of await gscSites()) console.log(`${s.siteUrl}  (${s.permissionLevel})`);
    return;
  }
  const dims = opt("dims", "page").split(",");
  const days = Number(opt("days", "28"));
  const page = opt("page", "") || undefined;
  const query = opt("query", "") || undefined;
  const all = (await gscQuery({ days, dims, page, query })).sort((a, b) =>
    dims[0] === "date" ? a.keys[0].localeCompare(b.keys[0]) : b.clicks - a.clicks || b.impressions - a.impressions,
  );

  console.log(`${gscDay(days)} → ${gscDay(0)} · ${dims.join(", ")}${page || query ? ` · filtre ${[page, query].filter(Boolean).join(", ")}` : ""}\n`);
  if (dims.join() === "page") {
    for (const s of gscSections(all)) console.log(`${s.section.padEnd(20)} ${String(s.pages).padStart(4)} pages  ${String(s.impressions).padStart(6)} impr.  ${s.clicks} clics`);
    console.log("");
  }
  console.log("clics  impr.   CTR    pos.  " + dims.join(" | "));
  for (const x of all.slice(0, Number(opt("limit", "25")))) {
    console.log(`${String(x.clicks).padStart(5)}  ${String(x.impressions).padStart(6)}  ${(x.ctr * 100).toFixed(1).padStart(4)}%  ${x.position.toFixed(1).padStart(5)}  ${x.keys.map(gscPath).join(" | ")}`);
  }
  const sum = (k: "clicks" | "impressions") => all.reduce((n, x) => n + x[k], 0);
  console.log(`\nTotal : ${all.length} lignes, ${sum("clicks")} clics, ${sum("impressions")} impressions`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
