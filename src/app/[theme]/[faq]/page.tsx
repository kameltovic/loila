import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import { accent, card } from "@/components/ui";

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
      <Link href={`/${theme.slug}`} className="text-sm font-semibold text-slate-500 hover:text-foreground">
        ← <span aria-hidden>{theme.emoji}</span> {theme.title}
      </Link>
      <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-tighter sm:text-5xl">
        {faq.emoji && <span aria-hidden className="mr-3">{faq.emoji}</span>}
        {faq.question}
      </h1>

      <div className={`mt-8 rounded-3xl border p-6 ${accent(theme.slug).soft} ${accent(theme.slug).ring}`}>
        <p className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">En bref</p>
        <p className="mt-2 text-lg font-medium leading-relaxed">{faq.short}</p>
      </div>

      <div className="prose-loila mt-10">
        <ReactMarkdown>{faq.answer_md}</ReactMarkdown>
      </div>

      {articles.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight">Articles de loi cités</h2>
          <div className="mt-6 grid gap-4">
            {articles.map((a) => (
              <div key={a.id} className={`${card} p-6`}>
                <p className="text-sm text-slate-500">{CODES[a.code as keyof typeof CODES]?.name ?? a.code}</p>
                <h3 className="mt-1 text-lg font-extrabold tracking-tight">Article {a.num}</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {a.texte.length > 200 ? `${a.texte.slice(0, 200).trimEnd()}…` : a.texte}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                  <Link href={`/article/${a.id}`} className="text-violet-700 hover:underline dark:text-violet-300">
                    Lire l’article →
                  </Link>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:underline">
                    Voir sur Légifrance ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
