import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AvocatsCard } from "@/components/PricingCards";
import { AVOCATS_FEATURES } from "@/lib/plans";
import { SectionHead, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Jurisprudence et IA pour avocats : Loilà Pro",
    description: "Arrêts de la Cour de cassation, du Conseil constitutionnel et des juridictions administratives reliés aux articles qu’ils appliquent, et un assistant IA qui cite chaque décision. Gratuit à consulter.",
    path: "/avocats",
  }),
  title: { absolute: "Jurisprudence et IA pour avocats · Loilà Pro" },
};

const FAQ = [
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
    answer: "Il ne répond qu’à partir des décisions et des articles retrouvés dans la base, cite chacun par un repère cliquable [D1], [D2]… et signale quand les sources ne suffisent pas. Les réponses restent à vérifier dans les décisions citées.",
  },
  {
    question: "Qu’est-ce qui est gratuit ?",
    answer: "Toutes les pages : articles en vigueur, décisions (sommaire officiel, texte intégral pseudonymisé, articles appliqués, décisions liées), résumés en clair et articles fréquemment cités ensemble. L’offre Avocats ajoute l’assistant IA et la recherche filtrée.",
  },
  {
    question: "Les juges sont-ils analysés ?",
    answer: "Non. Conformément à l’article 33 de la loi du 23 mars 2019, Loilà n’exploite jamais l’identité des magistrats ni ne profile leurs pratiques.",
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
      <JsonLd data={[breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Avocats", path: "/avocats" }]), faqJsonLd(FAQ)]} />

      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Loilà pour les avocats et juristes
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.92] text-balance`}>
            La jurisprudence, reliée à la loi. <span className="font-serif font-normal tracking-[-0.02em] italic">Et une IA qui cite ses sources.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
            Chaque arrêt est relié aux articles qu’il applique, chaque article aux décisions qui l’appliquent. Gratuit à consulter,
            sans inscription. L’offre Avocats ajoute un assistant qui répond en citant chaque décision.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#offre" className="inline-flex items-center gap-2 border-2 border-fg bg-fg px-5 py-3 font-mono text-sm font-bold uppercase text-bg">
              Rejoindre la liste d’attente <ArrowRight aria-hidden className="size-4" />
            </a>
            <Link href="/jurisprudence" className="inline-flex items-center gap-2 border-2 border-fg px-5 py-3 font-mono text-sm font-bold uppercase">
              Explorer la jurisprudence
            </Link>
          </div>
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

      <section aria-labelledby="gratuit-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num="01" kicker="Gratuit, pour tous" id="gratuit-title" title={<>Un graphe <span className="font-serif font-normal italic">loi ↔ jurisprudence</span></>} />
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
          <SectionHead num="02" kicker="Offre Avocats" id="offre-title" title={<>L’assistant <span className="font-serif font-normal italic">jurisprudence</span></>} />
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
            <div>
              <p className="max-w-2xl text-lg text-fg-2">
                Posez une question de droit. L’assistant cherche dans les codes et la jurisprudence, distingue la règle posée par la Cour
                des circonstances de l’espèce, et répond en citant chaque arrêt par un repère cliquable.
              </p>
              <ul className="mt-6 space-y-3">
                {AVOCATS_FEATURES.map((f) => (
                  <li key={f} className="flex gap-3"><Check aria-hidden className="mt-1 size-5 shrink-0 text-focus" />{f}</li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-fg-2">
                Déjà inscrit à l’offre ? <Link href="/pro/jurisprudence" className="font-semibold underline underline-offset-4">Ouvrir l’assistant</Link>
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
          <SectionHead num="03" kicker="Méthode" id="methode-title" title={<>Des sources, <span className="font-serif font-normal italic">pas des suppositions</span></>} />
          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              ["Open data officiel", "Décisions et textes issus des données ouvertes de la DILA. Chaque décision garde sa source, l’archive d’origine et l’empreinte du fichier."],
              ["Liens déterministes", "Les références sont extraites par des règles testées, jamais devinées par une IA. Une référence ambiguë n’est jamais reliée."],
              ["Anciennes rédactions", "« Dans sa rédaction antérieure », « ancien article », renumérotations de 2008 et 2016 : la référence n’est pas rattachée à l’article actuel."],
              ["IA sous contrôle", "L’IA rédige à partir des seules sources retrouvées et les cite. Elle n’est jamais la source de vérité."],
            ].map(([t, d]) => (
              <li key={t} className="border-2 border-fg bg-surface p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{t}</h3>
                <p className="mt-2 text-fg-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="py-16 sm:py-24">
        <div className={container}>
          <SectionHead num="04" kicker="Questions" id="faq-title" title="Questions fréquentes" />
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
