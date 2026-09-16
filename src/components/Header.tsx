"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";
import { btnPrimary } from "@/components/ui";

const NAV = [
  { slug: "travail", label: "Travail" },
  { slug: "urbanisme", label: "Urbanisme" },
  { slug: "logement", label: "Logement" },
  { slug: "conventions", label: "Conventions" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-[-0.05em] ${className}`}>
      Loil<span className="relative">
        à
        <span aria-hidden className="absolute -right-[0.26em] bottom-[0.16em] size-[0.2em] rounded-full bg-signal" />
      </span>
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
    <header className="sticky top-0 z-30 border-b border-rule bg-bg">
      <nav aria-label="Principale" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
        <Link href="/" className="text-[1.75rem] leading-none" aria-label="Loilà, accueil">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-6 text-[0.9375rem] font-medium md:flex">
          {NAV.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/${n.slug}`}
                aria-current={active(n.slug) ? "page" : undefined}
                className="inline-flex items-center gap-2 border-b-2 border-transparent py-1 text-fg-2 transition hover:text-fg aria-[current=page]:border-signal aria-[current=page]:text-fg"
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
            className={`${btnPrimary} hidden! sm:inline-flex!`}
          >
            Poser une question
            <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center border-2 border-fg md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden size={20} strokeWidth={1.75} /> : <Menu aria-hidden size={20} strokeWidth={1.75} />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-rule bg-bg md:hidden">
          <ul className="mx-auto max-w-6xl px-4 pt-2 pb-5">
            {NAV.map((n) => (
              <li key={n.slug} className="border-b border-rule">
                <Link
                  href={`/${n.slug}`}
                  aria-current={active(n.slug) ? "page" : undefined}
                  onClick={close}
                  className="flex items-center gap-3 py-4 font-display text-2xl font-bold tracking-tight decoration-signal decoration-[3px] underline-offset-[6px] aria-[current=page]:underline"
                >
                  <ThemeIcon slug={n.slug} size={22} />
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-5">
              <Link
                href="/#question"
                onClick={close}
                className={`${btnPrimary} w-full py-3.5`}
              >
                Poser une question
                <ArrowRight aria-hidden size={18} strokeWidth={1.75} />
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
