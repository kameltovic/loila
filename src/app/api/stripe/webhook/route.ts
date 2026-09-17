import { getStripe, handleStripeEvent } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return Response.json({ error: "missing signature" }, { status: 400 });
  const raw = await request.text(); // raw body: required for signature verification
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }
  try {
    return Response.json({ received: true, result: await handleStripeEvent(event, stripe) });
  } catch (e) {
    console.error("[stripe/webhook]", event.type, event.id, e instanceof Error ? e.message : e);
    return Response.json({ error: "handler failed" }, { status: 500 }); // Stripe retries
  }
}
