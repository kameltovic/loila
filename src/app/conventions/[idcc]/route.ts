import { notFound } from "next/navigation";
import { getConventions, conventionUrl } from "@/lib/conventions";
import { normalizeIdcc } from "@/lib/entities";

// /conventions/1486 -> 301 -> /conventions/branche/syntec (IDCC is a highly searched keyword).
// Explicit 301: permanentRedirect() answers 308 from a route handler.
export async function GET(_request: Request, { params }: { params: Promise<{ idcc: string }> }) {
  const { idcc } = await params;
  if (!/^[0-9]{3,5}$/.test(idcc)) notFound();
  const c = getConventions().find((x) => normalizeIdcc(x.idcc) === normalizeIdcc(idcc));
  if (!c) notFound();
  return new Response(null, { status: 301, headers: { Location: conventionUrl(c) } });
}
