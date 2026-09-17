import type { Identity } from "./auth";
import { getDb } from "./db";
import { FREE_QUESTIONS, OFFERS, type Me } from "./plans";

type SubRow = { plan: "essentiel" | "illimite"; current_period_start: number; current_period_end: number };
const ACTIVE = ["active", "trialing"];

const now = () => Math.floor(Date.now() / 1000);
const count = (sql: string, ...args: unknown[]) => (getDb().prepare(sql).get(...args) as { n: number }).n;
const countUsage = (subject: string, kind: string, since = 0) =>
  count("SELECT COUNT(*) n FROM usage WHERE subject = ? AND kind = ? AND created_at >= ?", subject, kind, since);

function activeSub(userId: number, at: number): SubRow | undefined {
  const row = getDb()
    .prepare("SELECT plan, status, current_period_start, current_period_end FROM subscriptions WHERE user_id = ?")
    .get(userId) as (SubRow & { status: string }) | undefined;
  return row && ACTIVE.includes(row.status) && row.current_period_end > at && row.plan in OFFERS ? row : undefined;
}

export function getMe(id: Identity, at = now()): Me {
  const sub = id.userId ? activeSub(id.userId, at) : undefined;
  const monthlyLimit = sub ? OFFERS[sub.plan].monthlyQuota : 0;
  const monthlyUsed = sub ? countUsage(`user:${id.userId}`, "sub", sub.current_period_start) : 0;
  const credits = id.userId ? count("SELECT COALESCE(SUM(delta), 0) n FROM credit_ledger WHERE user_id = ?", id.userId) : 0;
  const freeUsed = Math.max(countUsage(`anon:${id.anonId}`, "free"), countUsage(`ip:${id.ipHash}`, "free"));
  const freeLeft = Math.max(0, FREE_QUESTIONS - freeUsed);
  return {
    email: id.email,
    plan: sub?.plan ?? "free",
    credits,
    freeLeft,
    monthlyUsed,
    monthlyLimit,
    periodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    canAsk: monthlyUsed < monthlyLimit || credits > 0 || freeLeft > 0,
  };
}

// Charge one generated answer: subscription quota, then purchased credits, then free questions.
// Synchronous transaction: re-reads balances inside, so concurrent requests can't spend the same unit twice.
export function consume(id: Identity, at = now()): "sub" | "credit" | "free" | null {
  const db = getDb();
  const insert = db.prepare("INSERT INTO usage (subject, kind, created_at) VALUES (?, ?, ?)");
  return db.transaction(() => {
    const me = getMe(id, at);
    if (id.userId && me.monthlyUsed < me.monthlyLimit) {
      insert.run(`user:${id.userId}`, "sub", at);
      return "sub" as const;
    }
    if (id.userId && me.credits > 0) {
      db.prepare("INSERT INTO credit_ledger (user_id, delta, reason, created_at) VALUES (?, -1, 'use', ?)").run(id.userId, at);
      insert.run(`user:${id.userId}`, "credit", at);
      return "credit" as const;
    }
    if (me.freeLeft > 0) {
      // Recorded under both keys: clearing cookies or switching network alone doesn't reset the free quota.
      insert.run(`anon:${id.anonId}`, "free", at);
      insert.run(`ip:${id.ipHash}`, "free", at);
      return "free" as const;
    }
    return null;
  }).immediate();
}

// Idempotent: stripe_ref (checkout session id) is UNIQUE.
export function grantCredits(userId: number, credits: number, stripeRef: string) {
  return getDb()
    .prepare("INSERT INTO credit_ledger (user_id, delta, reason, stripe_ref) VALUES (?, ?, 'purchase', ?) ON CONFLICT(stripe_ref) DO NOTHING")
    .run(userId, credits, stripeRef).changes > 0;
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
