import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Chat from "@/components/Chat";
import { getDb, type Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { Empty, FaqCard, accent } from "@/components/ui";

export const dynamic = "force-dynamic";

const findTheme = (slug: string) => THEMES.find((t) => t.slug === slug);

export async function generateMetadata({ params }: PageProps<"/[theme]">): Promise<Metadata> {
  const theme = findTheme((await params).theme);
  return theme ? { title: theme.title, description: theme.tagline } : {};
}

export default async function ThemePage({ params }: PageProps<"/[theme]">) {
  const theme = findTheme((await params).theme);
  if (!theme) notFound();

  const faqs = getDb()
    .prepare("SELECT theme, slug, emoji, question, short FROM faq WHERE theme = ? ORDER BY id")
    .all(theme.slug) as Faq[];

  return (
    <>
      <section className={accent(theme.slug).soft}>
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <span aria-hidden className="text-5xl">{theme.emoji}</span>
          <h1 className="mt-4 text-5xl font-black tracking-tighter sm:text-6xl">{theme.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 sm:text-xl dark:text-slate-400">{theme.tagline}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-3xl font-black tracking-tight">Les questions fréquentes</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {faqs.map((f) => (
            <FaqCard key={f.slug} faq={f} />
          ))}
        </div>
        {faqs.length === 0 && <Empty>📚 Aucune question publiée pour ce thème pour l’instant. Posez la vôtre ci-dessous.</Empty>}
      </section>

      <section id="question" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-12">
        <h2 className="text-3xl font-black tracking-tight">Votre question ne figure pas ici ?</h2>
        <div className="mt-6">
          <Chat theme={theme.slug} />
        </div>
      </section>
    </>
  );
}
