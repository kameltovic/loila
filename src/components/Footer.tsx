import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { Logo } from "@/components/Header";
import { label } from "@/components/ui";

const link = "text-paper/70 transition hover:text-paper hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4";

export default function Footer() {
  const cols = [
    { title: "Thèmes", links: THEMES.map((t) => ({ href: `/${t.slug}`, label: t.title })) },
    {
      title: "Ressources",
      links: [
        { href: "/#comment-ca-marche", label: "Comment ça marche" },
        { href: "/modeles-lettres", label: "Modèles de lettres" },
        { href: "/relance-amiable", label: "Relancer un impayé" },
        { href: "/jurisprudence", label: "Jurisprudence" },
        { href: "/verifier-entreprise", label: "Vérifier une entreprise" },
        { href: "/verifier-un-bien", label: "Vérifier un bien immobilier" },
        { href: "/prix-immobilier", label: "Prix immobilier au m²" },
        { href: "/revision-loyer", label: "Réviser un loyer (IRL)" },
        { href: "/jo", label: "Lois et décrets (Journal officiel)" },
        { href: "/conventions", label: "Conventions collectives" },
        { href: "https://www.legifrance.gouv.fr", label: "Sources officielles (Légifrance)" },
        { href: "https://echanges.dila.gouv.fr/OPENDATA/", label: "Données ouvertes DILA" },
      ],
    },
    {
      title: "Loilà",
      links: [
        { href: "/pour", label: "Pour les pros" },
        { href: "/avocats", label: "Avocats et juristes" },
        { href: "/a-propos", label: "À propos" },
        { href: "/tarifs", label: "Tarifs" },
        { href: "/cgv", label: "CGV" },
        { href: "/mentions-legales", label: "Mentions légales" },
        { href: "/contact", label: "Contact" },
      ],
    },
  ];

  return (
    <footer className="border-t border-paper/15 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="max-w-xs font-serif text-2xl leading-snug italic text-paper/85">
              Le droit français expliqué clairement, à partir des textes officiels.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h2 className={`${label} text-paper/50`}>{c.title}</h2>
              <ul className="mt-5 space-y-3 text-[0.9375rem]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith("http") ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className={link}>
                        {l.label}
                        <ArrowUpRight aria-hidden size={14} strokeWidth={1.75} className="ml-1 inline align-[-2px]" />
                        <span className="sr-only">(nouvel onglet)</span>
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
        <Logo className="mt-16 block text-[clamp(5rem,22vw,15rem)] leading-[0.8] select-none" />
      </div>
      <div className="mt-8 border-t border-paper/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-paper/60 sm:px-6 md:flex-row md:justify-between">
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
