// Billing/auth self-check, no network: npx tsx scripts/check-billing.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Stripe from "stripe";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-billing-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.AUTH_SECRET = "test-secret";
process.env.ADMIN_EMAILS = " Boss+ops@Example.com , other@example.com";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { ask } = await import("../src/lib/ask");
  const auth = await import("../src/lib/auth");
  const { consume, getMe } = await import("../src/lib/billing");
  const { handleStripeEvent } = await import("../src/lib/stripe");
  const email = await import("../src/lib/email");
  const notices: string[] = [];
  email.adminMailer.send = async (_to, n) => void notices.push(n.subject);
  const sent = (prefix: string) => notices.filter((x) => x.startsWith(prefix)).length;
  const db = getDb();
  const T = 1_800_000_000;

  // --- anonymous cookie signing
  const signed = auth.signAnon("abc");
  assert.equal(auth.verifyAnon(signed), "abc");
  assert.equal(auth.verifyAnon("abc.forged"), null);
  assert.equal(auth.safeNext("//evil.com"), "/compte");
  assert.equal(auth.safeNext("/sujets"), "/sujets");

  // --- email aliases collapse to a single account (no free-account farming)
  assert.equal(auth.canonicalEmail("Jean+Loila@Example.com"), "jean@example.com");
  assert.equal(auth.canonicalEmail("J.E.A.N@gmail.com"), "jean@gmail.com");
  assert.equal(auth.canonicalEmail("j.e.a.n@googlemail.com"), "jean@googlemail.com");
  assert.equal(auth.canonicalEmail("Jean@Example.com"), "jean@example.com");
  assert.equal(auth.canonicalEmail("+tag@example.com"), "+tag@example.com"); // nothing before "+": keep as-is
  assert.equal(auth.upsertUser("alias+one@example.com"), auth.upsertUser("ALIAS+two@Example.com"));
  assert.equal(sent("Nouveau compte : alias@example.com"), 1); // notified on real creation only

  // --- admin notifications never break the caller
  email.adminMailer.send = () => { throw new Error("boom"); };
  assert.ok(auth.upsertUser("sync-fail@example.com"));
  email.adminMailer.send = async () => { throw new Error("boom"); };
  assert.ok(auth.upsertUser("async-fail@example.com"));
  await new Promise((r) => setTimeout(r, 0)); // a rejection would surface as unhandled here
  email.adminMailer.send = async (_to, n) => void notices.push(n.subject);

  // --- /admin guard: ADMIN_EMAILS compared canonically; anonymous and non-admins get nothing
  const session = (uid: number) => {
    const raw = `tok-${uid}`;
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(auth.sha256(raw), uid, 4_000_000_000);
    return raw;
  };
  assert.equal(auth.adminBySessionToken(session(auth.upsertUser("BOSS@example.com")))?.email, "boss@example.com");
  assert.equal(auth.adminBySessionToken(session(auth.upsertUser("visitor@example.com"))), null);
  assert.equal(auth.adminBySessionToken(undefined), null);
  assert.equal(auth.adminBySessionToken("forged"), null);
  assert.equal(auth.isAdmin("Other@Example.com"), true);
  assert.equal(auth.isAdmin(null), false);

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

  // --- Dossier via webhook: idempotent, expiry counted from the Stripe purchase time (not webhook arrival)
  const DAY = 86400;
  const checkout = (id: string, sessionId: string, customer: string, email: string, created: number, offer = "dossier") =>
    ({
      id, type: "checkout.session.completed",
      data: { object: { id: sessionId, object: "checkout.session", created, status: "complete", payment_status: "paid", mode: "payment",
        customer, customer_details: { email }, metadata: { offer }, subscription: null } },
    }) as unknown as Stripe.Event;
  const batches = (uid: number) =>
    db.prepare("SELECT id, credits_left, expires_at FROM credit_batches WHERE user_id = ? ORDER BY id").all(uid) as { id: number; credits_left: number; expires_at: number }[];
  const iso = (t: number) => new Date(t * 1000).toISOString();

  const userId = auth.upsertUser("Buyer@Example.com");
  const buyer = { userId, email: "buyer@example.com", anonId: "anon1", ipHash: "ip1" };
  for (let i = 0; i < 3; i++) assert.equal(consume(buyer, T), "free"); // spend the account's free questions first
  assert.equal(await handleStripeEvent(checkout("evt_1", "cs_1", "cus_1", "buyer@example.com", T)), "handled");
  assert.equal(await handleStripeEvent(checkout("evt_1", "cs_1", "cus_1", "buyer@example.com", T)), "duplicate");
  assert.equal(await handleStripeEvent(checkout("evt_2", "cs_1", "cus_1", "buyer@example.com", T)), "handled"); // same session, other event id
  assert.equal(await handleStripeEvent(checkout("evt_x", "cs_x", "cus_1", "buyer@example.com", T, "single")), "handled"); // retired offer: ignored
  assert.equal(batches(userId).length, 1);
  assert.equal(sent("Dossier acheté : buyer@example.com"), 1); // replays never re-notify
  assert.equal(sent("Nouveau compte : buyer@example.com"), 1);
  let me = getMe(buyer, T + 2 * DAY); // webhook processed late: expiry still from purchase
  assert.equal(me.credits, 10);
  assert.equal(me.creditsExpireAt, iso(T + 30 * DAY));
  assert.equal((db.prepare("SELECT stripe_customer_id c FROM users WHERE id = ?").get(userId) as { c: string }).c, "cus_1");

  // --- several batches, only one valid: the soonest-expiring valid batch pays, expired ones are skipped but kept
  await handleStripeEvent(checkout("evt_3", "cs_2", "cus_1", "buyer@example.com", T + 20 * DAY)); // expires T+50d
  const [b1, b2] = batches(userId);
  me = getMe(buyer, T + 21 * DAY);
  assert.equal(me.credits, 20);
  assert.equal(me.creditsExpireAt, iso(T + 30 * DAY)); // soonest first
  assert.equal(consume(buyer, T + 21 * DAY), "credit");
  assert.deepEqual(batches(userId).map((b) => b.credits_left), [9, 10]);
  assert.equal((db.prepare("SELECT batch_id FROM usage WHERE subject = ? AND kind = 'credit' ORDER BY id DESC").get(`user:${userId}`) as { batch_id: number }).batch_id, b1.id);

  me = getMe(buyer, T + 31 * DAY); // b1 expired with 9 left
  assert.equal(me.credits, 10);
  assert.equal(me.creditsExpireAt, iso(T + 50 * DAY));
  assert.equal(consume(buyer, T + 31 * DAY), "credit");
  assert.deepEqual(batches(userId).map((b) => b.credits_left), [9, 9]); // expired batch untouched
  for (let i = 0; i < 9; i++) assert.equal(consume(buyer, T + 31 * DAY), "credit");
  me = getMe(buyer, T + 31 * DAY);
  assert.equal(me.credits, 0);
  assert.equal(me.creditsExpireAt, null);
  assert.equal(me.canAsk, false);
  assert.equal(consume(buyer, T + 31 * DAY), null);
  assert.equal(batches(userId).length, 2); // never deleted
  assert.equal(batches(userId)[1].id, b2.id);

  // --- debit order: subscription quota → credit batch → free questions
  const proId = auth.upsertUser("Pro@Example.com");
  const pro = { userId: proId, email: "pro@example.com", anonId: "anon2", ipHash: "ip2" };
  await handleStripeEvent(checkout("evt_p0", "cs_p0", "cus_2", "pro@example.com", T)); // links cus_2, 10 credits
  const sub = (id: string, status: string, start: number, end: number) =>
    ({
      id, type: "customer.subscription.updated",
      data: { object: { id: "sub_1", object: "subscription", customer: "cus_2", status,
        items: { data: [{ price: { lookup_key: "loila_pro_monthly_v1" }, current_period_start: start, current_period_end: end }] } } },
    }) as unknown as Stripe.Event;
  await handleStripeEvent(sub("evt_s1", "active", T, T + 30 * DAY));
  assert.equal(sent("Abonnement Pro activé"), 1);
  me = getMe(pro, T + 10);
  assert.equal(me.plan, "pro");
  assert.equal(me.monthlyLimit, 500);
  for (let i = 0; i < 500; i++) assert.equal(consume(pro, T + 10), "sub");
  assert.equal(getMe(pro, T + 10).credits, 10); // quota spent before credits
  for (let i = 0; i < 10; i++) assert.equal(consume(pro, T + 10), "credit");
  for (let i = 0; i < 3; i++) assert.equal(consume(pro, T + 10), "free");
  me = getMe(pro, T + 10);
  assert.equal(me.monthlyUsed, 500);
  assert.equal(me.canAsk, false);
  assert.equal(consume(pro, T + 10), null);

  // --- subscription period reset and cancellation
  await handleStripeEvent(sub("evt_s2", "active", T + 30 * DAY, T + 60 * DAY));
  me = getMe(pro, T + 30 * DAY + 5);
  assert.equal(me.monthlyUsed, 0);
  assert.equal(me.canAsk, true);
  await handleStripeEvent(sub("evt_s3", "canceled", T + 30 * DAY, T + 60 * DAY));
  assert.equal(getMe(pro, T + 30 * DAY + 5).plan, "free");
  assert.deepEqual([sent("Abonnement Pro activé"), sent("Abonnement Pro terminé")], [1, 1]); // s2 renewal: no notice

  // --- checkout guard (rejected before any Stripe call): Pro not for sale, Dossier needs the withdrawal waiver
  const { POST: checkoutPost } = await import("../src/app/api/checkout/route");
  const post = (body: object) =>
    checkoutPost(new Request("http://localhost:3000/api/checkout", {
      method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body),
    }));
  assert.equal((await post({ offer: "pro" })).status, 400);
  assert.equal((await post({ offer: "single", waiver: true })).status, 400);
  assert.equal((await post({ offer: "dossier" })).status, 400);

  // --- Pro waitlist: upsert on email
  const { POST: waitlistPost } = await import("../src/app/api/pro-waitlist/route");
  const join = (body: object) =>
    waitlistPost(new Request("http://localhost:3000/api/pro-waitlist", {
      method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify(body),
    }));
  assert.equal((await join({ email: "nope" })).status, 400);
  assert.equal((await join({ email: "Syndic@Example.com", metier: "Syndic bénévole" })).status, 200);
  assert.equal((await join({ email: "syndic@example.com" })).status, 200);
  assert.equal(sent("Liste d'attente Pro : syndic@example.com"), 1);
  assert.deepEqual(db.prepare("SELECT email, metier FROM pro_waitlist").all(), [{ email: "syndic@example.com", metier: "Syndic bénévole" }]);

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
