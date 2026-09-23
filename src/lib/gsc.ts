// Google Search Console, read-only (webmasters.readonly).
// Production: an OAuth refresh token limited to that scope (GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REFRESH_TOKEN,
// written by scripts/gsc-auth.ts). Local fallback: the logged-in gcloud user impersonates GSC_SERVICE_ACCOUNT
// (the org blocks service-account keys).
import { execFileSync } from "node:child_process";

const API = "https://searchconsole.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SA = process.env.GSC_SERVICE_ACCOUNT ?? "loila-gsc@loila-seo.iam.gserviceaccount.com";

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export const gscConfigured = () => !!process.env.GSC_REFRESH_TOKEN?.trim() || process.env.NODE_ENV !== "production";

// Hosting panels and env files sometimes keep quotes or a trailing space/newline around pasted values.
const env = (k: string) => process.env[k]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;
/** Safe fingerprint of a secret for error messages: length and first 4 characters, never the value. */
const shape = (k: string) => `${k}: ${env(k) ? `${env(k)!.length} car., commence par « ${env(k)!.slice(0, 4)} »` : "absent"}`;

let cached: { token: string; until: number } | undefined;
async function token(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const [GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN] = [env("GSC_CLIENT_ID"), env("GSC_CLIENT_SECRET"), env("GSC_REFRESH_TOKEN")];
  if (GSC_REFRESH_TOKEN && GSC_CLIENT_ID && GSC_CLIENT_SECRET) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: GSC_CLIENT_ID, client_secret: GSC_CLIENT_SECRET, refresh_token: GSC_REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
    if (!res.ok) {
      throw new Error(
        `Google OAuth ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)} · ` +
          ["GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN"].map(shape).join(" · "),
      );
    }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  } else {
    const t = execFileSync("gcloud", ["auth", "print-access-token", `--impersonate-service-account=${SA}`, `--scopes=${SCOPE}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"], // gcloud prints an impersonation warning on stderr
    }).trim();
    cached = { token: t, until: Date.now() + 50 * 60_000 };
  }
  return cached.token;
}

async function api(path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function gscSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  return (await api("/sites")).siteEntry ?? [];
}

/** This site's property: GSC_SITE, else the one matching SITE_URL's domain (the OAuth account may own several sites). */
export async function gscSite(): Promise<string> {
  if (process.env.GSC_SITE) return process.env.GSC_SITE;
  const host = new URL(process.env.SITE_URL ?? "https://loila.fr").hostname.replace(/^www\./, "");
  const sites = await gscSites();
  const site = sites.find((s) => s.siteUrl === `sc-domain:${host}`) ?? sites.find((s) => new RegExp(`^https?://(www\\.)?${host.replace(/\./g, "\\.")}/`).test(s.siteUrl));
  if (!site) throw new Error(`No Search Console property for ${host} (visible: ${sites.map((s) => s.siteUrl).join(", ") || "none"}).`);
  return site.siteUrl;
}

export const gscDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

// ponytail: in-memory 15 min cache per query (single instance, a few admin views a day).
const memo = new Map<string, { at: number; rows: GscRow[]; incompleteFrom: string | null }>();

/**
 * All rows (up to 25k) for the period, unsorted. `page`/`query`: "contains" filters.
 * dataState "all" = what the Search Console UI shows, including the last provisional days ("final" alone lags 2-3 days).
 * incompleteFrom: first day still provisional (Google revises it for ~2-3 days, up or down); only sent for date queries.
 */
export async function gscQuery({ days, dims, page, query }: { days: number; dims: string[]; page?: string; query?: string }): Promise<{ rows: GscRow[]; incompleteFrom: string | null }> {
  const site = await gscSite();
  const key = JSON.stringify([site, days, dims, page, query]);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit;
  const filters = [
    ...(page ? [{ dimension: "page", operator: "contains", expression: page }] : []),
    ...(query ? [{ dimension: "query", operator: "contains", expression: query }] : []),
  ];
  const { rows = [], metadata } = await api(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    startDate: gscDay(days),
    endDate: gscDay(0),
    dimensions: dims,
    rowLimit: 25_000,
    dataState: "all",
    ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
  });
  const out = { at: Date.now(), rows: rows as GscRow[], incompleteFrom: (metadata?.firstIncompleteDate as string | undefined) ?? null };
  memo.set(key, out);
  return out;
}

/** Raw Search Console query, for what gscQuery does not cover (hourly view: dimension "hour" + dataState "hourly_all"). */
export async function gscRaw(body: object): Promise<GscRow[]> {
  const site = await gscSite();
  const { rows = [] } = await api(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, body);
  return rows as GscRow[];
}

/** "https://loila.fr/article/code-civil/1643" → "/article/code-civil/1643". */
export const gscPath = (url: string) => url.replace(/^https?:\/\/[^/]+/, "") || "/";

/** Totals and per-section rollup of page rows ("/article", "/sujets"…). */
export function gscSections(rows: GscRow[]) {
  const by = new Map<string, { section: string; pages: number; clicks: number; impressions: number }>();
  for (const r of rows) {
    const section = "/" + (gscPath(r.keys[0]).split("/")[1] ?? "");
    const v = by.get(section) ?? { section, pages: 0, clicks: 0, impressions: 0 };
    by.set(section, { section, pages: v.pages + 1, clicks: v.clicks + r.clicks, impressions: v.impressions + r.impressions });
  }
  return [...by.values()].sort((a, b) => b.impressions - a.impressions);
}

/** Impression-weighted average position (what Search Console shows as "position moyenne"). */
export function gscTotals(rows: GscRow[]) {
  const clicks = rows.reduce((n, r) => n + r.clicks, 0);
  const impressions = rows.reduce((n, r) => n + r.impressions, 0);
  const position = impressions ? rows.reduce((n, r) => n + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
}
