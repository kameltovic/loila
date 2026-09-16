import { getDb, type Article } from "@/lib/db";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";
import { CODES, THEMES } from "@/lib/themes";

export const alt = "Article de loi expliqué, texte officiel Légifrance";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const a = getDb().prepare("SELECT num, code, section FROM articles WHERE id = ?").get((await params).id) as Pick<Article, "num" | "code" | "section"> | undefined;
  const code = a?.code ?? "";
  return renderOg({
    kind: "article",
    num: a?.num || a?.section?.split(" > ").pop() || "Texte officiel",
    code: CODES[code as keyof typeof CODES]?.name ?? code,
    theme: THEMES.find((t) => (t.codes as readonly string[]).includes(code))?.slug,
  });
}
