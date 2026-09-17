import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { TRUNCATED_BEFORE, countCacheCitingLong } from "@/lib/ask";
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

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ issue?: string; purge?: string }> }) {
  await requireAdmin();
  const { issue, purge } = await searchParams;
  const filter = issue && issue in OUTCOMES ? issue : null;
  const db = getDb();

  const byOutcome = db
    .prepare("SELECT outcome, COUNT(*) total, SUM(created_at >= unixepoch() - 7 * 86400) week FROM question_log GROUP BY outcome ORDER BY total DESC")
    .all() as { outcome: string; total: number; week: number }[];
  const cacheTotal = (db.prepare("SELECT COUNT(*) n FROM qa_cache").get() as { n: number }).n;
  const cacheLong = countCacheCitingLong();
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

  const stories = db
    .prepare(
      `SELECT d.id, d.story, d.status, d.created_at, d.user_id, u.email, (SELECT COUNT(*) FROM dossier_messages m WHERE m.dossier_id = d.id) followups
       FROM dossiers d LEFT JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 100`,
    )
    .all() as { id: string; story: string; status: string; created_at: number; user_id: number; email: string | null; followups: number }[];

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

      <Section id="cache" title="Cache des réponses IA">
        {purge != null && (
          <p role="status" className="mb-4 border-2 border-fg bg-urbanisme px-4 py-3 text-ink">
            {purge} réponse{Number(purge) > 1 ? "s" : ""} supprimée{Number(purge) > 1 ? "s" : ""} du cache (sauvegarde JSON à côté de la base).
          </p>
        )}
        <div className="border-2 border-fg bg-surface p-5">
          <p>
            <strong>{cacheTotal}</strong> réponses en cache, dont <strong>{cacheLong}</strong> citent un article de plus de{" "}
            {TRUNCATED_BEFORE.toLocaleString("fr-FR")} caractères (rédigées avant les extraits par passages, possiblement incomplètes).
          </p>
          {cacheLong > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold underline decoration-signal decoration-2 underline-offset-4">Vider ces {cacheLong} réponses…</summary>
              <form method="post" action="/admin/cache" className="mt-3">
                <p className="text-sm text-fg-2">Elles seront sauvegardées puis régénérées à la prochaine question identique (moins d’un centime chacune).</p>
                <button type="submit" className="mt-3 border-2 border-fg bg-fg px-4 py-2 font-mono text-sm font-bold uppercase text-bg">
                  Confirmer la suppression
                </button>
              </form>
            </details>
          )}
        </div>
      </Section>

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

      <Section title="Récits des dossiers (wizard)">
        <Table head={["Date", "Statut", "Suivis", "Compte", "Récit"]}>
          {stories.map((d) => (
            <tr key={d.id}>
              <td>{fmt(d.created_at)}</td>
              <td>{d.status}</td>
              <td>{d.followups}</td>
              <td><Link href={`/admin/users/${d.user_id}`} className="underline underline-offset-2">{d.email}</Link></td>
              <td className="min-w-[24rem] whitespace-normal font-sans">{d.story}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Dernières questions (chat)">
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
