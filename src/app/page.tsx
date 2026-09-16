import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Chat from "@/components/Chat";
import ThemeIcon from "@/components/ThemeIcon";
import { getDb, type Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { Empty, FaqIndex, SectionHead, block, container, display, label } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Textes officiels", text: "Nous partons des articles en vigueur publiés sur Légifrance, mis à jour chaque jour." },
  { title: "Expliqués simplement", text: "Chaque règle est reformulée en français clair, sans jargon inutile." },
  { title: "Sources citées", text: "Chaque réponse renvoie aux articles de loi exacts, vérifiables en un clic." },
];

export default function Home() {
  const db = getDb();
  // ponytail: first 6 by id, add a popularity column when there is traffic data
  const faqs = db.prepare("SELECT theme, slug, emoji, question, short FROM faq ORDER BY id LIMIT 6").all() as Faq[];
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  // Round down to a friendly figure: 35 812 -> "35 000+".
  const articles = n >= 1000 ? `${(Math.floor(n / 1000) * 1000).toLocaleString("fr-FR")}+` : n.toLocaleString("fr-FR");

  const conventions = THEMES.find((t) => t.slug === "conventions")?.codes.length ?? 0;
  const trust = [
    { value: articles, label: "articles de loi officiels" },
    { value: String(conventions), label: "conventions collectives couvertes" },
    { value: "Chaque jour", label: "synchronisé avec Légifrance" },
  ];

  return (
    <>
      {/* Hero */}
      <section>
        <div className={`${container} pt-12 pb-16 sm:pt-20 sm:pb-24`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Loi + voilà · Droit français
          </p>
          <h1 className={`${display} mt-6 text-[clamp(3.5rem,11vw,7.5rem)] leading-[0.92] text-balance`}>
            Le droit français, enfin <span className="font-serif font-normal tracking-[-0.02em] italic">lisible.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-2 sm:text-xl">
            Travail, construction, location : posez votre question, on vous répond simplement, articles de loi à l’appui.
          </p>

          <div id="question" className="mt-10 max-w-4xl scroll-mt-28 sm:mt-12">
            <Chat variant="hero" />
          </div>

          <ul className="mt-14 grid border-y border-fg sm:grid-cols-3">
            {trust.map((t, i) => (
              <li key={t.label} className={`flex flex-wrap items-baseline gap-x-3 py-5 sm:block sm:px-6 sm:py-6 ${i ? "border-t border-rule sm:border-t-0 sm:border-l" : "sm:pl-0"}`}>
                <span className="block font-display text-3xl font-extrabold tracking-[-0.04em] whitespace-nowrap sm:text-5xl">{t.value}</span>
                <span className="block text-fg-2 sm:mt-1">{t.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 01 Themes */}
      <section id="themes" aria-labelledby="themes-title" className="scroll-mt-20 py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="01" kicker="Thèmes" id="themes-title" title={<>Par où <span className="font-serif font-normal italic">commencer</span> ?</>} />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {THEMES.map((t) => (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className={`${block(t.slug)} group flex min-h-72 flex-col justify-between rounded-2xl border-2 border-ink p-6 transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-ink-lg motion-reduce:hover:translate-0 sm:p-8 dark:border-paper dark:hover:shadow-[7px_7px_0_0_#f4f0e8]`}
              >
                <span className="flex items-start justify-between">
                  <ThemeIcon slug={t.slug} className="size-9 sm:size-11" />
                  <span className="grid size-12 place-items-center rounded-full border-2 border-ink transition group-hover:bg-ink group-hover:text-paper">
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:-rotate-45 motion-reduce:group-hover:rotate-0" />
                  </span>
                </span>
                <span className="mt-10 block">
                  <span className={`${display} block text-4xl leading-[0.95] text-balance sm:text-5xl`}>{t.title}</span>
                  <span className="mt-3 block max-w-md text-[1.0625rem] text-ink/80">{t.tagline}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 02 Popular questions */}
      <section aria-labelledby="faq-title" className="pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead num="02" kicker="Index" id="faq-title" title="Les questions les plus posées" />
          <div className="mt-12">
            {faqs.length > 0 ? <FaqIndex faqs={faqs} showTheme /> : <Empty>Les premières questions arrivent très bientôt.</Empty>}
          </div>
        </div>
      </section>

      {/* 03 How it works */}
      <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-20 pb-20 sm:pb-28">
        <div className={container}>
          <SectionHead num="03" kicker="Méthode" id="how-title" title="Comment ça marche" />
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="border-t border-rule pt-6">
                <span aria-hidden className="block font-display text-[5.5rem] leading-[0.8] font-extrabold tracking-[-0.06em] text-signal">
                  {i + 1}
                </span>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.03em]">{title}</h3>
                <p className="mt-2 max-w-sm text-fg-2">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing band */}
      <section className="bg-ink text-paper dark:border-t dark:border-paper/15">
        <div className={`${container} flex flex-col gap-8 py-16 sm:py-24 md:flex-row md:items-end md:justify-between`}>
          <h2 className={`${display} max-w-3xl text-5xl leading-[0.95] text-balance sm:text-7xl`}>
            Une situation précise ? <span className="font-serif font-normal tracking-[-0.02em] text-signal italic">Demandez.</span>
          </h2>
          <div className="max-w-sm">
            <p className="text-paper/75">Décrivez votre cas en quelques mots, la réponse cite les articles de loi utilisés.</p>
            <a
              href="#question"
              className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-paper bg-paper px-6 py-3.5 font-semibold text-ink shadow-[4px_4px_0_0_#ff4a1c] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#ff4a1c] motion-reduce:hover:translate-y-0"
            >
              Poser ma question <ArrowRight aria-hidden strokeWidth={1.75} size={18} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
