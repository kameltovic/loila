import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHead, container, display, label } from "@/components/ui";
import { articlePath, articleSummary } from "@/lib/articles";
import { type CodeTree, type SectionNode, codeTree, isIndexableArticle, rangeLabel, sectionArticles, sectionHref, sectionTrail, splitTitle } from "@/lib/codes";
import { JsonLd, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Above this, list sub-sections only (a whole "Partie législative" is thousands of articles).
const LIST_MAX = 300;

function resolve(code: string, slugs: string[]): { t: CodeTree; n: SectionNode } | undefined {
  const t = codeTree(code);
  const n = t?.bySlug.get(slugs.join("/"));
  return t && n ? { t, n } : undefined;
}

const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const firstSentence = (s: string) => clip(s.split(/(?<=[.;:!?])\s/)[0], 200);

export async function generateMetadata({ params }: PageProps<"/codes/[code]/[...section]">): Promise<Metadata> {
  const { code, section } = await params;
  const r = resolve(code, section);
  if (!r) return { title: "Section introuvable", robots: { index: false, follow: true } };
  const { t, n } = r;
  const { kind, name } = splitTitle(n.title);
  const arts = n.count <= LIST_MAX ? sectionArticles(code, n.section) : [];
  const key = arts.filter((a) => isIndexableArticle(a.id));
  const nums = (key.length ? key : arts).slice(0, 8).map((a) => a.num);
  const parents = sectionTrail(t, n).slice(0, -1).map((p) => splitTitle(p.title).name);
  const title = `${t.name}, ${rangeLabel(n)} : ${lowerFirst(name)}`;
  const meta = pageMetadata({
    title,
    description: clip(
      `${kind ? `${kind} « ${name} »` : name} du ${t.name}${parents.length ? ` (${parents.at(-1)})` : ""}. ${
        nums.length ? `Article${nums.length > 1 ? "s" : ""} ${nums.join(", ")}${arts.length > nums.length ? "…" : ""}` : `${n.count} articles, ${rangeLabel(n)}`
      } : texte en vigueur et explication en clair.`,
      160,
    ),
    path: sectionHref(code, n),
    image: "/og/index.png",
  });
  return { ...meta, title: { absolute: `${clip(title, 70)} · Loilà` }, ...(n.indexable ? {} : { robots: { index: false, follow: true } }) };
}

export default async function SectionPage({ params }: PageProps<"/codes/[code]/[...section]">) {
  const { code, section } = await params;
  const r = resolve(code, section);
  if (!r) notFound();
  const { t, n } = r;
  const trail = sectionTrail(t, n);
  const parent = trail.at(-2) ?? t.root;
  const i = parent.children.indexOf(n);
  const [prev, next] = [parent.children[i - 1], parent.children[i + 1]];
  const all = n.count <= LIST_MAX;
  const arts = sectionArticles(code, n.section).filter((a) => all || a.section === n.section);
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Codes et lois", path: "/codes" },
    { name: t.name, path: `/codes/${code}` },
    ...trail.map((s) => ({ name: splitTitle(s.title).kind || s.title, path: sectionHref(code, s) })),
  ];
  // Sub-section headings inside the full list: breadcrumb below the current section.
  const heading = (s: string) => (s === n.section ? "" : s.slice(n.section.length + 3).split(" > ").join(" › "));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap gap-x-2 gap-y-1 text-fg-2`}>
            {crumbs.slice(1, -1).map((c) => (
              <span key={c.path}>
                <Link href={c.path} className="hover:underline">{c.name}</Link> ›
              </span>
            ))}
          </nav>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2rem,5.5vw,4rem)] leading-[0.98] text-balance`}>{n.title}</h1>
          <p className="mt-6 font-mono text-sm text-fg-2">
            {t.name} · {rangeLabel(n)} · {n.count} article{n.count > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {n.children.length > 0 && (
        <section aria-labelledby="sub-title" className={`${container} pt-16 sm:pt-20`}>
          <SectionHead num="01" kicker="Sommaire" id="sub-title" title="Subdivisions" />
          <ul className="mt-8 border-t border-fg">
            {n.children.map((c) => (
              <li key={c.section} className="border-b border-rule py-3">
                <Link href={sectionHref(code, c)} className="font-semibold hover:underline">{c.title}</Link>{" "}
                <span className="font-mono text-xs whitespace-nowrap text-fg-2">{rangeLabel(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {arts.length > 0 && (
        <section aria-labelledby="arts-title" className={`${container} py-16 sm:py-20`}>
          <SectionHead num={n.children.length ? "02" : "01"} kicker="Articles" id="arts-title" title={!all ? "Articles de cette section" : arts.length > 1 ? `Les ${arts.length} articles` : "L’article"} />
          <ol className="mt-8 border-t border-fg">
            {arts.map((a, j) => {
              const h = heading(a.section);
              const text = articleSummary(a)?.summary ?? a.texte;
              return (
                <li key={a.id}>
                  {h && h !== heading(arts[j - 1]?.section ?? n.section) && <p className={`${label} border-b border-fg pt-8 pb-2 text-fg-2`}>{h}</p>}
                  <Link href={articlePath(a)} className="group grid gap-1 border-b border-rule py-4 hover:bg-surface sm:grid-cols-[8rem_1fr] sm:px-2">
                    <span className="font-display text-lg font-bold group-hover:underline">Art. {a.num}</span>
                    <span className="text-fg-2">{firstSentence(text)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <nav aria-label="Sections voisines" className={`${container} flex justify-between gap-6 border-t border-rule py-8 font-mono text-sm`}>
        {prev ? <Link href={sectionHref(code, prev)} rel="prev" className="hover:underline">← {splitTitle(prev.title).kind || prev.title}</Link> : <span />}
        <Link href={sectionHref(code, parent)} className="hover:underline">↑ {splitTitle(parent.title).kind || parent.title}</Link>
        {next ? <Link href={sectionHref(code, next)} rel="next" className="hover:underline">{splitTitle(next.title).kind || next.title} →</Link> : <span />}
      </nav>
    </>
  );
}
