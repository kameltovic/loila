import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import Chat from "@/components/Chat";
import ThemeIcon from "@/components/ThemeIcon";
import { ArticleDrawerProvider, ArticleLink, ArticleMarkdown } from "@/components/ArticleDrawer";
import { block, display, label } from "@/components/ui";

export const dynamic = "force-dynamic";

function load(theme: string, slug: string) {
  return getDb().prepare("SELECT * FROM faq WHERE theme = ? AND slug = ?").get(theme, slug) as Faq | undefined;
}

export async function generateMetadata({ params }: PageProps<"/[theme]/[faq]">): Promise<Metadata> {
  const { theme, faq: slug } = await params;
  const faq = load(theme, slug);
  return faq ? { title: faq.question, description: faq.short } : {};
}

export default async function FaqPage({ params }: PageProps<"/[theme]/[faq]">) {
  const { theme: themeSlug, faq: slug } = await params;
  const theme = THEMES.find((t) => t.slug === themeSlug);
  const faq = theme && load(theme.slug, slug);
  if (!theme || !faq) notFound();

  let ids: string[] = [];
  try {
    ids = JSON.parse(faq.article_ids);
  } catch {}
  const articles = ids.length
    ? (getDb()
        .prepare(`SELECT * FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as Article[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    : [];

  return (
    <article className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-24">
      <ArticleDrawerProvider>
        <nav aria-label="Fil d’Ariane" className={`${label} flex flex-wrap items-center gap-2 text-fg-2`}>
          <Link href="/" className="hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4">
            Accueil
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/${theme.slug}`}
            className="inline-flex items-center gap-1.5 hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4"
          >
            <ThemeIcon slug={theme.slug} size={14} />
            {theme.title}
          </Link>
        </nav>
        <h1 className={`${display} mt-8 text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] text-balance`}>{faq.question}</h1>

        <div className={`${block(theme.slug)} mt-10 rounded-2xl border-2 border-ink p-6 shadow-hard-ink sm:p-8 dark:border-paper dark:shadow-[4px_4px_0_0_#f4f0e8]`}>
          <p className={label}>En bref</p>
          <p className="mt-3 font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-pretty sm:text-2xl">{faq.short}</p>
        </div>

        <div className="prose-loila mt-12">
          <ArticleMarkdown md={faq.answer_md} articles={articles.map(({ id, num }) => ({ id, num }))} />
        </div>

        {articles.length > 0 && (
          <section aria-labelledby="sources-title" className="mt-16 border-t-2 border-fg pt-5">
            <p className={`${label} text-fg-2`}>Sources</p>
            <h2 id="sources-title" className={`${display} mt-4 text-3xl leading-none sm:text-5xl`}>
              Articles de loi <span className="font-serif font-normal italic">cités</span>
            </h2>
            <ul className="mt-8 border-t border-fg">
              {articles.map((a) => (
                <li key={a.id} className="group relative grid gap-4 border-b border-rule py-6 transition-colors hover:bg-surface sm:grid-cols-[1fr_auto] sm:px-2">
                  <div className="min-w-0">
                    <p className={`${label} text-fg-2`}>{CODES[a.code as keyof typeof CODES]?.name ?? a.code}</p>
                    <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.03em]">
                      {/* Stretched link: whole row opens the drawer, still a real link for new-tab. */}
                      <ArticleLink id={a.id} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-focus">
                        {a.num ? `Article ${a.num}` : (a.section?.split(" > ").pop() ?? "Article")}
                      </ArticleLink>
                    </h3>
                    <p className="mt-2 line-clamp-2 max-w-[68ch] text-fg-2">{a.texte}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-semibold sm:flex-col sm:items-end sm:justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      Lire
                      <span className="grid size-10 place-items-center rounded-full border-2 border-fg transition group-hover:bg-fg group-hover:text-bg">
                        <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
                      </span>
                    </span>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative inline-flex items-center gap-1 text-fg-2 hover:text-fg hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4"
                    >
                      Légifrance <ArrowUpRight aria-hidden strokeWidth={1.75} className="size-4" />
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ArticleDrawerProvider>

      <div className="mt-20">
        <Chat theme={theme.slug} title="Poser une autre question" />
      </div>
    </article>
  );
}
