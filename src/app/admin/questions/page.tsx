import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { container, display, label } from "@/components/ui";
import { Section, Table, fmt } from "../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questions · Admin", robots: { index: false, follow: false } };

const OUTCOMES: Record<string, string> = {
  faq: "Fiche FAQ",
  cache: "Réponse en cache",
  llm: "Réponse IA",
  none: "Sans réponse",
  paywall: "Paywall",
  auth: "Sans compte",
  error: "Erreur",
};

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  await requireAdmin();
  const { issue } = await searchParams;
  const filter = issue && issue in OUTCOMES ? issue : null;
  const db = getDb();

  const byOutcome = db
    .prepare("SELECT outcome, COUNT(*) total, SUM(created_at >= unixepoch() - 7 * 86400) week FROM question_log GROUP BY outcome ORDER BY total DESC")
    .all() as { outcome: string; total: number; week: number }[];
  const total = byOutcome.reduce((a, o) => a + o.total, 0);
  const top = db
    .prepare("SELECT MIN(question) question, COUNT(*) n, MAX(created_at) last FROM question_log GROUP BY lower(trim(question)) HAVING n > 1 ORDER BY n DESC, last DESC LIMIT 30")
    .all() as { question: string; n: number; last: number }[];
  const latest = db
    .prepare(
      `SELECT q.id, q.question, q.theme, q.outcome, q.created_at, q.user_id, u.email FROM question_log q LEFT JOIN users u ON u.id = q.user_id
       ${filter ? "WHERE q.outcome = ?" : ""} ORDER BY q.id DESC LIMIT 300`,
    )
    .all(...(filter ? [filter] : [])) as { id: number; question: string; theme: string | null; outcome: string; created_at: number; user_id: number | null; email: string | null }[];

  const chip = (value: string | null, text: string) => (
    <Link
      key={value ?? "all"}
      href={value ? `/admin/questions?issue=${value}` : "/admin/questions"}
      className={`border-2 border-fg px-2.5 py-1 font-mono text-xs uppercase ${filter === value ? "bg-fg text-bg" : "bg-bg"}`}
    >
      {text}
    </Link>
  );

  return (
    <section className={`${container} pt-10 pb-20`}>
      <p className={`${label} text-fg-2`}>
        <Link href="/admin" className="underline underline-offset-4">Admin</Link> / Questions
      </p>
      <h1 className={`${display} mt-4 text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92]`}>Questions posées</h1>
      <p className="mt-3 text-fg-2">{total} questions enregistrées depuis la mise en place du suivi.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {byOutcome.map((o) => (
          <div key={o.outcome} className="min-w-0 border-2 border-fg bg-surface p-4">
            <p className={`${label} text-fg-2`}>{OUTCOMES[o.outcome] ?? o.outcome}</p>
            <p className={`${display} mt-2 text-3xl`}>{o.total}</p>
            <p className="mt-1 font-mono text-xs text-fg-2">+{o.week ?? 0} sur 7 jours</p>
          </div>
        ))}
      </div>

      {top.length > 0 && (
        <Section title="Questions les plus fréquentes">
          <Table head={["Fois", "Question", "Dernière"]}>
            {top.map((t) => (
              <tr key={t.question}>
                <td>{t.n}</td>
                <td className="min-w-[24rem] whitespace-normal font-sans">{t.question}</td>
                <td>{fmt(t.last)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title="Dernières questions">
        <div className="mb-4 flex flex-wrap gap-2">
          {chip(null, "Toutes")}
          {Object.entries(OUTCOMES).map(([k, v]) => chip(k, v))}
        </div>
        <Table head={["Date", "Résultat", "Thème", "Compte", "Question"]}>
          {latest.map((q) => (
            <tr key={q.id}>
              <td>{fmt(q.created_at)}</td>
              <td>{OUTCOMES[q.outcome] ?? q.outcome}</td>
              <td>{q.theme ?? "—"}</td>
              <td>{q.user_id ? <Link href={`/admin/users/${q.user_id}`} className="underline underline-offset-2">{q.email}</Link> : "—"}</td>
              <td className="min-w-[24rem] whitespace-normal font-sans">{q.question}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </section>
  );
}
