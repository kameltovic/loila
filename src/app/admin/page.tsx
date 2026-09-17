import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { OFFERS, formatPrice } from "@/lib/plans";
import { container, display, label } from "@/components/ui";
import { Section, Table, fmt } from "./ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const DAY = 86400;

function Kpi({ name, value, sub }: { name: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 border-2 border-fg bg-surface p-4">
      <p className={`${label} text-fg-2`}>{name}</p>
      <p className={`${display} mt-2 text-3xl sm:text-4xl`}>{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-fg-2">{sub}</p>}
    </div>
  );
}

export default async function Admin() {
  await requireAdmin();
  const db = getDb();
  const week = `unixepoch() - ${7 * DAY}`;
  const n = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

  const accounts = n("SELECT COUNT(*) n FROM users");
  const accounts7 = n(`SELECT COUNT(*) n FROM users WHERE created_at >= ${week}`);
  const sold = n("SELECT COUNT(*) n FROM credit_batches WHERE stripe_ref IS NOT NULL");
  const sold7 = n(`SELECT COUNT(*) n FROM credit_batches WHERE stripe_ref IS NOT NULL AND created_at >= ${week}`);
  const usage = db.prepare(`SELECT kind, COUNT(*) total, SUM(created_at >= ${week}) week FROM usage GROUP BY kind`).all() as { kind: string; total: number; week: number }[];
  const questions = (k: string) => usage.find((u) => u.kind === k) ?? { total: 0, week: 0 };
  const credits = n("SELECT COALESCE(SUM(credits_left), 0) n FROM credit_batches WHERE expires_at > unixepoch()");
  const waitlistCount = n("SELECT COUNT(*) n FROM pro_waitlist");
  const wizard = db.prepare(`SELECT COUNT(*) started, COALESCE(SUM(answers IS NOT NULL), 0) completed, COALESCE(SUM(synthesis_md IS NOT NULL), 0) synthesized,
    COALESCE(SUM(created_at >= ${week}), 0) started7, COALESCE(SUM(synthesis_md IS NOT NULL AND created_at >= ${week}), 0) synthesized7 FROM dossiers`).get() as
    { started: number; completed: number; synthesized: number; started7: number; synthesized7: number };
  const followups = n("SELECT COUNT(*) n FROM dossier_messages");

  const users = db.prepare("SELECT id, email, stripe_customer_id, created_at FROM users ORDER BY id DESC LIMIT 100").all() as
    { id: number; email: string; stripe_customer_id: string | null; created_at: number }[];
  const purchases = db
    .prepare("SELECT b.id, b.user_id, u.email, b.credits_granted, b.credits_left, b.expires_at, b.expires_at <= unixepoch() expired, b.created_at FROM credit_batches b JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT 100")
    .all() as { id: number; user_id: number; email: string; credits_granted: number; credits_left: number; expires_at: number; expired: number; created_at: number }[];
  const waitlist = db.prepare("SELECT email, metier, created_at FROM pro_waitlist ORDER BY created_at DESC LIMIT 100").all() as
    { email: string; metier: string | null; created_at: number }[];
  const contacts = db.prepare("SELECT id, first_name, last_name, company, email, message, emailed, created_at FROM contact_messages ORDER BY id DESC LIMIT 100").all() as
    { id: number; first_name: string; last_name: string; company: string | null; email: string; message: string; emailed: number; created_at: number }[];

  return (
    <div className={`${container} pt-12 pb-20 sm:pt-16`}>
      <p className={`${label} flex items-center gap-3 text-fg-2`}>
        <span aria-hidden className="size-2 rounded-full bg-signal" />
        Admin
      </p>
      <h1 className={`${display} mt-4 text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92]`}>Tableau de bord</h1>
      <p className="mt-4">
        <Link href="/admin/questions" className="font-semibold underline decoration-signal decoration-2 underline-offset-4">
          Questions posées →
        </Link>
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi name="Comptes" value={accounts} sub={`+${accounts7} sur 7 jours`} />
        <Kpi name="Dossiers vendus" value={sold} sub={`+${sold7} sur 7 jours`} />
        <Kpi name="CA estimé" value={formatPrice(sold * OFFERS.dossier.priceCents)} sub="TTC, Dossiers, avant frais Stripe et remboursements" />
        <Kpi name="Crédits actifs" value={credits} sub="non expirés" />
        {(["free", "credit", "sub"] as const).map((k) => (
          <Kpi key={k} name={`Questions IA · ${k}`} value={questions(k).total} sub={`+${questions(k).week} sur 7 jours`} />
        ))}
        <Kpi name="Liste d'attente Pro" value={waitlistCount} />
        <Kpi name="Dossiers démarrés" value={wizard.started} sub={`+${wizard.started7} sur 7 jours`} />
        <Kpi name="Dossiers complétés" value={wizard.completed} sub="réponses aux questions envoyées" />
        <Kpi name="Synthèses générées" value={wizard.synthesized} sub={`+${wizard.synthesized7} sur 7 jours · ${followups} questions de suivi`} />
      </div>

      <Section title="Comptes récents">
        <Table head={["#", "E-mail", "Créé", "Stripe"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td><Link href={`/admin/users/${u.id}`} className="underline decoration-signal decoration-2 underline-offset-4">{u.email}</Link></td>
              <td>{fmt(u.created_at)}</td>
              <td>{u.stripe_customer_id ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Achats">
        <Table head={["Lot", "E-mail", "Acheté", "Crédits", "Expire"]}>
          {purchases.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td><Link href={`/admin/users/${b.user_id}`} className="underline decoration-signal decoration-2 underline-offset-4">{b.email}</Link></td>
              <td>{fmt(b.created_at)}</td>
              <td>{b.credits_left}/{b.credits_granted}</td>
              <td>{fmt(b.expires_at)} {!!b.expired && <span className="ml-2 border border-fg px-1.5 text-xs uppercase">expiré</span>}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section id="contact" title="Messages de contact">
        <Table head={["Reçu", "Nom", "Entreprise", "E-mail", "Notifié", "Message"]}>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td>{fmt(c.created_at)}</td>
              <td>{c.first_name} {c.last_name}</td>
              <td>{c.company ?? "—"}</td>
              <td>
                <a href={`mailto:${c.email}?subject=${encodeURIComponent("Re: votre message à Loilà")}`} className="underline underline-offset-2">{c.email}</a>
              </td>
              <td>{c.emailed ? "oui" : "non"}</td>
              <td className="min-w-[24rem] whitespace-pre-wrap font-sans">{c.message}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section id="attente" title="Liste d'attente Pro">
        <a href="/admin/waitlist.csv" className="mb-4 inline-block font-mono text-sm font-bold uppercase underline decoration-signal decoration-2 underline-offset-4">
          Exporter en CSV
        </a>
        <Table head={["E-mail", "Métier", "Inscrit"]}>
          {waitlist.map((w) => (
            <tr key={w.email}>
              <td>{w.email}</td>
              <td>{w.metier ?? "—"}</td>
              <td>{fmt(w.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
