import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "Mentions légales",
  description: "Mentions légales du site Loilà : éditeur, hébergement, données personnelles et limites de responsabilité.",
  path: "/mentions-legales",
});

const TODO = () => (
  <mark className="rounded-full border-[1.5px] border-ink bg-travail px-2 py-0.5 text-sm font-semibold text-ink">à compléter</mark>
);

export default function LegalNotice() {
  return (
    <>
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />Informations
          </p>
          <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,6rem)] leading-[0.92]`}>Mentions légales</h1>
        </div>
      </section>
      <div className="prose-loila mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <h2>Éditeur du site</h2>
        <p>Raison sociale, forme juridique, capital, adresse du siège, SIREN/RCS : <TODO /></p>
        <p>Directeur de la publication : <TODO /></p>
        <p>Contact : <a href="mailto:contact@loila.fr">contact@loila.fr</a></p>
        <h2>Hébergement</h2>
        <p>Nom, adresse et téléphone de l’hébergeur : <TODO /></p>
        <h2>Sources des textes</h2>
        <p>
          Les textes juridiques sont issus des données ouvertes de la DILA (Légifrance), réutilisées conformément à leur
          licence. Loilà n’est pas un service officiel de l’administration.
        </p>
        <h2>Responsabilité</h2>
        <p>
          Les contenus publiés constituent une information juridique générale et ne remplacent pas un conseil juridique
          personnalisé. Les réponses générées automatiquement peuvent comporter des erreurs : vérifiez toujours les
          articles cités.
        </p>
        <h2>Données personnelles</h2>
        <p>Politique de traitement des questions posées, durée de conservation, droits RGPD : <TODO /></p>
      </div>
    </>
  );
}
