"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, Search } from "lucide-react";
import { btnPrimary, label } from "@/components/ui";
import { postJson } from "@/components/AccountMenu";

type Hit = { banId: string; label: string; postcode: string | null; city: string | null; type: string | null };

const field =
  "mt-2 min-h-12 w-full border-2 border-fg bg-surface px-4 text-base text-fg placeholder:text-fg-2 focus:outline-2 focus:outline-offset-2 focus:outline-fg";

/** "Vérifier un bien": one address input, hitting /api/address. Precise addresses open their page;
 *  ambiguous queries show up to 5 geocoder candidates to pick from. */
export default function AddressSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Hit[] | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const id = useId();

  async function lookup(value: string) {
    if (value.length < 3) return;
    setState("loading");
    setError("");
    setResults(null);
    try {
      const r = await postJson<{ banId?: string; results?: Hit[] }>("/api/address", { q: value });
      if (r.banId) {
        router.push(`/bien/${r.banId}`);
        return;
      }
      setResults(r.results ?? []);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void lookup(q.trim());
  }

  function pick(hit: Hit) {
    setQ(hit.label);
    void lookup(hit.label);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={`${id}-q`} className={`${label} block text-fg-2`}>
            Adresse du bien
          </label>
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex. 8 boulevard du Port, 95000 Cergy"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
        </div>
        <button type="submit" disabled={state === "loading"} className={`${btnPrimary} h-12 disabled:opacity-60`}>
          {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Search aria-hidden className="size-4" />}
          {state === "loading" ? "Vérification…" : "Vérifier"}
        </button>
      </form>

      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 flex items-start gap-2 border-2 border-signal bg-danger-bg px-4 py-3">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}

      {results && (
        <div className="mt-6">
          {results.length === 0 ? (
            <p className="border-2 border-dashed border-fg/40 p-6 text-fg-2">
              Adresse introuvable. Précisez le numéro, la voie, le code postal et la commune.
            </p>
          ) : (
            <>
              <p className="text-sm text-fg-2">Plusieurs adresses correspondent. Choisissez la bonne :</p>
              <ul className="mt-3 border-t border-fg">
                {results.map((r) => (
                  <li key={r.banId} className="border-b border-rule">
                    <button
                      type="button"
                      onClick={() => pick(r)}
                      className="group flex w-full flex-wrap items-baseline justify-between gap-3 py-4 text-left hover:bg-surface sm:px-2"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.label}</span>
                        <span className="mt-1 font-mono text-xs text-fg-2">
                          {r.postcode ?? ""} {r.city ?? ""}
                          {r.type && <> · {r.type}</>}
                        </span>
                      </span>
                      <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
