// Google Search Console → one CSV ready for a spreadsheet: npm run gsc:export [-- --days 28] [--out chemin.csv]
// Stacked tables (par jour, par heure en heure de Paris, par section, top pages, top requêtes), séparateur virgule,
// nombres au format français. Auth : voir src/lib/gsc.ts. Les 2 derniers jours sont provisoires (Google les recalcule).
export {}; // module scope: every script declares its own main()
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
try { process.loadEnvFile(); } catch { /* no .env */ }

const PARIS = "Europe/Paris";
const csv = (v: unknown) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v ?? ""));
const num = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const pct = (n: number) => `${num(n * 100)} %`;

async function main() {
  const { gscDay, gscPath, gscQuery, gscRaw } = await import("../src/lib/gsc");
  const argv = process.argv.slice(2);
  const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const days = Number(opt("days", "28"));
  const out = opt("out", path.join(os.tmpdir(), `loila-gsc-${gscDay(0)}.csv`));

  const [byDay, byPage, byQuery, byHour] = await Promise.all([
    gscQuery({ days, dims: ["date"] }),
    gscQuery({ days, dims: ["page"] }),
    gscQuery({ days, dims: ["query"] }),
    gscRaw({ startDate: gscDay(2), endDate: gscDay(0), dimensions: ["hour"], dataState: "hourly_all", rowLimit: 200 }),
  ]);

  const rows: unknown[][] = [];
  const table = (title: string, headers: string[], body: unknown[][]) => rows.push([], [title], headers, ...body);
  const day = byDay.rows.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const provisional = day.slice(-2).map((r) => r.keys[0]);

  rows.push(["Loilà · Google Search Console", `export du ${new Date().toLocaleString("fr-FR", { timeZone: PARIS })}`, "2 derniers jours provisoires"]);
  table("PAR JOUR", ["Date", "Impressions", "Clics", "CTR", "Position moyenne", "Statut"],
    day.map((r) => [r.keys[0], r.impressions, r.clicks, pct(r.ctr), num(r.position), provisional.includes(r.keys[0]) ? "provisoire" : "définitif"]));

  table("PAR HEURE (heure de Paris)", ["Date", "Heure", "Impressions", "Clics", "Position moyenne"],
    byHour.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).map((r) => {
      const t = new Date(r.keys[0]);
      const f = (o: Intl.DateTimeFormatOptions) => t.toLocaleString("fr-CA", { timeZone: PARIS, ...o });
      return [f({ dateStyle: "short" }), `${f({ hour: "2-digit", hour12: false }).replace(/\D/g, "")}h`, r.impressions, r.clicks, num(r.position)];
    }));

  const sections = new Map<string, { pages: number; impressions: number; clicks: number; weighted: number }>();
  for (const r of byPage.rows) {
    const s = `/${gscPath(r.keys[0]).split("/")[1] ?? ""}`;
    const a = sections.get(s) ?? { pages: 0, impressions: 0, clicks: 0, weighted: 0 };
    sections.set(s, { pages: a.pages + 1, impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks, weighted: a.weighted + r.position * r.impressions });
  }
  table(`PAR SECTION (${days} jours)`, ["Section", "Pages", "Impressions", "Clics", "CTR", "Position moyenne"],
    [...sections].sort((a, b) => b[1].impressions - a[1].impressions)
      .map(([s, a]) => [s, a.pages, a.impressions, a.clicks, pct(a.impressions ? a.clicks / a.impressions : 0), a.impressions ? num(a.weighted / a.impressions) : ""]));

  const top = 60;
  table(`TOP ${top} PAGES (${days} jours)`, ["Page", "Impressions", "Clics", "Position moyenne"],
    byPage.rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, top)
      .map((r) => [gscPath(r.keys[0]), r.impressions, r.clicks, num(r.position)]));

  // Long queries are pasted texts (letters, personal messages): they say nothing useful and may carry personal data.
  table(`TOP ${top} REQUÊTES (${days} jours)`, ["Requête", "Impressions", "Clics", "Position moyenne"],
    byQuery.rows.filter((r) => r.keys[0].length <= 90).sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks).slice(0, top)
      .map((r) => [r.keys[0], r.impressions, r.clicks, num(r.position)]));

  fs.writeFileSync(out, rows.map((r) => r.map(csv).join(",")).join("\n"));
  const total = (k: "clicks" | "impressions") => day.reduce((n, r) => n + r[k], 0);
  console.log(`${out}\n${day.length} jours, ${total("impressions")} impressions, ${total("clicks")} clics · ${byPage.rows.length} pages, ${byQuery.rows.length} requêtes`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
