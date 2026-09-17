import { clientIp, isEmail, rateLimited, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Pro offer isn't sold yet: collect interest. Re-joining updates the trade.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`waitlist:${clientIp(request)}`, 10, 60 * 60_000)) {
    return Response.json({ error: "Trop de demandes, réessayez plus tard." }, { status: 429 });
  }
  let body: { email?: unknown; metier?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const metier = typeof body.metier === "string" ? body.metier.trim().slice(0, 120) || null : null;
  getDb()
    .prepare("INSERT INTO pro_waitlist (email, metier) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET metier = COALESCE(excluded.metier, pro_waitlist.metier)")
    .run(email, metier);
  return Response.json({ ok: true, message: "C’est noté : vous serez prévenu dès l’ouverture de l’offre Pro." });
}
