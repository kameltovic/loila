import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { btnPrimary, container, display, label } from "@/components/ui";

export default function NotFound() {
  return (
    <section className={`${container} py-20 sm:py-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />Erreur 404
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3.5rem,11vw,7.5rem)] leading-[0.92] text-balance`}>
        Page <span className="font-serif font-normal tracking-[-0.02em] italic">introuvable.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-fg-2 sm:text-xl">Cette page n’existe pas ou a été déplacée.</p>
      <Link href="/" className={`${btnPrimary} mt-10`}>
        Retour à l’accueil <ArrowRight aria-hidden strokeWidth={1.75} size={18} />
      </Link>
    </section>
  );
}
