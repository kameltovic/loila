import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { resolvePath } from "../../../view";
import { JurisprudenceView, jurisprudenceMetadata, jurisprudencePath } from "../../../jurisprudence";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps<"/article/[id]/[num]/jurisprudence">): Promise<Metadata> {
  const { id, num } = await params;
  const r = resolvePath(id, num);
  return r?.a ? jurisprudenceMetadata(r.a, (await searchParams).avant) : {};
}

export default async function ArticleJurisprudence({ params, searchParams }: PageProps<"/article/[id]/[num]/jurisprudence">) {
  const { id, num } = await params;
  const { avant } = await searchParams;
  const r = resolvePath(id, num);
  if (!r) notFound();
  if (!r.a) permanentRedirect(jurisprudencePath(r.redirect, avant));
  return <JurisprudenceView a={r.a} avant={avant} />;
}
