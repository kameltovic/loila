import { cookies } from "next/headers";
import { SESSION_COOKIE, adminBySessionToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Always quoted; leading =+-@ neutralized against spreadsheet formula injection.
const cell = (v: string | null) => `"${(v ?? "").replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""')}"`;

export async function GET() {
  if (!adminBySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) return new Response("Not Found", { status: 404 });
  const rows = getDb().prepare("SELECT email, metier, created_at FROM pro_waitlist ORDER BY created_at").all() as { email: string; metier: string | null; created_at: number }[];
  const csv = ["email,metier,inscrit_le", ...rows.map((r) => [r.email, r.metier, new Date(r.created_at * 1000).toISOString()].map(cell).join(","))].join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="loila-pro-waitlist.csv"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
