"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Lock, UserRound, X } from "lucide-react";
import { FREE_QUESTIONS, type Me } from "@/lib/plans";
import { display, label } from "@/components/ui";
import PricingCards from "@/components/PricingCards";
import { LoginForm } from "@/components/AccountMenu";

/** Modal shown when a question can't be answered: `auth` = must sign up first, `quota` = free/subscription exhausted. */
export default function Paywall({ me, reason = "quota", onClose }: { me: Me | null; reason?: "auth" | "quota"; onClose: () => void }) {
  const auth = reason === "auth";
  const [login, setLogin] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const subscriber = !!me && me.plan !== "free";

  // Same focus handling as ArticleDrawer: focus close, trap Tab, Esc closes, restore focus.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])");
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-6">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/60" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        aria-describedby="paywall-desc"
        className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto border-2 border-fg bg-bg text-fg sm:shadow-[8px_8px_0_0_var(--signal)] sm:max-h-[90dvh]"
      >
        <header className="flex items-start gap-4 border-b-2 border-fg px-5 py-5 sm:px-8 sm:py-7">
          <div className="min-w-0 flex-1">
            <p className={`${label} flex items-center gap-2 text-fg-2`}>
              {auth ? <UserRound aria-hidden strokeWidth={2} className="size-3.5" /> : <Lock aria-hidden strokeWidth={2} className="size-3.5" />}
              {auth ? "Compte requis" : "Nouvelle question à l’IA"}
            </p>
            <h2 id="paywall-title" className={`${display} mt-3 text-3xl leading-[0.95] text-balance sm:text-5xl`}>
              {auth ? (
                <>Un compte est <span className="font-serif font-normal italic">nécessaire.</span></>
              ) : subscriber ? (
                <>Quota du mois <span className="font-serif font-normal italic">atteint.</span></>
              ) : (
                <>Vos {FREE_QUESTIONS} questions offertes sont <span className="font-serif font-normal italic">utilisées.</span></>
              )}
            </h2>
            <p id="paywall-desc" className="mt-3 max-w-2xl text-fg-2">
              {auth ? (
                <>
                  Entrez votre email : le compte se crée automatiquement, sans mot de passe. Vos {FREE_QUESTIONS} premières
                  questions générées sont offertes, et votre question est conservée pour être renvoyée après connexion.
                </>
              ) : (
                <>Continuez avec une question à l’unité ou un abonnement. Votre question est conservée : renvoyez-la après l’achat.</>
              )}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-10 shrink-0 place-items-center border-2 border-fg transition hover:bg-fg hover:text-bg"
          >
            <X aria-hidden strokeWidth={2} className="size-5" />
          </button>
        </header>

        {auth ? (
          <div className="space-y-6 px-5 py-7 sm:px-8">
            <LoginForm autoFocus />
            <p className="text-sm text-fg-2">
              Un seul lien par email, valable quelques minutes : il vous connecte et crée votre compte si besoin.{" "}
              <Link href="/tarifs" className="underline decoration-signal decoration-2 underline-offset-4" onClick={onClose}>
                Voir les offres
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-7 sm:px-8">
            <PricingCards compact />

            <p className="border-l-4 border-signal pl-4 text-[0.9375rem]">
              <strong>Les réponses existantes restent gratuites et illimitées</strong> : fiches pratiques et réponses instantanées
              ne consomment aucune question.
            </p>

            <p className="text-sm text-fg-2">
              Paiement sécurisé par Stripe · Sans engagement · Résiliable en 1 clic ·{" "}
              <Link href="/tarifs" className="underline decoration-signal decoration-2 underline-offset-4" onClick={onClose}>
                Détail des tarifs
              </Link>
            </p>

            <div className="border-t border-rule pt-5">
              {login ? (
                <LoginForm autoFocus />
              ) : (
                <p>
                  Déjà client ?{" "}
                  <button type="button" onClick={() => setLogin(true)} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">
                    Se connecter
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
