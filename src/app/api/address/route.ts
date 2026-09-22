import { clientIp, rateLimited, sameOrigin } from "@/lib/auth";
import { geocode, syncAddressFull } from "@/lib/address";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Address lookup for the "Vérifier un bien" tool.
 * A precise address (geocoder returns a housenumber): cache the whole chain and return its BAN id.
 * An ambiguous or name-like query: return up to 5 candidates from the geocoder, none stored.
 * Rate-limited; the Géoplateforme allows 50 calls/s per IP, a single lookup is well inside.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  // A lookup triggers up to 6 upstream calls + writes: keep it tight (in-memory, single instance).
  if (rateLimited(`address:${clientIp(request)}`, 10, 60_000)) {
    return Response.json({ error: "Trop de recherches en une minute, réessayez dans un instant." }, { status: 429 });
  }
  // Global ceiling on upstream calls + writes, whatever the IP rotation (bounds cache growth per hour).
  if (rateLimited("address:all", 200, 3_600_000)) {
    return Response.json({ error: "Service très sollicité, réessayez plus tard." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { q?: string } | null;
  const q = (body?.q ?? "").trim().slice(0, 160);
  if (q.length < 3 || !/[\p{L}\d]/u.test(q)) return Response.json({ error: "Entrez une adresse (numéro, voie, code postal et ville)." }, { status: 400 });

  try {
    const candidates = await geocode(q, 5);
    if (candidates.length === 0) return Response.json({ results: [] });
    const best = candidates[0];
    // Housenumber with a decent score: precise enough to sync. Otherwise let the user pick.
    const precise = best.type === "housenumber" && (best.score ?? 0) >= 0.4;
    if (!precise) {
      return Response.json({
        results: candidates.map((c) => ({ banId: c.banId, label: c.label, postcode: c.postcode, city: c.city, type: c.type })),
      });
    }
    getDb(); // ensure the schema exists before the sync writes
    const summary = await syncAddressFull(q);
    if (!summary) return Response.json({ results: [] });
    return Response.json({ banId: summary.banId });
  } catch (e) {
    console.error("[api/address]", e instanceof Error ? e.message : e);
    return Response.json({ error: "La source officielle n'a pas répondu. Réessayez dans un instant." }, { status: 502 });
  }
}
