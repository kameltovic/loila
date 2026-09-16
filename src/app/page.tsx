import Link from "next/link";
import { ArrowRight, BookOpenCheck, Link2, Landmark, MessageCircleQuestion, RefreshCw, ScrollText, ShieldCheck } from "lucide-react";
import Chat from "@/components/Chat";
import { getDb, type Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { Empty, FaqCard, IconTile, card, container, eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Landmark, title: "Textes officiels", text: "Nous partons des articles en vigueur publiés sur Légifrance." },
  { icon: BookOpenCheck, title: "Expliqués simplement", text: "Chaque règle est reformulée en français clair, sans jargon." },
  { icon: Link2, title: "Sources citées", text: "Chaque réponse renvoie aux articles de loi exacts, vérifiables." },
];

export default function Home() {
  const db = getDb();
  // ponytail: first 6 by id, add a popularity column when there is traffic data
  const faqs = db.prepare("SELECT theme, slug, emoji, question, short FROM faq ORDER BY id LIMIT 6").all() as Faq[];
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  // Round down to a friendly figure: 35 812 -> "35 000+".
  const articles = n >= 1000 ? `${(Math.floor(n / 1000) * 1000).toLocaleString("fr-FR")}+` : n.toLocaleString("fr-FR");

  const trust = [
    { icon: ScrollText, label: `${articles} articles officiels` },
    { icon: ShieldCheck, label: "Sources Légifrance citées" },
    { icon: RefreshCw, label: "Mis à jour chaque jour" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200/70 dark:border-white/10">
        <div className={`${container} pt-14 pb-16 sm:pt-20 sm:pb-20`}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-fg">
              <Landmark aria-hidden size={14} /> Loi + voilà
            </p>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tighter text-balance sm:text-6xl lg:text-7xl">
              Le droit français, enfin lisible.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-slate-600 sm:text-xl dark:text-slate-400">
              Travail, construction, location : posez votre question, nous vous répondons simplement, articles de loi
              à l’appui.
            </p>
          </div>

          <div id="question" className="mx-auto mt-10 max-w-3xl scroll-mt-24">
            <Chat variant="hero" />
          </div>

          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2">
                <Icon aria-hidden size={18} className="text-brand-fg" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="scroll-mt-20 py-16 sm:py-20">
        <div className={container}>
          <p className={eyebrow}>Thèmes</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Par où commencer ?</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {THEMES.map((t) => (
              <Link key={t.slug} href={`/${t.slug}`} className={`${card} group flex flex-col p-6`}>
                <IconTile slug={t.slug} />
                <h3 className="mt-5 text-xl font-extrabold tracking-tight">{t.title}</h3>
                <p className="mt-2 flex-1 text-slate-600 dark:text-slate-400">{t.tagline}</p>
                <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-fg">
                  Voir les questions <ArrowRight aria-hidden size={16} className="transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular questions */}
      <section className="bg-muted py-16 sm:py-20">
        <div className={container}>
          <p className={eyebrow}>Questions fréquentes</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Les questions les plus posées</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((f) => (
              <FaqCard key={f.slug} faq={f} />
            ))}
          </div>
          {faqs.length === 0 && <Empty>Les premières questions arrivent très bientôt.</Empty>}
        </div>
      </section>

      {/* How it works */}
      <section id="comment-ca-marche" className="scroll-mt-20 py-16 sm:py-20">
        <div className={container}>
          <p className={eyebrow}>Méthode</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Comment ça marche</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
                    <Icon aria-hidden size={22} />
                  </span>
                  <span className="text-sm font-bold text-slate-400">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight">{title}</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <h2 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">Une situation précise ? Demandez.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Décrivez votre cas en quelques mots, la réponse cite les articles de loi utilisés.
          </p>
          <a href="#question" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-brand-strong shadow-sm transition hover:bg-white/90">
            <MessageCircleQuestion aria-hidden size={18} /> Poser ma question
          </a>
        </div>
      </section>
    </>
  );
}
