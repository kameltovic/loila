import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Sujets de droit expliqués simplement";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({ kind: "topic", title: "Tous les sujets du droit, expliqués simplement", label: "Sujets · Guides pratiques" });
}
