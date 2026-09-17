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

export default function Login() {
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
      <div className="mt-10 border-2 border-fg bg-surface p-5 shadow-hard sm:p-8">
        <LoginForm />
      </div>
    </section>
  );
}
