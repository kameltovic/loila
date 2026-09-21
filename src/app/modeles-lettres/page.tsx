import type { Metadata } from "next";
import { LettreCards } from "@/components/Lettres";
import { Empty, SectionHead, container, display, label } from "@/components/ui";
import { getLettres, lettreUrl } from "@/lib/lettres";
import { JsonLd, abs, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { THEMES } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({
  title: "Modèles de lettres gratuits : démission, préavis, dépôt de garantie",
  description: "Modèles de lettres juridiques gratuits à compléter en ligne, sans inscription : démission, rupture conventionnelle, préavis locataire, dépôt de garantie, travaux, quittance. Avec les articles de loi.",
  path: "/modeles-lettres",
});

export default function Lettres() {
  const lettres = getLettres();
  const groups = THEMES.map((t) => ({ theme: t, lettres: lettres.filter((l) => l.theme === t.slug) })).filter((g) => g.lettres.length);
  return (
    <section className={`${container} pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Modèles de lettres", path: "/modeles-lettres" }]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: lettres.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.title, url: abs(lettreUrl(l)) })),
          },
        ]}
      />
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Modèles de lettres
      </p>
      <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3rem,9vw,6rem)] leading-[0.92] text-balance`}>
        La bonne lettre, <span className="font-serif font-normal tracking-[-0.02em] italic">avec le bon article.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
        Des modèles gratuits à compléter en ligne, sans inscription. Chaque lettre cite le texte de loi applicable et rappelle
        les délais à respecter.
      </p>
      {groups.length ? (
        groups.map((g, i) => (
          <div key={g.theme.slug} className="mt-16 sm:mt-24">
            <SectionHead num={String(i + 1).padStart(2, "0")} kicker={g.theme.title} title={g.theme.tagline} />
            <div className="mt-10"><LettreCards lettres={g.lettres} from="/modeles-lettres" /></div>
          </div>
        ))
      ) : (
        <div className="mt-12"><Empty>Les modèles de lettres arrivent très bientôt.</Empty></div>
      )}
    </section>
  );
}
