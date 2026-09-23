import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleView, articleMetadata, resolvePath } from "../../view";

export const dynamic = "force-dynamic";

// Canonical article URL: /article/<code slug>/<num> (the [id] segment is the code here).
export async function generateMetadata({ params }: PageProps<"/article/[id]/[num]">): Promise<Metadata> {
  const { id, num } = await params;
  const r = resolvePath(id, num);
  return r?.a ? articleMetadata(r.a) : {};
}

export default async function ArticleByNum({ params }: PageProps<"/article/[id]/[num]">) {
  const { id, num } = await params;
  const r = resolvePath(id, num);
  if (!r) notFound();
  if (!r.a) permanentRedirect(r.redirect);
  return <ArticleView a={r.a} />;
}
