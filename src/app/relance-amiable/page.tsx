import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LettreCards } from "@/components/Lettres";
import { FaqIndex, SectionHead, btnPrimary, container, display, label } from "@/components/ui";
import { LETTRE_GROUPS, getLettres, lettreUrl } from "@/lib/lettres";
import { faqsBySlugs, refArticles } from "@/lib/metiers";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";
import { CODES, faqUrl } from "@/lib/themes";

export const dynamic = "force-dynamic";

const PATH = LETTRE_GROUPS.relances.href;
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Relance amiable d’un impayé : modèles et étapes avant la mise en demeure",
    description: "Facture, loyer, argent prêté, remboursement : modèles gratuits de relance amiable et de mise en demeure, et les étapes jusqu’au juge. Pour TPE, PME et particuliers.",
    path: PATH,
  }),
  title: { absolute: "Relance amiable d’un impayé : modèles et étapes | Loilà" },
};

const codeName = (c: string) => (CODES[c as keyof typeof CODES]?.name ?? c).replace(/ \(.*\)$/, "");

// The escalation, in order. Delays are common practice, not legal deadlines (stated on the page).
const STEPS = [
  { title: "Relance courtoise", when: "Dès l’échéance dépassée", detail: "Un simple rappel écrit, sur le ton de l’oubli. C’est lui qui règle la majorité des retards.", slug: null },
  { title: "Relance ferme", when: "8 à 15 jours plus tard, en usage", detail: "Même lettre, ton plus ferme, avec un délai précis et l’annonce de la mise en demeure. Proposer un échéancier débloque souvent la situation.", slug: null },
  { title: "Mise en demeure", when: "Si les relances restent sans effet", detail: "En recommandé avec accusé de réception. Elle fait courir les intérêts au taux légal et prépare l’action en justice.", slug: "mise-en-demeure-de-payer" },
  { title: "Recouvrement ou juge", when: "Après l’ultime délai", detail: "Procédure simplifiée par un commissaire de justice pour les petites créances, ou injonction de payer devant le juge.", slug: null },
] as const;

const RULES = [
  { title: "Entre professionnels : pénalités et 40 €", detail: "Pénalités de retard dues dès le lendemain de l’échéance, sans rappel, et indemnité forfaitaire de 40 € pour frais de recouvrement.", refs: ["code-commerce:L441-10", "code-commerce:D441-5"] },
  { title: "Intérêts au taux légal après mise en demeure", detail: "Pour toute somme d’argent, la mise en demeure fait courir les intérêts de retard, sans preuve d’un préjudice.", refs: ["code-civil:1231-6", "code-civil:1344-1"] },
  { title: "5 ans pour agir, 2 ans contre un consommateur", detail: "La plupart des créances se prescrivent par cinq ans. Celles d’un professionnel contre un particulier, par deux ans.", refs: ["code-civil:2224", "code-consommation:L218-2"] },
  { title: "Prouver sa créance", detail: "Facture, contrat, reconnaissance de dette : au-delà de 1 500 €, un prêt se prouve par un écrit signé.", refs: ["code-civil:1353", "code-civil:1359"] },
];

export default function RelanceAmiable() {
  const lettres = getLettres().filter((l) => l.group === "relances");
  const faqs = faqsBySlugs([...new Set(lettres.flatMap((l) => l.faqSlugs))]);
  const rules = RULES.map((r) => ({ ...r, articles: refArticles(r.refs) }));
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Modèles de lettres", path: "/modeles-lettres" }, { name: LETTRE_GROUPS.relances.title, path: PATH }]),
          ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
        ]}
      />

      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/modeles-lettres" className="underline-offset-4 hover:underline">Modèles de lettres</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{LETTRE_GROUPS.relances.title}</span>
          </nav>
          <h1 className={`${display} mt-12 max-w-5xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.92] text-balance sm:mt-16`}>
            Un impayé ? <span className="font-serif font-normal tracking-[-0.02em] italic">Relancez d’abord à l’amiable.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-2 sm:text-xl">
            Facture, loyer, argent prêté, remboursement qui n’arrive pas : la plupart des retards se règlent par une relance écrite,
            sans frais. Choisissez votre situation, complétez la lettre, et suivez les étapes si elle reste sans effet.
          </p>
          <p className="mt-8 flex flex-wrap gap-2" aria-label="Pour qui">
            {["TPE et PME", "Artisans et indépendants", "Bailleurs", "Particuliers"].map((a) => (
              <span key={a} className="rounded-full border-2 border-fg px-3 py-1 font-mono text-xs font-bold tracking-wide uppercase">{a}</span>
            ))}
          </p>
        </div>
      </section>

      <section aria-labelledby="choix-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Votre situation" id="choix-title" title={<>Choisissez <span className="font-serif font-normal italic">votre modèle</span></>} />
          <div className="mt-12"><LettreCards lettres={lettres} from={PATH} /></div>
        </div>
      </section>

      <section aria-labelledby="etapes-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={num()} kicker="Les étapes" id="etapes-title" title={<>De la relance <span className="font-serif font-normal italic">au juge</span></>} />
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col border-2 border-fg bg-surface p-5 sm:p-6">
                <p className="font-display text-5xl font-extrabold tracking-[-0.04em] text-signal">{i + 1}</p>
                <h3 className="mt-3 font-display text-2xl leading-tight font-bold tracking-[-0.025em]">{s.title}</h3>
                <p className={`${label} mt-2 text-fg-2`}>{s.when}</p>
                <p className="mt-3 text-fg-2">{s.detail}</p>
                {s.slug && (
                  <p className="mt-auto pt-5">
                    <Link href={lettreUrl({ slug: s.slug })} className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
                      Le modèle <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-fg-2">
            Les délais entre relances sont des usages, pas des obligations légales : adaptez-les à votre relation et au montant en jeu.
          </p>
        </div>
      </section>

      <section aria-labelledby="regles-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <SectionHead num={num()} kicker="L’essentiel" id="regles-title" title={<>Ce que dit <span className="font-serif font-normal italic">la loi</span></>} />
          <ul className="mt-12 grid gap-5 md:grid-cols-2">
            {rules.map((r) => (
              <li key={r.title} className="flex flex-col border-2 border-fg bg-surface p-5 sm:p-6">
                <h3 className="font-display text-2xl leading-tight font-bold tracking-[-0.025em]">{r.title}</h3>
                <p className="mt-3 text-fg-2">{r.detail}</p>
                <p className="mt-auto flex flex-wrap gap-2 pt-5">
                  {r.articles.map((a) => (
                    <Link key={a.id} href={`/article/${a.id}`} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-fg px-2.5 py-0.5 font-mono text-xs font-semibold hover:bg-fg hover:text-bg">
                      Art. {a.num} · {codeName(a.code)}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-fg-2">Information juridique générale, à vérifier selon votre situation et les textes cités.</p>
        </div>
      </section>

      <section aria-labelledby="wizard-title" className="pt-16 sm:pt-24">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-surface p-6 shadow-[6px_6px_0_0_var(--signal)] sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className={`${label} text-fg-2`}>Débiteur de mauvaise foi, dette contestée ?</p>
              <h2 id="wizard-title" className={`${display} mt-3 text-3xl leading-tight sm:text-5xl`}>
                Faites analyser <span className="font-serif font-normal italic">votre dossier.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-fg-2">Décrivez la situation : Loilà vous pose les bonnes questions et vous rend une analyse sourcée, article par article.</p>
            </div>
            <Link href="/dossier/nouveau" data-umami-event="relances-wizard" className={`${btnPrimary} justify-self-start`}>
              Décrire ma situation <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section aria-labelledby="questions-title" className="py-16 sm:py-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Questions fréquentes" id="questions-title" title="Impayés : vos questions" />
            <div className="mt-12"><FaqIndex faqs={faqs} showTheme /></div>
          </div>
        </section>
      )}
    </>
  );
}
