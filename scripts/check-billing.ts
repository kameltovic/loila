// Billing/auth self-check, no network: npx tsx scripts/check-billing.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Stripe from "stripe";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-billing-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.AUTH_SECRET = "test-secret";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { ask } = await import("../src/lib/ask");
  const auth = await import("../src/lib/auth");
  const { consume, getMe } = await import("../src/lib/billing");
  const { handleStripeEvent } = await import("../src/lib/stripe");
  const db = getDb();
  const T = 1_800_000_000;

  // --- anonymous cookie signing
  const signed = auth.signAnon("abc");
  assert.equal(auth.verifyAnon(signed), "abc");
  assert.equal(auth.verifyAnon("abc.forged"), null);
  assert.equal(auth.safeNext("//evil.com"), "/compte");
  assert.equal(auth.safeNext("/sujets"), "/sujets");

  // --- asking requires an account: anonymous visitors cannot ask, free questions are account-scoped
  db.prepare("INSERT INTO articles (id, code, num, texte, url) VALUES ('A1', 'loi-89-462', '15', 'Le délai de préavis du locataire est de trois mois.', 'u')").run();
  const anon = { userId: null, email: null, anonId: "anon1", ipHash: "ip1" };
  const fakeLlm = async () => ({ content: "Trois mois (art. 15).", model: "fake" });
  const askAs = async (id: { userId: number | null; email: string | null; anonId: string; ipHash: string }, q: string) => {
    const r = await ask(q, "logement", fakeLlm, undefined, () => getMe(id).canAsk);
    if (r.source === "llm") consume(id);
    return r.source;
  };
  assert.equal(getMe(anon).canAsk, false); // no account, no question
  assert.equal(consume(anon), null);
  assert.equal(await askAs(anon, "préavis locataire"), "paywall"); // → 401 auth, not answered

  const freeId = auth.upsertUser("Free@Example.com");
  const free = { ...anon, userId: freeId, email: "free@example.com" };
  assert.equal(getMe(free).freeLeft, 3);
  for (const [i, q] of ["préavis locataire", "délai préavis trois", "préavis mois locataire"].entries()) {
    assert.equal(await askAs(free, q), "llm");
    assert.equal(getMe(free).freeLeft, 2 - i);
  }
  assert.equal(await askAs(free, "préavis du locataire délai"), "paywall"); // → 402
  assert.equal(await askAs(free, "préavis locataire"), "cache"); // cache stays free
  assert.equal(await askAs(free, "xylophone zébulon"), "paywall"); // hook runs before retrieval

  // --- credits via webhook, idempotent
  const userId = auth.upsertUser("Buyer@Example.com");
  const buyer = { userId, email: "buyer@example.com", anonId: "anon1", ipHash: "ip1" };
  for (let i = 0; i < 3; i++) assert.equal(consume(buyer), "free"); // spend the account's free questions first
  assert.equal(getMe(buyer).freeLeft, 0);
  const checkout = (id: string, sessionId: string) =>
    ({
      id, type: "checkout.session.completed",
      data: { object: { id: sessionId, object: "checkout.session", status: "complete", payment_status: "paid", mode: "payment",
        customer: "cus_1", customer_details: { email: "buyer@example.com" }, metadata: { offer: "single" }, subscription: null } },
    }) as unknown as Stripe.Event;
  assert.equal(await handleStripeEvent(checkout("evt_1", "cs_1")), "handled");
  assert.equal(await handleStripeEvent(checkout("evt_1", "cs_1")), "duplicate");
  assert.equal(await handleStripeEvent(checkout("evt_2", "cs_1")), "handled"); // same session, other event id
  assert.equal(getMe(buyer).credits, 1);
  assert.equal((db.prepare("SELECT stripe_customer_id c FROM users WHERE id = ?").get(userId) as { c: string }).c, "cus_1");
  assert.equal(getMe(buyer).canAsk, true);
  assert.equal(consume(buyer), "credit");
  assert.equal(getMe(buyer).credits, 0);
  assert.equal(consume(buyer), null);
  assert.equal(getMe(buyer).canAsk, false);

  // --- subscription quota and period reset
  const sub = (id: string, status: string, start: number, end: number) =>
    ({
      id, type: "customer.subscription.updated",
      data: { object: { id: "sub_1", object: "subscription", customer: "cus_1", status,
        items: { data: [{ price: { lookup_key: "loila_essentiel_monthly_v1" }, current_period_start: start, current_period_end: end }] } } },
    }) as unknown as Stripe.Event;
  await handleStripeEvent(sub("evt_s1", "active", T, T + 30 * 86400));
  let me = getMe(buyer, T + 10);
  assert.equal(me.plan, "essentiel");
  assert.equal(me.monthlyLimit, 100);
  for (let i = 0; i < 100; i++) assert.equal(consume(buyer, T + 10), "sub");
  me = getMe(buyer, T + 10);
  assert.equal(me.monthlyUsed, 100);
  assert.equal(me.canAsk, false);
  assert.equal(consume(buyer, T + 10), null);
  await handleStripeEvent(sub("evt_s2", "active", T + 30 * 86400, T + 60 * 86400));
  me = getMe(buyer, T + 30 * 86400 + 5);
  assert.equal(me.monthlyUsed, 0);
  assert.equal(me.canAsk, true);
  await handleStripeEvent(sub("evt_s3", "canceled", T + 30 * 86400, T + 60 * 86400));
  assert.equal(getMe(buyer, T + 30 * 86400 + 5).plan, "free");

  // --- magic link tokens: single use + expiry
  const tok = auth.createLoginToken("Someone@Example.com", T);
  assert.equal(auth.consumeLoginToken(tok, T + 60), "someone@example.com");
  assert.equal(auth.consumeLoginToken(tok, T + 61), null);
  const old = auth.createLoginToken("late@example.com", T);
  assert.equal(auth.consumeLoginToken(old, T + 15 * 60 + 1), null);
  assert.equal(auth.consumeLoginToken("garbage", T), null);

  console.log("check-billing: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
