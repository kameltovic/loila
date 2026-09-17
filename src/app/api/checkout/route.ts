import { getIdentity, sameOrigin, appUrl, clientIp, rateLimited } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { OFFERS, type OfferId } from "@/lib/plans";
import { getStripe, priceFor } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`checkout:${clientIp(request)}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
  }
  let offer: unknown;
  try {
    offer = (await request.json())?.offer;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof offer !== "string" || !Object.hasOwn(OFFERS, offer)) return Response.json({ error: "Offre inconnue." }, { status: 400 });
  const offerId = offer as OfferId;

  try {
    const id = await getIdentity(request);
    const customer = id.userId
      ? (getDb().prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(id.userId) as { stripe_customer_id: string | null }).stripe_customer_id
      : null;
    const price = await priceFor(offerId); // amount always comes from Stripe
    const base = appUrl(request);
    const subscription = OFFERS[offerId].kind === "subscription";
    const session = await getStripe().checkout.sessions.create({
      mode: subscription ? "subscription" : "payment",
      line_items: [{ price: price.id, quantity: 1 }],
      ...(customer ? { customer } : id.email ? { customer_email: id.email } : {}),
      ...(!subscription && !customer ? { customer_creation: "always" as const } : {}),
      allow_promotion_codes: true,
      locale: "fr",
      metadata: { offer: offerId, ...(id.userId ? { user_id: String(id.userId) } : {}) },
      success_url: `${base}/api/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/tarifs?annule=1`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[api/checkout]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Le paiement est momentanément indisponible." }, { status: 503 });
  }
}
