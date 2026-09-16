"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { AskResult } from "@/lib/ask";

const EXAMPLES: Record<string, string[]> = {
  travail: [
    "Combien de jours de congés payés ai-je par an ?",
    "Comment fonctionne une rupture conventionnelle ?",
    "Quelle est la durée de la période d'essai en CDI ?",
    "Mon employeur peut-il refuser mes congés ?",
  ],
  urbanisme: [
    "Faut-il un permis pour construire un abri de jardin ?",
    "Quelle différence entre permis de construire et déclaration préalable ?",
    "Combien de temps pour obtenir un permis de construire ?",
  ],
  logement: [
    "Quel est le préavis pour quitter un logement vide ?",
    "Sous quel délai le dépôt de garantie doit-il être rendu ?",
    "Le propriétaire peut-il augmenter le loyer en cours de bail ?",
  ],
  default: [
    "Quel est le préavis pour quitter un logement vide ?",
    "Comment fonctionne une rupture conventionnelle ?",
    "Faut-il un permis pour construire une piscine ?",
  ],
};

type Message = { id: number; question: string; result?: AskResult; error?: string };

export default function Chat({ theme }: { theme?: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);
  const inputId = useId();
  const examples = EXAMPLES[theme ?? ""] ?? EXAMPLES.default;

  async function send(text: string) {
    const question = text.trim();
    if (question.length < 3 || loading) return;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, question }]);
    setInput("");
    setLoading(true);
    let patch: Partial<Message>;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, theme }),
      });
      const data = await res.json().catch(() => ({}));
      patch = res.ok ? { result: data as AskResult } : { error: data.error ?? "Une erreur est survenue." };
    } catch {
      patch = { error: "Impossible de joindre le serveur. Vérifiez votre connexion." };
    }
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)));
    setLoading(false);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Posez votre question 💬</h2>

      <div aria-live="polite" className="mt-6 space-y-6">
        {messages.map((m) => (
          <div key={m.id} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-white">{m.question}</p>
            {m.error ? (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {m.error}
              </p>
            ) : m.result ? (
              <Answer result={m.result} />
            ) : (
              <p className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <span className="size-2 animate-pulse rounded-full bg-indigo-500" aria-hidden />
                Recherche dans les textes de loi…
              </p>
            )}
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Exemples de questions">
          {examples.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-sm text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Votre question
        </label>
        <textarea
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={500}
          placeholder="Ex. : mon propriétaire garde ma caution, que faire ?"
          className="min-h-14 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length < 3}
          className="rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Envoi…" : "Envoyer"}
        </button>
      </form>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Information générale, pas un conseil juridique.</p>
    </section>
  );
}

function Answer({ result }: { result: AskResult }) {
  const instant = result.source === "faq" || result.source === "cache";
  return (
    <div className="rounded-2xl rounded-bl-sm bg-zinc-50 px-4 py-4 dark:bg-zinc-800/60">
      {result.source !== "none" && (
        <span
          className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            instant
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300"
          }`}
        >
          {instant ? "⚡ Réponse instantanée" : "✨ Réponse générée"}
        </span>
      )}
      <div className="space-y-3 text-zinc-800 dark:text-zinc-200 [&_a]:text-indigo-600 [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_strong]:font-semibold">
        <ReactMarkdown>{result.answer_md}</ReactMarkdown>
      </div>
      {result.faq && (
        <Link
          href={`/${result.faq.theme}/${result.faq.slug}`}
          className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Voir la fiche : {result.faq.question} →
        </Link>
      )}
      {result.articles.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Articles cités">
          {result.articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/article/${a.id}`}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                art. {a.num}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
