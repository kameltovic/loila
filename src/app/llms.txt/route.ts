import { llmsTxt } from "@/lib/llms";

export const revalidate = 3600;

export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
