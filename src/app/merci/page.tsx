import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { btnPrimary, container, display, label } from "@/components/ui";
import { MerciPanel } from "@/components/AccountMenu";

export const metadata: Metadata = {
  ...pageMetadata({ title: "Merci", description: "Votre achat Loilà est confirmé.", path: "/merci" }),
  robots: { index: false },
};

export default async function Thanks({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  // /api/checkout/return redirects here with ok=1 (paid + logged in) or ok=0 (session not verifiable).
  const failed = (await searchParams).ok === "0";
  if (failed) {
    return (
      <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
        <h1 className={`${display} text-[clamp(2.5rem,8vw,5rem)] leading-[0.95]`}>Paiement non confirmé</h1>
        <p className="mt-6 max-w-xl text-lg text-fg-2">
          Nous n&apos;avons pas pu vérifier votre paiement. Si vous avez été débité, vos questions seront créditées sous quelques
          minutes : connectez-vous avec l&apos;email utilisé lors du paiement.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/connexion" className={btnPrimary}>Se connecter <ArrowRight aria-hidden className="size-4" /></Link>
          <Link href="/tarifs" className="px-3 py-2.5 font-mono text-sm font-bold uppercase underline decoration-signal decoration-2 underline-offset-4">Voir les tarifs</Link>
        </div>
      </section>
    );
  }
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Paiement confirmé
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3.5rem,11vw,7rem)] leading-[0.9]`}>
        Merci <span className="font-serif font-normal tracking-[-0.02em] italic">!</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-fg-2">
        Votre achat est validé et vous êtes connecté. Un reçu vous a été envoyé par email. Vous pouvez reposer votre
        question dès maintenant.
      </p>
      <div className="mt-10">
        <MerciPanel />
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/#question" className={btnPrimary}>
          Poser ma question <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href="/compte" className="px-3 py-2.5 font-mono text-sm font-bold uppercase underline decoration-signal decoration-2 underline-offset-4">
          Mon compte
        </Link>
      </div>
    </section>
  );
}
