import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Mascot from "@/components/Mascot";
import ThemeIcon from "@/components/ThemeIcon";
import { AvocatsCard } from "@/components/PricingCards";
import { AVOCATS_FEATURES } from "@/lib/plans";
import { SectionHead, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { JsonLd, abs, breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Alinéa : assistant IA juridique pour avocats et juristes",
    description: "Découvrez Alinéa, l’assistant IA de Loilà pour la recherche juridique : articles de loi, jurisprudence et sources vérifiables. Offre avocats sur liste d’attente.",
    path: "/avocats",
  }),
  title: { absolute: "Alinéa, assistant IA pour avocats et juristes · Loilà" },
};

const FAQ = [
  {
    question: "Qu’est-ce qu’Alinéa ?",
    answer: "Alinéa est l’assistant IA juridique de Loilà. Sa déclinaison pour les avocats et juristes aide à préparer une recherche en droit français à partir des articles de loi et des décisions présents dans la base. Elle propose une synthèse avec des références consultables. L’offre Avocats est en préparation et accessible sur liste d’attente.",
  },
  {
    question: "À qui s’adresse Alinéa pour les professionnels du droit ?",
    answer: "Aux avocats, juristes d’entreprise et élèves-avocats qui souhaitent explorer une question de droit, retrouver des décisions liées à un article et préparer leur analyse. La sélection des sources et la validation de l’analyse restent sous la responsabilité du professionnel.",
  },
  {
    question: "Quel est le prix de l’assistant Alinéa pour avocats ?",
    answer: "Le prix de l’offre Avocats n’est pas encore annoncé. Vous pouvez rejoindre la liste d’attente pour être informé de son ouverture et du tarif de lancement. Les pages publiques de jurisprudence et les articles de loi restent consultables gratuitement, sans inscription.",
  },
  {
    question: "D’où viennent les décisions ?",
    answer: "Des données ouvertes de la DILA (Légifrance) : Cour de cassation (CASS), Conseil constitutionnel (CONSTIT) et juridictions administratives (JADE). Chaque décision garde sa source officielle, l’archive d’origine et l’empreinte du fichier importé.",
  },
  {
    question: "Comment une décision est-elle reliée à un article ?",
    answer: "Par extraction déterministe des références (« article L. 1235-3 du code du travail », « art. 1643 C. civ. », « du même code »…), jamais par IA. Les références ambiguës, historiques (« dans sa rédaction antérieure », « ancien article ») ou antérieures à une renumérotation ne sont pas reliées à l’article actuel.",
  },
  {
    question: "L’assistant peut-il inventer une jurisprudence ?",
    answer: "Une IA peut produire une erreur, y compris dans une citation ou une interprétation. Alinéa reçoit les articles et décisions retrouvés dans la base, avec la consigne de s’appuyer sur ces sources et de signaler leurs limites. Les repères [D1], [D2] permettent d’ouvrir les décisions pour contrôler la réponse. Cela ne garantit ni l’exhaustivité de la recherche ni l’absence d’erreur.",
  },
  {
    question: "Qu’est-ce qui est gratuit ?",
    answer: "Toutes les pages : articles en vigueur, décisions (sommaire officiel, texte intégral pseudonymisé, articles appliqués, décisions liées), résumés en clair et articles fréquemment cités ensemble. L’offre Avocats, en préparation, prévoit l’assistant IA et la recherche filtrée.",
  },
  {
    question: "Les juges sont-ils analysés ?",
    answer: "Non. Alinéa est conçu pour rechercher et expliquer des textes et des décisions, pas pour établir des profils de magistrats ni prédire l’issue d’un litige.",
  },
];

export default function Avocats() {
  const db = getDb();
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const decisions = n("SELECT COUNT(*) n FROM decisions");
  const articles = n("SELECT COUNT(DISTINCT article_id) n FROM decision_articles");
  const relations = n("SELECT COUNT(*) n FROM article_relations") / 2;
  const bySource = db.prepare("SELECT source, COUNT(*) n FROM decisions GROUP BY source ORDER BY n DESC").all() as { source: string; n: number }[];
  const SOURCE: Record<string, string> = { cass: "Cour de cassation", inca: "Cour de cassation (inédits)", constit: "Conseil constitutionnel", jade: "Juridictions administratives", capp: "Cours d’appel" };
  const example = db.prepare("SELECT d.id FROM decisions d JOIN decision_summaries s ON s.decision_id = d.id ORDER BY d.date DESC LIMIT 1").get() as { id: string } | undefined;

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Avocats", path: "/avocats" }]), faqJsonLd(FAQ), {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": abs("/avocats#page"),
        url: abs("/avocats"),
        name: "Alinéa, assistant IA juridique pour avocats et juristes",
        description: "Présentation d’Alinéa, l’assistant IA de Loilà, de ses sources et de l’offre Avocats en préparation.",
        inLanguage: "fr-FR",
        about: {
          "@type": "SoftwareApplication",
          "@id": abs("/avocats#alinea"),
          name: "Alinéa",
          alternateName: "Alinéa de Loilà",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "Assistant IA de recherche juridique en droit français. Offre Avocats en préparation, sur liste d’attente.",
          url: abs("/avocats"),
          creator: { "@type": "Organization", name: "Loilà", url: abs("/") },
        },
      }]} />

      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Loilà pour les avocats et juristes
          </p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center">
            <div>
              <h1 className={`${display} max-w-3xl text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.96] text-balance`}>
                Alinéa, votre assistant <span className="font-serif font-normal tracking-[-0.02em] italic">IA juridique.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
                Pour les avocats et juristes qui veulent remonter à la source. Alinéa, l’assistant IA de Loilà,
                vous aide à explorer le droit français en rapprochant les articles de loi et la jurisprudence.
              </p>
              <p className="mt-4 max-w-2xl text-fg-2">
                Une question de droit, des références à consulter, une synthèse à vérifier.
                Vous gardez la main sur l’analyse et la stratégie de votre dossier.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#offre" className="inline-flex items-center gap-2 border-2 border-fg bg-fg px-5 py-3 text-sm font-bold text-bg">
                  Découvrir l’offre Avocats <ArrowRight aria-hidden className="size-4 shrink-0" />
                </a>
                <Link href="/jurisprudence" className="inline-flex items-center gap-2 border-2 border-fg px-5 py-3 text-sm font-bold">
                  Explorer les décisions gratuites
                </Link>
              </div>
              <p className="mt-4 text-sm text-fg-2">Offre Avocats en préparation · inscription sur liste d’attente.</p>
            </div>
            <aside aria-label="Rencontrez Alinéa" className="relative border-2 border-ink bg-ink p-8 text-paper">
              <p className={`${label} text-paper/60`}>Enchanté, moi c’est</p>
              <p className="mt-2 font-display text-5xl font-extrabold tracking-tight">Alinéa<span className="text-signal">.</span></p>
              <Mascot className="mx-auto my-4 size-52" />
              <p className="font-serif text-2xl leading-snug italic">Les références d’abord.<br />Les idées plus claires ensuite.</p>
              <p className="mt-4 border-t border-paper/20 pt-4 text-sm leading-relaxed text-paper/70">Le petit visage de votre assistant de recherche juridique.</p>
            </aside>
          </div>
          <nav aria-label="Sur cette page" className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-rule pt-5 text-sm font-semibold">
            <a href="#usages" className="underline decoration-signal underline-offset-4">Cas d’usage</a>
            <a href="#fonctionnement" className="underline decoration-signal underline-offset-4">Comment ça marche</a>
            <a href="#sources" className="underline decoration-signal underline-offset-4">Sources et couverture</a>
            <a href="#offre" className="underline decoration-signal underline-offset-4">Accès et offre</a>
            <a href="#questions" className="underline decoration-signal underline-offset-4">Questions fréquentes</a>
          </nav>
          <dl className="mt-12 grid max-w-3xl grid-cols-3 border-t-2 border-fg">
            {[["Décisions", decisions], ["Articles reliés à la jurisprudence", articles], ["Liens entre articles", relations]].map(([k, v], i) => (
              <div key={k} className={`py-4 ${i ? "border-l-2 border-fg pl-4 sm:pl-8" : "pr-4"}`}>
                <dt className={`${label} text-fg-2`}>{k}</dt>
                <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{Number(v).toLocaleString("fr-FR")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-fg-2">{bySource.map((s) => `${SOURCE[s.source] ?? s.source} : ${s.n.toLocaleString("fr-FR")}`).join(" · ")}</p>
        </div>
      </section>

      <section id="usages" aria-labelledby="usages-title" className="scroll-mt-24 pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="01" kicker="Dans votre pratique" id="usages-title" title={<>Une recherche à amorcer.<br /><span className="font-serif font-normal italic">Une piste à approfondir.</span></>} />
          <p className="mt-6 max-w-2xl text-lg text-fg-2">Voici les types de questions à explorer avec Alinéa. Ces exemples illustrent des usages ; ils ne constituent pas des réponses juridiques.</p>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { theme: "travail", title: "Droit du travail", question: "Quelles décisions examinent le consentement lors d’une rupture conventionnelle ?", use: "Repérer les décisions pertinentes, puis confronter leurs circonstances aux faits de votre dossier.", href: "/travail", color: "bg-travail" },
              { theme: "logement", title: "Baux et logement", question: "Quels articles et décisions concernent la clause résolutoire d’un bail d’habitation ?", use: "Partir du texte, consulter les décisions liées et identifier les conditions discutées.", href: "/logement", color: "bg-logement" },
              { theme: "construction", title: "Construction", question: "Quelles décisions citent l’article 1792 du Code civil ?", use: "Explorer la jurisprudence liée à un article et lire les motifs utiles à votre analyse.", href: "/construction", color: "bg-construction" },
            ].map((item) => (
              <li key={item.theme} className="flex flex-col border-2 border-fg bg-surface">
                <div className={`${item.color} flex items-center gap-3 border-b-2 border-ink p-5 text-ink`}><ThemeIcon slug={item.theme} className="size-8 shrink-0" /><h3 className="font-display text-xl font-bold">{item.title}</h3></div>
                <div className="flex flex-1 flex-col p-5"><p className="font-serif text-2xl italic">« {item.question} »</p><p className="mt-4 text-fg-2">{item.use}</p><Link href={item.href} className="mt-auto inline-flex items-center gap-2 pt-6 font-semibold underline decoration-signal underline-offset-4">Explorer ce domaine <ArrowRight aria-hidden className="size-4" /></Link></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="fonctionnement" aria-labelledby="fonctionnement-title" className="scroll-mt-24 pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="02" kicker="Avec Alinéa" id="fonctionnement-title" title={<>De la question <span className="font-serif font-normal italic">au texte source.</span></>} />
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Formuler la question", "Précisez la difficulté juridique et, si vous la connaissez, la référence de l’article. Une question ciblée aide à retrouver les sources pertinentes."],
              ["Explorer la synthèse", "Alinéa reçoit les articles et décisions retrouvés. Il est invité à distinguer la règle de droit des circonstances de l’espèce et à signaler les sources insuffisantes ou contradictoires."],
              ["Revenir aux décisions", "Les repères [D1], [D2] ouvrent les décisions citées. Vérifiez les motifs, la date et la portée de chaque décision avant de retenir une conclusion."],
            ].map(([title, text], i) => <li key={title} className="border-t-2 border-fg pt-5"><span className="font-display text-4xl font-extrabold text-focus">0{i + 1}</span><h3 className="mt-4 font-display text-2xl font-bold">{title}</h3><p className="mt-3 text-fg-2">{text}</p></li>)}
          </ol>
          <div className="mt-10 border-l-4 border-signal bg-surface p-6 sm:p-8"><h3 className="font-display text-xl font-bold">Une aide à la recherche, une analyse à valider.</h3><p className="mt-3 max-w-3xl text-fg-2">Alinéa peut se tromper ou manquer une décision pertinente. La base n’est pas une garantie de couverture exhaustive ; les versions applicables et les sources officielles doivent être contrôlées. L’assistant ne prédit pas l’issue d’un litige.</p></div>
        </div>
      </section>

      <section id="sources" aria-labelledby="gratuit-title" className="scroll-mt-24 pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="03" kicker="Gratuit, pour tous" id="gratuit-title" title={<>Un graphe <span className="font-serif font-normal italic">loi ↔ jurisprudence</span></>} />
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Chaque article, sa jurisprudence", "Les décisions qui appliquent l’article, les plus récentes d’abord, et la liste complète paginée.", "/jurisprudence"],
              ["Chaque décision, ses articles", "Sommaire officiel, texte intégral pseudonymisé, articles appliqués, décision attaquée, arrêts cités.", example ? `/jurisprudence/${example.id}` : "/jurisprudence"],
              ["Les articles cités ensemble", "Les articles qui reviennent dans les mêmes arrêts, classés par un score de co-citation.", "/jurisprudence"],
            ].map(([t, d, href]) => (
              <li key={t} className="flex flex-col border-2 border-fg bg-surface p-5 sm:p-6">
                <h3 className="font-display text-2xl leading-tight font-bold tracking-[-0.025em]">{t}</h3>
                <p className="mt-3 text-fg-2">{d}</p>
                <Link href={href} className="mt-auto inline-flex items-center gap-1.5 pt-5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                  Voir un exemple <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="offre-title" id="offre" className="scroll-mt-20 pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="04" kicker="Offre Avocats · bientôt" id="offre-title" title={<>Alinéa, pour votre <span className="font-serif font-normal italic">pratique du droit.</span></>} />
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
            <div>
              <p className="max-w-2xl text-lg text-fg-2">
                L’offre Avocats prépare un accès à Alinéa pour la recherche juridique. Inscrivez-vous pour être informé de son ouverture
                et du tarif de lancement. Le prix n’est pas encore annoncé. Voici les fonctionnalités prévues :
              </p>
              <ul className="mt-6 space-y-3">
                {AVOCATS_FEATURES.map((f) => (
                  <li key={f} className="flex gap-3"><Check aria-hidden className="mt-1 size-5 shrink-0 text-focus" />{f}</li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-fg-2">
                Vous disposez déjà d’un accès autorisé ? <Link href="/pro/jurisprudence" className="font-semibold underline underline-offset-4">Ouvrir Alinéa</Link>
              </p>
            </div>
            <ul className="list-none">
              <AvocatsCard />
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="methode-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="05" kicker="Méthode" id="methode-title" title={<>Des sources, <span className="font-serif font-normal italic">pas des suppositions</span></>} />
          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              ["Open data officiel", "Décisions et textes issus des données ouvertes de la DILA. Chaque décision garde sa source, l’archive d’origine et l’empreinte du fichier."],
              ["Liens déterministes", "Les références sont extraites par des règles testées, jamais devinées par une IA. Une référence ambiguë n’est jamais reliée."],
              ["Anciennes rédactions", "« Dans sa rédaction antérieure », « ancien article », renumérotations de 2008 et 2016 : la référence n’est pas rattachée à l’article actuel."],
              ["IA sous contrôle", "Alinéa reçoit une sélection de sources retrouvées et des consignes de citation. La synthèse générée doit être confrontée aux textes et aux décisions."],
            ].map(([t, d]) => (
              <li key={t} className="border-2 border-fg bg-surface p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{t}</h3>
                <p className="mt-2 text-fg-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="questions" aria-labelledby="faq-title" className="scroll-mt-24 py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="06" kicker="Questions" id="faq-title" title="Questions fréquentes" />
          <dl className="mt-10 max-w-3xl divide-y divide-rule border-t border-fg">
            {FAQ.map((f) => (
              <div key={f.question} className="py-5">
                <dt className="font-display text-xl font-bold">{f.question}</dt>
                <dd className="mt-2 text-fg-2">{f.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-fg-2">Loilà fournit une information juridique et documentaire ; il ne délivre pas de consultation juridique.</p>
        </div>
      </section>
    </>
  );
}
