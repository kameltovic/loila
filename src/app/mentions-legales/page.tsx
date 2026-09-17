import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "Mentions légales et données personnelles",
  description: "Mentions légales de Loilà : éditeur, hébergement, responsabilité, et politique de protection des données personnelles (RGPD).",
  path: "/mentions-legales",
});

export default function LegalNotice() {
  return (
    <>
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />Informations
          </p>
          <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,6rem)] leading-[0.92]`}>Mentions légales</h1>
          <p className="mt-6 text-fg-2">Dernière mise à jour : 17 septembre 2026</p>
        </div>
      </section>
      <div className="prose-loila mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <h2>Éditeur du site</h2>
        <p>
          Le site loila.fr est édité par <strong>Kamel Laïmène EI</strong>, entrepreneur individuel exerçant sous le nom
          commercial <strong>Coffee Beans</strong>.
        </p>
        <ul>
          <li>Adresse : 4 rue de Cambo, 75019 Paris, France</li>
          <li>SIRET : 521 998 120 00021</li>
          <li>TVA intracommunautaire : FR85521998120</li>
          <li>
            Contact : <Link href="/contact">formulaire de contact</Link>
          </li>
        </ul>

        <h2>Directeur de la publication</h2>
        <p>Kamel Laïmène.</p>

        <h2>Hébergement</h2>
        <ul>
          <li>
            Serveurs : Amazon Web Services EMEA SARL, 38 avenue John F. Kennedy, L-1855 Luxembourg. Données hébergées dans la
            région AWS de Paris (France).
          </li>
          <li>Diffusion et protection du site : Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis.</li>
        </ul>

        <h2>Sources des textes</h2>
        <p>
          Les textes juridiques sont issus des données ouvertes de la DILA (Légifrance), réutilisées conformément à leur
          licence. Loilà n’est pas un service officiel de l’administration.
        </p>

        <h2>Responsabilité</h2>
        <p>
          Les contenus publiés constituent une information juridique générale et ne remplacent pas un conseil juridique
          personnalisé. Les réponses générées automatiquement peuvent comporter des erreurs : vérifiez toujours les articles
          cités et, pour une situation à enjeu, consultez un avocat ou un professionnel du droit.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          La marque Loilà, l’identité visuelle, la structure du site et les contenus rédigés par l’Éditeur sont protégés par
          le droit d’auteur. Toute reproduction sans autorisation écrite préalable est interdite. Les textes de loi restent
          librement réutilisables selon leur licence d’origine.
        </p>

        <h2 id="donnees-personnelles">Données personnelles</h2>
        <p>
          Le responsable du traitement est Kamel Laïmène EI (Coffee Beans), dont les coordonnées figurent ci-dessus. Les
          données sont traitées conformément au Règlement général sur la protection des données (RGPD) et à la loi
          Informatique et Libertés.
        </p>

        <h3>Données traitées, finalités et bases légales</h3>
        <ul>
          <li>
            <strong>Compte</strong> (adresse email, date de création, sessions de connexion) : créer et sécuriser votre compte,
            vous connecter par lien email. Base légale : exécution du contrat.
          </li>
          <li>
            <strong>Achats</strong> (offre achetée, montant, date, questions restantes et leur expiration, identifiant client
            Stripe, date de votre renonciation au droit de rétractation) : fournir le service payé, facturer, prouver la
            commande. Bases légales : exécution du contrat et obligations légales comptables.
          </li>
          <li>
            <strong>Questions posées</strong> au chat (texte de la question, thème, date, type de réponse obtenue, compte le cas
            échéant) : y répondre, puis établir des statistiques pour améliorer les fiches et les réponses. Bases légales :
            exécution du contrat, puis intérêt légitime de l’Éditeur à améliorer son service.
          </li>
          <li>
            <strong>Dossiers</strong> (description de votre situation, réponses aux questions de précision, synthèses et
            questions de suivi) : produire la synthèse et conserver l’historique de vos dossiers dans{" "}
            <Link href="/compte">Mon compte</Link>. Base légale : exécution du contrat.
          </li>
          <li>
            <strong>Liste d’attente Pro</strong> (adresse email, métier indiqué) : vous prévenir de l’ouverture de l’offre.
            Base légale : consentement, retirable à tout moment.
          </li>
          <li>
            <strong>Messages de contact</strong> (prénom, nom, entreprise, adresse email, message) : vous répondre. Base légale :
            intérêt légitime à traiter les demandes reçues.
          </li>
          <li>
            <strong>Sécurité</strong> (adresse IP, utilisée en mémoire vive uniquement, sans stockage) : limiter les abus et
            les envois massifs. Base légale : intérêt légitime.
          </li>
        </ul>
        <p>
          Ne saisissez pas de données sensibles ni d’informations permettant d’identifier des tiers (noms, adresses,
          numéros) dans vos questions ou dossiers : elles ne sont pas nécessaires pour obtenir une réponse.
        </p>

        <h3>Durées de conservation</h3>
        <ul>
          <li>Compte et dossiers : tant que le compte existe ; suppression sur simple demande.</li>
          <li>Questions posées au chat : 12 mois, puis suppression automatique.</li>
          <li>Liens de connexion : supprimés un jour après leur expiration ; sessions : 90 jours au plus.</li>
          <li>Données d’achat et de facturation : 10 ans, conformément à l’article L123-22 du Code de commerce.</li>
          <li>Liste d’attente Pro : jusqu’à l’ouverture de l’offre ou votre désinscription.</li>
          <li>Messages de contact : 3 ans à compter de leur envoi, puis suppression automatique.</li>
        </ul>

        <h3>Destinataires et sous-traitants</h3>
        <p>
          Les données sont destinées à l’Éditeur. Elles ne sont ni vendues ni cédées. Elles sont traitées, pour son compte,
          par les prestataires suivants :
        </p>
        <ul>
          <li>Amazon Web Services (hébergement, région de Paris) ;</li>
          <li>Cloudflare (diffusion du site et protection contre les attaques) ;</li>
          <li>Stripe (paiement : l’Éditeur n’a jamais accès à vos coordonnées bancaires) ;</li>
          <li>Sweego (envoi des emails de connexion et de notification, France) ;</li>
          <li>
            OpenRouter et les fournisseurs de modèles d’intelligence artificielle auxquels il transmet les questions et les
            dossiers pour générer les réponses (notamment Anthropic, Google et, pour l’analyse des dossiers, des hébergeurs
            établis aux États-Unis). Les requêtes sont configurées pour exclure les fournisseurs qui conservent les données
            ou les utilisent pour entraîner leurs modèles.
          </li>
        </ul>

        <h3>Transferts hors de l’Union européenne</h3>
        <p>
          Certains prestataires (Cloudflare, Stripe, OpenRouter, fournisseurs de modèles) sont établis aux États-Unis. Ces
          transferts sont encadrés par le cadre de protection des données UE–États-Unis (Data Privacy Framework) lorsque le
          prestataire y a adhéré, ou à défaut par les clauses contractuelles types adoptées par la Commission européenne.
        </p>

        <h3>Cookies et mesure d’audience</h3>
        <p>
          Loilà n’utilise que des cookies strictement nécessaires, exemptés de consentement : maintien de la connexion
          (<code>loila_session</code>), finalisation de la connexion par lien email (<code>loila_login</code>, 15 minutes) et
          identifiant technique de visiteur non connecté (<code>loila_anon</code>). La mesure d’audience est assurée par
          Umami, auto-hébergé, sans cookie et sans suivi entre sites. Aucun traceur publicitaire n’est utilisé.
        </p>

        <h3>Vos droits</h3>
        <p>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de
          vos données, ainsi que du droit de retirer votre consentement et de définir des directives sur leur sort après
          votre décès. Pour les exercer, utilisez le <Link href="/contact">formulaire de contact</Link> en indiquant
          l’adresse email de votre compte ; une réponse vous est apportée dans un délai d’un mois.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL
          (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07,{" "}
          <a href="https://www.cnil.fr/fr/plaintes" rel="noopener">cnil.fr</a>).
        </p>
      </div>
    </>
  );
}
