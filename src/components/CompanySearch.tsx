"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2, Search } from "lucide-react";
import { btnPrimary, label } from "@/components/ui";
import { postJson } from "@/components/AccountMenu";

type Hit = { siren: string; nom_complet: string | null; etat_administratif: string | null; activite_principale: string | null; siege_siret: string | null };

const field =
  "mt-2 min-h-12 w-full border-2 border-fg bg-surface px-4 text-base text-fg placeholder:text-fg-2 focus:outline-2 focus:outline-offset-2 focus:outline-fg";

/** "Vérifier une entreprise": one input, SIREN/SIRET or name, hitting /api/company. */
export default function CompanySearch({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Hit[] | null>(null);
  const [siren, setSiren] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = q.trim();
    if (value.length < 2) return;
    setState("loading");
    setError("");
    setResults(null);
    setSiren(null);
    try {
      const r = await postJson<{ siren?: string; results?: Hit[] }>("/api/company", { q: value });
      if (r.siren) setSiren(r.siren);
      else setResults(r.results ?? []);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={`${id}-q`} className={`${label} block text-fg-2`}>
            Nom, SIREN ou SIRET
          </label>
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex. 552081317, 82454695600023, La Poste…"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
        </div>
        <button type="submit" disabled={state === "loading"} className={`${btnPrimary} h-12 disabled:opacity-60`}>
          {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Search aria-hidden className="size-4" />}
          {state === "loading" ? "Recherche…" : "Vérifier"}
        </button>
      </form>

      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 flex items-start gap-2 border-2 border-signal bg-danger-bg px-4 py-3">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}

      {siren && (
        <p role="status" className="mt-6 border-2 border-fg bg-urbanisme px-4 py-4 text-ink">
          Fiche trouvée.{" "}
          <Link href={`/entreprise/${siren}`} className="font-semibold underline underline-offset-4">
            Voir l’entreprise {siren} <ArrowRight aria-hidden className="inline size-4" />
          </Link>
        </p>
      )}

      {results && (
        <div className="mt-6">
          {results.length === 0 ? (
            <p className="border-2 border-dashed border-fg/40 p-6 text-fg-2">
              Aucune entreprise trouvée. Vérifiez le SIREN/SIRET ou essayez la raison sociale exacte.
            </p>
          ) : (
            <ul className="border-t border-fg">
              {results.map((r) => (
                <li key={r.siren} className="border-b border-rule">
                  <Link href={`/entreprise/${r.siren}`} className="group flex flex-wrap items-baseline justify-between gap-3 py-4 hover:bg-surface sm:px-2">
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-bold tracking-[-0.02em]">{r.nom_complet ?? r.siren}</span>
                      <span className="mt-1 font-mono text-xs text-fg-2">
                        SIREN {r.siren}
                        {r.activite_principale && <> · NAF {r.activite_principale}</>}
                        {r.etat_administratif && <> · {r.etat_administratif === "A" ? "active" : "cessée"}</>}
                      </span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
