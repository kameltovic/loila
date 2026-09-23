import { articlePath } from "@/lib/articles";
import { getArticle } from "@/lib/search";
import { CODES } from "@/lib/themes";

export async function GET(_req: Request, ctx: RouteContext<"/api/article/[id]">) {
  const a = getArticle((await ctx.params).id);
  if (!a) return Response.json({ error: "Article introuvable." }, { status: 404 });
  const codeName = CODES[a.code as keyof typeof CODES]?.name ?? a.code;
  return Response.json(
    { id: a.id, num: a.num, code: a.code, codeName, section: a.section, texte: a.texte, date_debut: a.date_debut, url: a.url, path: articlePath(a) },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
