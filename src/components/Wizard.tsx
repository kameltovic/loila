"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUp, Info, Loader2 } from "lucide-react";
import type { DossierView, Question } from "@/lib/wizard";
import type { Me } from "@/lib/plans";
import { ArticleDrawerProvider } from "@/components/ArticleDrawer";
import { useMe } from "@/components/AccountMenu";
import { Answer } from "@/components/Chat";
import Paywall from "@/components/Paywall";
import { btnPrimary, display, label } from "@/components/ui";

const STEPS = ["Votre situation", "Précisions", "Synthèse"];
const DONT_KNOW = "Je ne sais pas";
const STORY_KEY = "loila.story";
const MIN_STORY = 30;
const MAX_STORY = 3000;
const LOADING: Record<"start" | "synthesize" | "followup", string[]> = {
  start: ["Lecture de votre récit…", "Recherche des articles de loi applicables…", "Repérage des conditions qui changent la règle…", "Préparation des questions…"],
  synthesize: ["Recherche affinée avec vos réponses…", "Lecture des articles…", "Rédaction de la synthèse…", "Vérification des formulations…"],
  followup: ["Recherche des articles…", "Rédaction de la réponse…"],
};

type Busy = keyof typeof LOADING | null;
type Values = Record<string, string>;

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : { error: "Impossible de joindre le serveur. Vérifiez votre connexion." };
  return { status: res?.status ?? 0, data: data as { error?: string; code?: string; dossier?: DossierView; me?: Me } };
}

// Stored answers ("20/07/2026", "Je ne sais pas") → form values.
function initialValues(d: DossierView | undefined): Values {
  const out: Values = {};
  for (const a of d?.answers?.items ?? []) {
    const q = d?.questions.find((x) => x.id === a.id);
    out[a.id] = q?.type === "date" && /^\d{2}\/\d{2}\/\d{4}$/.test(a.answer) ? a.answer.split("/").reverse().join("-") : a.answer;
  }
  return out;
}

function LoadingState({ busy }: { busy: Busy }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setI((n) => Math.min(n + 1, LOADING[busy].length - 1)), 3500);
    return () => clearInterval(t);
  }, [busy]);
  return (
    <p role="status" aria-live="polite" className="flex min-h-12 items-center gap-3 border-2 border-fg bg-surface px-4 py-3 font-mono text-sm">
      {busy && (
        <>
          <Loader2 aria-hidden className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
          <span>{LOADING[busy][i]} <span className="text-fg-2">Cela prend quelques secondes.</span></span>
        </>
      )}
    </p>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 border-2 border-signal bg-danger-bg px-4 py-3 text-fg">
      <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
      {children}
    </p>
  );
}

function QuestionField({ q, index, total, value, onChange }: { q: Question; index: number; total: number; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const unknown = value === DONT_KNOW;
  const choice = "flex cursor-pointer items-start gap-3 border-2 border-fg bg-bg px-4 py-3 transition has-checked:bg-fg has-checked:text-bg has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus";
  return (
    <div className="border-2 border-fg bg-surface p-5 sm:p-6">
    <fieldset className="min-w-0" aria-describedby={q.why ? `${id}-why` : undefined}>
      <legend className="block w-full">
        <span className={`${label} block text-fg-2`}>
          Question {index + 1} / {total}
          {q.article && <span className="font-mono normal-case tracking-normal"> · art. {q.article}</span>}
        </span>
        <span className="mt-2 block font-display text-xl leading-tight font-bold tracking-[-0.02em] sm:text-2xl">{q.question}</span>
      </legend>
      {q.why && (
        <p id={`${id}-why`} className="mt-2 flex items-start gap-2 text-sm text-fg-2">
          <Info aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          {q.why}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {q.type === "choice" ? (
          q.options.map((o) => (
            <label key={o} className={choice}>
              <input type="radio" name={id} value={o} checked={value === o} onChange={() => onChange(o)} className="mt-0.5 size-5 shrink-0 accent-[var(--signal)] focus:outline-none" />
              <span className="min-w-0 break-words">{o}</span>
            </label>
          ))
        ) : (
          <>
            <label htmlFor={`${id}-input`} className="sr-only">
              {q.type === "date" ? "Date" : "Votre réponse"}
            </label>
            <input
              id={`${id}-input`}
              type={q.type === "date" ? "date" : "text"}
              maxLength={300}
              disabled={unknown}
              value={unknown ? "" : value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-12 w-full min-w-0 border-2 border-fg bg-bg px-4 text-base text-fg disabled:opacity-50"
            />
            <label className={choice}>
              <input type="checkbox" checked={unknown} onChange={(e) => onChange(e.target.checked ? DONT_KNOW : "")} className="mt-0.5 size-5 shrink-0 accent-[var(--signal)] focus:outline-none" />
              {DONT_KNOW}
            </label>
          </>
        )}
      </div>
    </fieldset>
    </div>
  );
}

export default function Wizard({ initial }: { initial?: DossierView }) {
  const [dossier, setDossier] = useState<DossierView | undefined>(initial);
  const [story, setStory] = useState("");
  const [values, setValues] = useState<Values>(() => initialValues(initial));
  const [note, setNote] = useState(initial?.answers?.note ?? "");
  const [followup, setFollowup] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [gate, setGate] = useState<"auth" | "quota" | null>(null);
  const closeGate = useCallback(() => setGate(null), []);
  const { me, setMe } = useMe();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const storyId = useId();
  const noteId = useId();
  const followId = useId();

  const step = !dossier ? 0 : dossier.status === "done" ? 2 : 1;
  const prevStep = useRef(step);
  useEffect(() => {
    // Move focus to the new step's heading so screen reader and keyboard users land on it.
    if (prevStep.current !== step) headingRef.current?.focus();
    prevStep.current = step;
  }, [step]);

  // A story typed before signing up survives the magic link round trip.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, unavailable during SSR
      if (saved && !initial) setStory(saved);
    } catch {}
  }, [initial]);

  async function run(action: Exclude<Busy, null>, url: string, body: object) {
    setBusy(action);
    setError("");
    const { status, data } = await post(url, body);
    if (data.me) setMe(data.me);
    if (data.dossier) setDossier(data.dossier);
    setBusy(null);
    if (status === 401 && data.code === "auth") setGate("auth");
    else if (status === 402) setGate("quota");
    else if (status < 200 || status >= 300) setError(data.error ?? "Une erreur est survenue, réessayez.");
    else return data.dossier ?? null;
    return null;
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const text = story.trim();
    if (text.length < MIN_STORY) return setError(`Décrivez votre situation en au moins ${MIN_STORY} caractères.`);
    try {
      sessionStorage.setItem(STORY_KEY, text);
    } catch {}
    if (me && !me.email) return setGate("auth");
    const d = await run("start", "/api/dossiers", { story: text });
    if (!d) return;
    try {
      sessionStorage.removeItem(STORY_KEY);
    } catch {}
    window.history.replaceState(null, "", `/dossier/${d.id}`);
  }

  async function synthesize(e: React.FormEvent) {
    e.preventDefault();
    if (!dossier) return;
    const items = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === DONT_KNOW ? "" : v]));
    await run("synthesize", `/api/dossiers/${dossier.id}`, { action: "synthesize", answers: { items, note } });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!dossier || followup.trim().length < 3) return;
    if (await run("followup", `/api/dossiers/${dossier.id}`, { action: "followup", question: followup.trim() })) setFollowup("");
  }

  const heading = (text: React.ReactNode) => (
    <h2 ref={headingRef} tabIndex={-1} className={`${display} text-3xl leading-[0.95] text-balance focus:outline-none sm:text-5xl`}>
      {text}
    </h2>
  );
  const quotaNote = me?.email && (
    <p className="text-sm text-fg-2">
      La synthèse et chaque question de suivi comptent pour une question
      {me.canAsk ? "" : " : votre quota est épuisé, une offre vous sera proposée"}. Les questions de clarification sont gratuites.
    </p>
  );

  return (
    <ArticleDrawerProvider>
      <ol aria-label="Étapes du dossier" className="grid grid-cols-3 border-2 border-fg">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`min-w-0 px-2 py-2.5 sm:px-4 ${i ? "border-l-2 border-fg" : ""} ${i === step ? "bg-fg text-bg" : i < step ? "bg-surface" : "text-fg-2"}`}
          >
            <span className="block font-display text-lg font-extrabold tabular-nums sm:text-2xl">
              {String(i + 1).padStart(2, "0")}
              <span className="sr-only">{i < step ? " (terminée)" : ""}</span>
            </span>
            <span className="block font-mono text-[0.6875rem] leading-tight font-bold uppercase break-words sm:text-xs">{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 space-y-6">
        {step === 0 && (
          <form onSubmit={start} className="space-y-6" noValidate>
            {heading(<>Racontez, <span className="font-serif font-normal italic">avec vos mots.</span></>)}
            <div>
              <label htmlFor={storyId} className="block font-semibold">
                Décrivez votre situation
              </label>
              <p id={`${storyId}-hint`} className="mt-1 text-sm text-fg-2">
                Les dates, les montants, le type de contrat ou de bail et ce qui a déjà été fait aident à cibler les règles. Évitez les noms
                et coordonnées : ils ne sont pas utiles.
              </p>
              <textarea
                id={storyId}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                aria-describedby={`${storyId}-hint ${storyId}-count`}
                minLength={MIN_STORY}
                maxLength={MAX_STORY}
                rows={8}
                disabled={busy === "start"}
                placeholder="Ex. : j’ai quitté mon appartement le 20 juillet, l’état des lieux était bon, mais le propriétaire ne m’a toujours pas rendu les 750 € de dépôt de garantie…"
                className="mt-3 block w-full min-w-0 resize-y border-2 border-fg bg-white p-4 text-base text-ink shadow-hard-ink placeholder:text-[#5a564e] disabled:opacity-60 sm:text-lg dark:shadow-[4px_4px_0_0_#ff4a1c]"
              />
              <p id={`${storyId}-count`} className="mt-2 text-right font-mono text-xs text-fg-2">
                {story.trim().length} / {MAX_STORY}
              </p>
            </div>
            {busy === "start" ? <LoadingState busy={busy} /> : (
              <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
                Analyser ma situation <ArrowRight aria-hidden className="size-4" />
              </button>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <p className="text-sm text-fg-2">
              Gratuit jusqu’aux questions de clarification · compte requis · information juridique générale, pas un avis sur votre cas.
            </p>
          </form>
        )}

        {step === 1 && dossier?.status === "hors_sujet" && (
          <div className="space-y-6">
            {heading(<>Hors de notre <span className="font-serif font-normal italic">champ.</span></>)}
            <p className="border-2 border-fg bg-surface px-5 py-4">
              Cette situation ne semble pas relever des thèmes couverts par les dossiers : travail, location d’un logement,
              urbanisme. Aucune question n’a été décomptée.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setStory(dossier.story);
                  setDossier(undefined);
                  window.history.replaceState(null, "", "/dossier/nouveau");
                }}
              >
                Décrire une autre situation <ArrowRight aria-hidden className="size-4" />
              </button>
              <Link href="/#question" className="px-3 py-2.5 font-mono text-sm font-bold uppercase underline decoration-signal decoration-2 underline-offset-4">
                Poser une question rapide
              </Link>
            </div>
          </div>
        )}

        {step === 1 && dossier && dossier.status !== "hors_sujet" && (
          <form onSubmit={synthesize} className="space-y-6">
            {heading(dossier.questions.length ? <>Quelques <span className="font-serif font-normal italic">précisions.</span></> : <>Tout est <span className="font-serif font-normal italic">clair.</span></>)}
            <p className="text-fg-2">
              {dossier.questions.length
                ? "Ces réponses changent la règle applicable selon les articles trouvés. Répondez « Je ne sais pas » si besoin : la synthèse indiquera les différents cas."
                : "Votre récit suffit pour exposer les règles applicables : pas de question complémentaire."}
            </p>
            <details className="border-2 border-fg bg-surface px-5 py-3">
              <summary className="cursor-pointer font-semibold">Votre récit</summary>
              <p className="mt-2 whitespace-pre-line text-fg-2">{dossier.story}</p>
            </details>
            {dossier.questions.map((q, i) => (
              <QuestionField key={q.id} q={q} index={i} total={dossier.questions.length} value={values[q.id] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [q.id]: v }))} />
            ))}
            <div>
              <label htmlFor={noteId} className="block font-semibold">
                Une précision à ajouter ? <span className="font-normal text-fg-2">(facultatif)</span>
              </label>
              <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} className="mt-2 block w-full min-w-0 border-2 border-fg bg-surface p-3 text-base" />
            </div>
            {quotaNote}
            {busy === "synthesize" ? <LoadingState busy={busy} /> : (
              <button type="submit" disabled={!!busy} className={`${btnPrimary} w-full bg-fg! text-bg! sm:w-auto`}>
                Obtenir ma synthèse <ArrowRight aria-hidden className="size-4" />
              </button>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
          </form>
        )}

        {step === 2 && dossier?.synthesis_md && (
          <div className="space-y-6">
            {heading(<>Votre <span className="font-serif font-normal italic">synthèse.</span></>)}
            <p role="note" className="border-l-4 border-signal pl-4 text-[0.9375rem]">
              <strong>Information juridique générale</strong> sur une situation comme la vôtre, établie à partir des articles de loi cités.
              Ce n’est pas un avis sur votre cas : pour une décision importante, consultez un professionnel.
            </p>
            <Answer result={{ source: "llm", answer_md: dossier.synthesis_md, articles: dossier.articles }} />
            <details className="border-2 border-fg bg-surface px-5 py-3">
              <summary className="cursor-pointer font-semibold">Votre récit et vos réponses</summary>
              <p className="mt-2 whitespace-pre-line text-fg-2">{dossier.story}</p>
              {!!dossier.answers?.items.length && (
                <dl className="mt-3 space-y-2 border-t border-rule pt-3 text-sm">
                  {dossier.answers.items.map((a) => (
                    <div key={a.id}>
                      <dt className="font-semibold">{a.question}</dt>
                      <dd className="text-fg-2">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {dossier.answers?.note && <p className="mt-3 text-sm text-fg-2">Précision : {dossier.answers.note}</p>}
            </details>

            <section aria-labelledby={`${followId}-title`} className="space-y-6 border-t-2 border-fg pt-8">
              <h3 id={`${followId}-title`} className={`${display} text-2xl sm:text-4xl`}>Questions de suivi</h3>
              {dossier.messages.map((m) => (
                <div key={m.id} className="space-y-3">
                  <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-none bg-ink px-4 py-2.5 break-words text-paper dark:bg-paper dark:text-ink">{m.question}</p>
                  <Answer result={{ source: "llm", answer_md: m.answer_md, articles: m.articles }} />
                </div>
              ))}
              <form onSubmit={ask} className="space-y-3">
                <label htmlFor={followId} className="block font-semibold">
                  Une autre question sur ce dossier
                </label>
                <div className="flex items-stretch gap-2 border-2 border-ink bg-white p-1.5 pl-4 text-ink shadow-hard-ink dark:shadow-[4px_4px_0_0_#ff4a1c]">
                  <textarea
                    id={followId}
                    value={followup}
                    onChange={(e) => setFollowup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={500}
                    placeholder="Ex. : comment rédiger la lettre de relance ?"
                    className="field-sizing-content max-h-48 min-h-12 min-w-0 flex-1 resize-none self-center bg-transparent py-3 text-base placeholder:text-[#5a564e] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!!busy || followup.trim().length < 3}
                    aria-label="Envoyer la question de suivi"
                    className="grid size-12 shrink-0 place-items-center self-end bg-ink text-paper transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:text-paper/40"
                  >
                    <ArrowUp aria-hidden className="size-6" />
                  </button>
                </div>
                {busy === "followup" && <LoadingState busy={busy} />}
                {error && <ErrorBox>{error}</ErrorBox>}
                {quotaNote}
              </form>
            </section>
          </div>
        )}
      </div>
      {gate && <Paywall me={me} reason={gate} onClose={closeGate} />}
    </ArticleDrawerProvider>
  );
}
