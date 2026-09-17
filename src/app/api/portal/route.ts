import { appUrl, getIdentity, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const id = await getIdentity(request);
  if (!id.userId) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const row = getDb().prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(id.userId) as { stripe_customer_id: string | null };
  if (!row.stripe_customer_id) return Response.json({ error: "Aucun abonnement ni achat associé à ce compte." }, { status: 404 });
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${appUrl(request)}/compte`, locale: "fr",
      // Dedicated Loilà portal config: the account's default one belongs to other businesses.
      ...(process.env.STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION } : {}) });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[api/portal]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Le portail de facturation est momentanément indisponible." }, { status: 503 });
  }
}
