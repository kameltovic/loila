import { permanentRedirect } from "next/navigation";

// /adresse/<banId> is an alias; the canonical URL is /bien/<banId>.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/bien/${id}`);
}
