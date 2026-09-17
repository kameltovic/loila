import { display, label } from "@/components/ui";
export const fmt = (t: number | null) =>
  t ? new Date(t * 1000).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "—";

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-2 border-fg bg-surface">
      <table className="min-w-full font-mono text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b-2 border-fg text-left">
            {head.map((h) => <th key={h} className={`${label} px-3 py-2`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-rule">{children}</tbody>
      </table>
    </div>
  );
}

export function Section({ id, title, children }: { id?: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 min-w-0">
      <h2 className={`${display} mb-4 text-3xl sm:text-4xl`}>{title}</h2>
      {children}
    </section>
  );
}

