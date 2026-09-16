import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Chat from "@/components/Chat";
import ThemeIcon from "@/components/ThemeIcon";
import { getDb, type Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { getTopic, getTopics } from "@/lib/topics";
import { Empty, FaqIndex, SectionHead, block, container, display, label } from "@/components/ui";
import { JsonLd, SITE_NAME, SITE_URL, pageMetadata } from "@/lib/seo";

export const metadata = {
  ...pageMetadata({
    title: "Droit du travail, logement, urbanisme expliqués simplement",
    description:
      "Congés, licenciement, bail, permis de construire : des réponses claires et gratuites en 2026, chaque règle sourcée par l’article de loi officiel.",
    path: "/",
  }),
  title: { absolute: "Loilà · Droit du travail, logement, urbanisme expliqués" },
};

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: "Le droit français expliqué simplement, chaque réponse sourcée par les articles officiels publiés sur Légifrance.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Loila",
    url: SITE_URL,
    inLanguage: "fr-FR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

export const dynamic = "force-dynamic";

const POPULAR_TOPICS = [
  "conge-de-naissance-paternite", "poser-ses-conges-payes", "arbres-du-voisin", "avoir-une-piscine", "quitter-son-logement", "bruit-des-voisins",
  "couper-du-bois-en-foret", "divorcer", "stage-etudiant", "heritage-succession", "retourner-un-achat-internet", "partir-a-la-retraite",
];

const STEPS = [
  { title: "Textes officiels", text: "Nous partons des articles en vigueur publiés sur Légifrance, mis à jour chaque jour." },
  { title: "Expliqués simplement", text: "Chaque règle est reformulée en français clair, sans jargon inutile." },
  { title: "Sources citées", text: "Chaque réponse renvoie aux articles de loi exacts, vérifiables en un clic." },
];

export default function Home() {
  const db = getDb();
  // ponytail: first 6 by id, add a popularity column when there is traffic data
  const faqs = db.prepare("SELECT theme, topic, slug, emoji, question, short FROM faq ORDER BY id LIMIT 6").all() as Faq[];
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  // Round down to a friendly figure: 35 812 -> "35 000+".
  const articles = n >= 1000 ? `${(Math.floor(n / 1000) * 1000).toLocaleString("fr-FR")}+` : n.toLocaleString("fr-FR");

  // ponytail: hand-picked, swap for traffic-based ranking later
  const popularTopics = POPULAR_TOPICS.map((slug) => getTopic(slug)).filter((t) => !!t);
  const topicCount = getTopics().length;
  const conventions = THEMES.find((t) => t.slug === "conventions")?.codes.length ?? 0;
  const trust = [
    { value: articles, label: "articles de loi officiels" },
    { value: String(conventions), label: "conventions collectives couvertes" },
    { value: "Chaque jour", label: "synchronisé avec Légifrance" },
  ];

  return (
    <>
      <JsonLd data={homeJsonLd} />
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
          <ul className="mt-12 border-t-2 border-fg">
            {THEMES.map((t, i) => (
              <li key={t.slug} className="border-b-2 border-fg">
                <Link
                  href={`/${t.slug}`}
                  className="group relative isolate grid grid-cols-[auto_1fr_auto] items-center gap-4 overflow-hidden py-6 sm:grid-cols-[4rem_auto_1fr_auto] sm:gap-8 sm:py-8"
                >
                  {/* theme color wipes in from the left on hover */}
                  <span aria-hidden className={`${block(t.slug)} absolute inset-0 -z-10 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none`} />
                  <span className="hidden font-mono text-sm font-bold text-fg-2 group-hover:text-ink sm:block sm:pl-3">0{i + 1}</span>
                  <span className={`${block(t.slug)} grid size-12 place-items-center border-2 border-fg text-ink sm:size-14`}>
                    <ThemeIcon slug={t.slug} className="size-6 sm:size-7" />
                  </span>
                  <span className="min-w-0 group-hover:text-ink">
                    <span className={`${display} block text-3xl leading-none sm:text-5xl`}>{t.title}</span>
                    <span className="mt-2 block text-[0.9375rem] text-fg-2 group-hover:text-ink/80 sm:text-base">{t.tagline}</span>
                  </span>
                  <ArrowRight aria-hidden strokeWidth={1.75} className="size-7 transition group-hover:translate-x-1 group-hover:text-ink sm:mr-3 sm:size-9 motion-reduce:transition-none" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Topics teaser */}
      <section aria-labelledby="topics-teaser-title" className="pb-16 sm:pb-24">
        <div className={container}>
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-fg pt-5">
            <h2 id="topics-teaser-title" className={`${label} flex items-center gap-3`}>
              <span aria-hidden className="h-0.5 w-8 bg-signal" />
              Tous les sujets
            </h2>
            <Link href="/sujets" className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
              Voir les {topicCount} sujets <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {popularTopics.map((t) => (
              <li key={t.slug}>
                <Link href={`/sujets/${t.slug}`} className="inline-flex rounded-full border-2 border-fg px-4 py-2 font-semibold transition hover:bg-fg hover:text-bg">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
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
