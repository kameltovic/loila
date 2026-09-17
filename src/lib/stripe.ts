import Stripe from "stripe";
import { upsertUser } from "./auth";
import { grantCredits, upsertSubscription } from "./billing";
import { getDb } from "./db";
import { OFFERS, type OfferId } from "./plans";

let client: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return (client ??= new Stripe(key));
}

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);
const offerByLookupKey = (key: string | null | undefined) =>
  (Object.keys(OFFERS) as OfferId[]).find((o) => OFFERS[o].lookupKey === key);

export async function priceFor(offer: OfferId) {
  const { data } = await getStripe().prices.list({ lookup_keys: [OFFERS[offer].lookupKey], active: true, limit: 1 });
  if (!data[0]) throw new Error(`Stripe price not found for ${offer}`);
  return data[0];
}

// First customer wins; never steal a customer id already linked to someone else.
function linkCustomer(userId: number, customerId: string | null) {
  if (!customerId) return;
  getDb()
    .prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE stripe_customer_id = ?)")
    .run(customerId, userId, customerId);
}

async function userForCustomer(customerId: string, stripe?: Stripe): Promise<number | null> {
  const row = getDb().prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(customerId) as { id: number } | undefined;
  if (row) return row.id;
  if (!stripe) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) return null;
  const userId = upsertUser(customer.email);
  linkCustomer(userId, customerId);
  return userId;
}

type Legacy = { current_period_start: number; current_period_end: number; subscription?: string | { id: string } | null };
const legacy = (o: object) => o as Legacy;

export async function syncSubscription(sub: Stripe.Subscription, stripe?: Stripe) {
  const customerId = idOf(sub.customer);
  const userId = customerId ? await userForCustomer(customerId, stripe) : null;
  const item = sub.items.data[0];
  const plan = offerByLookupKey(item?.price.lookup_key);
  if (!userId || !item || !plan || OFFERS[plan].kind !== "subscription") {
    console.warn("[stripe] subscription not synced", sub.id);
    return;
  }
  upsertSubscription({
    userId, stripeSubscriptionId: sub.id, plan, status: sub.status,
    // Pre-2025-03-31 API versions (older webhook endpoints) carry the period on the subscription itself.
    periodStart: item.current_period_start ?? legacy(sub).current_period_start,
    periodEnd: item.current_period_end ?? legacy(sub).current_period_end,
  });
}

// Shared by the webhook and /api/checkout/return (whichever comes first). Returns the buyer's user id.
export async function fulfillCheckout(session: Stripe.Checkout.Session, stripe?: Stripe): Promise<number | null> {
  if (session.status !== "complete" || session.payment_status === "unpaid") return null;
  const email = session.customer_details?.email ?? session.customer_email;
  const metaUser = Number(session.metadata?.user_id) || null;
  const known = metaUser && getDb().prepare("SELECT id FROM users WHERE id = ?").get(metaUser) ? metaUser : null;
  const userId = known ?? (email ? upsertUser(email) : null);
  if (!userId) return null;
  linkCustomer(userId, idOf(session.customer));
  const offer = session.metadata?.offer as OfferId | undefined;
  if (session.mode === "payment" && offer === "single") grantCredits(userId, OFFERS.single.credits, session.id);
  const subId = idOf(session.subscription);
  if (session.mode === "subscription" && subId && stripe) {
    await syncSubscription(typeof session.subscription === "object" && session.subscription ? session.subscription : await stripe.subscriptions.retrieve(subId), stripe);
  }
  return userId;
}

export async function handleStripeEvent(event: Stripe.Event, stripe?: Stripe) {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM stripe_events WHERE id = ?").get(event.id)) return "duplicate";
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckout(event.data.object, stripe);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object, stripe);
      break;
    case "invoice.paid": {
      const subId = idOf(event.data.object.parent?.subscription_details?.subscription ?? legacy(event.data.object).subscription);
      if (subId && stripe) await syncSubscription(await stripe.subscriptions.retrieve(subId), stripe);
      break;
    }
    default:
      return "ignored";
  }
  // Recorded after success so a failed handling is retried by Stripe; grants are idempotent anyway.
  db.prepare("INSERT OR IGNORE INTO stripe_events (id) VALUES (?)").run(event.id);
  return "handled";
}
