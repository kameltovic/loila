import { permanentRedirect } from "next/navigation";

// /siren/<siren> and /societe/<siren> are aliases; the canonical URL is /entreprise/<siren>.
export async function GET(_request: Request, { params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  permanentRedirect(`/entreprise/${siren.replace(/\D/g, "").slice(0, 9)}`);
}
