import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import { AccountPanel } from "@/components/AccountMenu";

export const metadata: Metadata = {
  ...pageMetadata({ title: "Mon compte", description: "Vos questions, votre abonnement et vos factures Loilà.", path: "/compte" }),
  robots: { index: false },
};

export default function Account() {
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Espace personnel
      </p>
      <h1 className={`${display} mt-6 mb-10 text-[clamp(3rem,9vw,5.5rem)] leading-[0.92]`}>Mon compte</h1>
      <AccountPanel />
    </section>
  );
}
