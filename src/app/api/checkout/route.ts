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
  let waiver: unknown;
  try {
    ({ offer, waiver } = (await request.json()) ?? {});
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof offer !== "string" || !Object.hasOwn(OFFERS, offer) || !OFFERS[offer as OfferId].available) {
    return Response.json({ error: "Offre indisponible." }, { status: 400 });
  }
  const offerId = offer as OfferId;
  // Digital content supplied immediately: the withdrawal right is lost only with prior express consent + waiver
  // (art. L221-28 13° Code de la consommation), collected by a checkbox before redirecting to Stripe.
  if (OFFERS[offerId].kind === "one_time" && waiver !== true) {
    return Response.json({ error: "Cochez la case pour demander l’accès immédiat à vos questions." }, { status: 400 });
  }

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
      metadata: {
        offer: offerId,
        ...(id.userId ? { user_id: String(id.userId) } : {}),
        ...(waiver === true ? { withdrawal_waiver_at: new Date().toISOString() } : {}), // proof of consent
      },
      ...(!subscription
        ? { custom_text: { submit: { message: "Accès immédiat à vos questions : vous avez renoncé à votre droit de rétractation de 14 jours." } } }
        : {}),
      success_url: `${base}/api/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/tarifs?annule=1`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[api/checkout]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Le paiement est momentanément indisponible." }, { status: 503 });
  }
}
