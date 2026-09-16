import { getDb, type Faq } from "@/lib/db";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";
import { THEMES } from "@/lib/themes";

export const alt = "Question de droit expliquée simplement, réponse sourcée Légifrance";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ theme: string; faq: string }> }) {
  const { theme, faq: slug } = await params;
  const faq = getDb().prepare("SELECT question FROM faq WHERE theme = ? AND slug = ?").get(theme, slug) as Pick<Faq, "question"> | undefined;
  const t = THEMES.find((x) => x.slug === theme);
  return renderOg({ kind: "faq", theme, themeTitle: t?.title ?? "Droit", question: faq?.question ?? "Le droit français, enfin lisible." });
}
