// Pricing contract shared by billing backend and UI. Client-safe (no DB/Stripe imports).
// Margins computed 2026-09-17: generated answer ≈ 0.7 c€ avg, 1.4 c€ worst (Haiku 4.5 + Flash Lite expand).
export const FREE_QUESTIONS = 3; // lifetime per visitor (cookie + IP), generated answers only

export const OFFERS = {
  single: {
    kind: "one_time",
    name: "À l'unité",
    priceCents: 99,
    credits: 1,
    lookupKey: "loila_single_v1",
    tagline: "Une question, une réponse sourcée.",
  },
  essentiel: {
    kind: "subscription",
    name: "Essentiel",
    priceCents: 799,
    monthlyQuota: 100,
    lookupKey: "loila_essentiel_monthly_v1",
    tagline: "100 questions par mois.",
  },
  illimite: {
    kind: "subscription",
    name: "Illimité",
    priceCents: 2499,
    monthlyQuota: 1000, // fair-use cap, shown as "usage raisonnable"
    lookupKey: "loila_illimite_monthly_v1",
    tagline: "Questions illimitées (usage raisonnable).",
  },
} as const;

export type OfferId = keyof typeof OFFERS;

export type Me = {
  email: string | null;
  plan: "free" | "essentiel" | "illimite";
  credits: number; // purchased single credits, never expire
  freeLeft: number;
  monthlyUsed: number;
  monthlyLimit: number; // 0 without subscription
  periodEnd: string | null; // ISO, subscription renewal
  canAsk: boolean;
};

export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
