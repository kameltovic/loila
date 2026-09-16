"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SectionHead, TopicList, container, label } from "@/components/ui";

type Item = { slug: string; title: string; h1: string; keywords: string[] };
type Category = { slug: string; title: string; topics: Item[] };

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Client-side filterable index of all topics, grouped by category. */
export default function TopicIndex({ categories }: { categories: Category[] }) {
  const [q, setQ] = useState("");
  const words = norm(q).split(/\s+/).filter(Boolean);
  const match = (t: Item) => {
    const hay = norm(`${t.title} ${t.h1} ${t.keywords.join(" ")}`);
    return words.every((w) => hay.includes(w));
  };
  const shown = categories.map((c) => ({ ...c, topics: c.topics.filter(match) })).filter((c) => c.topics.length);
  const count = shown.reduce((n, c) => n + c.topics.length, 0);

  return (
    <>
      <div className={`${container} pb-4`}>
        <label htmlFor="topic-filter" className={`${label} text-fg-2`}>Filtrer les sujets</label>
        <div className="mt-3 flex items-center gap-3 border-2 border-fg bg-surface px-4 shadow-[4px_4px_0_0_var(--fg)] focus-within:outline-3 focus-within:outline-focus">
          <Search aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-fg-2" />
          <input
            id="topic-filter"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Piscine, congé, voisin, chien…"
            className="w-full bg-transparent py-3.5 text-lg outline-none focus-visible:outline-none placeholder:text-fg-2"
          />
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-fg-2">
          {q ? `${count} sujet${count > 1 ? "s" : ""} trouvé${count > 1 ? "s" : ""}` : `${count} sujets`}
        </p>
      </div>

      {shown.length === 0 && (
        <div className={`${container} py-12`}>
          <p className="border-2 border-dashed border-fg/40 p-8 text-center text-fg-2">
            Aucun sujet ne correspond. <a href="#question" className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Posez directement votre question.</a>
          </p>
        </div>
      )}

      {shown.map((c) => (
        <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-title`} className="scroll-mt-20 pt-14 sm:pt-20">
          <div className={container}>
            <SectionHead
              num={String(categories.findIndex((x) => x.slug === c.slug) + 1).padStart(2, "0")}
              kicker={`${c.topics.length} sujet${c.topics.length > 1 ? "s" : ""}`}
              id={`${c.slug}-title`}
              title={c.title}
            />
            <TopicList topics={c.topics} />
          </div>
        </section>
      ))}
    </>
  );
}
