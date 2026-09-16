import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, ScrollText } from "lucide-react";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { Empty, FaqCard, btnPrimary, container } from "@/components/ui";

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
      <section className="border-b border-slate-200/70 bg-muted dark:border-white/10">
        <div className={`${container} py-12 sm:py-14`}>
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <ChevronRight aria-hidden size={14} />
            <span>{codeName(a)}</span>
          </nav>
          <div className="mt-6 flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
              <ScrollText aria-hidden size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-brand-fg">{codeName(a)}</p>
              <h1 className="mt-1 text-4xl font-black tracking-tighter sm:text-5xl">Article {a.num}</h1>
              {a.section && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{a.section.split(" > ").join(" › ")}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-lg leading-relaxed shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.04]">
          {a.texte
            .split(/\n+/)
            .filter((p) => p.trim())
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <a href={a.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Voir sur Légifrance <ExternalLink aria-hidden size={16} />
          </a>
          {a.date_debut && (
            <span className="text-slate-600 dark:text-slate-400">
              Version en vigueur depuis le {new Date(a.date_debut).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight">Questions liées</h2>
          <div className="mt-6 grid gap-4">
            {related.map((f) => (
              <FaqCard key={f.slug} faq={f} />
            ))}
          </div>
          {related.length === 0 && <Empty>Aucune question ne cite encore cet article.</Empty>}
        </section>
      </article>
    </>
  );
}
