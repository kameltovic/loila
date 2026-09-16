import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Faq } from "@/lib/db";
import ThemeIcon from "@/components/ThemeIcon";

// Accent per theme slug. bg = icon tile / chip, soft = tinted band, ring = border, fg = icon/text color.
export const ACCENT: Record<string, { bg: string; soft: string; ring: string; fg: string }> = {
  travail: {
    bg: "bg-blue-100 dark:bg-blue-400/15",
    soft: "bg-blue-50 dark:bg-blue-400/[0.07]",
    ring: "border-blue-200 dark:border-blue-400/25",
    fg: "text-blue-700 dark:text-blue-300",
  },
  urbanisme: {
    bg: "bg-emerald-100 dark:bg-emerald-400/15",
    soft: "bg-emerald-50 dark:bg-emerald-400/[0.07]",
    ring: "border-emerald-200 dark:border-emerald-400/25",
    fg: "text-emerald-700 dark:text-emerald-300",
  },
  logement: {
    bg: "bg-amber-100 dark:bg-amber-400/15",
    soft: "bg-amber-50 dark:bg-amber-400/[0.07]",
    ring: "border-amber-200 dark:border-amber-400/25",
    fg: "text-amber-700 dark:text-amber-300",
  },
  conventions: {
    bg: "bg-rose-100 dark:bg-rose-400/15",
    soft: "bg-rose-50 dark:bg-rose-400/[0.07]",
    ring: "border-rose-200 dark:border-rose-400/25",
    fg: "text-rose-700 dark:text-rose-300",
  },
};
export const accent = (slug: string) => ACCENT[slug] ?? ACCENT.travail;

export const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20";

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 font-semibold transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10";

export const eyebrow = "text-sm font-semibold uppercase tracking-wider text-brand-fg";

export function IconTile({ slug, size = "md" }: { slug: string; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-9 w-9 rounded-lg", md: "h-12 w-12 rounded-xl", lg: "h-16 w-16 rounded-2xl" }[size];
  const icon = { sm: 18, md: 22, lg: 30 }[size];
  const a = accent(slug);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${a.bg} ${a.fg}`}>
      <ThemeIcon slug={slug} size={icon} />
    </span>
  );
}

export function FaqCard({ faq }: { faq: Pick<Faq, "theme" | "slug" | "emoji" | "question" | "short"> }) {
  return (
    <Link href={`/${faq.theme}/${faq.slug}`} className={`${card} group flex gap-4 p-5 sm:p-6`}>
      <IconTile slug={faq.theme} size="sm" />
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-snug tracking-tight">{faq.question}</span>
        <span className="mt-1.5 line-clamp-2 block text-slate-600 dark:text-slate-400">{faq.short}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-fg">
          Lire la réponse <ArrowRight aria-hidden size={16} className="transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-white/15 dark:text-slate-400">
      {children}
    </div>
  );
}
