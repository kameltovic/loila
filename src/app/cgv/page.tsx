import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import { FREE_QUESTIONS, OFFERS, formatPrice } from "@/lib/plans";

export const metadata: Metadata = pageMetadata({
  title: "Conditions générales de vente",
  description: "Conditions générales de vente des questions à l’unité et abonnements Loilà : prix, rétractation, résiliation, données.",
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
          Les présentes conditions régissent la vente, par <TODO /> (l’« Éditeur »), de questions posées à l’assistant de
          Loilà, à l’unité ou par abonnement. Les fiches et réponses déjà publiées sur le site restent accessibles
          gratuitement et sans limite.
        </p>

        <h2>2. Offres et prix</h2>
        <p>Les prix sont indiqués en euros, toutes taxes comprises (TTC) :</p>
        <ul>
          <li>{FREE_QUESTIONS} questions offertes par visiteur, sans achat ;</li>
          <li>
            {OFFERS.single.name} : {formatPrice(OFFERS.single.priceCents)} la question, sans date d’expiration ;
          </li>
          <li>
            {OFFERS.essentiel.name} : {formatPrice(OFFERS.essentiel.priceCents)} par mois, {OFFERS.essentiel.monthlyQuota}{" "}
            questions par période, non reportables ;
          </li>
          <li>
            {OFFERS.illimite.name} : {formatPrice(OFFERS.illimite.priceCents)} par mois, questions illimitées dans la limite
            d’un usage raisonnable ({OFFERS.illimite.monthlyQuota} questions par période).
          </li>
        </ul>
        <p>Seules les nouvelles questions donnant lieu à une réponse rédigée par l’IA sont décomptées.</p>

        <h2>3. Commande et paiement</h2>
        <p>
          Le paiement est effectué par carte bancaire via Stripe. L’Éditeur n’a pas accès aux coordonnées bancaires. Les
          abonnements sont prélevés à la souscription puis à chaque date anniversaire mensuelle.
        </p>

        <h2>4. Droit de rétractation</h2>
        <p>
          Conformément à l’article L221-28 13° du Code de la consommation, le droit de rétractation ne peut être exercé
          pour la fourniture d’un contenu numérique non fourni sur un support matériel dont l’exécution a commencé avec
          l’accord préalable exprès du consommateur et sa renonciation expresse à ce droit. Ce consentement et cette
          renonciation sont recueillis lors du paiement. <TODO /> (modalités exactes et case à cocher au checkout)
        </p>

        <h2>5. Durée et résiliation</h2>
        <p>
          Les abonnements sont sans engagement. Ils peuvent être résiliés à tout moment depuis{" "}
          <Link href="/compte">Mon compte</Link> ; la résiliation prend effet à la fin de la période en cours, déjà payée.
          Aucun remboursement au prorata n’est dû, sauf disposition légale contraire.
        </p>

        <h2>6. Nature du service</h2>
        <p>
          Les réponses constituent une information juridique générale et ne remplacent pas le conseil personnalisé d’un
          professionnel du droit. <TODO /> (limitation de responsabilité)
        </p>

        <h2>7. Données personnelles</h2>
        <p>
          L’adresse email et l’historique d’achat sont traités pour la gestion du compte, de la facturation et de la
          connexion par lien email. Les données de paiement sont traitées par Stripe. Vous disposez d’un droit d’accès, de
          rectification et d’effacement : <a href="mailto:contact@loila.fr">contact@loila.fr</a>. <TODO /> (durées de
          conservation, base légale, sous-traitants)
        </p>

        <h2>8. Médiation et litiges</h2>
        <p>
          Médiateur de la consommation : <TODO />. Droit applicable : droit français.
        </p>
      </div>
    </>
  );
}
