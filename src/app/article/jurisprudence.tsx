import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { container, display, label } from "@/components/ui";
import type { Article } from "@/lib/db";
import { articlePath } from "@/lib/articles";
import { articleStats, citation, decisionUrl, decisionsPage, formationLabel, teaser } from "@/lib/decisions";
import { jurisprudenceListIndexable } from "@/lib/eligibility";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { CODES } from "@/lib/themes";

const codeName = (c: string) => (CODES[c as keyof typeof CODES]?.name ?? c).replace(/ \(.*\)$/, "");
const CURSOR = /^\d{4}-\d{2}-\d{2}_(?:JURI|CETA|CONS)TEXT\d+$/; // Cassation, administrative, constitutional ids
const cursorOf = (raw: string | string[] | undefined) => (typeof raw === "string" && CURSOR.test(raw) ? raw : undefined);

/** Redirect target (article path + /jurisprudence), keeping the pagination cursor. */
export const jurisprudencePath = (articleHref: string, avant?: string | string[]) => {
  const cursor = cursorOf(avant);
  return `${articleHref}/jurisprudence${cursor ? `?avant=${cursor}` : ""}`;
};

export function jurisprudenceMetadata(a: Article, avant?: string | string[]): Metadata {
  const stats = articleStats(a.id);
  const title = `Jurisprudence de l’article ${a.num} du ${codeName(a.code)}`;
  const meta = pageMetadata({
    title,
    description: `${stats?.decisions ?? 0} décisions de justice (Cour de cassation, Conseil d’État, cours administratives d’appel, Conseil constitutionnel) appliquant l’article ${a.num} du ${codeName(a.code)}, des plus récentes aux plus anciennes, avec leur sommaire officiel.`,
    path: `${articlePath(a)}/jurisprudence`,
  });
  // One canonical list per article: following pages are browsable, not indexed. The list inherits the
  // parent article's indexability (a noindex article's case-law list must not be indexed either).
  return {
    ...meta,
    title: { absolute: title },
    ...(avant || !jurisprudenceListIndexable(a.id, a) ? { robots: { index: false, follow: true } } : {}),
  };
}

export function JurisprudenceView({ a, avant }: { a: Article; avant?: string | string[] }) {
  const cursor = cursorOf(avant);
  const stats = articleStats(a.id);
  const { rows, next } = decisionsPage(a.id, cursor);
  if (!rows.length && !cursor) notFound();
  const path = articlePath(a);
  const base = `${path}/jurisprudence`;

  return (
    <section className={`${container} pt-10 pb-20 sm:pt-14`}>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: `Article ${a.num}`, path }, { name: "Jurisprudence", path: base }])} />
      <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
        <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
        <span aria-hidden>/</span>
        <Link href={path} className="underline-offset-4 hover:underline">Article {a.num}, {codeName(a.code)}</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Jurisprudence</span>
      </nav>
      <h1 className={`${display} mt-8 max-w-5xl text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] text-balance`}>
        Jurisprudence de l’article {a.num} <span className="font-serif font-normal italic">du {codeName(a.code)}</span>
      </h1>
      {stats && (
        <p className="mt-4 text-lg text-fg-2">
          {stats.decisions} décision{stats.decisions > 1 ? "s" : ""} de justice
          {stats.first_date && stats.last_date && <> · {stats.first_date.slice(0, 4)}–{stats.last_date.slice(0, 4)}</>}
          {" · "}
          {Object.entries(stats.by_formation).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([f, n]) => `${formationLabel(f)} ${n}`).join(", ")}
        </p>
      )}

      <ol className="mt-10 border-t-2 border-fg">
        {rows.map((d) => (
          <li key={d.id} className="border-b border-rule">
            <Link href={decisionUrl(d)} className="group grid gap-2 py-5 hover:bg-surface sm:px-2">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{citation(d)}</span>
                <span className="font-mono text-xs uppercase text-fg-2">
                  {formationLabel(d.formation)} · {d.solution}{d.publie === 1 && " · Publié"}
                </span>
              </span>
              {d.sommaire && <span className="line-clamp-3 max-w-[80ch] text-[0.9375rem] text-fg-2">{teaser(d.sommaire, 360)}</span>}
            </Link>
          </li>
        ))}
      </ol>

      <nav aria-label="Pagination" className="mt-8 flex flex-wrap gap-4">
        {cursor && <Link href={base} className="font-semibold underline underline-offset-4">← Les plus récentes</Link>}
        {next && (
          <Link href={`${base}?avant=${next}`} rel="next" className="inline-flex items-center gap-1.5 font-semibold underline decoration-signal decoration-2 underline-offset-4">
            Décisions plus anciennes <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </nav>
    </section>
  );
}
