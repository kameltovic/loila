import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales" };

const TODO = () => (
  <mark className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
    à compléter
  </mark>
);

export default function LegalNotice() {
  return (
    <>
      <section className="border-b border-slate-200/70 bg-muted dark:border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">Mentions légales</h1>
        </div>
      </section>
      <div className="prose-loila mx-auto max-w-3xl px-4 py-12 sm:px-6">
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
