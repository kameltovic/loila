"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUp, Bot, Loader2, Scale, Zap } from "lucide-react";
import type { AskResult } from "@/lib/ask";
import { faqUrl } from "@/lib/themes";
import { ArticleDrawerProvider, ArticleLink, ArticleMarkdown } from "@/components/ArticleDrawer";
import { useMe } from "@/components/AccountMenu";
import Paywall from "@/components/Paywall";
import { FREE_QUESTIONS, type Me } from "@/lib/plans";

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
  const [gate, setGate] = useState<"auth" | "quota" | null>(null);
  const closeGate = useCallback(() => setGate(null), []);
  const { me, setMe } = useMe();
  const nextId = useRef(0);
  const inputId = useId();
  const examples = EXAMPLES[theme ?? ""] ?? EXAMPLES.default;
  const hero = variant === "hero";

  // A question typed before signing up is kept so it can be sent right after the magic link.
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("loila.pending");
      if (pending) {
        sessionStorage.removeItem("loila.pending");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, unavailable during SSR
        setInput(pending);
      }
    } catch {}
  }, []);

  function requireAccount(question: string, pendingId?: number) {
    if (pendingId !== undefined) setMessages((m) => m.filter((msg) => msg.id !== pendingId));
    try {
      sessionStorage.setItem("loila.pending", question);
    } catch {}
    setInput(question);
    setLoading(false);
    setGate("auth");
  }

  async function send(text: string) {
    const question = text.trim();
    if (question.length < 3 || loading) return;
    if (me && !me.email) return requireAccount(question); // asking requires an account
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
      if (data.me) setMe(data.me as Me);
      if (res.status === 401 && data.code === "auth") return requireAccount(question, id);
      if (res.status === 402) {
        // Paywall: drop the pending bubble, give the question back so it can be resent after purchase/login.
        setMessages((m) => m.filter((msg) => msg.id !== id));
        setInput(question);
        setLoading(false);
        setGate("quota");
        return;
      }
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
      className={`flex items-stretch gap-2 border-2 border-ink bg-white text-ink transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg dark:border-paper ${
        hero
          ? "rounded-2xl p-2 pl-5 shadow-[6px_6px_0_0_#0e0e0e] sm:p-2.5 sm:pl-7 dark:shadow-[6px_6px_0_0_#ff4a1c]"
          : "rounded-xl p-1.5 pl-4 shadow-hard-ink dark:shadow-[4px_4px_0_0_#ff4a1c]"
      }`}
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
        rows={1}
        maxLength={500}
        placeholder="Ex. : mon propriétaire garde ma caution, que faire ?"
        className={`field-sizing-content max-h-48 min-w-0 flex-1 resize-none self-center bg-transparent text-ink placeholder:text-[#5a564e] focus:outline-none ${
          hero ? "min-h-14 py-3.5 text-lg sm:min-h-[4.5rem] sm:py-5 sm:text-xl" : "min-h-12 py-3 text-base sm:text-lg"
        }`}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label={loading ? "Envoi en cours" : "Envoyer la question"}
        className={`grid shrink-0 place-items-center self-end rounded-xl bg-ink text-paper transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:bg-ink disabled:text-paper/40 ${
          hero ? "size-14 sm:size-[4.5rem]" : "size-12"
        }`}
      >
        {loading ? (
          <Loader2 aria-hidden className="size-6 animate-spin" />
        ) : (
          <ArrowUp aria-hidden strokeWidth={2} className={hero ? "size-7" : "size-6"} />
        )}
      </button>
    </form>
  );

  const chips = messages.length === 0 && (
    <ul className="mt-5 flex flex-wrap gap-2" aria-label="Exemples de questions">
      {examples.map((q) => (
        <li key={q}>
          <button
            type="button"
            onClick={() => send(q)}
            className="rounded-[1.25rem] border-[1.5px] border-fg px-3.5 py-1.5 text-left text-sm font-medium transition hover:bg-fg hover:text-bg"
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
          <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-none bg-ink px-4 py-2.5 text-paper dark:bg-paper dark:text-ink">
            {m.question}
          </p>
          {m.error ? (
            <p role="alert" className="flex items-start gap-2.5 border-2 border-signal bg-danger-bg px-4 py-3 text-fg">
              <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
              {m.error}
            </p>
          ) : m.result ? (
            <Answer result={m.result} />
          ) : (
            <p className="flex items-center gap-2 text-fg-2">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Recherche dans les textes de loi…
            </p>
          )}
        </div>
      ))}
    </div>
  );

  const disclaimer = (
    <p className="mt-4 text-xs text-fg-2">
      {me?.email ? (
        <>
          <Link href="/tarifs" className="underline decoration-rule underline-offset-2 hover:decoration-signal">
            {quota(me)}
          </Link>
          {" · les réponses existantes sont gratuites"}
          <br />
        </>
      ) : me ? (
        <>
          <Link href="/connexion" className="underline decoration-rule underline-offset-2 hover:decoration-signal">
            Créez votre compte pour poser une question
          </Link>
          {` · ${FREE_QUESTIONS} questions offertes`}
          <br />
        </>
      ) : null}
      Information générale, pas un conseil juridique.
    </p>
  );
  const modal = gate && <Paywall me={me} reason={gate} onClose={closeGate} />;

  if (hero) {
    return (
      <ArticleDrawerProvider>
        <section aria-label="Poser une question" className="w-full">
          {form}
          {chips}
          {disclaimer}
          {messages.length > 0 && <div className="mt-8">{thread}</div>}
        </section>
        {modal}
      </ArticleDrawerProvider>
    );
  }

  return (
    <ArticleDrawerProvider>
      <section className="rounded-2xl border-2 border-fg bg-surface p-5 sm:p-8">
        {title && <h2 className="mb-6 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">{title}</h2>}
        {messages.length > 0 && <div className="mb-6">{thread}</div>}
        {form}
        {chips}
        {disclaimer}
      </section>
      {modal}
    </ArticleDrawerProvider>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function quota(me: Me): string {
  const dossier = me.credits > 0 && me.creditsExpireAt
    ? `${plural(me.credits, "question")} du Dossier jusqu’au ${new Date(me.creditsExpireAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
    : "";
  const extra = dossier ? ` + ${dossier}` : "";
  if (me.plan === "pro") return `${plural(Math.max(0, me.monthlyLimit - me.monthlyUsed), "question")} IA ce mois${extra}`;
  if (me.freeLeft > 0) return `${plural(me.freeLeft, "question")} IA ${me.freeLeft > 1 ? "offertes" : "offerte"}${extra}`;
  return dossier || "Questions IA offertes utilisées, voir les tarifs";
}

export function Answer({ result }: { result: AskResult }) {
  const instant = result.source === "faq" || result.source === "cache";
  return (
    <div className="rounded-xl border-2 border-fg bg-bg px-5 py-5 sm:px-7 sm:py-6">
      {result.source !== "none" && (
        <span
          className={`mb-4 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-ink ${
            instant ? "bg-travail" : "bg-logement"
          }`}
        >
          {instant ? <Zap aria-hidden strokeWidth={1.75} className="size-3.5" /> : <Bot aria-hidden strokeWidth={1.75} className="size-3.5" />}
          {instant ? "Réponse instantanée" : "Réponse générée par IA"}
        </span>
      )}
      <div className="prose-loila">
        <ArticleMarkdown md={result.answer_md} articles={result.articles} />
      </div>
      {result.faq && (
        <Link
          href={faqUrl(result.faq)}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-signal decoration-2 underline-offset-4 hover:bg-signal hover:text-ink"
        >
          Voir la fiche : {result.faq.question}
          <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
        </Link>
      )}
      {result.articles.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2 border-t border-rule pt-4" aria-label="Articles cités">
          {result.articles.map((a) => (
            <li key={a.id}>
              <ArticleLink
                id={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-fg px-3 py-1 text-xs font-semibold transition hover:bg-fg hover:text-bg"
              >
                <Scale aria-hidden strokeWidth={1.75} className="size-3.5" />
                {a.num ? `art. ${a.num}` : "Article"}
              </ArticleLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
