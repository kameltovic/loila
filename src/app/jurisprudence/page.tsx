import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHead, btnPrimary, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { citation, decisionUrl, formationLabel, teaser, type Decision } from "@/lib/decisions";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({
  title: "Jurisprudence expliquée : Cour de cassation, Conseil d’État, Conseil constitutionnel",
  description: "Les décisions de la Cour de cassation, du Conseil d’État, des cours administratives d’appel et du Conseil constitutionnel depuis 2017, reliées aux articles de loi qu’elles appliquent.",
  path: "/jurisprudence",
});

const CHAMBERS = ["CHAMBRE_SOCIALE", "CHAMBRE_CIVILE_3", "CHAMBRE_CIVILE_1", "CHAMBRE_CIVILE_2", "CHAMBRE_COMMERCIALE", "CHAMBRE_CRIMINELLE"];
const TOPICS: Record<string, string> = {
  CHAMBRE_SOCIALE: "Contrat de travail, licenciement, salaires",
  CHAMBRE_CIVILE_3: "Bail, copropriété, construction, urbanisme",
  CHAMBRE_CIVILE_1: "Contrats, consommation, famille",
  CHAMBRE_CIVILE_2: "Procédure, sécurité sociale, assurances",
  CHAMBRE_COMMERCIALE: "Entreprises, sociétés, paiements",
  CHAMBRE_CRIMINELLE: "Droit pénal",
};

export default function Jurisprudence() {
  const db = getDb();
  const stats = db.prepare("SELECT COUNT(*) n, MIN(date) since FROM decisions").get() as { n: number; since: string | null };
  const linkedArticles = (db.prepare("SELECT COUNT(DISTINCT article_id) n FROM decision_articles").get() as { n: number }).n;
  const latest = db.prepare("SELECT id, juridiction, formation, date, numero, solution, sommaire FROM decisions WHERE formation = ? ORDER BY date DESC LIMIT 8");
  // Other courts: grouped by court (published administrative decisions first).
  const others = [
    { key: "ce", title: "Conseil d’État", kicker: "Urbanisme, environnement, fonction publique", where: "juridiction LIKE 'Conseil d%tat'" },
    { key: "caa", title: "Cours administratives d’appel", kicker: "Permis de construire, PLU, marchés publics", where: "juridiction LIKE 'CAA%'" },
    { key: "cc", title: "Conseil constitutionnel", kicker: "Contrôle de la loi (DC) et QPC", where: "source = 'constit'" },
  ].map((g) => ({ ...g, rows: db.prepare(`SELECT id, juridiction, formation, date, numero, solution, sommaire FROM decisions WHERE ${g.where} ORDER BY publie DESC, date DESC LIMIT 8`).all() as Pick<Decision, "id" | "juridiction" | "formation" | "date" | "numero" | "solution" | "sommaire">[] }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Jurisprudence", path: "/jurisprudence" }])} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Jurisprudence
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3rem,9vw,6rem)] leading-[0.92] text-balance`}>
            La loi, <span className="font-serif font-normal tracking-[-0.02em] italic">et ce qu’en disent les juges.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
            Les décisions de la Cour de cassation, du Conseil d’État, des cours administratives d’appel et du Conseil constitutionnel,
            reliées aux articles de loi qu’elles appliquent. Gratuit, sans inscription.
          </p>
          <dl className="mt-10 grid max-w-xl grid-cols-2 border-t-2 border-fg">
            <div className="py-4 pr-4 sm:pr-8">
              <dt className={label}>Décisions</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{stats.n.toLocaleString("fr-FR")}</dd>
            </div>
            <div className="border-l-2 border-fg py-4 pl-4 sm:pl-8">
              <dt className={label}>Articles de loi reliés</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{linkedArticles.toLocaleString("fr-FR")}</dd>
            </div>
          </dl>
        </div>
      </section>

      {CHAMBERS.map((f, i) => {
        const rows = latest.all(f) as Pick<Decision, "id" | "juridiction" | "formation" | "date" | "numero" | "solution" | "sommaire">[];
        if (!rows.length) return null;
        return (
          <section key={f} aria-labelledby={`ch-${f}`} className="pt-16 sm:pt-20">
            <div className={container}>
              <SectionHead num={String(i + 1).padStart(2, "0")} kicker={TOPICS[f]} id={`ch-${f}`} title={formationLabel(f)} />
              <ul className="mt-8 border-t border-fg">
                {rows.map((d) => (
                  <li key={d.id} className="border-b border-rule">
                    <Link href={decisionUrl(d)} className="group grid gap-1 py-4 hover:bg-surface sm:grid-cols-[18rem_1fr_auto] sm:gap-6 sm:px-2">
                      <span className="font-semibold">{citation(d)}</span>
                      <span className="line-clamp-2 text-[0.9375rem] text-fg-2">{teaser(d.sommaire, 220) || d.solution}</span>
                      <ArrowRight aria-hidden className="hidden size-5 transition group-hover:translate-x-1 sm:block motion-reduce:transition-none" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

      {others.filter((g) => g.rows.length).map((g, i) => (
        <section key={g.key} aria-labelledby={`ch-${g.key}`} className="pt-16 sm:pt-20">
          <div className={container}>
            <SectionHead num={String(CHAMBERS.length + i + 1).padStart(2, "0")} kicker={g.kicker} id={`ch-${g.key}`} title={g.title} />
            <ul className="mt-8 border-t border-fg">
              {g.rows.map((d) => (
                <li key={d.id} className="border-b border-rule">
                  <Link href={decisionUrl(d)} className="group grid gap-1 py-4 hover:bg-surface sm:grid-cols-[18rem_1fr_auto] sm:gap-6 sm:px-2">
                    <span className="font-semibold">{citation(d)}</span>
                    <span className="line-clamp-2 text-[0.9375rem] text-fg-2">{teaser(d.sommaire, 220) || d.solution || formationLabel(d.formation)}</span>
                    <ArrowRight aria-hidden className="hidden size-5 transition group-hover:translate-x-1 sm:block motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section aria-labelledby="pro-title" className="py-16 sm:py-24">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-surface p-6 shadow-[6px_6px_0_0_var(--signal)] sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className={`${label} text-fg-2`}>Avocats et juristes · bientôt</p>
              <h2 id="pro-title" className={`${display} mt-3 text-3xl leading-tight sm:text-5xl`}>
                Interrogez la jurisprudence <span className="font-serif font-normal italic">avec l’IA.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-fg-2">Une question de droit, une réponse qui cite chaque arrêt et chaque article, vérifiable en un clic.</p>
            </div>
            <Link href="/avocats" data-umami-event="juri-pro-hub" className={`${btnPrimary} justify-self-start`}>
              L’offre avocats <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
