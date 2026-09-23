import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHead, container, display, label } from "@/components/ui";
import { type SectionNode, codeTree, rangeLabel, sectionHref, splitTitle } from "@/lib/codes";
import { JsonLd, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Top levels only: code-du-travail has ~3,400 sections, the deeper ones live on their section pages.
const DEPTH = 3;

export async function generateMetadata({ params }: PageProps<"/codes/[code]">): Promise<Metadata> {
  const t = codeTree((await params).code);
  if (!t) return { title: "Code introuvable" };
  const top = t.root.children.map((c) => splitTitle(c.title).name);
  return pageMetadata({
    title: `${t.name} : sommaire et articles expliqués`,
    description: clip(`Sommaire du ${t.name} (${t.root.count.toLocaleString("fr-FR")} articles) : ${top.join(", ")}. Chaque article en vigueur, expliqué en clair.`, 160),
    path: `/codes/${t.code}`,
    image: "/og/index.png",
  });
}

function Toc({ code, nodes, depth }: { code: string; nodes: SectionNode[]; depth: number }) {
  return (
    <ul className={depth === 1 ? "mt-8 border-t border-fg" : "mt-2 ml-4 border-l border-rule pl-4"}>
      {nodes.map((n) => (
        <li key={n.section} className={depth === 1 ? "border-b border-rule py-4" : "py-1"}>
          <Link href={sectionHref(code, n)} className={`${depth === 1 ? "font-display text-xl font-bold" : depth === 2 ? "font-semibold" : ""} hover:underline`}>
            {n.title}
          </Link>{" "}
          <span className="font-mono text-xs whitespace-nowrap text-fg-2">{rangeLabel(n)}</span>
          {depth < DEPTH && n.children.length > 0 && <Toc code={code} nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default async function CodePage({ params }: PageProps<"/codes/[code]">) {
  const t = codeTree((await params).code);
  if (!t) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Codes et lois", path: "/codes" }, { name: t.name, path: `/codes/${t.code}` }])} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} text-fg-2`}>
            <Link href="/codes" className="hover:underline">Codes et lois</Link> · Sommaire
          </p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>{t.name}</h1>
          <p className="mt-6 font-mono text-sm text-fg-2">
            {t.root.count.toLocaleString("fr-FR")} articles en vigueur · {rangeLabel(t.root)}
          </p>
        </div>
      </section>
      <section aria-labelledby="toc-title" className={`${container} py-16 sm:py-20`}>
        <SectionHead num="01" kicker="Sommaire" id="toc-title" title="Table des matières" />
        <Toc code={t.code} nodes={t.root.children} depth={1} />
      </section>
    </>
  );
}
