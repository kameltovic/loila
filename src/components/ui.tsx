import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Faq } from "@/lib/db";
import { THEMES } from "@/lib/themes";

// Flat color block per theme (text is always ink on these).
const BLOCK: Record<string, string> = {
  travail: "bg-travail",
  urbanisme: "bg-urbanisme",
  logement: "bg-logement",
  conventions: "bg-conventions",
};
export const block = (slug: string) => `${BLOCK[slug] ?? BLOCK.travail} text-ink`;

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Small uppercase label, magazine style. */
export const label = "text-xs font-semibold uppercase tracking-[0.16em]";

export const display = "font-display font-extrabold tracking-[-0.04em]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-fg bg-fg px-5 py-2.5 font-semibold text-bg transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--signal)] motion-reduce:hover:translate-y-0";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-fg px-5 py-2.5 font-semibold transition hover:bg-fg hover:text-bg";

/** "01 — Thèmes" section heading with a top rule. */
export function SectionHead({ num, kicker, title, id }: { num: string; kicker: string; title: React.ReactNode; id?: string }) {
  return (
    <header className="border-t-2 border-fg pt-5">
      <p className={`${label} flex items-center gap-3`}>
        <span className="font-display text-sm font-bold">{num}</span>
        <span aria-hidden className="h-0.5 w-8 bg-signal" />
        {kicker}
      </p>
      <h2 id={id} className={`${display} mt-6 max-w-4xl text-4xl leading-[0.95] text-balance sm:text-6xl`}>
        {title}
      </h2>
    </header>
  );
}

/** Editorial index: numbered rows separated by hairlines. */
export function FaqIndex({ faqs, showTheme = false }: { faqs: Pick<Faq, "theme" | "slug" | "question" | "short">[]; showTheme?: boolean }) {
  return (
    <ol className="border-t border-fg">
      {faqs.map((f, i) => (
        <li key={`${f.theme}/${f.slug}`} className="border-b border-rule">
          <Link
            href={`/${f.theme}/${f.slug}`}
            className="group grid grid-cols-[2rem_1fr_auto] items-start gap-3 py-6 transition-colors hover:bg-surface sm:grid-cols-[4rem_1fr_auto] sm:gap-6 sm:px-2 sm:py-8"
          >
            <span className="pt-1 font-display text-sm font-bold tabular-nums text-fg-2 sm:text-base">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              {showTheme && (
                <span className={`${label} mb-2 flex items-center gap-2 text-fg-2`}>
                  <span aria-hidden className={`size-2.5 border border-ink ${block(f.theme)}`} />
                  {THEMES.find((t) => t.slug === f.theme)?.title ?? f.theme}
                </span>
              )}
              <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em] sm:text-3xl sm:text-balance">
                {f.question}
              </span>
              <span className="mt-2 line-clamp-2 max-w-[68ch] text-fg-2">{f.short}</span>
            </span>
            <span className="mt-1 grid size-10 place-items-center rounded-full border-2 border-fg transition group-hover:bg-fg group-hover:text-bg sm:size-12">
              <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:-rotate-45 motion-reduce:group-hover:rotate-0" />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border-2 border-dashed border-fg/40 p-8 text-center text-fg-2">{children}</div>;
}
