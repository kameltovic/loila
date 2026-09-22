import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHead, btnPrimary, container, display, label } from "@/components/ui";
import { getDb } from "@/lib/db";
import { NATURE_LABEL, jorfUrl, titleObject } from "@/lib/jorf";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Journal officiel : lois et décrets reliés aux articles de loi",
  description:
    "Retrouvez une loi, une ordonnance ou un décret du Journal officiel par son numéro : articles de code créés ou modifiés, jurisprudence qui le cite, sources officielles.",
  path: "/jo",
});

const frDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
type Row = { id: string; nature: string | null; titre: string; titre_full: string | null; date_publi: string | null; n: number };

export default async function JoHub({ searchParams }: PageProps<"/jo">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 40);
  const db = getDb();
  // "2016-472", "n° 2016-472", a NOR ("AGRT1527367D") or a JORFTEXT id.
  const num = q.match(/\d{2,4}-\d{1,5}/)?.[0];
  const hits = q
    ? (db
        .prepare(
          `SELECT t.id, t.nature, t.titre, t.titre_full, t.date_publi, 0 n FROM jorf_texts t
           WHERE t.num = @num OR t.nor = @q OR t.id = @q ORDER BY t.date_texte DESC LIMIT 20`,
        )
        .all({ num: num ?? "", q: q.toUpperCase() }) as Row[])
    : [];
  if (hits.length === 1) redirect(jorfUrl(hits[0].id));

  const recent = db
    .prepare(
      `SELECT t.id, t.nature, t.titre, t.titre_full, t.date_publi, COUNT(DISTINCT l.article_id) n
       FROM jorf_texts t JOIN jorf_article_links l ON l.jorf_text_id = t.id AND l.relation IN ('cree', 'modifie', 'abroge', 'codifie')
       WHERE t.fetched_at > 0 AND t.nature IN ('LOI', 'LOI_ORGANIQUE', 'ORDONNANCE', 'DECRET')
       GROUP BY t.id HAVING n >= 2 ORDER BY t.date_publi DESC LIMIT 60`,
    )
    .all() as Row[];
  const totals = db.prepare("SELECT nature, COUNT(*) n FROM jorf_texts WHERE nature IN ('LOI', 'ORDONNANCE', 'DECRET', 'ARRETE') GROUP BY nature").all() as { nature: string; n: number }[];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Journal officiel", path: "/jo" }])} />
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-12 pb-12 sm:pt-20 sm:pb-16`}>
          <p className={`${label} text-fg-2`}>Graphe juridique · Journal officiel</p>
          <h1 className={`${display} mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>Lois et décrets du Journal officiel</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Chaque texte publié au Journal officiel relié aux articles qu’il a créés, modifiés ou abrogés, et aux décisions de justice qui le citent.
          </p>
          <p className="mt-4 font-mono text-sm text-fg-2">
            {totals.map((t) => `${t.n.toLocaleString("fr-FR")} ${(NATURE_LABEL[t.nature] ?? t.nature).toLowerCase()}s`).join(" · ")}
          </p>
          <form method="get" className="mt-8 flex max-w-xl gap-3">
            <label className="sr-only" htmlFor="jo-q">Numéro, NOR ou identifiant du texte</label>
            <input id="jo-q" name="q" defaultValue={q} placeholder="Numéro du texte, ex. 2016-1088" className="w-full border-2 border-fg bg-bg px-4 py-3 text-lg" />
            <button type="submit" className={btnPrimary}>Chercher</button>
          </form>
          {q && hits.length === 0 && <p role="status" className="mt-4 font-semibold">Aucun texte relié au graphe pour « {q} ».</p>}
          {hits.length > 1 && (
            <ul role="status" className="mt-6 max-w-3xl border-t border-fg">
              {hits.map((h) => (
                <li key={h.id} className="border-b border-rule py-3">
                  <Link href={jorfUrl(h.id)} className="font-semibold underline underline-offset-4">{h.titre}</Link>
                  {titleObject(h) && <span className="block text-sm text-fg-2">{titleObject(h)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="recent-title" className={`${container} py-16 sm:py-20`}>
        <SectionHead num="01" kicker="Derniers textes" id="recent-title" title="Récemment publiés et reliés aux codes" />
        <ul className="mt-8 border-t border-fg">
          {recent.map((r) => (
            <li key={r.id}>
              <Link href={jorfUrl(r.id)} className="group grid gap-1 border-b border-rule py-4 hover:bg-surface sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-2">
                <span>
                  <span className="font-semibold group-hover:underline">{r.titre}</span>
                  {titleObject(r) && <span className="mt-1 block line-clamp-2 text-sm text-fg-2">{titleObject(r)}</span>}
                </span>
                <span className="font-mono text-xs text-fg-2">
                  {r.n} articles · JO du {frDate(r.date_publi)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
