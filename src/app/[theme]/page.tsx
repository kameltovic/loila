import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Chat from "@/components/Chat";
import { getDb, type Faq } from "@/lib/db";
import { CODES, THEMES } from "@/lib/themes";
import { Empty, FaqCard, IconTile, accent, card, container, eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

const findTheme = (slug: string) => THEMES.find((t) => t.slug === slug);

export async function generateMetadata({ params }: PageProps<"/[theme]">): Promise<Metadata> {
  const theme = findTheme((await params).theme);
  return theme ? { title: theme.title, description: theme.tagline } : {};
}

export default async function ThemePage({ params }: PageProps<"/[theme]">) {
  const theme = findTheme((await params).theme);
  if (!theme) notFound();
  const a = accent(theme.slug);

  const faqs = getDb()
    .prepare("SELECT theme, slug, emoji, question, short FROM faq WHERE theme = ? ORDER BY id")
    .all(theme.slug) as Faq[];

  const counts = new Map(
    (getDb().prepare("SELECT code, COUNT(*) AS n FROM articles GROUP BY code").all() as { code: string; n: number }[]).map((r) => [r.code, r.n]),
  );
  const total = theme.codes.reduce((s, c) => s + (counts.get(c) ?? 0), 0);
  const conventions = theme.slug === "conventions"
    ? theme.codes.map((slug) => ({ slug, ...CODES[slug], n: counts.get(slug) ?? 0 }))
    : [];

  return (
    <>
      <section className={`border-b ${a.soft} ${a.ring}`}>
        <div className={`${container} py-12 sm:py-16`}>
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <ChevronRight aria-hidden size={14} />
            <span className="font-medium text-foreground">{theme.title}</span>
          </nav>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <IconTile slug={theme.slug} size="lg" />
            <div>
              <h1 className="text-4xl font-black tracking-tighter sm:text-6xl">{theme.title}</h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-600 sm:text-xl dark:text-slate-400">{theme.tagline}</p>
            </div>
          </div>
          <p className="mt-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            {total.toLocaleString("fr-FR")} articles officiels · {faqs.length} questions expliquées
          </p>
        </div>
      </section>

      {conventions.length > 0 && (
        <section className="py-14">
          <div className={container}>
            <p className={eyebrow}>Branches</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Les conventions couvertes</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {conventions.map((c) => (
                <div key={c.slug} className={`${card} p-5`}>
                  <p className="font-bold leading-snug tracking-tight">{c.name.replace(/^Convention collective /, "").replace(/ \(IDCC \d+\)$/, "")}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className={`rounded-md px-2 py-0.5 font-semibold ${a.bg} ${a.fg}`}>IDCC {c.idcc}</span>
                    {c.n.toLocaleString("fr-FR")} articles
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`py-14 ${conventions.length > 0 ? "bg-muted" : ""}`}>
        <div className={container}>
          <p className={eyebrow}>Questions fréquentes</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Les réponses essentielles</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faqs.map((f) => (
              <FaqCard key={f.slug} faq={f} />
            ))}
          </div>
          {faqs.length === 0 && <Empty>Aucune question publiée pour ce thème pour l’instant. Posez la vôtre ci-dessous.</Empty>}
        </div>
      </section>

      <section id="question" className={`scroll-mt-20 py-16 ${conventions.length > 0 ? "" : "bg-muted"}`}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-black tracking-tight">Votre question ne figure pas ici ?</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Décrivez votre situation, la réponse cite les articles utilisés.</p>
          <div className="mt-6">
            <Chat theme={theme.slug} />
          </div>
        </div>
      </section>
    </>
  );
}
