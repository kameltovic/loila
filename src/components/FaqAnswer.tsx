import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { ArticleLink, ArticleMarkdown } from "@/components/ArticleDrawer";
import { block, display, label } from "@/components/ui";

/** Cited articles of a FAQ row, in citation order. */
export function faqArticles(faq: Pick<Faq, "article_ids">): Article[] {
  let ids: string[] = [];
  try {
    ids = JSON.parse(faq.article_ids);
  } catch {}
  return ids.length
    ? (getDb()
        .prepare(`SELECT * FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as Article[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    : [];
}

/** "En bref" block, full answer and cited sources. Must be rendered inside ArticleDrawerProvider. */
export default function FaqAnswer({ faq, articles, updated }: { faq: Faq; articles: Article[]; updated: Date }) {
  return (
    <>
      <div className={`${block(faq.theme)} mt-10 rounded-2xl border-2 border-ink p-6 shadow-hard-ink sm:p-8 dark:border-paper dark:shadow-[4px_4px_0_0_#f4f0e8]`}>
        <p className={label}>En bref</p>
        <p className="mt-3 font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-pretty sm:text-2xl">{faq.short}</p>
      </div>
      <p className="mt-4 text-sm text-fg-2">
        Dernière mise à jour : <time dateTime={updated.toISOString().slice(0, 10)}>{updated.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time>
        {" · "}Sources : Légifrance{articles.length > 0 && ` (${articles.map((a) => (a.num ? `art. ${a.num}` : "article")).join(", ")})`}
      </p>

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
    </>
  );
}
