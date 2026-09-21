// Google Search Console stats (clicks, impressions, CTR, position), read-only, no key file:
// the logged-in gcloud user impersonates the service account added (Restreint) to the Search Console property.
//   npx tsx scripts/gsc.ts --sites                         list the properties the account can read
//   npx tsx scripts/gsc.ts [--dims page|query|date|page,query] [--days 28] [--page /article/] [--query préavis] [--limit 25]
// Env: GSC_SERVICE_ACCOUNT (default loila-gsc@loila-seo.iam.gserviceaccount.com), GSC_SITE (default: first property).
// Data lags ~2 days behind today.
import { execFileSync } from "node:child_process";

try { process.loadEnvFile(); } catch { /* no .env */ }

const SA = process.env.GSC_SERVICE_ACCOUNT ?? "loila-gsc@loila-seo.iam.gserviceaccount.com";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

const argv = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

function token(): string {
  return execFileSync("gcloud", ["auth", "print-access-token", `--impersonate-service-account=${SA}`, "--scopes=https://www.googleapis.com/auth/webmasters.readonly"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"], // gcloud prints an impersonation warning on stderr
  }).trim();
}

async function api(path: string, auth: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

async function main() {
  const auth = token();
  const sites = ((await api("/sites", auth)).siteEntry ?? []) as { siteUrl: string; permissionLevel: string }[];
  if (argv.includes("--sites") || !sites.length) {
    for (const s of sites) console.log(`${s.siteUrl}  (${s.permissionLevel})`);
    if (!sites.length) console.log(`No property: add ${SA} as a user (Restreint) in Search Console.`);
    return;
  }
  const site = process.env.GSC_SITE ?? sites[0].siteUrl;
  const dims = opt("dims", "page").split(",");
  const days = Number(opt("days", "28"));
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const filters = [
    ...(opt("page", "") ? [{ dimension: "page", operator: "contains", expression: opt("page", "") }] : []),
    ...(opt("query", "") ? [{ dimension: "query", operator: "contains", expression: opt("query", "") }] : []),
  ];
  const { rows = [] } = await api(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, auth, {
    startDate: day(days),
    endDate: day(0),
    dimensions: dims,
    rowLimit: 25_000, // all rows, sorted and cut below
    ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
  });
  // The API sorts by clicks; with few clicks, impressions say more.
  const r = (rows as { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[])
    .sort((a, b) => (dims[0] === "date" ? a.keys[0].localeCompare(b.keys[0]) : b.clicks - a.clicks || b.impressions - a.impressions));
  console.log(`${site} · ${day(days)} → ${day(0)} · ${dims.join(", ")}${filters.length ? ` · filtre ${filters.map((f) => f.expression).join(", ")}` : ""}\n`);
  console.log("clics  impr.   CTR    pos.  " + dims.join(" | "));
  const all = r;
  const top = r.slice(0, Number(opt("limit", "25")));
  if (dims.length === 1 && dims[0] === "page") {
    // Where impressions land, by site section.
    const by = new Map<string, { c: number; i: number; n: number }>();
    for (const x of all) {
      const sec = "/" + (x.keys[0].replace(/^https?:\/\/[^/]+\/?/, "").split("/")[0] || "");
      const v = by.get(sec) ?? { c: 0, i: 0, n: 0 };
      by.set(sec, { c: v.c + x.clicks, i: v.i + x.impressions, n: v.n + 1 });
    }
    for (const [sec, v] of [...by].sort((a, b) => b[1].i - a[1].i)) console.log(`${sec.padEnd(20)} ${String(v.n).padStart(4)} pages  ${String(v.i).padStart(6)} impr.  ${v.c} clics`);
    console.log("");
  }
  for (const x of top) {
    const keys = x.keys.map((k) => k.replace(/^https?:\/\/[^/]+/, "")).join(" | ");
    console.log(`${String(x.clicks).padStart(5)}  ${String(x.impressions).padStart(6)}  ${(x.ctr * 100).toFixed(1).padStart(4)}%  ${x.position.toFixed(1).padStart(5)}  ${keys}`);
  }
  const sum = (k: "clicks" | "impressions") => all.reduce((n, x) => n + x[k], 0);
  console.log(`\nTotal : ${all.length} lignes, ${sum("clicks")} clics, ${sum("impressions")} impressions`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
