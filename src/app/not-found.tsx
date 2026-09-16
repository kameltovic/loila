import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p aria-hidden className="text-6xl">🧭</p>
      <h1 className="mt-6 text-5xl font-black tracking-tighter">Page introuvable.</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Cette page n’existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
      >
        Retour à l’accueil
      </Link>
    </section>
  );
}
