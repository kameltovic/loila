"use client";

import { useId, useState } from "react";
import { ArrowRight, Loader2, Scale } from "lucide-react";
import { btnPrimary, display, label } from "@/components/ui";
import { postJson } from "@/components/AccountMenu";

/** Demand test for lawyer matching: collects an email (+ city) and posts to /api/avocat-demande. */
export default function AvocatCta({ page }: { page: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const emailId = useId();
  const cityId = useId();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setState("loading");
    setError("");
    try {
      const r = await postJson<{ message: string }>("/api/avocat-demande", { email: data.get("email"), city: data.get("city"), website: data.get("website"), page });
      setMessage(r.message);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  const field = "min-h-11 w-full border-2 border-fg bg-surface px-3 text-base text-fg placeholder:text-fg-2 focus:outline-2 focus:outline-offset-2 focus:outline-fg";
  return (
    // Signal-orange block so the offer stands out from the answer; ink text keeps contrast in both themes.
    <section aria-labelledby="avocat-cta" className="mt-16 border-2 border-fg bg-signal p-6 text-ink shadow-[6px_6px_0_0_var(--fg)] sm:p-8">
      <p className={`${label} flex items-center gap-2`}><Scale aria-hidden className="size-4" /> Mise en relation</p>
      <h2 id="avocat-cta" className={`${display} mt-3 text-3xl leading-tight`}>Besoin d’un avocat sur cette question ?</h2>
      <p className="mt-3">Laissez votre e-mail : nous vous recontactons pour vous orienter vers un avocat près de chez vous.</p>
      {state === "done" ? (
        <p role="status" className="mt-5 border-2 border-fg bg-urbanisme px-4 py-3 text-ink">{message}</p>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div>
            <label htmlFor={emailId} className="block text-sm font-semibold">E-mail</label>
            <input id={emailId} name="email" type="email" required autoComplete="email" className={`${field} mt-1`} />
          </div>
          <div>
            <label htmlFor={cityId} className="block text-sm font-semibold">Ville <span className="font-normal">(facultatif)</span></label>
            <input id={cityId} name="city" type="text" maxLength={80} autoComplete="address-level2" className={`${field} mt-1`} />
          </div>
          <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <button type="submit" disabled={state === "loading"} className={`${btnPrimary} disabled:opacity-60`}>
            {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
            Être recontacté
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 border-2 border-ink bg-surface px-3 py-2 font-semibold text-fg">{error}</p>}
      <p className="mt-4 text-xs">Votre e-mail sert uniquement à vous répondre sur cette demande. Loilà ne délivre pas de consultation juridique.</p>
    </section>
  );
}
