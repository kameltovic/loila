import Link from "next/link";
import { Compass } from "lucide-react";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="hero-mesh">
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-fg">
          <Compass aria-hidden size={30} />
        </span>
        <h1 className="mt-6 text-5xl font-black tracking-tighter">Page introuvable.</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Cette page n’existe pas ou a été déplacée.</p>
        <Link href="/" className={`${btnPrimary} mt-8`}>
          Retour à l’accueil
        </Link>
      </div>
    </section>
  );
}
