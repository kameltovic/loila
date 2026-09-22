import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { container, display, label } from "@/components/ui";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Contact",
    description: "Écrire à l’équipe Loilà : question sur le service, partenariat, offre Pro ou exercice de vos droits sur vos données.",
    path: "/contact",
  }),
  // Thin utility page: kept reachable, never indexed.
  robots: { index: false, follow: true },
};

export default function Contact() {
  return (
    <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Contact
      </p>
      <h1 className={`${display} mt-6 text-[clamp(3rem,9vw,5.5rem)] leading-[0.92]`}>
        Écrivez-<span className="font-serif font-normal tracking-[-0.02em] italic">nous.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-fg-2">
        Une question sur le service, un partenariat, l’offre Pro ou vos données personnelles : laissez-nous un message, nous
        vous répondons par e-mail.
      </p>
      <div className="relative mt-10 border-2 border-fg bg-surface p-5 shadow-hard sm:p-8">
        <ContactForm />
      </div>
    </section>
  );
}
