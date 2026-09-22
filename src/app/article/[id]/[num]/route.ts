import { permanentRedirect } from "next/navigation";
import { getArticleByNum } from "@/lib/search";

// Human-readable alias: /article/<code-slug>/<num> -> 301 -> /article/<LEGIARTI id>.
// The canonical URL never changes (impressions already point at the opaque id).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; num: string }> }) {
  const { id, num } = await params;
  const a = getArticleByNum(id, decodeURIComponent(num));
  if (a) permanentRedirect(`/article/${a.id}`);
  return new Response("Article introuvable", { status: 404 });
}
