// Idempotent: creates the "Loilà" product and one price per offer (by lookup_key) from src/lib/plans.ts.
// npx tsx --env-file=.env scripts/stripe-setup.ts   (refuses live keys unless --live)
import Stripe from "stripe";
import { OFFERS } from "../src/lib/plans";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  if (!/^[sr]k_test_/.test(key) && !process.argv.includes("--live")) throw new Error("Live key: pass --live to confirm");
  const stripe = new Stripe(key);

  // Existing prices name the product directly (product search is eventually consistent).
  const known = await stripe.prices.list({ lookup_keys: Object.values(OFFERS).map((o) => o.lookupKey), limit: 3 });
  const existingId = (known.data[0]?.product as string | undefined) ?? (await stripe.products.search({ query: "metadata['app']:'loila'" })).data[0]?.id;
  const product = existingId
    ? { id: existingId }
    : await stripe.products.create({ name: "Loilà", metadata: { app: "loila" }, tax_code: "txcd_10000000" });
  console.log("product", product.id, existingId ? "(existing)" : "(created)");

  for (const offer of Object.values(OFFERS)) {
    const found = await stripe.prices.list({ lookup_keys: [offer.lookupKey], limit: 1 });
    if (found.data[0]) {
      console.log("price", offer.lookupKey, found.data[0].id, "(existing)");
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: offer.priceCents,
      tax_behavior: "inclusive",
      lookup_key: offer.lookupKey,
      nickname: offer.name,
      ...(offer.kind === "subscription" ? { recurring: { interval: "month" as const } } : {}),
    });
    console.log("price", offer.lookupKey, price.id, "(created)");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
