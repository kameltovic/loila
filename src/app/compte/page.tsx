import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { SESSION_COOKIE, userBySessionToken } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { listDossiers } from "@/lib/wizard";
import { btnPrimary, container, display, label } from "@/components/ui";
import { AccountPanel } from "@/components/AccountMenu";

export const metadata: Metadata = {
  ...pageMetadata({ title: "Mon compte", description: "Vos questions, votre abonnement et vos factures Loilà.", path: "/compte" }),
  robots: { index: false },
};

const STATUS: Record<string, string> = {
  questions: "Questions en attente",
  answered: "Synthèse à obtenir",
  generating: "Synthèse en cours",
  done: "Synthèse prête",
  hors_sujet: "Hors champ",
};
const day = (t: number) => new Date(t * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export default async function Account() {
  const user = userBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const dossiers = user ? listDossiers(user.id) : [];
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Espace personnel
      </p>
      <h1 className={`${display} mt-6 mb-10 text-[clamp(3rem,9vw,5.5rem)] leading-[0.92]`}>Mon compte</h1>
      <AccountPanel />
      {user && (
        <section id="dossiers" aria-labelledby="dossiers-title" className="mt-16 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-fg pt-5">
            <h2 id="dossiers-title" className={`${display} text-4xl sm:text-5xl`}>
              Mes <span className="font-serif font-normal italic">dossiers</span>
            </h2>
            <Link href="/dossier/nouveau" className={btnPrimary}>
              Décrire ma situation <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          {dossiers.length ? (
            <ul className="mt-8 border-t border-fg">
              {dossiers.map((d) => (
                <li key={d.id} className="border-b border-rule">
                  <Link href={`/dossier/${d.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-5 transition-colors hover:bg-surface sm:px-2">
                    <span className="min-w-0">
                      <span className="block font-display text-xl leading-tight font-bold tracking-[-0.025em] break-words sm:text-2xl">{d.title}</span>
                      <span className="mt-1 block font-mono text-xs text-fg-2 uppercase">
                        {day(d.created_at)} · {STATUS[d.status] ?? d.status}
                        {d.followups > 0 && ` · ${d.followups} question${d.followups > 1 ? "s" : ""} de suivi`}
                      </span>
                    </span>
                    <ArrowRight aria-hidden strokeWidth={1.75} className="size-5 transition group-hover:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 border-2 border-dashed border-fg/40 p-6 text-fg-2">
              Aucun dossier pour l’instant. Décrivez votre situation pour obtenir une synthèse des règles qui s’appliquent.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
