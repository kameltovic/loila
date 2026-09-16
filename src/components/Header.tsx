"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageCircleQuestion, X } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";

const NAV = [
  { slug: "travail", label: "Travail" },
  { slug: "urbanisme", label: "Urbanisme" },
  { slug: "logement", label: "Logement" },
  { slug: "conventions", label: "Conventions" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      Loilà<span className="text-brand">.</span>
    </span>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = (slug: string) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-background/75 backdrop-blur-lg dark:border-white/10">
      <nav aria-label="Principale" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-2xl" aria-label="Loilà, accueil">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 text-sm font-medium md:flex">
          {NAV.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/${n.slug}`}
                aria-current={active(n.slug) ? "page" : undefined}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-slate-700 transition hover:bg-slate-100 hover:text-foreground aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-fg dark:text-slate-300 dark:hover:bg-white/10"
              >
                <ThemeIcon slug={n.slug} size={16} />
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/#question"
            className="hidden items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong sm:inline-flex"
          >
            <MessageCircleQuestion aria-hidden size={16} />
            Poser une question
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 md:hidden dark:border-white/15"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-200/80 bg-background md:hidden dark:border-white/10">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-4">
            {NAV.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/${n.slug}`}
                  aria-current={active(n.slug) ? "page" : undefined}
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-slate-100 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-fg dark:hover:bg-white/10"
                >
                  <ThemeIcon slug={n.slug} size={20} />
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/#question"
                onClick={close}
                className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 font-semibold text-white"
              >
                <MessageCircleQuestion aria-hidden size={18} />
                Poser une question
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
