import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { container, display, label } from "@/components/ui";
import { Section, Table, fmt } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · compte", robots: { index: false, follow: false } };

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  await requireAdmin();
  const db = getDb();
  const id = Number((await params).id);
  const user = Number.isInteger(id)
    ? (db.prepare("SELECT id, email, stripe_customer_id, created_at FROM users WHERE id = ?").get(id) as
        { id: number; email: string; stripe_customer_id: string | null; created_at: number } | undefined)
    : undefined;
  if (!user) notFound();

  const batches = db.prepare("SELECT id, credits_granted, credits_left, expires_at, expires_at <= unixepoch() expired, stripe_ref, created_at FROM credit_batches WHERE user_id = ? ORDER BY id DESC").all(id) as
    { id: number; credits_granted: number; credits_left: number; expires_at: number; expired: number; stripe_ref: string | null; created_at: number }[];
  const usage = db.prepare("SELECT id, kind, batch_id, created_at FROM usage WHERE subject = ? ORDER BY id DESC LIMIT 500").all(`user:${id}`) as
    { id: number; kind: string; batch_id: number | null; created_at: number }[];
  // Titles and status only: the story itself stays private to its owner.
  const dossiers = db.prepare("SELECT id, status, analysis, created_at, updated_at, calls, (SELECT COUNT(*) FROM dossier_messages m WHERE m.dossier_id = d.id) followups FROM dossiers d WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").all(id) as
    { id: string; status: string; analysis: string | null; created_at: number; updated_at: number; calls: string; followups: number }[];
  const parse = <T,>(s: string | null, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
  const sub = db.prepare("SELECT stripe_subscription_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE user_id = ?").get(id) as
    { stripe_subscription_id: string; plan: string; status: string; current_period_start: number; current_period_end: number } | undefined;

  return (
    <div className={`${container} pt-12 pb-20 sm:pt-16`}>
      <Link href="/admin" className={`${label} text-fg-2 underline underline-offset-4`}>← Admin</Link>
      <h1 className={`${display} mt-4 text-[clamp(1.75rem,6vw,3.5rem)] leading-[0.95] break-all`}>{user.email}</h1>
      <dl className="mt-6 grid gap-x-6 gap-y-2 font-mono text-sm sm:grid-cols-[auto_1fr]">
        <dt className={`${label} text-fg-2`}>Compte</dt><dd>#{user.id}</dd>
        <dt className={`${label} text-fg-2`}>Créé</dt><dd>{fmt(user.created_at)}</dd>
        <dt className={`${label} text-fg-2`}>Client Stripe</dt><dd className="break-all">{user.stripe_customer_id ?? "—"}</dd>
      </dl>

      <Section title="Abonnement">
        {sub ? (
          <Table head={["Abonnement", "Offre", "Statut", "Début période", "Fin période"]}>
            <tr>
              <td>{sub.stripe_subscription_id}</td>
              <td>{sub.plan}</td>
              <td>{sub.status}</td>
              <td>{fmt(sub.current_period_start)}</td>
              <td>{fmt(sub.current_period_end)}</td>
            </tr>
          </Table>
        ) : <p className="font-mono text-sm text-fg-2">Aucun.</p>}
      </Section>

      <Section title="Lots de crédits">
        <Table head={["Lot", "Acheté", "Crédits", "Expire", "Session Stripe"]}>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{fmt(b.created_at)}</td>
              <td>{b.credits_left}/{b.credits_granted}</td>
              <td>{fmt(b.expires_at)} {!!b.expired && <span className="ml-2 border border-fg px-1.5 text-xs uppercase">expiré</span>}</td>
              <td>{b.stripe_ref ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Dossiers">
        <Table head={["Dossier", "Créé", "Titre", "Statut", "Suivi", "Coût LLM", "Hébergeurs"]}>
          {dossiers.map((d) => {
            const calls = parse<{ cost?: number; provider?: string }[]>(d.calls, []);
            return (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{fmt(d.created_at)}</td>
                <td className="max-w-xs truncate">{parse<{ title?: string }>(d.analysis, {}).title ?? "—"}</td>
                <td>{d.status}</td>
                <td>{d.followups}</td>
                <td>${calls.reduce((t, c) => t + (c.cost ?? 0), 0).toFixed(4)}</td>
                <td>{[...new Set(calls.map((c) => c.provider).filter(Boolean))].join(", ") || "—"}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <Section title="Questions IA">
        <Table head={["#", "Date", "Type", "Lot"]}>
          {usage.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{fmt(u.created_at)}</td>
              <td>{u.kind}</td>
              <td>{u.batch_id ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
