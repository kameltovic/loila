import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SectionHead, btnPrimary, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { citation, decisionUrl, teaser } from "@/lib/decisions";
import { jorfIndexable } from "@/lib/eligibility";
import { NATURE_LABEL, type JorfArticleRow, type JorfRelation, articlesForJorf, byArticleNum, titleObject, decisionCountForJorf, decisionsForJorf, getJorfText, legifranceJorfUrl } from "@/lib/jorf";
import { JsonLd, abs, breadcrumbJsonLd, clip, pageMetadata } from "@/lib/seo";
import { CODES } from "@/lib/themes";

export const dynamic = "force-dynamic";

const ID = /^JORFTEXT\d{12}$/;
const frDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

const SECTIONS: { relation: JorfRelation; title: string; kicker: string }[] = [
  { relation: "cree", kicker: "Créés", title: "Articles créés par ce texte" },
  { relation: "modifie", kicker: "Modifiés", title: "Articles modifiés par ce texte" },
  { relation: "abroge", kicker: "Abrogation", title: "Articles dont ce texte prévoit l’abrogation" },
  { relation: "deplace", kicker: "Déplacés", title: "Articles déplacés par ce texte" },
  { relation: "codifie", kicker: "Codification", title: "Articles de code issus de ce texte" },
  { relation: "cite", kicker: "Renvois", title: "Articles qui renvoient à ce texte" },
];

export async function generateMetadata({ params }: PageProps<"/jo/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = ID.test(id) ? getJorfText(id) : undefined;
  if (!t) return { title: "Texte introuvable" };
  const n = articlesForJorf(id).length;
  const meta = pageMetadata({
    title: clip(`${t.titre}${titleObject(t) ? ` ${titleObject(t)}` : " : articles modifiés et jurisprudence"}`, 70),
    description: clip(
      `${t.titre_full ?? t.titre}${t.date_publi ? `, publié au Journal officiel du ${frDate(t.date_publi)}` : ""}. ${n} article${n > 1 ? "s" : ""} de loi reliés, décisions de justice qui le citent, sources officielles.`,
      160,
    ),
    path: `/jo/${id}`,
  });
  return { ...meta, title: { absolute: `${clip(`${t.titre} ${titleObject(t)}`.trim(), 62)} · Loilà` }, ...(jorfIndexable(id) ? {} : { robots: { index: false, follow: true } }) };
}

export default async function JorfPage({ params }: PageProps<"/jo/[id]">) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const t = getJorfText(id);
  if (!t) notFound();
  const rows = articlesForJorf(id);
  const decisions = decisionsForJorf(id, 20);
  const decisionTotal = decisionCountForJorf(id);
  const codeNames = new Map((getDb().prepare("SELECT id, name FROM legal_codes").all() as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const codeName = (c: string) => (CODES[c as keyof typeof CODES]?.name ?? codeNames.get(c) ?? c).replace(/ \(.*\)$/, "");
  const byCode = (list: JorfArticleRow[]) => {
    const m = new Map<string, JorfArticleRow[]>();
    const seen = new Set<string>();
    for (const r of list) if (!seen.has(r.article_id) && seen.add(r.article_id)) m.set(r.code, [...(m.get(r.code) ?? []), r]);
    return [...m].map(([c, l]) => [c, l.sort(byArticleNum)] as const);
  };
  const object = titleObject(t);
  const nature = t.nature ? NATURE_LABEL[t.nature] ?? t.nature.toLowerCase() : "Texte";
  let num = 0;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Journal officiel", path: "/jo" }, { name: t.titre, path: `/jo/${id}` }]),
          {
            "@context": "https://schema.org",
            "@type": "Legislation",
            name: t.titre_full ?? t.titre,
            alternateName: t.titre,
            legislationIdentifier: t.nor ?? t.num ?? id,
            legislationType: nature,
            ...(t.date_texte && { legislationDate: t.date_texte }),
            ...(t.date_publi && { datePublished: t.date_publi }),
            legislationJurisdiction: "FR",
            ...(t.eli && { sameAs: t.eli }),
            url: abs(`/jo/${id}`),
            isBasedOn: legifranceJorfUrl(id),
            inLanguage: "fr-FR",
          },
        ]}
      />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-16`}>
          <p className={`${label} text-fg-2`}>
            <Link href="/jo" className="hover:underline">Journal officiel</Link> · {nature}
          </p>
          <h1 className={`${display} mt-5 max-w-5xl text-[clamp(2rem,5.5vw,4rem)] leading-[0.98] text-balance`}>{t.titre}</h1>
          {object && <p className="mt-5 max-w-4xl font-serif text-xl italic text-pretty sm:text-2xl">{object.charAt(0).toUpperCase() + object.slice(1)}</p>}
          <dl className="mt-8 grid max-w-4xl gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
            {t.date_texte && <div><dt className={`${label} text-fg-2`}>Signé le</dt><dd className="mt-1 font-semibold">{frDate(t.date_texte)}</dd></div>}
            {t.jo && <div><dt className={`${label} text-fg-2`}>Publié au</dt><dd className="mt-1 font-semibold">{t.jo}</dd></div>}
            {t.nor && <div><dt className={`${label} text-fg-2`}>NOR</dt><dd className="mt-1 font-mono">{t.nor}</dd></div>}
            <div><dt className={`${label} text-fg-2`}>Dans Loilà</dt><dd className="mt-1 font-semibold">{new Set(rows.map((r) => r.article_id)).size} articles · {decisionTotal} décisions</dd></div>
          </dl>
          <a href={legifranceJorfUrl(id)} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} mt-8`}>
            Texte officiel sur Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </div>
      </section>

      <div className={`${container} space-y-16 py-16 sm:py-20`}>
        {SECTIONS.map(({ relation, title, kicker }) => {
          const groups = byCode(rows.filter((r) => r.relation === relation));
          if (!groups.length) return null;
          num++;
          return (
            <section key={relation} aria-labelledby={`${relation}-title`}>
              <SectionHead num={String(num).padStart(2, "0")} kicker={kicker} id={`${relation}-title`} title={title} />
              <div className="mt-8 space-y-8">
                {groups.map(([code, list]) => (
                  <div key={code}>
                    <h3 className="font-display text-lg font-bold tracking-[-0.02em]">{codeName(code)}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {list.slice(0, 200).map((r) => (
                        <li key={r.article_id}>
                          <Link href={`/article/${r.article_id}`} className="inline-block border-2 border-fg px-2.5 py-1 font-mono text-sm hover:bg-fg hover:text-bg">
                            {/^\d/.test(r.num) ? `Art. ${r.num}` : r.num}
                          </Link>
                        </li>
                      ))}
                      {list.length > 200 && <li className="self-center text-sm text-fg-2">et {list.length - 200} autres</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {decisions.length > 0 && (
          <section aria-labelledby="decisions-title">
            <SectionHead num={String(num + 1).padStart(2, "0")} kicker="Jurisprudence" id="decisions-title" title="Décisions qui citent ce texte" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {decisions.map((d) => (
                <li key={d.id}>
                  <Link href={decisionUrl(d)} className="block h-full border-2 border-fg p-5 hover:bg-surface">
                    <span className="font-semibold">{citation(d)}</span>
                    {d.solution && <span className="ml-2 font-mono text-xs uppercase text-fg-2">{d.solution}</span>}
                    {d.sommaire && <span className="mt-2 block line-clamp-3 text-sm text-fg-2">{teaser(d.sommaire, 220)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            {decisionTotal > decisions.length && <p className="mt-4 text-sm text-fg-2">{decisionTotal} décisions au total, les 20 plus récentes affichées.</p>}
          </section>
        )}

        <p className="border-t border-rule pt-6 text-sm text-fg-2">
          Source : Journal officiel de la République française (DILA, fonds JORF et LEGI, Licence Ouverte 2.0). Les liens entre ce texte et les
          articles viennent de la consolidation officielle de Légifrance ; les décisions sont celles qui mentionnent son numéro.
        </p>
      </div>
    </>
  );
}
