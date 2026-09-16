import { getDb, type Faq } from "@/lib/db";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";
import { getTopic } from "@/lib/topics";

export const alt = "Question de droit expliquée simplement, réponse sourcée Légifrance";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ topic: string; question: string }> }) {
  const { topic: slug, question } = await params;
  const topic = getTopic(slug);
  const faq = getDb().prepare("SELECT theme, question FROM faq WHERE topic = ? AND slug = ?").get(slug, question) as Pick<Faq, "theme" | "question"> | undefined;
  const q = faq?.question ?? topic?.questions.find((x) => x.slug === question)?.question ?? topic?.h1 ?? "Le droit français, enfin lisible.";
  return renderOg({ kind: "faq", theme: faq?.theme ?? "", themeTitle: topic?.title ?? "Sujet", question: q });
}
