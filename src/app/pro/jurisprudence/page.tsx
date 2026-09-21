import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import JuriAssistant from "@/components/JuriAssistant";
import { btnPrimary, container, display, label } from "@/components/ui";
import { SESSION_COOKIE, isAdmin, userBySessionToken } from "@/lib/auth";
import { getMe } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Assistant jurisprudence · Loilà Pro", robots: { index: false, follow: false } };

// Loilà Pro: case-law assistant. Pro subscribers and admins get the tool; everyone else the pitch and the waitlist.
export default async function ProJurisprudence() {
  const user = userBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const allowed = !!user && (isAdmin(user.email) || getMe({ userId: user.id, email: user.email, anonId: "", ipHash: "" }).plan === "pro");

  return (
    <section className={`${container} pt-10 pb-20 sm:pt-14`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Loilà Pro · avocats et juristes
      </p>
      <h1 className={`${display} mt-6 max-w-5xl text-[clamp(2.5rem,7vw,5rem)] leading-[0.92] text-balance`}>
        Interrogez la jurisprudence <span className="font-serif font-normal tracking-[-0.02em] italic">avec l’IA.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-fg-2">
        Une question de droit : l’assistant cherche dans les codes et les décisions de la Cour de cassation et du Conseil
        constitutionnel, puis répond en citant chaque arrêt [D1] et chaque article, vérifiables en un clic.
      </p>
      <div className="mt-10">
        {allowed ? (
          <JuriAssistant />
        ) : (
          <div className="grid gap-4 border-2 border-fg bg-surface p-6 sm:p-8">
            <p className="text-lg">L’assistant est réservé à l’offre Pro, en cours d’ouverture.</p>
            <Link href="/avocats#offre" className={`${btnPrimary} justify-self-start`}>
              Rejoindre la liste d’attente <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
