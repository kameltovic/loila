import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionHead, block, label } from "@/components/ui";
import ThemeIcon from "@/components/ThemeIcon";
import { faqUrl, relatedFaqs } from "@/lib/topics";
import type { Faq } from "@/lib/db";

/** "À lire aussi" under a question page: 3 cards, colour-coded by theme. Clicks tracked in Umami. */
export default function RelatedFaqs({ faq }: { faq: Faq }) {
  const related = relatedFaqs(faq);
  if (!related.length) return null;
  const from = faqUrl(faq);
  return (
    <section aria-labelledby="related-faqs-title" className="mt-20">
      <SectionHead num="→" kicker="Continuer" id="related-faqs-title" title="À lire aussi" />
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {related.map((f, i) => (
          <li key={f.id} className="min-w-0">
            <Link
              href={faqUrl(f)}
              data-umami-event="related-faq"
              data-umami-event-from={from}
              data-umami-event-rank={i + 1}
              className="group flex h-full flex-col border-2 border-fg bg-surface shadow-hard transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg motion-reduce:transition-none motion-reduce:hover:translate-0"
            >
              <span className={`${block(f.color)} flex items-center gap-2 border-b-2 border-fg px-4 py-3`}>
                <ThemeIcon slug={f.color} size={16} aria-hidden />
                <span className={`${label} truncate`}>{f.kicker}</span>
              </span>
              <span className="flex flex-1 flex-col p-4 sm:p-5">
                <span className="font-display text-xl leading-tight font-bold tracking-[-0.025em] text-balance">{f.question}</span>
                <span className="mt-3 line-clamp-3 text-[0.9375rem] text-fg-2">{f.short}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-5 font-mono text-xs font-bold uppercase">
                  Lire la réponse
                  <ArrowUpRight aria-hidden strokeWidth={2} className="size-4 transition group-hover:rotate-45 motion-reduce:group-hover:rotate-0" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
