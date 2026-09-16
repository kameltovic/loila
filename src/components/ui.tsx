import Link from "next/link";
import type { Faq } from "@/lib/db";

// Pastel accent per theme slug.
export const ACCENT: Record<string, { bg: string; soft: string; ring: string }> = {
  travail: {
    bg: "bg-sky-100 dark:bg-sky-400/15",
    soft: "bg-sky-50 dark:bg-sky-400/10",
    ring: "border-sky-200 dark:border-sky-400/30",
  },
  urbanisme: {
    bg: "bg-emerald-100 dark:bg-emerald-400/15",
    soft: "bg-emerald-50 dark:bg-emerald-400/10",
    ring: "border-emerald-200 dark:border-emerald-400/30",
  },
  logement: {
    bg: "bg-amber-100 dark:bg-amber-400/15",
    soft: "bg-amber-50 dark:bg-amber-400/10",
    ring: "border-amber-200 dark:border-amber-400/30",
  },
  conventions: {
    bg: "bg-rose-100 dark:bg-rose-400/15",
    soft: "bg-rose-50 dark:bg-rose-400/10",
    ring: "border-rose-200 dark:border-rose-400/30",
  },
};
export const accent = (slug: string) => ACCENT[slug] ?? ACCENT.travail;

export const card =
  "rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5";

export function FaqCard({ faq }: { faq: Pick<Faq, "theme" | "slug" | "emoji" | "question" | "short"> }) {
  return (
    <Link href={`/${faq.theme}/${faq.slug}`} className={`${card} block p-6`}>
      <p className="text-lg font-bold leading-snug tracking-tight">
        {faq.emoji && <span aria-hidden className="mr-2">{faq.emoji}</span>}
        {faq.question}
      </p>
      <p className="mt-2 line-clamp-3 text-slate-600 dark:text-slate-400">{faq.short}</p>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-white/15 dark:text-slate-400">
      {children}
    </div>
  );
}
