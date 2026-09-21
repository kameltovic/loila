import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { gscConfigured, gscDay, gscPath, gscQuery, gscSections, gscTotals, type GscRow } from "@/lib/gsc";
import { CODES } from "@/lib/themes";
import { container, display, label } from "@/components/ui";
import { Section, Table } from "../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO · Admin", robots: { index: false, follow: false } };

const PERIODS = [7, 28, 90];
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const num = (x: number) => x.toLocaleString("fr-FR");

/** "/article/LEGIARTI…" → "Art. 1376 · Code civil", so the table is readable. */
function articleLabels(paths: string[]) {
  const ids = paths.map((p) => p.match(/^\/article\/([A-Z0-9]+)/)?.[1]).filter((x): x is string => !!x);
  if (!ids.length) return new Map<string, string>();
  const rows = getDb().prepare(`SELECT id, num, code FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as { id: string; num: string; code: string }[];
  return new Map(rows.map((r) => [r.id, `Art. ${r.num} · ${(CODES[r.code as keyof typeof CODES]?.name ?? r.code).replace(/ \(.*\)$/, "")}`]));
}

export default async function AdminSeo({ searchParams }: { searchParams: Promise<{ days?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 28;
  const page = sp.page?.trim() || undefined;

  const head = (
    <>
      <p className={`${label} text-fg-2`}>
        <Link href="/admin" className="underline underline-offset-4">Admin</Link> / SEO
      </p>
      <h1 className={`${display} mt-4 text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92]`}>Google Search</h1>
    </>
  );

  if (!gscConfigured()) {
    return (
      <section className={`${container} pt-10 pb-20`}>
        {head}
        <p className="mt-6 max-w-2xl border-2 border-fg bg-surface p-5">
          Search Console n’est pas configuré sur ce serveur : ajoutez <code>GSC_CLIENT_ID</code>, <code>GSC_CLIENT_SECRET</code> et{" "}
          <code>GSC_REFRESH_TOKEN</code> (obtenu avec <code>npx tsx scripts/gsc-auth.ts</code>) aux variables d’environnement.
        </p>
      </section>
    );
  }

  let daily: GscRow[], pages: GscRow[], queries: GscRow[];
  try {
    [daily, pages, queries] = await Promise.all([
      gscQuery({ days, dims: ["date"], page }),
      gscQuery({ days, dims: ["page"], page }),
      gscQuery({ days, dims: ["query"], page }),
    ]);
  } catch (e) {
    return (
      <section className={`${container} pt-10 pb-20`}>
        {head}
        <p role="alert" className="mt-6 border-2 border-fg bg-surface p-5 font-mono text-sm">{e instanceof Error ? e.message : String(e)}</p>
      </section>
    );
  }

  // Google omits days without impressions: fill them so gaps stay visible.
  const byDate = new Map(daily.map((d) => [d.keys[0], d]));
  daily = Array.from({ length: days + 1 }, (_, i) => gscDay(days - i)).map((k) => byDate.get(k) ?? { keys: [k], clicks: 0, impressions: 0, ctr: 0, position: 0 });
  const byImpr = (a: GscRow, b: GscRow) => b.clicks - a.clicks || b.impressions - a.impressions;
  pages.sort(byImpr);
  queries.sort(byImpr);
  const totals = gscTotals(daily);
  const sections = gscSections(pages);
  const topPages = pages.slice(0, 50);
  const labels = articleLabels(topPages.map((p) => gscPath(p.keys[0])));
  const max = Math.max(1, ...daily.map((d) => d.impressions));
  const link = (over: { days?: number; page?: string | null }) => {
    const q = new URLSearchParams();
    const d = over.days ?? days;
    const p = over.page === null ? undefined : (over.page ?? page);
    if (d !== 28) q.set("days", String(d));
    if (p) q.set("page", p);
    return `/admin/seo${q.size ? `?${q}` : ""}`;
  };

  return (
    <section className={`${container} pt-10 pb-20`}>
      {head}
      <p className="mt-3 text-fg-2">
        Du {new Date(gscDay(days)).toLocaleDateString("fr-FR")} au {new Date(gscDay(0)).toLocaleDateString("fr-FR")} · données Google avec 2 à 3 jours de retard
        {page && <> · pages contenant <strong className="text-fg">{page}</strong></>}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((d) => (
          <Link key={d} href={link({ days: d })} className={`border-2 border-fg px-2.5 py-1 font-mono text-xs uppercase ${d === days ? "bg-fg text-bg" : "bg-bg"}`}>
            {d} jours
          </Link>
        ))}
        {["/article/", "/sujets/", "/modeles-lettres/"].map((p) => (
          <Link key={p} href={link({ page: page === p ? null : p })} className={`border-2 border-fg px-2.5 py-1 font-mono text-xs ${page === p ? "bg-fg text-bg" : "bg-bg"}`}>
            {p}
          </Link>
        ))}
        <form action="/admin/seo" className="flex gap-2">
          {days !== 28 && <input type="hidden" name="days" value={days} />}
          <input name="page" defaultValue={page} placeholder="filtrer les URL…" aria-label="Filtrer les URL" className="border-2 border-fg bg-bg px-2.5 py-1 font-mono text-xs" />
        </form>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Clics", num(totals.clicks)],
          ["Impressions", num(totals.impressions)],
          ["CTR", pct(totals.ctr)],
          ["Position moyenne", totals.position ? totals.position.toFixed(1) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 border-2 border-fg bg-surface p-4">
            <p className={`${label} text-fg-2`}>{k}</p>
            <p className={`${display} mt-2 text-3xl`}>{v}</p>
          </div>
        ))}
      </div>

      <Section title="Impressions par jour">
        {totals.impressions ? (
          <figure className="border-2 border-fg bg-surface p-4 sm:p-6">
            <div className="flex h-48 items-end gap-[2px]" role="img" aria-label={`Impressions par jour, maximum ${num(max)}`}>
              {daily.map((d) => (
                <div key={d.keys[0]} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
                  <div className="w-full rounded-t-[4px] bg-fg group-hover:bg-signal group-focus:bg-signal" style={{ height: d.impressions ? `${Math.max(2, (d.impressions / max) * 100)}%` : "0" }} />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 border-2 border-fg bg-bg px-2.5 py-1.5 font-mono text-xs whitespace-nowrap group-hover:block group-focus:block">
                    <strong>{new Date(d.keys[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</strong> · {num(d.impressions)} impr. · {d.clicks} clic{d.clicks > 1 ? "s" : ""}{d.impressions > 0 && <> · pos. {d.position.toFixed(1)}</>}
                  </div>
                </div>
              ))}
            </div>
            <figcaption className="mt-2 flex justify-between font-mono text-xs text-fg-2">
              <span>{new Date(daily[0].keys[0]).toLocaleDateString("fr-FR")}</span>
              <span>max {num(max)} / jour</span>
              <span>{new Date(daily.at(-1)!.keys[0]).toLocaleDateString("fr-FR")}</span>
            </figcaption>
          </figure>
        ) : (
          <p className="text-fg-2">Aucune donnée sur la période.</p>
        )}
      </Section>

      <Section title="Par section">
        <Table head={["Section", "Pages vues par Google", "Impressions", "Clics"]}>
          {sections.map((s) => (
            <tr key={s.section}>
              <td><Link href={link({ page: `${s.section}/` })} className="underline underline-offset-2">{s.section}</Link></td>
              <td>{s.pages}</td>
              <td>{num(s.impressions)}</td>
              <td>{s.clicks}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title={`Pages (${pages.length})`}>
        <Table head={["Clics", "Impr.", "CTR", "Pos.", "Page"]}>
          {topPages.map((p) => {
            const path = gscPath(p.keys[0]);
            const art = labels.get(path.split("/")[2] ?? "");
            return (
              <tr key={path}>
                <td>{p.clicks}</td>
                <td>{p.impressions}</td>
                <td>{pct(p.ctr)}</td>
                <td>{p.position.toFixed(1)}</td>
                <td className="font-sans">
                  <a href={path} target="_blank" rel="noopener" className="underline underline-offset-2">{art ?? path}</a>
                  {art && <span className="ml-2 font-mono text-xs text-fg-2">{path}</span>}
                </td>
              </tr>
            );
          })}
        </Table>
        {pages.length > topPages.length && <p className="mt-2 text-sm text-fg-2">50 premières pages sur {pages.length}.</p>}
      </Section>

      <Section title={`Requêtes (${queries.length})`}>
        <p className="mb-4 text-sm text-fg-2">Google masque les requêtes trop rares : leur total est inférieur à celui des pages.</p>
        <Table head={["Clics", "Impr.", "CTR", "Pos.", "Requête"]}>
          {queries.slice(0, 100).map((q) => (
            <tr key={q.keys[0]}>
              <td>{q.clicks}</td>
              <td>{q.impressions}</td>
              <td>{pct(q.ctr)}</td>
              <td>{q.position.toFixed(1)}</td>
              <td className="max-w-[36rem] truncate font-sans">{q.keys[0]}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </section>
  );
}
