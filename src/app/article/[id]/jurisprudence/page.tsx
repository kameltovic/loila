import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveId } from "../../view";
import { JurisprudenceView, jurisprudenceMetadata, jurisprudencePath } from "../../jurisprudence";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps<"/article/[id]/jurisprudence">): Promise<Metadata> {
  const r = resolveId((await params).id);
  return r && "a" in r && r.a ? jurisprudenceMetadata(r.a, (await searchParams).avant) : {};
}

export default async function ArticleJurisprudence({ params, searchParams }: PageProps<"/article/[id]/jurisprudence">) {
  const r = resolveId((await params).id);
  const { avant } = await searchParams;
  if (!r || "choices" in r) notFound();
  if (!r.a) permanentRedirect(jurisprudencePath(r.redirect, avant));
  return <JurisprudenceView a={r.a} avant={avant} />;
}
