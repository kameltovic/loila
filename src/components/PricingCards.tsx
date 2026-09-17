"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Clock, Loader2 } from "lucide-react";
import { OFFERS, formatPrice } from "@/lib/plans";
import { btnPrimary, label } from "@/components/ui";
import { postJson } from "@/components/AccountMenu";

const DOSSIER = OFFERS.dossier;
const PRO = OFFERS.pro;

export const DOSSIER_FEATURES = [
  "Décrivez votre situation : questions ciblées, puis synthèse des règles, délais et prochaines étapes",
  `${DOSSIER.credits} questions à l’IA (synthèse et questions de suivi)`,
  `Valables ${DOSSIER.validityDays} jours après l’achat`,
  "Chaque réponse cite ses articles de loi",
  "Paiement unique, sans abonnement",
];
export const PRO_AUDIENCE = "Syndics bénévoles, bailleurs multi-lots, TPE sans RH, agences immobilières, artisans.";
export const PRO_SOON = [
  "Export des réponses avec leurs sources",
  "Historique classé par dossier",
  "Alerte quand un article cité change",
  "Plusieurs conventions collectives",
  "Facture au nom de la société",
];

const Alert = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="mt-4 flex items-start gap-2 border-2 border-signal bg-danger-bg px-3 py-2 text-sm">
    <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
    {children}
  </p>
);

function DossierCard({ compact }: { compact: boolean }) {
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const waiverId = useId();

  async function checkout() {
    if (!waiver) return setError("Cochez la case ci-dessus pour accéder à vos questions dès le paiement.");
    setBusy(true);
    setError("");
    try {
      const { url } = await postJson<{ url: string }>("/api/checkout", { offer: "dossier", waiver: true });
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className={`relative flex flex-col border-2 border-fg bg-surface shadow-[6px_6px_0_0_var(--signal)] ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}>
      <span className={`${label} absolute -top-3.5 left-5 border-2 border-ink bg-signal px-2 py-0.5 text-ink`}>Un problème à régler</span>
      <h3 className={`${label} text-fg-2`}>{DOSSIER.name}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-display font-extrabold tracking-[-0.04em] ${compact ? "text-5xl" : "text-6xl"}`}>{formatPrice(DOSSIER.priceCents)}</span>
        <span className="text-fg-2">{DOSSIER.taxLabel} · paiement unique</span>
      </p>
      <p className="mt-2 font-serif text-xl italic">{DOSSIER.tagline}</p>
      <ul className="mt-5 space-y-2 border-t border-rule pt-5 text-[0.9375rem]">
        {DOSSIER_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check aria-hidden strokeWidth={2.25} className="mt-0.5 size-4 shrink-0 text-focus" />
            {f}
          </li>
        ))}
      </ul>
      <div className={`mt-auto ${compact ? "pt-5" : "pt-7"}`}>
        {!compact && (
          <div className="mb-6 border-b border-rule pb-6">
            <Link href="/dossier/nouveau" className={`${btnPrimary} w-full bg-fg! text-bg!`}>
              <ArrowRight aria-hidden className="size-4" /> Décrire ma situation
            </Link>
            <p className="mt-2 text-sm text-fg-2">Commencez gratuitement : le dossier n’est demandé qu’au moment de la synthèse, si vos questions offertes sont utilisées.</p>
          </div>
        )}
        <label htmlFor={waiverId} className="flex cursor-pointer items-start gap-3 text-sm text-fg-2">
          <input
            id={waiverId}
            type="checkbox"
            checked={waiver}
            onChange={(e) => setWaiver(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--signal)]"
          />
          <span>
            Je veux accéder à mes questions dès le paiement et je renonce à mon droit de rétractation de 14 jours (
            <Link href="/cgv#retractation" className="underline underline-offset-2">
              CGV
            </Link>
            ).
          </span>
        </label>
        <button
          type="button"
          onClick={checkout}
          disabled={busy}
          aria-label={`Ouvrir un dossier, ${formatPrice(DOSSIER.priceCents)}`}
          className={`${btnPrimary} mt-4 w-full disabled:opacity-60 ${compact ? "bg-fg! text-bg!" : ""}`}
        >
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
          {busy ? "Redirection…" : "Ouvrir un dossier"}
        </button>
        {error && <Alert>{error}</Alert>}
      </div>
    </li>
  );
}

function ProCard() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const emailId = useId();
  const metierId = useId();

  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setState("loading");
    setError("");
    try {
      const r = await postJson<{ message: string }>("/api/pro-waitlist", { email: data.get("email"), metier: data.get("metier") });
      setMessage(r.message);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  const field = "min-h-11 w-full border-2 border-fg bg-surface px-3 text-base text-fg placeholder:text-fg-2 focus:outline-2 focus:outline-offset-2 focus:outline-fg";
  return (
    <li id="pro" className="relative flex scroll-mt-24 flex-col border-2 border-fg bg-bg p-6 sm:p-8">
      <span className={`${label} absolute -top-3.5 left-5 flex items-center gap-1.5 border-2 border-fg bg-bg px-2 py-0.5`}>
        <Clock aria-hidden strokeWidth={2.25} className="size-3.5" /> Bientôt
      </span>
      <h3 className={`${label} text-fg-2`}>{PRO.name}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-6xl font-extrabold tracking-[-0.04em]">{formatPrice(PRO.priceCents)}</span>
        <span className="text-fg-2">{PRO.taxLabel} / mois</span>
      </p>
      <p className="mt-2 font-serif text-xl italic">{PRO.tagline}</p>
      <p className="mt-2 text-sm text-fg-2">{PRO_AUDIENCE}</p>
      <ul className="mt-5 space-y-2 border-t border-rule pt-5 text-[0.9375rem]">
        <li className="flex items-start gap-2">
          <Check aria-hidden strokeWidth={2.25} className="mt-0.5 size-4 shrink-0 text-focus" />
          {PRO.monthlyQuota} questions par mois (usage raisonnable)
        </li>
        {PRO_SOON.map((f) => (
          <li key={f} className="flex items-start gap-2 text-fg-2">
            <Clock aria-hidden strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
            <span>
              {f} <span className="font-mono text-xs uppercase">· bientôt</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        {state === "done" ? (
          <p role="status" className="border-2 border-fg bg-urbanisme px-4 py-3 text-ink">
            {message}
          </p>
        ) : open ? (
          <form onSubmit={join} className="space-y-3">
            <label htmlFor={emailId} className="block text-sm font-semibold">
              Email professionnel
            </label>
            <input id={emailId} name="email" type="email" required autoComplete="email" autoFocus className={field} />
            <label htmlFor={metierId} className="block text-sm font-semibold">
              Votre métier <span className="font-normal text-fg-2">(facultatif)</span>
            </label>
            <input id={metierId} name="metier" type="text" maxLength={120} placeholder="Syndic bénévole, artisan…" className={field} />
            <button type="submit" disabled={state === "loading"} className={`${btnPrimary} w-full disabled:opacity-60`}>
              {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
              M’inscrire
            </button>
            {error && <Alert>{error}</Alert>}
          </form>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} w-full`}>
            <ArrowRight aria-hidden className="size-4" /> Rejoindre la liste d’attente
          </button>
        )}
      </div>
    </li>
  );
}

/** Full grid on /tarifs (Dossier + Pro waitlist); `compact` (paywall) shows the Dossier only. */
export default function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`grid gap-6 ${compact ? "" : "md:grid-cols-2 md:gap-8"}`}>
      <DossierCard compact={compact} />
      {!compact && <ProCard />}
    </ul>
  );
}
