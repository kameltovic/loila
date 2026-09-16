import { OG_CONTENT_TYPE, OG_SIZE, topicOg } from "@/lib/og";
import { getTopic } from "@/lib/topics";

export const alt = "Sujet de droit expliqué simplement, réponses sourcées Légifrance";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ topic: string }> }) {
  return topicOg(getTopic((await params).topic));
}
