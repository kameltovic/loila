import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";
import { THEMES } from "@/lib/themes";

export const alt = "Thème Loilà : le droit expliqué simplement";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  const t = THEMES.find((x) => x.slug === theme) ?? THEMES[0];
  return renderOg({ kind: "theme", theme: t.slug, title: t.title, tagline: t.tagline });
}
