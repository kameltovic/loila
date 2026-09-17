// Idempotent: creates the "Loilà" product and one price per available offer (by lookup_key) from src/lib/plans.ts,
// and deactivates retired prices (Stripe prices are immutable: a new grid means new lookup keys).
// npx tsx --env-file=.env scripts/stripe-setup.ts   (refuses live keys unless --live)
import Stripe from "stripe";
import { LEGACY_LOOKUP_KEYS, OFFERS } from "../src/lib/plans";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  if (!/^[sr]k_test_/.test(key) && !process.argv.includes("--live")) throw new Error("Live key: pass --live to confirm");
  const stripe = new Stripe(key);
  const allKeys = [...Object.values(OFFERS).map((o) => o.lookupKey), ...LEGACY_LOOKUP_KEYS];

  // Existing prices name the product directly (product search is eventually consistent).
  const known = await stripe.prices.list({ lookup_keys: allKeys, limit: 10 });
  const existingId = (known.data[0]?.product as string | undefined) ?? (await stripe.products.search({ query: "metadata['app']:'loila'" })).data[0]?.id;
  const product = existingId
    ? { id: existingId }
    : await stripe.products.create({ name: "Loilà", metadata: { app: "loila" }, tax_code: "txcd_10000000" });
  console.log("product", product.id, existingId ? "(existing)" : "(created)");

  for (const offer of Object.values(OFFERS)) {
    if (!offer.available) {
      console.log("price", offer.lookupKey, "(skipped: offer not available)");
      continue;
    }
    const found = await stripe.prices.list({ lookup_keys: [offer.lookupKey], limit: 1 });
    if (found.data[0]) {
      console.log("price", offer.lookupKey, found.data[0].id, "(existing)");
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: offer.priceCents,
      tax_behavior: offer.taxLabel === "TTC" ? "inclusive" : "exclusive",
      lookup_key: offer.lookupKey,
      nickname: offer.name,
      ...((offer as { kind: string }).kind === "subscription" ? { recurring: { interval: "month" as const } } : {}),
    });
    console.log("price", offer.lookupKey, price.id, "(created)");
  }

  for (const p of known.data.filter((p) => LEGACY_LOOKUP_KEYS.includes(p.lookup_key ?? "") && p.active)) {
    await stripe.prices.update(p.id, { active: false });
    console.log("price", p.lookup_key, p.id, "(deactivated)");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
