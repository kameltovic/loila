import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { block, label } from "@/components/ui";
import { lettresForFaq, lettreUrl, type Lettre } from "@/lib/lettres";

/** Letter cards, used on the index, theme hubs, letter pages ("autres modèles") and question pages. */
export function LettreCards({ lettres, from }: { lettres: Lettre[]; from: string }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {lettres.map((l) => (
        <li key={l.slug} className="min-w-0">
          <Link
            href={lettreUrl(l)}
            data-umami-event="lettre-link"
            data-umami-event-from={from}
            className="group flex h-full flex-col border-2 border-fg bg-surface shadow-hard transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm motion-reduce:transition-none"
          >
            <span className={`${block(l.theme)} flex items-center gap-2 border-b-2 border-fg px-4 py-3`}>
              <FileText aria-hidden className="size-4" />
              <span className={label}>Modèle de lettre</span>
            </span>
            <span className="flex flex-1 flex-col p-4 sm:p-5">
              <span className="font-display text-xl leading-tight font-bold tracking-[-0.025em] text-balance">{l.title}</span>
              <span className="mt-2 line-clamp-2 text-[0.9375rem] text-fg-2">{l.when[0]}</span>
              <span className="mt-auto flex items-center gap-1.5 pt-5 font-mono text-xs font-bold uppercase">
                Compléter la lettre
                <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1 motion-reduce:transition-none" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Under a question's answer: the letter(s) that act on it. */
export function FaqLettres({ slug, from }: { slug: string; from: string }) {
  const lettres = lettresForFaq(slug);
  if (!lettres.length) return null;
  return (
    <aside aria-label="Modèles de lettres" className="mt-12 grid gap-3">
      {lettres.map((l) => (
        <Link
          key={l.slug}
          href={lettreUrl(l)}
          data-umami-event="faq-lettre"
          data-umami-event-from={from}
          className={`${block(l.theme)} group flex items-center justify-between gap-4 border-2 border-ink p-4 shadow-hard transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm sm:p-5 motion-reduce:transition-none`}
        >
          <span className="flex items-center gap-3">
            <FileText aria-hidden className="size-6 shrink-0" />
            <span>
              <span className={`${label} block`}>Modèle gratuit</span>
              <span className="font-display text-lg leading-tight font-bold sm:text-xl">{l.title}</span>
            </span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0 transition group-hover:translate-x-1 motion-reduce:transition-none" />
        </Link>
      ))}
    </aside>
  );
}
