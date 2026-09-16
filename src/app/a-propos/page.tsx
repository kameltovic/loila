import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { btnPrimary, container, display, label } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "À propos : le droit expliqué, sources officielles",
  description: "Pourquoi Loilà existe, d’où viennent les réponses (articles officiels Légifrance, synchronisés chaque jour) et comment elles sont rédigées.",
  path: "/a-propos",
});

export default function About() {
  return (
    <>
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-14 sm:pt-20 sm:pb-20`}>
          <p className={`${label} flex items-center gap-3 text-fg-2`}>
            <span aria-hidden className="size-2 rounded-full bg-signal" />À propos
          </p>
          <h1 className={`${display} mt-6 max-w-5xl text-[clamp(3.25rem,10vw,7rem)] leading-[0.92] text-balance`}>
            Loi + voilà <span className="font-serif font-normal tracking-[-0.02em] italic">= Loilà.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-2 sm:text-xl">
            Rendre le droit du quotidien compréhensible par tous.
          </p>
        </div>
      </section>
      <div className="prose-loila mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <h2>Notre mission</h2>
        <p>
          Le droit français est public, mais rarement lisible. Loilà part des textes officiels (Code du travail, Code de
          l’urbanisme, loi de 1989 sur les baux, conventions collectives) et les explique en français clair.
        </p>
        <h2>D’où viennent les textes ?</h2>
        <p>
          Les articles proviennent des données ouvertes de la DILA, diffusées par{" "}
          <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener noreferrer">Légifrance</a>, et sont mis à
          jour quotidiennement. Chaque réponse cite les articles utilisés pour que vous puissiez vérifier.
        </p>
        <h2>Ce que Loilà n’est pas</h2>
        <p>
          Loilà fournit une information juridique générale, pas un conseil juridique. Pour une situation particulière,
          rapprochez-vous d’un avocat, d’un notaire, d’une ADIL ou de l’inspection du travail.
        </p>
        <div className="pt-6">
          <Link href="/#question" className={btnPrimary}>
            Poser une question <ArrowRight aria-hidden strokeWidth={1.75} size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}
