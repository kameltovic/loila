import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHead, container, display, label } from "@/components/ui";
import { hubCodes } from "@/lib/codes";
import { getDb } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Codes et lois : sommaires et articles expliqués",
  description:
    "Code civil, Code du travail, Code de l'urbanisme… Le sommaire de chaque code, livre par livre, avec les articles en vigueur et leur explication en clair.",
  path: "/codes",
  image: "/og/index.png",
});

export default function CodesPage() {
  const counts = new Map((getDb().prepare("SELECT code, COUNT(*) n FROM articles GROUP BY code").all() as { code: string; n: number }[]).map((r) => [r.code, r.n]));
  const codes = hubCodes().map((code) => ({ code, name: CODES[code].name, count: counts.get(code) ?? 0 }));
  const group = (lois: boolean) => codes.filter((t) => /^(loi|decret)-/.test(t.code) === lois);
  const list = (items: typeof codes) => (
    <ul className="mt-8 grid border-t border-fg md:grid-cols-2 md:gap-x-10">
      {items.map((t) => (
        <li key={t.code} className="border-b border-rule">
          <Link href={`/codes/${t.code}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 transition-colors hover:bg-surface sm:px-2">
            <span className="min-w-0">
              <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em]">{t.name}</span>
              <span className="mt-1 block font-mono text-xs text-fg-2">{t.count.toLocaleString("fr-FR")} articles</span>
            </span>
            <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Codes et lois", path: "/codes" }])} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} text-fg-2`}>Textes officiels · Légifrance</p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>Codes et lois</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Le sommaire de chaque code, livre par livre et chapitre par chapitre, pour retrouver un article et ceux qui l’entourent.
          </p>
        </div>
      </section>
      <section aria-labelledby="codes-title" className={`${container} py-16 sm:py-20`}>
        <SectionHead num="01" kicker="Codes" id="codes-title" title="Les codes" />
        {list(group(false))}
      </section>
      <section aria-labelledby="lois-title" className={`${container} pb-16 sm:pb-20`}>
        <SectionHead num="02" kicker="Lois et décrets" id="lois-title" title="Lois et décrets non codifiés" />
        {list(group(true))}
      </section>
    </>
  );
}
