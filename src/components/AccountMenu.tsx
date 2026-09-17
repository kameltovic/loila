"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { OFFERS, type Me } from "@/lib/plans";
import { btnPrimary, label } from "@/components/ui";

/** POST JSON, resolve parsed body; reject with the server message on non-2xx or network failure. */
export async function postJson<T = Record<string, unknown>>(url: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok) throw new Error(data.error ?? "Service momentanément indisponible. Réessayez dans un instant.");
  return data as T;
}

/** Current visitor from /api/me. `null` while loading or when the API is unavailable (callers hide counters). */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => alive && setMe(d && typeof d.plan === "string" ? d : null))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  return { me, setMe, loaded };
}

export const planName = (plan: Me["plan"]) => (plan === "free" ? "Gratuit" : OFFERS[plan].name);

/** Header entry: "Connexion" / "Mon compte". */
export default function AccountMenu({ className, onClick }: { className: string; onClick?: () => void }) {
  const { me } = useMe();
  const loggedIn = !!me?.email;
  return (
    <Link href={loggedIn ? "/compte" : "/connexion"} onClick={onClick} className={className}>
      {loggedIn ? "Mon compte" : "Connexion"}
    </Link>
  );
}

/** Magic-link email form. */
export function LoginForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");
  const id = useId();

  if (state === "sent") {
    return (
      <p role="status" className="flex items-start gap-3 border-2 border-fg bg-urbanisme px-4 py-3 text-ink">
        <Check aria-hidden strokeWidth={2} className="mt-0.5 size-5 shrink-0" />
        <span>
          <strong>Lien envoyé, vérifiez vos emails.</strong> Il est valable quelques minutes. Pensez aux indésirables.
        </span>
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState("loading");
        setError("");
        try {
          // Come back to the current page after the magic link (keeps the pending question in view).
          const next = window.location.pathname + window.location.search;
          await postJson("/api/auth/request", { email: email.trim(), next });
          setState("sent");
        } catch (err) {
          setError((err as Error).message);
          setState("idle");
        }
      }}
    >
      <label htmlFor={id} className={`${label} block text-fg-2`}>
        Adresse email
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className="min-h-12 min-w-0 flex-1 border-2 border-fg bg-surface px-4 text-base text-fg placeholder:text-fg-2 focus:outline-3 focus:outline-offset-2 focus:outline-focus"
        />
        <button type="submit" disabled={state === "loading"} className={`${btnPrimary} disabled:opacity-60`}>
          {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
          Recevoir le lien
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-fg">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-focus" />
          {error}
        </p>
      )}
    </form>
  );
}

/** Credits / quota readout shared by /compte and /merci. */
export function MeSummary({ me }: { me: Me }) {
  const sub = me.plan !== "free";
  const pct = me.monthlyLimit ? Math.min(100, Math.round((me.monthlyUsed / me.monthlyLimit) * 100)) : 0;
  const rows = [
    { k: "Formule", v: planName(me.plan) },
    ...(me.email ? [{ k: "Email", v: me.email }] : []),
    { k: "Questions offertes restantes", v: String(me.freeLeft) },
    { k: "Questions à l'unité (sans expiration)", v: String(me.credits) },
    ...(sub && me.periodEnd
      ? [{ k: "Renouvellement", v: new Date(me.periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) }]
      : []),
  ];
  return (
    <div className="border-2 border-fg bg-surface shadow-hard">
      <dl className="divide-y divide-rule">
        {rows.map((r) => (
          <div key={r.k} className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto] sm:gap-6">
            <dt className="text-fg-2">{r.k}</dt>
            <dd className="font-semibold break-all sm:text-right">{r.v}</dd>
          </div>
        ))}
      </dl>
      {sub && (
        <div className="border-t-2 border-fg px-5 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className={label}>Ce mois-ci</p>
            <p className="font-mono text-sm font-bold tabular-nums">
              {me.monthlyUsed} / {me.plan === "illimite" ? "∞" : me.monthlyLimit}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Questions utilisées ce mois"
            aria-valuemin={0}
            aria-valuemax={me.monthlyLimit}
            aria-valuenow={me.monthlyUsed}
            className="mt-3 h-4 border-2 border-fg bg-bg"
          >
            <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
          </div>
          {me.plan === "illimite" && <p className="mt-2 text-xs text-fg-2">Usage raisonnable : {me.monthlyLimit} questions par mois.</p>}
        </div>
      )}
    </div>
  );
}

/** /compte body. */
export function AccountPanel() {
  const { me, loaded } = useMe();
  const [busy, setBusy] = useState<"" | "portal" | "logout">("");
  const [error, setError] = useState("");

  async function go(kind: "portal" | "logout") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "portal") {
        const { url } = await postJson<{ url: string }>("/api/portal");
        window.location.assign(url);
        return;
      }
      await postJson("/api/auth/logout");
      window.location.assign(window.location.origin); // full reload so the header refetches /api/me
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  }

  if (!loaded) return <p className="flex items-center gap-2 text-fg-2"><Loader2 aria-hidden className="size-4 animate-spin" />Chargement…</p>;

  if (!me?.email) {
    return (
      <div className="border-2 border-fg bg-surface p-6 shadow-hard sm:p-8">
        <p className="font-display text-2xl font-bold tracking-[-0.03em]">Vous n’êtes pas connecté.</p>
        <p className="mt-2 text-fg-2">Connectez-vous avec votre email pour retrouver vos questions et votre abonnement.</p>
        <Link href="/connexion" className={`${btnPrimary} mt-6`}>
          Se connecter <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MeSummary me={me} />
      <div className="flex flex-wrap gap-3">
        {me.plan !== "free" && (
          <button type="button" onClick={() => go("portal")} disabled={!!busy} className={`${btnPrimary} disabled:opacity-60`}>
            {busy === "portal" && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Gérer mon abonnement
          </button>
        )}
        <Link href="/tarifs" className={btnPrimary}>
          Acheter des questions
        </Link>
        <button
          type="button"
          onClick={() => go("logout")}
          disabled={!!busy}
          className="px-3 py-2.5 font-mono text-sm font-bold uppercase underline decoration-signal decoration-2 underline-offset-4 disabled:opacity-60"
        >
          Se déconnecter
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 border-2 border-signal bg-danger-bg px-4 py-3">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** /merci body: refreshed Me after checkout. */
export function MerciPanel() {
  const { me } = useMe();
  return me ? <MeSummary me={me} /> : null;
}
