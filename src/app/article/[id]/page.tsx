import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleChoices, ArticleView, articleMetadata, choicesMetadata, resolveId } from "../view";

export const dynamic = "force-dynamic";

// Légifrance ids 301 to /article/<code>/<num> (./[num]) unless the number is ambiguous; bare numbers are looked up.
export async function generateMetadata({ params }: PageProps<"/article/[id]">): Promise<Metadata> {
  const r = resolveId((await params).id);
  if (!r) return {};
  return "choices" in r ? choicesMetadata(r.num) : r.a ? articleMetadata(r.a) : {};
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const r = resolveId((await params).id);
  if (!r) notFound();
  if ("choices" in r) return <ArticleChoices num={r.num} choices={r.choices} />;
  if (!r.a) permanentRedirect(r.redirect);
  return <ArticleView a={r.a} />;
}
