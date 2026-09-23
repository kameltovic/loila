import type { Metadata } from "next";
import Link from "next/link";
import { articlePath } from "@/lib/articles";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Chat from "@/components/Chat";
import { Empty, FaqIndex, SectionHead, block, btnPrimary, btnSecondary, container, display, label } from "@/components/ui";
import { getDb, type Article, type Faq } from "@/lib/db";
import { faqUrl } from "@/lib/themes";
import { formatDate } from "@/lib/plans";
import { conventionHeading, conventionLegifranceUrl, conventionUrl, getConvention, getConventions } from "@/lib/conventions";
import { JsonLd, abs, breadcrumbJsonLd, clip, faqJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Accord = { title: string; n: number };
type FaqRow = Pick<Faq, "theme" | "slug" | "question" | "short"> & { topic: string | null };

function load(slug: string) {
  const c = getConvention(slug);
  if (!c) return undefined;
  const db = getDb();
  const { n: articles } = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE code = ?").get(c.code) as { n: number };
  // Convention collective texts have no article number for most entries: the section is the accord/annexe title.
  const accords = db
    .prepare(
      `SELECT CASE WHEN instr(section, ' > ') > 0 THEN substr(section, 1, instr(section, ' > ') - 1) ELSE section END AS title, COUNT(*) AS n
       FROM articles WHERE code = ? AND section IS NOT NULL AND section <> ''
       GROUP BY title ORDER BY n DESC LIMIT 12`,
    )
    .all(c.code) as Accord[];
  const faqs = db
    .prepare(
      `SELECT DISTINCT f.theme, f.topic, f.slug, f.emoji, f.question, f.short, f.article_ids
       FROM faq f JOIN json_each(f.article_ids) j JOIN articles a ON a.id = j.value
       WHERE a.code = ? ORDER BY f.id`,
    )
    .all(c.code) as FaqRow[];
  const cited = db
    .prepare(
      `SELECT DISTINCT a.* FROM faq f JOIN json_each(f.article_ids) j JOIN articles a ON a.id = j.value
       WHERE a.code = ? ORDER BY a.num`,
    )
    .all(c.code) as Article[];
  const { grids, topics } = keyArticles(c.code);
  return { c, articles, accords, faqs, cited, grids, topics, updated: lastVersion(c.code) };
}

/** "1er janvier 2026", as dates are written in French legal texts. */
const frDate = (iso: string) => formatDate(iso).replace(/^1 /, "1er ");

const lastVersion = (code: string) =>
  (getDb().prepare("SELECT MAX(date_debut) AS d FROM articles WHERE code = ?").get(code) as { d: string | null }).d;

// Deterministic key-article picks by keyword match on section titles (main text first, then by date).
// ponytail: regex heuristics tuned on the 18 KALI conventions; revisit if a branch comes out empty or noisy.
const GRID = /^salaires?\b|salaires? (minim|hiérarchiques|conventionnels)|appointements minim|minima (conventionnels|hiérarchiques)|rémunérations? minim|grille applicable|barème (unique )?des salaires/i;
const NOT_GRID = /santé|prévoyance|épargne|intéressement|participation|retraite|égalité|temps partiel/i;
const TOPICS: { title: string; section: RegExp; texte?: RegExp }[] = [
  { title: "Salaires et classifications", section: /salaire|rémunération|classification|appointement/i },
  { title: "Période d’essai", section: /période d['’]essai|\bessai\b/i, texte: /période d['’]essai/i },
  { title: "Préavis et licenciement", section: /préavis|licenciement|rupture|démission|départ à la retraite|délai-congé/i, texte: /préavis/i },
  { title: "Congés", section: /congés?\b/i, texte: /congés payés/i },
  { title: "Primes et indemnités", section: /prime|indemnité|gratification|13e mois|treizième mois/i, texte: /\bprimes?\b|13e mois/i },
  { title: "Durée du travail", section: /durée du travail|temps de travail|heures supplémentaires|travail de nuit|repos|dimanche|astreinte|aménagement du temps/i, texte: /durée du travail|heures supplémentaires/i },
];
type KeyArticle = Article & { title: string };

function keyArticles(code: string) {
  const rows = getDb().prepare("SELECT * FROM articles WHERE code = ? AND section IS NOT NULL AND section <> ''").all(code) as (Article & { section: string })[];
  const leaf = (a: { section: string }) => a.section.split(" > ").pop()!;
  const main = (a: { section: string }) => /^Convention collective\b/i.test(a.section);
  const byDate = (x: Article, y: Article) => (y.date_debut ?? "").localeCompare(x.date_debut ?? "");

  // One entry per salary text (avenant or title), its longest article being the grid itself.
  const grids = new Map<string, KeyArticle>();
  for (const a of rows) {
    const seg = a.section.split(" > ").find((s) => GRID.test(s));
    if (!seg || NOT_GRID.test(a.section)) continue;
    const g = grids.get(seg);
    if (!g || a.texte.length > g.texte.length) grids.set(seg, { ...a, title: seg });
  }

  const used = new Set<string>();
  const topics = TOPICS.map((t) => {
    const score = (a: Article & { section: string }) => (main(a) ? 4 : 0) + (t.section.test(leaf(a)) ? 2 : 0) + (a.num ? 1 : 0);
    const seen = new Set<string>();
    const items = rows
      .filter((a) => !/égalit/i.test(a.section) && (t.section.test(leaf(a)) || (main(a) && !!t.texte?.test(a.texte))))
      .sort((x, y) => score(y) - score(x) || byDate(x, y))
      .filter((a) => {
        const k = leaf(a).toLowerCase();
        if (used.has(a.id) || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 4)
      .map((a) => ({ ...a, title: leaf(a) }));
    for (const a of items) used.add(a.id);
    return { title: t.title, items };
  }).filter((t) => t.items.length);

  return { grids: [...grids.values()].sort(byDate).slice(0, 4), topics };
}

/** Longest "Convention collective X (IDCC n) …" title that fits a search result (~60 chars). */
function metaTitle(c: { short: string; idcc: string }) {
  const id = `(IDCC ${c.idcc})`;
  return (
    [
      `Convention collective ${c.short} ${id} : texte gratuit et à jour`,
      `Convention collective ${c.short} ${id} gratuite et à jour`,
      `CCN ${c.short} ${id} gratuite et à jour`,
    ].find((t) => t.length <= 60) ?? `CCN ${c.short} ${id} gratuite`
  );
}

export async function generateMetadata({ params }: PageProps<"/conventions/branche/[slug]">): Promise<Metadata> {
  const c = getConvention((await params).slug);
  if (!c) return {};
  const updated = lastVersion(c.code);
  const title = metaTitle(c);
  const meta = pageMetadata({
    title,
    description: clip(
      `Convention collective ${c.short} (IDCC ${c.idcc}) gratuite et à jour${updated ? ` au ${frDate(updated)}` : ""} : salaires minimums, période d’essai, préavis, congés, primes. Texte officiel article par article.`,
    ),
    path: conventionUrl(c),
  });
  // Skip the " · Loilà" suffix so the IDCC isn’t truncated in results.
  return { ...meta, title: { absolute: title } };
}

export default async function ConventionPage({ params }: PageProps<"/conventions/branche/[slug]">) {
  const data = load((await params).slug);
  if (!data) notFound();
  const { c, articles, accords, faqs, cited, grids, topics, updated } = data;

  const path = conventionUrl(c);
  const legifrance = conventionLegifranceUrl(c);
  const others = getConventions().filter((o) => o.slug !== c.slug);
  const jsonLd = [
    breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Conventions collectives", path: "/conventions" }, { name: c.short, path }]),
    {
      "@context": "https://schema.org",
      "@type": "Legislation",
      name: c.name,
      legislationIdentifier: `IDCC ${c.idcc}`,
      legislationJurisdiction: "FR",
      legislationLegalForce: "InForce",
      inLanguage: "fr-FR",
      url: abs(path),
      isBasedOn: legifrance,
      sameAs: legifrance,
      isAccessibleForFree: true,
      ...(updated && { dateModified: updated }),
    },
    ...(faqs.length ? [faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.short, path: faqUrl(f) })))] : []),
  ];

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${block("conventions")} border-b-2 border-ink`}>
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2`}>
            <Link href="/" className="underline-offset-4 hover:underline">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/conventions" className="underline-offset-4 hover:underline">Conventions collectives</Link>
          </nav>
          <p className={`${label} mt-12 flex items-center gap-3 sm:mt-16`}>
            <span aria-hidden className="h-0.5 w-8 bg-signal" />
            IDCC {c.idcc}
          </p>
          <h1 className={`${display} mt-5 max-w-5xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance`}>
            {conventionHeading(c)}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            Cette convention collective de branche complète le Code du travail pour les salariés des entreprises concernées.
            Loilà en explique les règles clés en français clair, articles officiels à l’appui.
          </p>
          <dl className="mt-10 grid max-w-xl grid-cols-2 border-t-2 border-ink">
            <div className="py-4 pr-4 sm:pr-8">
              <dt className={label}>Articles officiels</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{articles.toLocaleString("fr-FR")}</dd>
            </div>
            <div className="border-l-2 border-ink py-4 pl-4 sm:pl-8">
              <dt className={label}>Questions expliquées</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{faqs.length}</dd>
            </div>
          </dl>
          <a href={legifrance} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} mt-8`}>
            Lire le texte officiel <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
          {grids.length > 0 && (
            <a href="#grille" className={`${btnSecondary} mt-8 ml-3`}>
              Grille des salaires
            </a>
          )}
          <p className="mt-6 max-w-2xl text-sm">
            Texte gratuit et à jour{updated && <> : dernière version en vigueur le {frDate(updated)}</>}. IDCC {c.idcc}, source{" "}
            <a href={legifrance} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Légifrance (KALI)</a>.
          </p>
        </div>
      </section>

      {grids.length > 0 && (
        <section id="grille" aria-labelledby="grille-title" className="scroll-mt-20 pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Salaires" id="grille-title" title="Grille des salaires minimums" />
            <ul className="mt-12 border-t-2 border-fg">
              {grids.map((g) => (
                <li key={g.id} className="border-b-2 border-fg">
                  <Link href={articlePath(g)} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-6 transition-colors hover:bg-surface sm:px-2">
                    <span className="min-w-0">
                      <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em] sm:text-2xl">{g.title}</span>
                      {g.date_debut && <span className="mt-2 block font-mono text-sm text-fg-2">En vigueur depuis le {frDate(g.date_debut)}</span>}
                    </span>
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-fg-2">
              Les minima conventionnels de la branche, texte officiel intégral. Aucun salaire ne peut être inférieur au SMIC.
            </p>
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section aria-labelledby="cles-title" className="pt-16 sm:pt-24">
          <div className={container}>
            <SectionHead num={num()} kicker="L’essentiel" id="cles-title" title="Les articles clés" />
            <div className="mt-12 grid border-t-2 border-l-2 border-fg sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <div key={t.title} className="border-r-2 border-b-2 border-fg p-5 sm:p-6">
                  <h3 className="font-display text-xl leading-tight font-bold tracking-[-0.02em]">{t.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {t.items.map((a) => (
                      <li key={a.id}>
                        <Link href={articlePath(a)} className="underline decoration-signal decoration-2 underline-offset-4">
                          {a.num ? `Art. ${a.num} · ` : ""}{a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {accords.length > 0 && (
        <section aria-labelledby="accords-title" className="py-16 sm:py-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Sommaire" id="accords-title" title="Ce que couvre cette convention" />
            <ul className="mt-12 grid border-t-2 border-l-2 border-fg sm:grid-cols-2 lg:grid-cols-3">
              {accords.map((a) => (
                <li key={a.title} className="flex items-baseline justify-between gap-4 border-r-2 border-b-2 border-fg p-5 sm:p-6">
                  <span className="font-display text-lg leading-tight font-bold tracking-[-0.02em]">{a.title}</span>
                  <span className="shrink-0 font-mono text-sm text-fg-2">{a.n.toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-fg-2">
              Les intitulés proviennent du texte officiel de la convention, découpé en accords et annexes.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="faq-title" className={accords.length ? "pb-16 sm:pb-24" : "py-16 sm:py-24"}>
        <div className={container}>
          <SectionHead num={num()} kicker="Questions fréquentes" id="faq-title" title="Les réponses essentielles" />
          <div className="mt-12">
            {faqs.length > 0 ? (
              <FaqIndex faqs={faqs} />
            ) : (
              <Empty>Aucune réponse publiée sur cette convention pour l’instant.</Empty>
            )}
          </div>
        </div>
      </section>

      <section id="question" aria-labelledby="ask-title" className="scroll-mt-20 pb-16 sm:pb-24">
        <div className={container}>
          <SectionHead
            num={num()}
            kicker="Votre cas"
            id="ask-title"
            title={<>Une question sur cette <span className="font-serif font-normal italic">branche</span> ?</>}
          />
          <p className="mt-4 max-w-xl text-lg text-fg-2">Décrivez votre situation, la réponse cite les articles utilisés.</p>
          <div className="mt-10 max-w-4xl">
            <Chat theme="conventions" title="" />
          </div>
        </div>
      </section>

      {cited.length > 0 && (
        <section aria-labelledby="cited-title" className="pb-16 sm:pb-24">
          <div className={container}>
            <SectionHead num={num()} kicker="Sources" id="cited-title" title="Articles cités dans nos réponses" />
            <ul className="mt-12 border-t border-fg">
              {cited.map((a) => (
                <li key={a.id} className="border-b border-rule">
                  <Link href={articlePath(a)} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-6 transition-colors hover:bg-surface sm:px-2">
                    <span className="min-w-0">
                      <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em] sm:text-2xl">
                        {a.num ? `Article ${a.num}` : (a.section?.split(" > ").pop() ?? "Texte officiel")}
                      </span>
                      <span className="mt-2 line-clamp-2 max-w-[68ch] text-fg-2">{a.texte}</span>
                    </span>
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="others-title" className="pb-20 sm:pb-28">
        <div className={container}>
          <SectionHead num={num()} kicker="Branches" id="others-title" title="Autres conventions collectives" />
          <ul className="mt-8 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={conventionUrl(o)} className="inline-flex rounded-full border-2 border-fg px-4 py-2 font-semibold transition hover:bg-fg hover:text-bg">
                  {o.short}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
