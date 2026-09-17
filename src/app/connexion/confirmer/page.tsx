import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { LOGIN_COOKIE, safeNext } from "@/lib/auth";
import { btnPrimary, container, display, label } from "@/components/ui";

export const metadata: Metadata = { title: "Confirmer la connexion", robots: { index: false, follow: false } };

export default async function ConfirmLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next ?? null);
  const hasToken = !!(await cookies()).get(LOGIN_COOKIE)?.value;
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Connexion
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,5.5rem)] leading-[0.92]`}>
        {hasToken ? (
          <>Plus qu’un <span className="font-serif font-normal tracking-[-0.02em] italic">clic.</span></>
        ) : (
          <>Lien <span className="font-serif font-normal tracking-[-0.02em] italic">expiré.</span></>
        )}
      </h1>
      <div className="mt-10 border-2 border-fg bg-surface p-5 shadow-hard sm:p-8">
        {hasToken ? (
          <form method="post" action="/api/auth/verify">
            <input type="hidden" name="next" value={next} />
            <p className="text-lg text-fg-2">Confirmez pour ouvrir votre session sur cet appareil.</p>
            <button type="submit" className={`${btnPrimary} mt-6 w-full sm:w-auto`}>
              Me connecter <ArrowRight aria-hidden className="size-4" />
            </button>
          </form>
        ) : (
          <>
            <p className="text-lg text-fg-2">Ce lien n’est plus valable. Les liens de connexion expirent après 15 minutes.</p>
            <Link href="/connexion" className={`${btnPrimary} mt-6`}>
              Recevoir un nouveau lien <ArrowRight aria-hidden className="size-4" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
