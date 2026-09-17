import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import PricingCards from "@/components/PricingCards";
import { SectionHead, container, display, label } from "@/components/ui";
import { JsonLd, SITE_NAME, abs, faqJsonLd, pageMetadata } from "@/lib/seo";
import { FREE_QUESTIONS, OFFERS, formatPrice } from "@/lib/plans";

export const metadata = pageMetadata({
  title: "Tarifs : réponses gratuites, questions IA dès 0,99 €",
  description: `Toutes les fiches et réponses existantes sont gratuites et illimitées. Posez une nouvelle question à l’IA : ${FREE_QUESTIONS} offertes, puis 0,99 € l’unité ou dès 7,99 €/mois.`,
  path: "/tarifs",
});

const FAQ = [
  {
    question: "Qu’est-ce qui compte comme une question ?",
    answer:
      "Seule une nouvelle question à laquelle l’IA rédige une réponse est décomptée. Les fiches pratiques et les réponses instantanées (questions déjà traitées) sont gratuites et illimitées, même sans compte.",
  },
  {
    question: "Les questions non utilisées sont-elles reportées ?",
    answer:
      "Les questions achetées à l’unité n’expirent jamais. Le quota mensuel d’un abonnement est remis à zéro à chaque période et n’est pas reporté.",
  },
  {
    question: "Puis-je résilier à tout moment ?",
    answer:
      "Oui. Les abonnements sont sans engagement : résiliez en un clic depuis « Mon compte », l’accès reste actif jusqu’à la fin de la période payée.",
  },
  {
    question: "Que veut dire « usage raisonnable » ?",
    answer: `L’offre Illimité couvre un usage personnel ou professionnel normal, jusqu’à ${OFFERS.illimite.monthlyQuota} questions par mois, pour éviter les usages automatisés.`,
  },
  {
    question: "Est-ce un conseil juridique ?",
    answer:
      "Non. Loilà fournit une information juridique générale, sourcée par les articles de loi officiels. Pour une situation à enjeu, consultez un avocat ou un professionnel du droit.",
  },
  {
    question: "Le paiement est-il sécurisé ?",
    answer: "Oui, le paiement est traité par Stripe. Loilà ne voit ni ne stocke vos coordonnées bancaires. Les prix sont indiqués TTC.",
  },
];

const ROWS: { k: string; v: (string | boolean)[] }[] = [
  { k: "Fiches et réponses existantes", v: ["Illimitées", "Illimitées", "Illimitées", "Illimitées"] },
  { k: "Nouvelles questions à l’IA", v: [`${FREE_QUESTIONS} offertes`, "1 par achat", "100 / mois", "Illimitées*"] },
  { k: "Articles de loi cités", v: [true, true, true, true] },
  { k: "Expiration", v: ["—", "Jamais", "Chaque mois", "Chaque mois"] },
  { k: "Engagement", v: ["Aucun", "Aucun", "Aucun", "Aucun"] },
  { k: "Compte requis", v: [false, true, true, true] },
];
const COLS = ["Gratuit", OFFERS.single.name, OFFERS.essentiel.name, OFFERS.illimite.name];

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${SITE_NAME} · questions juridiques à l’IA`,
  description: "Réponses sourcées par les articles de loi officiels à vos questions de droit français.",
  brand: { "@type": "Brand", name: SITE_NAME },
  offers: Object.values(OFFERS).map((o) => ({
    "@type": "Offer",
    name: o.name,
    price: (o.priceCents / 100).toFixed(2),
    priceCurrency: "EUR",
    url: abs("/tarifs"),
    availability: "https://schema.org/InStock",
  })),
};

export default async function Pricing({ searchParams }: { searchParams: Promise<{ annule?: string }> }) {
  const { annule } = await searchParams;
  return (
    <>
      <JsonLd data={[productJsonLd, faqJsonLd(FAQ)]} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          {annule === "1" && (
            <p role="status" className="mb-10 border-2 border-fg bg-travail px-4 py-3 text-ink">
              Paiement annulé, aucun montant n’a été débité. Vous pouvez choisir une autre formule quand vous voulez.
            </p>
          )}
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Tarifs
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3rem,9vw,6.5rem)] leading-[0.92] text-balance`}>
            Lire est gratuit. <span className="font-serif font-normal tracking-[-0.02em] italic">Demander</span> coûte peu.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-2 sm:text-xl">
            Toutes les fiches et réponses déjà publiées restent gratuites, sans limite et sans compte. Vous ne payez que les
            nouvelles questions rédigées par l’IA.
          </p>
        </div>
      </section>

      {/* Free tier */}
      <section aria-labelledby="free-title" className="py-14 sm:py-20">
        <div className={container}>
          <div className="grid gap-6 border-2 border-fg bg-urbanisme p-6 text-ink sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 id="free-title" className={`${label}`}>
                Gratuit · 0 €
              </h2>
              <ul className="mt-4 space-y-2 font-display text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                <li className="flex items-start gap-3">
                  <Check aria-hidden strokeWidth={2.5} className="mt-1 size-6 shrink-0" />
                  Réponses existantes illimitées
                </li>
                <li className="flex items-start gap-3">
                  <Check aria-hidden strokeWidth={2.5} className="mt-1 size-6 shrink-0" />
                  {FREE_QUESTIONS} questions à l’IA offertes
                </li>
              </ul>
            </div>
            <Link
              href="/#question"
              className="inline-flex items-center justify-center gap-2 border-2 border-ink bg-paper px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-wide text-ink shadow-hard-ink transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#0e0e0e]"
            >
              Poser une question <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="offers-title" className="pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead num="01" kicker="Formules" id="offers-title" title={<>Pour aller <span className="font-serif font-normal italic">plus loin</span></>} />
          <div className="mt-12">
            <PricingCards />
          </div>
          <p className="mt-6 text-sm text-fg-2">
            Prix TTC · Paiement sécurisé par Stripe · Sans engagement, résiliable en 1 clic · Voir les{" "}
            <Link href="/cgv" className="underline decoration-signal decoration-2 underline-offset-4">
              conditions générales de vente
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead num="02" kicker="Comparatif" id="compare-title" title="Tout compris, en un coup d’œil" />
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-fg">
                  <th scope="col" className="py-4 pr-4">
                    <span className="sr-only">Critère</span>
                  </th>
                  {COLS.map((c, i) => (
                    <th key={c} scope="col" className={`${label} px-3 py-4 ${i === 2 ? "bg-fg text-bg" : ""}`}>
                      {c}
                      {i > 0 && (
                        <span className="mt-1 block font-display text-xl font-extrabold tracking-[-0.03em] normal-case">
                          {formatPrice(Object.values(OFFERS)[i - 1].priceCents)}
                          {i > 1 && <span className={`text-sm font-normal ${i === 2 ? "" : "text-fg-2"}`}> /mois</span>}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.k} className="border-b border-rule">
                    <th scope="row" className="py-4 pr-4 font-semibold">
                      {r.k}
                    </th>
                    {r.v.map((v, i) => (
                      <td key={i} className={`px-3 py-4 ${i === 2 ? "bg-surface" : ""}`}>
                        {v === true ? (
                          <Check aria-label="Oui" strokeWidth={2.5} className="size-5 text-focus" />
                        ) : v === false ? (
                          <Minus aria-label="Non" strokeWidth={2.5} className="size-5 text-fg-2" />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-fg-2">* Usage raisonnable : {OFFERS.illimite.monthlyQuota} questions par mois.</p>
        </div>
      </section>

      <section aria-labelledby="pricing-faq-title" className="pb-20 sm:pb-28">
        <div className={container}>
          <SectionHead num="03" kicker="Questions" id="pricing-faq-title" title="Questions fréquentes" />
          <div className="mt-12 border-t border-fg">
            {FAQ.map((f) => (
              <details key={f.question} className="group border-b border-rule">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 font-display text-xl font-bold tracking-[-0.025em] sm:text-2xl [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center border-2 border-fg text-xl leading-none transition group-open:rotate-45 motion-reduce:transition-none">
                    +
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-6 text-fg-2">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
