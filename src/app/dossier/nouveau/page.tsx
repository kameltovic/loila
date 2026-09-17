import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import Wizard from "@/components/Wizard";

export const metadata: Metadata = pageMetadata({
  title: "Décrire ma situation",
  description: "Décrivez votre situation : Loilà repère les articles de loi applicables, vous pose quelques questions ciblées puis rédige une synthèse sourcée.",
  path: "/dossier/nouveau",
});

export default function NewDossier() {
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Dossier guidé
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3rem,10vw,5.5rem)] leading-[0.92] text-balance`}>
        Décrivez votre <span className="font-serif font-normal tracking-[-0.02em] italic">situation.</span>
      </h1>
      <p className="mt-6 mb-10 max-w-2xl text-lg text-pretty text-fg-2">
        Travail, location, urbanisme : racontez ce qui se passe. Nous cherchons les articles de loi qui s’appliquent, posons au
        plus trois questions pour cibler les bonnes règles, puis rédigeons une synthèse avec les délais et les prochaines étapes.
      </p>
      <Wizard />
    </section>
  );
}
