"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Loader2 } from "lucide-react";
import type { JuriResult } from "@/lib/juri-ask";
import { label } from "@/components/ui";

const EXAMPLES = [
  "Une rupture conventionnelle peut-elle être annulée pour vice du consentement ?",
  "Quelles conditions pour faire jouer la clause résolutoire d’un bail d’habitation ?",
  "Le salarié peut-il prendre acte de la rupture pour un manquement ancien de l’employeur ?",
];

/** "[D2]" in the answer → a link to that decision's page. */
function withLinks(md: string, r: JuriResult) {
  const urls = new Map(r.decisions.map((d) => [d.ref, d.url]));
  return md.replace(/\[(D\d+)\]/g, (m, ref: string) => (urls.has(ref) ? `[[${ref}]](${urls.get(ref)})` : m));
}

export default function JuriAssistant() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<JuriResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(q = question) {
    if (loading || q.trim().length < 10) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/juri-ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erreur.");
      else setResult(data);
    } catch {
      setError("Connexion impossible, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-3">
        <label htmlFor="juri-q" className={label}>Votre question de droit</label>
        <textarea
          id="juri-q"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex. : un licenciement pour inaptitude est-il sans cause réelle et sérieuse si l’employeur n’a pas consulté le CSE ?"
          className="w-full border-2 border-fg bg-bg px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 border-2 border-fg bg-fg px-5 py-2.5 font-mono text-sm font-bold uppercase text-bg disabled:opacity-60">
            {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
            {loading ? "Recherche dans la jurisprudence…" : "Interroger"}
          </button>
        </div>
        {!result && !loading && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Exemples">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button type="button" onClick={() => submit(ex)} className="border border-fg px-3 py-1.5 text-left text-sm hover:bg-fg hover:text-bg">{ex}</button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {error && <p role="alert" className="border-2 border-fg bg-surface p-4">{error}</p>}

      {result && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div aria-live="polite" className="prose-answer border-2 border-fg bg-surface p-6 sm:p-8 [&_a]:font-semibold [&_a]:underline [&_a]:decoration-signal [&_a]:decoration-2 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-2">
            <ReactMarkdown>{withLinks(result.answer_md, result)}</ReactMarkdown>
          </div>
          <aside className="space-y-6">
            {result.decisions.length > 0 && (
              <div>
                <h2 className={`${label} text-fg-2`}>Décisions citées</h2>
                <ul className="mt-3 space-y-2">
                  {result.decisions.map((d) => (
                    <li key={d.id}>
                      <Link href={d.url} className="block border-2 border-fg p-3 text-sm hover:bg-fg hover:text-bg">
                        <span className="font-mono font-bold">[{d.ref}]</span> {d.citation}
                        {d.solution && <span className="block font-mono text-xs uppercase opacity-70">{d.solution}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.articles.length > 0 && (
              <div>
                <h2 className={`${label} text-fg-2`}>Articles</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {result.articles.map((a) => (
                    <li key={a.id}>
                      <Link href={`/article/${a.id}`} className="inline-flex rounded-full border-[1.5px] border-fg px-2.5 py-0.5 font-mono text-xs font-semibold hover:bg-fg hover:text-bg">Art. {a.num}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-fg-2">Réponse générée à partir des sources listées, à vérifier dans les décisions. Ne constitue pas une consultation juridique.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
