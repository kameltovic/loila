"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { btnPrimary } from "@/components/ui";
import AccountMenu from "@/components/AccountMenu";

const NAV = [
  { slug: "travail", label: "Travail" },
  { slug: "urbanisme", label: "Urbanisme" },
  { slug: "logement", label: "Logement" },
  { slug: "conventions", label: "Conventions" },
  { slug: "sujets", label: "Tous les sujets" },
  { slug: "tarifs", label: "Tarifs" },
];

const navItem =
  "relative block whitespace-nowrap border-2 border-transparent px-3 py-1.5 transition-[transform,box-shadow,background-color] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-fg hover:bg-surface hover:shadow-[3px_3px_0_0_var(--fg)] aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg motion-reduce:transition-none motion-reduce:hover:translate-0";

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

        <ul className="hidden items-center gap-1 font-mono text-[0.8125rem] font-bold tracking-wide uppercase lg:flex">
          {NAV.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/${n.slug}`}
                aria-current={active(n.slug) ? "page" : undefined}
                className={navItem}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <AccountMenu className={`${navItem} hidden font-mono text-[0.8125rem] font-bold tracking-wide uppercase lg:block`} />
          <Link
            href="/#question"
            className={`${btnPrimary} hidden! sm:inline-flex!`}
          >
            Poser une question
            <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center border-2 border-fg lg:hidden"
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
        <div id="mobile-menu" className="border-t border-rule bg-bg lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 pt-2 pb-5">
            {NAV.map((n) => (
              <li key={n.slug} className="border-b border-rule">
                <Link
                  href={`/${n.slug}`}
                  aria-current={active(n.slug) ? "page" : undefined}
                  onClick={close}
                  className="flex items-center gap-3 py-4 font-display text-2xl font-bold tracking-tight decoration-signal decoration-[3px] underline-offset-[6px] aria-[current=page]:underline"
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-rule">
              <AccountMenu
                onClick={close}
                className="flex items-center gap-3 py-4 font-display text-2xl font-bold tracking-tight"
              />
            </li>
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
