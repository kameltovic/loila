import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, type Article, type Faq } from "@/lib/db";
import { CODES } from "@/lib/themes";
import { Empty, FaqCard } from "@/components/ui";

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
    <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">{codeName(a)}</p>
      <h1 className="mt-2 text-4xl font-black tracking-tighter sm:text-5xl">Article {a.num}</h1>
      {a.section && (
        <nav aria-label="Section" className="mt-4 text-sm text-slate-500">
          {a.section.split(" > ").join(" › ")}
        </nav>
      )}

      <div className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-lg leading-relaxed sm:p-8 dark:border-white/10 dark:bg-white/5">
        {a.texte
          .split(/\n+/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Voir sur Légifrance ↗
        </a>
        {a.date_debut && <span className="text-slate-500">Version en vigueur depuis le {new Date(a.date_debut).toLocaleDateString("fr-FR")}</span>}
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
  );
}
