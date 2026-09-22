import { clientIp, rateLimited, sameOrigin } from "@/lib/auth";
import { cacheCompanyHit, companyFresh, getCompany, isSiren, isSiret, searchCompanies, syncBodacc, syncCompany, syncRge } from "@/lib/company";
import { fetchJson } from "@/lib/sources";

export const dynamic = "force-dynamic";

const RE_BASE = "https://recherche-entreprises.api.gouv.fr";

type Hit = { siren: string; nom_complet: string | null; etat_administratif: string | null; activite_principale: string | null; siege_siret: string | null };

/**
 * Company lookup for the "Vérifier une entreprise" tool.
 * - SIREN/SIRET: enrich the local cache once (identity + IDCC), plus BODACC/RGE, then return it.
 * - name: search the local cache; fall back to the official DINUM search (results are not stored
 *   one by one here, the detail page syncs the chosen SIREN).
 * Rate-limited; the DINUM API allows 7 req/s so a single lookup stays well inside.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`company:${clientIp(request)}`, 30, 60_000)) {
    return Response.json({ error: "Trop de recherches en une minute, réessayez dans un instant." }, { status: 429 });
  }
  // Global ceiling on upstream calls + writes, whatever the IP rotation (bounds cache growth per hour).
  if (rateLimited("company:all", 600, 3_600_000)) {
    return Response.json({ error: "Service très sollicité, réessayez plus tard." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { q?: string } | null;
  const q = (body?.q ?? "").trim().slice(0, 120);
  if (q.length < 2 || !/[\p{L}\d]/u.test(q)) return Response.json({ error: "Entrez un nom, un SIREN ou un SIRET." }, { status: 400 });

  try {
    if (isSiren(q) || isSiret(q)) {
      let siren = await syncCompany(q);
      if (!siren) return Response.json({ results: [] });
      const c = getCompany(siren);
      if (c && !companyFresh(c)) siren = (await syncCompany(q)) ?? siren; // refresh a stale cache once
      const refreshed = getCompany(siren);
      const siret = isSiret(q) ? q.replace(/\D/g, "") : refreshed?.siege_siret ?? "";
      await Promise.all([
        syncBodacc(siren).catch(() => 0),
        siret ? syncRge(siret).catch(() => 0) : Promise.resolve(0),
      ]);
      return Response.json({ siren });
    }

    const local = searchCompanies(q, 10);
    if (local.length) return Response.json({ results: local });
    const data = await fetchJson<{ results?: { siren: string; nom_complet?: string; etat_administratif?: string; activite_principale?: string; siege?: { siret?: string } }[] }>(
      `${RE_BASE}/search?q=${encodeURIComponent(q)}&per_page=10`,
    );
    const results: Hit[] = (data.results ?? []).map((r) => ({
      siren: r.siren,
      nom_complet: r.nom_complet ?? null,
      etat_administratif: r.etat_administratif ?? null,
      activite_principale: r.activite_principale ?? null,
      siege_siret: r.siege?.siret ?? null,
    }));
    // Cache the identity of each hit so its detail page renders without a live call (stays noindex: no block).
    for (const hit of results) cacheCompanyHit(hit);
    return Response.json({ results });
  } catch (e) {
    console.error("[api/company]", e instanceof Error ? e.message : e);
    return Response.json({ error: "La source officielle n'a pas répondu. Réessayez dans un instant." }, { status: 502 });
  }
}
