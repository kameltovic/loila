import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import { FREE_QUESTIONS, OFFERS, formatPrice } from "@/lib/plans";

const D = OFFERS.dossier;

export const metadata: Metadata = pageMetadata({
  title: "Conditions générales de vente",
  description: "Conditions générales de vente des dossiers de questions Loilà : prix, validité de 30 jours, rétractation, données.",
  path: "/cgv",
});

const TODO = () => (
  <mark className="rounded-full border-[1.5px] border-ink bg-travail px-2 py-0.5 text-sm font-semibold text-ink">à compléter</mark>
);

export default function Cgv() {
  return (
    <>
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            Informations
          </p>
          <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,6rem)] leading-[0.92]`}>Conditions générales de vente</h1>
        </div>
      </section>
      <div className="prose-loila mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <p role="note" className="border-2 border-signal bg-danger-bg px-4 py-3">
          <strong>Document provisoire, à compléter et valider par un juriste</strong> avant toute mise en production.
        </p>

        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent la vente, par Kamel Laïmène EI, exerçant sous le nom commercial Coffee Beans, 4 rue de Cambo, 75019 Paris, SIRET 521 998 120 00021 (l’« Éditeur »), de questions posées à l’assistant de
          Loilà, regroupées en « dossiers ». Les fiches et réponses déjà publiées sur le site restent accessibles gratuitement
          et sans limite.
        </p>

        <h2>2. Offres et prix</h2>
        <ul>
          <li>{FREE_QUESTIONS} questions offertes par compte, sans achat ;</li>
          <li>
            <strong>{D.name}</strong> : {formatPrice(D.priceCents)} {D.taxLabel}, paiement unique, donnant droit à {D.credits}{" "}
            questions.
          </li>
        </ul>
        <p>
          L’offre {OFFERS.pro.name} ({formatPrice(OFFERS.pro.priceCents)} {OFFERS.pro.taxLabel} par mois) n’est pas encore
          commercialisée : l’inscription sur sa liste d’attente est gratuite et n’engage à rien. Ses conditions seront ajoutées
          aux présentes avant son ouverture.
        </p>
        <p>Seules les nouvelles questions donnant lieu à une réponse rédigée par l’IA sont décomptées.</p>

        <h2 id="validite">3. Durée de validité des questions</h2>
        <p>
          Les questions d’un dossier sont <strong>valables {D.validityDays} jours à compter de la date d’achat</strong>. À
          l’issue de ce délai, les questions non utilisées expirent : elles ne sont ni reportées, ni remboursées, ni
          échangées. Chaque achat constitue un dossier distinct avec sa propre date d’expiration, qui n’est pas prolongée par
          un achat ultérieur. Lorsque plusieurs dossiers sont en cours, les questions du dossier qui expire le plus tôt sont
          utilisées en premier. Le nombre de questions restantes et leur date d’expiration sont affichés dans{" "}
          <Link href="/compte">Mon compte</Link>.
        </p>

        <h2>4. Commande et paiement</h2>
        <p>
          Le paiement est effectué par carte bancaire via Stripe, en une seule fois. L’Éditeur n’a pas accès aux coordonnées
          bancaires. Les questions sont disponibles sur le compte dès la confirmation du paiement.
        </p>

        <h2 id="retractation">5. Droit de rétractation</h2>
        <p>
          Les questions d’un dossier constituent un contenu numérique non fourni sur un support matériel, mis à disposition
          immédiatement après le paiement. Conformément à l’article L221-28 13° du Code de la consommation, le droit de
          rétractation de 14 jours ne peut être exercé lorsque l’exécution a commencé avec l’accord préalable exprès du
          consommateur et sa renonciation expresse à ce droit.
        </p>
        <p>
          Avant tout paiement, le client coche une case par laquelle il demande l’accès immédiat à ses questions et reconnaît
          renoncer à son droit de rétractation. Sans cette case cochée, la commande ne peut pas être passée. La date de ce
          consentement est conservée avec la commande. <TODO /> (confirmation sur support durable, voir L221-13)
        </p>

        <h2>6. Nature du service</h2>
        <p>
          Les réponses constituent une information juridique générale et ne remplacent pas le conseil personnalisé d’un
          professionnel du droit. <TODO /> (limitation de responsabilité)
        </p>

        <h2>7. Données personnelles</h2>
        <p>
          Les données nécessaires au compte, aux achats, aux questions et aux dossiers sont traitées par l’Éditeur selon la{" "}
          <Link href="/mentions-legales#donnees-personnelles">politique de protection des données personnelles</Link>{" "}
          (finalités, durées de conservation, sous-traitants, transferts et droits).
        </p>

        <h2>8. Médiation et litiges</h2>
        <p>
          Médiateur de la consommation : <TODO />. Droit applicable : droit français.
        </p>
      </div>
    </>
  );
}
