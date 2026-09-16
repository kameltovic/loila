import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export const metadata: Metadata = { title: "À propos", description: "Pourquoi Loilà existe et comment le site fonctionne." };

export default function About() {
  return (
    <>
      <section className="hero-mesh border-b border-slate-200/70 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="text-4xl font-black tracking-tighter sm:text-6xl">À propos de Loilà</h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl dark:text-slate-400">
            Loi + voilà : rendre le droit du quotidien compréhensible par tous.
          </p>
        </div>
      </section>
      <div className="prose-loila mx-auto max-w-3xl px-4 py-12 sm:px-6">
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
        <p className="pt-4">
          <Link href="/#question" className={btnPrimary} style={{ textDecoration: "none", color: "white" }}>
            Poser une question
          </Link>
        </p>
      </div>
    </>
  );
}
