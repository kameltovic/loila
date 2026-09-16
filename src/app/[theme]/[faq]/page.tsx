import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Lightbulb, Scale } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import Chat from "@/components/Chat";
import { ArticleDrawerProvider, ArticleLink, ArticleMarkdown } from "@/components/ArticleDrawer";

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
    <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <ArticleDrawerProvider>
        <Link
          href={`/${theme.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {theme.title}
        </Link>
        <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tighter text-balance sm:text-5xl">{faq.question}</h1>

        <div className="mt-8 flex gap-4 rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:p-6 dark:border-violet-400/20 dark:bg-violet-400/10">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
            <Lightbulb aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">En bref</p>
            <p className="mt-1 text-lg font-medium leading-relaxed">{faq.short}</p>
          </div>
        </div>

        <div className="prose-loila mt-10">
          <ArticleMarkdown md={faq.answer_md} articles={articles.map(({ id, num }) => ({ id, num }))} />
        </div>

        {articles.length > 0 && (
          <section className="mt-14">
            <h2 className="flex items-center gap-2.5 text-2xl font-black tracking-tight">
              <Scale aria-hidden className="size-6 text-violet-600 dark:text-violet-400" />
              Articles de loi cités
            </h2>
            <ul className="mt-6 grid gap-4">
              {articles.map((a) => (
                <li
                  key={a.id}
                  className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10 dark:bg-white/5 dark:hover:border-violet-400/40"
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400">{CODES[a.code as keyof typeof CODES]?.name ?? a.code}</p>
                  <h3 className="mt-1 text-lg font-extrabold tracking-tight">
                    {/* Stretched link: whole card opens the drawer, still a real link for new-tab. */}
                    <ArticleLink id={a.id} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-violet-500">
                      {a.num ? `Article ${a.num}` : (a.section?.split(" > ").pop() ?? "Article")}
                    </ArticleLink>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-slate-600 dark:text-slate-400">{a.texte}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold">
                    <span className="text-violet-700 group-hover:underline dark:text-violet-300">Lire l’article</span>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 hover:underline dark:hover:text-white"
                    >
                      Légifrance <ArrowUpRight aria-hidden className="size-4" />
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ArticleDrawerProvider>

      <div className="mt-16">
        <Chat theme={theme.slug} title="Poser une autre question" />
      </div>
    </article>
  );
}
