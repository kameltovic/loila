"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { OFFERS, formatPrice, type OfferId } from "@/lib/plans";
import { btnPrimary, label } from "@/components/ui";
import { postJson } from "@/components/AccountMenu";

export const OFFER_FEATURES: Record<OfferId, string[]> = {
  single: ["1 question à l’IA", "Réponse sourcée par les articles de loi", "N’expire jamais", "Sans abonnement"],
  essentiel: ["100 questions par mois", "Réponses sourcées et vérifiables", "Sans engagement", "Résiliable en 1 clic"],
  illimite: ["Questions illimitées (usage raisonnable)", "Idéal pour un usage pro", "Sans engagement", "Résiliable en 1 clic"],
};

const ORDER: OfferId[] = ["single", "essentiel", "illimite"];
const FEATURED: OfferId = "essentiel";

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<OfferId | null>(null);
  const [error, setError] = useState("");

  async function checkout(offer: OfferId) {
    setBusy(offer);
    setError("");
    try {
      const { url } = await postJson<{ url: string }>("/api/checkout", { offer });
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className={`grid gap-5 ${compact ? "lg:grid-cols-3 lg:gap-4" : "md:grid-cols-3 md:gap-6"}`}>
        {ORDER.map((id) => {
          const o = OFFERS[id];
          const featured = id === FEATURED;
          return (
            <li
              key={id}
              className={`relative flex flex-col border-2 border-fg ${featured ? "bg-surface shadow-[6px_6px_0_0_var(--signal)]" : "bg-bg"} ${
                compact ? "p-5" : "p-6 sm:p-7"
              }`}
            >
              {featured && (
                <span className={`${label} absolute -top-3.5 left-5 border-2 border-ink bg-signal px-2 py-0.5 text-ink`}>Le plus choisi</span>
              )}
              <h3 className={`${label} text-fg-2`}>{o.name}</h3>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className={`font-display font-extrabold tracking-[-0.04em] ${compact ? "text-4xl" : "text-5xl"}`}>{formatPrice(o.priceCents)}</span>
                <span className="text-fg-2">{o.kind === "subscription" ? "/ mois" : "une fois"}</span>
              </p>
              <p className="mt-2 font-serif text-lg italic">{o.tagline}</p>
              {!compact && (
                <ul className="mt-5 space-y-2 border-t border-rule pt-5 text-[0.9375rem]">
                  {OFFER_FEATURES[id].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check aria-hidden strokeWidth={2.25} className="mt-0.5 size-4 shrink-0 text-focus" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className={`mt-auto ${compact ? "pt-5" : "pt-7"}`}>
              <button
                type="button"
                onClick={() => checkout(id)}
                disabled={!!busy}
                aria-label={`Choisir ${o.name}, ${formatPrice(o.priceCents)}${o.kind === "subscription" ? " par mois" : ""}`}
                className={`${btnPrimary} w-full disabled:opacity-60 ${featured ? "bg-fg! text-bg!" : ""}`}
              >
                {busy === id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
                {busy === id ? "Redirection…" : o.kind === "subscription" ? "S’abonner" : "Acheter"}
              </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 border-2 border-signal bg-danger-bg px-4 py-3">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
