"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { btnPrimary, label } from "@/components/ui";
import { postJson, useMe } from "@/components/AccountMenu";

const field =
  "mt-2 min-h-12 w-full border-2 border-fg bg-surface px-4 text-base text-fg placeholder:text-fg-2 focus:outline-2 focus:outline-offset-2 focus:outline-fg";

export default function ContactForm() {
  const { me } = useMe();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState("loading");
    setError("");
    try {
      const r = await postJson<{ message: string }>("/api/contact", data);
      setDone(r.message);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="flex items-start gap-3 border-2 border-fg bg-urbanisme px-4 py-4 text-ink">
        <Check aria-hidden strokeWidth={2} className="mt-0.5 size-5 shrink-0" />
        {done}
      </p>
    );
  }

  const f = (name: string) => `${id}-${name}`;
  return (
    <form onSubmit={submit} className="space-y-6" noValidate={false}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={f("first")} className={`${label} block text-fg-2`}>Prénom</label>
          <input id={f("first")} name="firstName" required maxLength={80} autoComplete="given-name" className={field} />
        </div>
        <div>
          <label htmlFor={f("last")} className={`${label} block text-fg-2`}>Nom</label>
          <input id={f("last")} name="lastName" required maxLength={80} autoComplete="family-name" className={field} />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={f("company")} className={`${label} block text-fg-2`}>
            Entreprise <span className="normal-case tracking-normal">(facultatif)</span>
          </label>
          <input id={f("company")} name="company" maxLength={120} autoComplete="organization" className={field} />
        </div>
        <div>
          <label htmlFor={f("email")} className={`${label} block text-fg-2`}>E-mail</label>
          <input
            id={f("email")}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={me?.email ?? undefined}
            key={me?.email ?? "anon"}
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor={f("message")} className={`${label} block text-fg-2`}>Message</label>
        <textarea
          id={f("message")}
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          className={`${field} py-3 leading-relaxed`}
        />
      </div>
      {/* Honeypot: hidden from people and assistive tech, bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={f("website")}>Site web</label>
        <input id={f("website")} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-sm text-fg-2">
        Vos informations servent uniquement à vous répondre et sont conservées 3 ans au plus (
        <Link href="/mentions-legales#donnees-personnelles" className="underline underline-offset-2">données personnelles</Link>).
        Pour une question de droit, utilisez plutôt la{" "}
        <Link href="/#question" className="underline underline-offset-2">recherche</Link> : nous ne donnons pas de conseil juridique par e-mail.
      </p>
      <button type="submit" disabled={state === "loading"} className={`${btnPrimary} w-full disabled:opacity-60 sm:w-auto`}>
        {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
        {state === "loading" ? "Envoi…" : "Envoyer le message"}
      </button>
      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 border-2 border-signal bg-danger-bg px-4 py-3">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
