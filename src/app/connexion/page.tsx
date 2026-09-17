import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import { LoginForm } from "@/components/AccountMenu";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Connexion",
    description: "Connectez-vous à Loilà avec un lien envoyé par email, sans mot de passe.",
    path: "/connexion",
  }),
  robots: { index: false },
};

export default async function Login({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const linkError = (await searchParams).erreur === "lien";
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Mon compte
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,5.5rem)] leading-[0.92]`}>
        Connexion, <span className="font-serif font-normal tracking-[-0.02em] italic">sans mot de passe.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-fg-2">
        Entrez votre email : nous vous envoyons un lien de connexion à usage unique. Cliquez dessus et c’est tout. Utilisez
        l’adresse de votre achat pour retrouver vos questions et votre abonnement.
      </p>
      {linkError && (
        <p role="alert" className="mt-8 border-2 border-signal bg-danger-bg px-4 py-3">
          Ce lien de connexion n’est plus valable : il a expiré (15 minutes) ou a déjà servi. Demandez-en un nouveau ci-dessous.
        </p>
      )}
      <div className="mt-10 border-2 border-fg bg-surface p-5 shadow-hard sm:p-8">
        <LoginForm />
      </div>
    </section>
  );
}
