import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, userBySessionToken } from "@/lib/auth";
import { getDossier } from "@/lib/wizard";
import { LoginForm } from "@/components/AccountMenu";
import { container, display, label } from "@/components/ui";
import Wizard from "@/components/Wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon dossier", robots: { index: false, follow: false } };

export default async function DossierPage({ params }: PageProps<"/dossier/[id]">) {
  const user = userBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const shell = (children: React.ReactNode) => <section className={`${container} max-w-3xl! pt-12 pb-20 sm:pt-20 sm:pb-28`}>{children}</section>;
  if (!user) {
    return shell(
      <>
        <h1 className={`${display} text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92]`}>
          Connectez-vous pour voir <span className="font-serif font-normal italic">ce dossier.</span>
        </h1>
        <div className="mt-10 border-2 border-fg bg-surface p-5 shadow-hard sm:p-8">
          <LoginForm />
        </div>
      </>,
    );
  }
  // Ownership enforced in getDossier: someone else's dossier is a plain 404.
  const dossier = getDossier({ userId: user.id, email: user.email, anonId: "", ipHash: "" }, (await params).id);
  if (!dossier || ["analyse", "failed"].includes(dossier.status)) notFound();
  return shell(
    <>
      <Link href="/compte#dossiers" className={`${label} text-fg-2 underline underline-offset-4`}>← Mes dossiers</Link>
      <p className={`${label} mt-8 flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Dossier du {new Date(dossier.created_at * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}
      </p>
      <h1 className={`${display} mt-6 mb-10 text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92] text-balance break-words`}>{dossier.title}</h1>
      <Wizard initial={dossier} />
    </>,
  );
}
