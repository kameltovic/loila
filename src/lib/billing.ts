import type { Identity } from "./auth";
import { getDb } from "./db";
import { FREE_QUESTIONS, OFFERS, type Me, type OfferId } from "./plans";

type SubRow = { plan: OfferId; current_period_start: number; current_period_end: number };
const ACTIVE = ["active", "trialing"];

const now = () => Math.floor(Date.now() / 1000);
const count = (sql: string, ...args: unknown[]) => (getDb().prepare(sql).get(...args) as { n: number }).n;
const countUsage = (subject: string, kind: string, since = 0) =>
  count("SELECT COUNT(*) n FROM usage WHERE subject = ? AND kind = ? AND created_at >= ?", subject, kind, since);

function activeSub(userId: number, at: number): SubRow | undefined {
  const row = getDb()
    .prepare("SELECT plan, status, current_period_start, current_period_end FROM subscriptions WHERE user_id = ?")
    .get(userId) as (SubRow & { status: string }) | undefined;
  return row && ACTIVE.includes(row.status) && row.current_period_end > at && OFFERS[row.plan]?.kind === "subscription" ? row : undefined;
}

// Usable batch expiring first (credits_left > 0, not expired at `at`).
const nextBatch = (userId: number, at: number) =>
  getDb()
    .prepare("SELECT id, expires_at FROM credit_batches WHERE user_id = ? AND credits_left > 0 AND expires_at > ? ORDER BY expires_at, id LIMIT 1")
    .get(userId, at) as { id: number; expires_at: number } | undefined;

export function getMe(id: Identity, at = now()): Me {
  const sub = id.userId ? activeSub(id.userId, at) : undefined;
  const subOffer = sub ? OFFERS[sub.plan] : undefined;
  const monthlyLimit = subOffer?.kind === "subscription" ? subOffer.monthlyQuota : 0;
  const monthlyUsed = sub ? countUsage(`user:${id.userId}`, "sub", sub.current_period_start) : 0;
  const credits = id.userId ? count("SELECT COALESCE(SUM(credits_left), 0) n FROM credit_batches WHERE user_id = ? AND expires_at > ?", id.userId, at) : 0;
  const batch = id.userId ? nextBatch(id.userId, at) : undefined;
  // Free questions are bound to the account: signing up is required before asking. Anonymous visitors
  // still see the offer (freeLeft = FREE_QUESTIONS) but cannot spend it until they register.
  const freeUsed = id.userId ? countUsage(`user:${id.userId}`, "free") : 0;
  const freeLeft = Math.max(0, FREE_QUESTIONS - freeUsed);
  return {
    email: id.email,
    plan: sub ? "pro" : "free",
    credits,
    creditsExpireAt: batch ? new Date(batch.expires_at * 1000).toISOString() : null,
    freeLeft,
    monthlyUsed,
    monthlyLimit,
    periodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    canAsk: !!id.userId && (monthlyUsed < monthlyLimit || credits > 0 || freeLeft > 0),
  };
}

// Charge one generated answer: subscription quota, then the non-expired credit batch expiring first, then free questions.
// Synchronous transaction: re-reads balances inside, so concurrent requests can't spend the same unit twice.
export function consume(id: Identity, at = now()): "sub" | "credit" | "free" | null {
  const userId = id.userId;
  if (!userId) return null; // asking requires an account
  const db = getDb();
  const insert = db.prepare("INSERT INTO usage (subject, kind, created_at, batch_id) VALUES (?, ?, ?, ?)");
  return db.transaction(() => {
    const me = getMe(id, at);
    if (me.monthlyUsed < me.monthlyLimit) {
      insert.run(`user:${userId}`, "sub", at, null);
      return "sub" as const;
    }
    const batch = nextBatch(userId, at);
    if (batch) {
      db.prepare("UPDATE credit_batches SET credits_left = credits_left - 1 WHERE id = ? AND credits_left > 0").run(batch.id);
      insert.run(`user:${userId}`, "credit", at, batch.id);
      return "credit" as const;
    }
    if (me.freeLeft > 0) {
      insert.run(`user:${userId}`, "free", at, null);
      return "free" as const;
    }
    return null;
  }).immediate();
}

// Idempotent: stripe_ref (checkout session id) is UNIQUE. `purchasedAt` is the Stripe purchase time, so a
// delayed or replayed webhook yields the same expiry.
export function grantBatch(userId: number, credits: number, purchasedAt: number, validityDays: number, stripeRef: string) {
  return getDb()
    .prepare(
      "INSERT INTO credit_batches (user_id, credits_granted, credits_left, expires_at, stripe_ref, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_ref) DO NOTHING",
    )
    .run(userId, credits, credits, purchasedAt + validityDays * 86400, stripeRef, purchasedAt).changes > 0;
}

export function upsertSubscription(s: {
  userId: number; stripeSubscriptionId: string; plan: string; status: string; periodStart: number; periodEnd: number;
}) {
  getDb()
    .prepare(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id = excluded.stripe_subscription_id, plan = excluded.plan,
         status = excluded.status, current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end
       -- a stale event for an old subscription must not overwrite a newer active one
       WHERE subscriptions.stripe_subscription_id = excluded.stripe_subscription_id OR subscriptions.status NOT IN ('active', 'trialing')
         OR excluded.status IN ('active', 'trialing')`,
    )
    .run(s.userId, s.stripeSubscriptionId, s.plan, s.status, s.periodStart, s.periodEnd);
}
