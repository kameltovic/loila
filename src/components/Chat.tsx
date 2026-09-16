"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUp, Loader2, MessageCircleQuestion, Scale, Sparkles, Zap } from "lucide-react";
import type { AskResult } from "@/lib/ask";
import { ArticleDrawerProvider, ArticleLink, ArticleMarkdown } from "@/components/ArticleDrawer";

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

export default function Chat({
  theme,
  variant = "default",
  title = "Posez votre question",
}: {
  theme?: string;
  variant?: "hero" | "default";
  title?: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);
  const inputId = useId();
  const examples = EXAMPLES[theme ?? ""] ?? EXAMPLES.default;
  const hero = variant === "hero";

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

  const canSend = !loading && input.trim().length >= 3;

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className={`relative flex items-end gap-2 border bg-white transition focus-within:ring-4 dark:bg-slate-950 ${
        hero
          ? "rounded-[1.75rem] border-white/60 p-2.5 pl-5 shadow-xl shadow-slate-900/10 focus-within:ring-violet-500/25 sm:p-3 sm:pl-6 dark:border-white/15"
          : "rounded-2xl border-slate-300 p-2 pl-4 focus-within:border-violet-500 focus-within:ring-violet-500/20 dark:border-white/15"
      }`}
    >
      <MessageCircleQuestion
        aria-hidden
        className={`shrink-0 text-violet-600 dark:text-violet-400 ${hero ? "mb-3 size-6 sm:mb-3.5" : "mb-2.5 size-5"}`}
      />
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
        rows={hero ? 2 : 1}
        maxLength={500}
        placeholder="Ex. : mon propriétaire garde ma caution, que faire ?"
        className={`min-w-0 flex-1 resize-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500 ${
          hero ? "min-h-16 py-2.5 text-lg sm:text-xl" : "min-h-10 py-2"
        }`}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label={loading ? "Envoi en cours" : "Envoyer la question"}
        className={`grid shrink-0 place-items-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15 ${
          hero ? "size-12 sm:size-14" : "size-10"
        }`}
      >
        {loading ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <ArrowUp aria-hidden className={hero ? "size-6" : "size-5"} />}
      </button>
    </form>
  );

  const chips = messages.length === 0 && (
    <ul className={`mt-4 flex flex-wrap gap-2 ${hero ? "justify-center" : ""}`} aria-label="Exemples de questions">
      {examples.map((q) => (
        <li key={q}>
          <button
            type="button"
            onClick={() => send(q)}
            className={`rounded-full border px-3.5 py-1.5 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-violet-500 ${
              hero
                ? "border-white/50 bg-white/70 text-slate-800 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            }`}
          >
            {q}
          </button>
        </li>
      ))}
    </ul>
  );

  const thread = (
    <div aria-live="polite" className="space-y-6">
      {messages.map((m) => (
        <div key={m.id} className="space-y-3">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-white">{m.question}</p>
          {m.error ? (
            <p role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-red-800 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
              {m.error}
            </p>
          ) : m.result ? (
            <Answer result={m.result} />
          ) : (
            <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 aria-hidden className="size-4 animate-spin text-violet-600 dark:text-violet-400" />
              Recherche dans les textes de loi…
            </p>
          )}
        </div>
      ))}
    </div>
  );

  const disclaimer = (
    <p className={`mt-3 text-xs ${hero ? "text-center text-slate-600 dark:text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>
      Information générale, pas un conseil juridique.
    </p>
  );

  if (hero) {
    return (
      <ArticleDrawerProvider>
        <section aria-label="Poser une question" className="mx-auto w-full max-w-3xl">
          {form}
          {chips}
          {disclaimer}
          <div
            className={
              messages.length
                ? "mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-xl shadow-slate-900/5 sm:p-7 dark:border-white/10 dark:bg-slate-900"
                : undefined
            }
          >
            {thread}
          </div>
        </section>
      </ArticleDrawerProvider>
    );
  }

  return (
    <ArticleDrawerProvider>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/5">
        <h2 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
            <MessageCircleQuestion aria-hidden className="size-5" />
          </span>
          {title}
        </h2>
        <div className={messages.length ? "mt-6" : undefined}>{thread}</div>
        {chips}
        <div className="mt-5">{form}</div>
        {disclaimer}
      </section>
    </ArticleDrawerProvider>
  );
}

function Answer({ result }: { result: AskResult }) {
  const instant = result.source === "faq" || result.source === "cache";
  return (
    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 dark:border-white/10 dark:bg-white/5">
      {result.source !== "none" && (
        <span
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            instant
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300"
              : "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300"
          }`}
        >
          {instant ? <Zap aria-hidden className="size-3.5" /> : <Sparkles aria-hidden className="size-3.5" />}
          {instant ? "Réponse instantanée" : "Réponse générée par IA"}
        </span>
      )}
      <div className="prose-loila text-slate-800 dark:text-slate-200">
        <ArticleMarkdown md={result.answer_md} articles={result.articles} />
      </div>
      {result.faq && (
        <Link
          href={`/${result.faq.theme}/${result.faq.slug}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
        >
          Voir la fiche : {result.faq.question}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
      {result.articles.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Articles cités">
          {result.articles.map((a) => (
            <li key={a.id}>
              <ArticleLink
                id={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-violet-300"
              >
                <Scale aria-hidden className="size-3.5" />
                {a.num ? `art. ${a.num}` : "Article"}
              </ArticleLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
