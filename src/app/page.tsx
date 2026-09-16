import Link from "next/link";
import Chat from "@/components/Chat";
import { getDb, type Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { Empty, FaqCard, accent, card } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  { emoji: "📜", title: "Textes officiels", text: "Nous partons des articles en vigueur publiés sur Légifrance." },
  { emoji: "💡", title: "Expliqués simplement", text: "Chaque règle est reformulée en français clair, sans jargon." },
  { emoji: "🔗", title: "Sources citées", text: "Chaque réponse renvoie aux articles de loi exacts, vérifiables." },
];

export default function Home() {
  // ponytail: first 6 by id, add a popularity column when there is traffic data
  const faqs = getDb()
    .prepare("SELECT theme, slug, emoji, question, short FROM faq ORDER BY id LIMIT 6")
    .all() as Faq[];

  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-12 sm:pt-24">
        <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800 dark:bg-violet-400/15 dark:text-violet-200">
          Loi + voilà ✨
        </p>
        <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.02] tracking-tighter sm:text-7xl">
          Le droit français, enfin lisible.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl dark:text-slate-400">
          Travail, construction, location : posez votre question, nous vous répondons simplement, articles de loi à
          l’appui.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#question"
            className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Poser une question
          </a>
          <a
            href="#themes"
            className="rounded-full border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
          >
            Explorer les thèmes
          </a>
        </div>
      </section>

      <section id="themes" className="mx-auto grid max-w-5xl scroll-mt-20 gap-4 px-5 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {THEMES.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`} className={`${card} p-6`}>
            <span aria-hidden className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${accent(t.slug).bg}`}>
              {t.emoji}
            </span>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">{t.title}</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t.tagline}</p>
            <p className="mt-4 text-sm font-semibold text-violet-700 dark:text-violet-300">Voir les questions →</p>
          </Link>
        ))}
      </section>

      <section id="question" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Une question ? Demandez.</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Décrivez votre situation, la réponse cite les articles de loi utilisés.
        </p>
        <div className="mt-6">
          <Chat />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Questions les plus posées</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {faqs.map((f) => (
            <FaqCard key={f.slug} faq={f} />
          ))}
        </div>
        {faqs.length === 0 && <Empty>📚 Les premières questions arrivent très bientôt.</Empty>}
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Comment ça marche</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl bg-slate-100 p-6 dark:bg-white/5">
              <p className="text-sm font-bold text-slate-500">
                {i + 1} <span aria-hidden>· {s.emoji}</span>
              </p>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
