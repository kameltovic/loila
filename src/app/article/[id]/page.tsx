import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { Empty, FaqIndex, btnPrimary, container, display, label } from "@/components/ui";

export const dynamic = "force-dynamic";

const load = (id: string) => getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as Article | undefined;
const codeName = (a: Article) => CODES[a.code as keyof typeof CODES]?.name ?? a.code;

export async function generateMetadata({ params }: PageProps<"/article/[id]">): Promise<Metadata> {
  const a = load((await params).id);
  return a ? { title: `Article ${a.num} — ${codeName(a)}`, description: a.texte.slice(0, 160) } : {};
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const a = load((await params).id);
  if (!a) notFound();

  const related = getDb()
    .prepare(
      "SELECT theme, slug, emoji, question, short FROM faq WHERE EXISTS (SELECT 1 FROM json_each(faq.article_ids) WHERE value = ?)",
    )
    .all(a.id) as Faq[];

  return (
    <>
      <section className="border-b-2 border-fg">
        <div className={`${container} pt-8 pb-12 sm:pt-10 sm:pb-16`}>
          <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
            <Link href="/" className="hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4">
              Accueil
            </Link>
            <span aria-hidden>/</span>
            <span>{codeName(a)}</span>
          </nav>
          <p className={`${label} mt-12 flex items-center gap-3`}>
            <span aria-hidden className="h-0.5 w-8 bg-signal" />
            {codeName(a)}
          </p>
          <h1 className={`${display} mt-4 text-[clamp(3.25rem,10vw,7rem)] leading-[0.92]`}>Article {a.num}</h1>
          {a.section && (
            <p className="mt-5 max-w-3xl font-serif text-xl leading-snug text-fg-2 italic">{a.section.split(" > ").join(" › ")}</p>
          )}
        </div>
      </section>

      <article className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_16rem]`}>
        <div className="rounded-2xl border-2 border-fg bg-surface p-6 sm:p-10">
          <div className="max-w-[68ch] space-y-5 text-[1.0625rem] leading-[1.8] sm:text-lg">
            {a.texte
              .split(/\n+/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        </div>

        <aside className="space-y-6 lg:pt-2">
          {a.date_debut && (
            <div className="border-t-2 border-fg pt-4">
              <p className={`${label} text-fg-2`}>En vigueur depuis</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]">
                {new Date(a.date_debut).toLocaleDateString("fr-FR")}
              </p>
            </div>
          )}
          <a href={a.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Voir sur Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} size={16} />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </aside>
      </article>

      <section aria-labelledby="related-title" className={`${container} pb-20 sm:pb-28`}>
        <header className="border-t-2 border-fg pt-5">
          <p className={`${label} text-fg-2`}>Pour aller plus loin</p>
          <h2 id="related-title" className={`${display} mt-4 text-3xl leading-none sm:text-5xl`}>
            Questions liées
          </h2>
        </header>
        <div className="mt-10">
          {related.length > 0 ? <FaqIndex faqs={related} showTheme /> : <Empty>Aucune question ne cite encore cet article.</Empty>}
        </div>
      </section>
    </>
  );
}
