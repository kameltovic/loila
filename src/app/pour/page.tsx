import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";
import { Empty, block, container, display, label } from "@/components/ui";
import { getMetiers } from "@/lib/metiers";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({
  title: "Pour les pros : syndics, BTP, bailleurs, employeurs",
  description: "Les règles de droit utiles à votre métier, expliquées simplement et sourcées : syndics bénévoles, entreprises du BTP, bailleurs, employeurs de TPE.",
  path: "/pour",
});

export default function Metiers() {
  const metiers = getMetiers();
  return (
    <section className={`${container} pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Pour les pros
      </p>
      <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3rem,9vw,6rem)] leading-[0.92] text-balance`}>
        Le droit de <span className="font-serif font-normal tracking-[-0.02em] italic">votre métier.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
        Les règles, délais et obligations que vous croisez chaque semaine, expliqués simplement, avec l’article de loi à
        chaque fois.
      </p>
      {metiers.length ? (
        <ul className="mt-12 grid gap-5 md:grid-cols-2">
          {metiers.map((m) => (
            <li key={m.slug}>
              <Link href={`/pour/${m.slug}`} className="group flex h-full flex-col border-2 border-fg bg-surface shadow-hard transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm motion-reduce:transition-none">
                <span className={`${block(m.theme)} flex items-center gap-2 border-b-2 border-fg px-5 py-3`}>
                  <ThemeIcon slug={m.theme} className="size-5" />
                  <span className={label}>{m.audience.slice(0, 2).join(" · ")}</span>
                </span>
                <span className="flex flex-1 flex-col p-5 sm:p-6">
                  <span className={`${display} text-3xl leading-tight sm:text-4xl`}>{m.title}</span>
                  <span className="mt-3 text-fg-2">{m.intro}</span>
                  <span className="mt-auto flex items-center gap-1.5 pt-6 font-mono text-xs font-bold uppercase">
                    Découvrir <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12"><Empty>Les espaces métiers arrivent très bientôt.</Empty></div>
      )}
    </section>
  );
}
