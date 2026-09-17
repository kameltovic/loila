import { appUrl, startSession } from "@/lib/auth";
import { fulfillCheckout, getStripe } from "@/lib/stripe";

// Stripe redirects here after payment: grant (idempotent, in case the webhook is late) and log the buyer in.
export async function GET(request: Request) {
  const base = appUrl(request);
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId?.startsWith("cs_")) return Response.redirect(new URL("/tarifs", base), 303);
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = await fulfillCheckout(session, stripe);
    // The session id doubles as a login credential: only honour it shortly after checkout.
    if (userId && Date.now() / 1000 - session.created > 24 * 3600) return Response.redirect(new URL("/connexion", base), 303);
    if (!userId) return Response.redirect(new URL("/merci?ok=0", base), 303);
    await startSession(userId);
    return Response.redirect(new URL("/merci?ok=1", base), 303);
  } catch (e) {
    console.error("[api/checkout/return]", e instanceof Error ? e.message : e);
    return Response.redirect(new URL("/merci?ok=0", base), 303);
  }
}
