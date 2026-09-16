import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { THEMES } from "@/lib/themes";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const NAV_LABEL = { travail: "Travail", urbanisme: "Urbanisme", logement: "Logement" };

export const metadata: Metadata = {
  title: { default: "Loilà — Le droit français, enfin lisible", template: "%s · Loilà" },
  description:
    "Travail, urbanisme, logement : le droit français expliqué simplement, avec les articles de loi officiels cités.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-background/80 backdrop-blur dark:border-white/10">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-5">
            <Link href="/" className="text-xl font-black tracking-tight">
              Loilà<span className="text-violet-500">.</span>
            </Link>
            <div className="flex text-sm font-medium sm:gap-2">
              {THEMES.map((t) => (
                <Link
                  key={t.slug}
                  href={`/${t.slug}`}
                  className="rounded-full px-2.5 py-1.5 hover:bg-slate-100 sm:px-3 dark:hover:bg-white/10"
                >
                  <span aria-hidden className="hidden sm:inline">{t.emoji} </span>
                  {NAV_LABEL[t.slug]}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200/70 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-600 dark:text-slate-400">
            <p className="text-base font-black tracking-tight text-foreground">
              Loilà<span className="text-violet-500">.</span>
            </p>
            <p className="mt-2 max-w-2xl">
              Information juridique générale, pas un conseil juridique. Textes : Légifrance (DILA), licence open data.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
