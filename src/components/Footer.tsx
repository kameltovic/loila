import Link from "next/link";
import { THEMES } from "@/lib/themes";
import { Logo } from "@/components/Header";

const link = "text-slate-400 transition hover:text-white";

export default function Footer() {
  const cols = [
    { title: "Thèmes", links: THEMES.map((t) => ({ href: `/${t.slug}`, label: t.title })) },
    {
      title: "Ressources",
      links: [
        { href: "/#comment-ca-marche", label: "Comment ça marche" },
        { href: "https://www.legifrance.gouv.fr", label: "Sources officielles (Légifrance)" },
        { href: "https://echanges.dila.gouv.fr/OPENDATA/", label: "Données ouvertes DILA" },
      ],
    },
    {
      title: "Loilà",
      links: [
        { href: "/a-propos", label: "À propos" },
        { href: "/mentions-legales", label: "Mentions légales" },
        { href: "mailto:contact@loila.fr", label: "Contact" },
      ],
    },
  ];

  return (
    <footer className="bg-ink text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo className="text-2xl text-white" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            Le droit français expliqué clairement, à partir des textes officiels.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold text-white">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={link}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 sm:px-6 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} Loilà</p>
          <p className="md:text-right">
            Information juridique générale, pas un conseil juridique. Textes officiels issus de Légifrance (DILA), mis à
            jour quotidiennement.
          </p>
        </div>
      </div>
    </footer>
  );
}
