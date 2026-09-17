// Pricing contract shared by billing backend and UI. Client-safe (no DB/Stripe imports).
// Margins computed 2026-09-17: generated answer ≈ 0.7 c€ avg, 1.4 c€ worst (Haiku 4.5 + Flash Lite expand).
export const FREE_QUESTIONS = 3; // lifetime per account, generated answers only (asking requires signing up)

export const OFFERS = {
  dossier: {
    kind: "one_time",
    name: "Dossier",
    priceCents: 490,
    taxLabel: "TTC",
    credits: 10,
    validityDays: 30, // from purchase; each purchase is its own batch
    lookupKey: "loila_dossier_v1",
    tagline: "10 questions sur votre situation, pendant 30 jours.",
    available: true,
  },
  pro: {
    kind: "subscription",
    name: "Pro",
    priceCents: 4900,
    taxLabel: "HT", // VAT treatment not settled yet: no Stripe price exists for this offer
    monthlyQuota: 500, // fair use
    lookupKey: "loila_pro_monthly_v1",
    tagline: "Pour ceux dont le droit est le quotidien.",
    available: false, // features not built: waitlist only. Flip to true once they ship (and run stripe-setup).
  },
} as const;

export type OfferId = keyof typeof OFFERS;

// Retired lookup keys (Stripe prices are immutable): stripe-setup deactivates them.
export const LEGACY_LOOKUP_KEYS = ["loila_single_v1", "loila_essentiel_monthly_v1", "loila_illimite_monthly_v1"];

export type Me = {
  email: string | null;
  plan: "free" | "pro";
  credits: number; // Dossier credits left in non-expired batches
  creditsExpireAt: string | null; // ISO, expiry of the soonest-expiring batch that still has credits
  freeLeft: number;
  monthlyUsed: number;
  monthlyLimit: number; // 0 without subscription
  periodEnd: string | null; // ISO, subscription renewal
  canAsk: boolean;
};

export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
