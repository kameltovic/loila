import { llmsFullTxt } from "@/lib/llms";
import { hourly } from "@/lib/seo";

// Request-time + hourly memo, never prerendered: the build only sees a bundles-only DB (see `hourly` in lib/seo).
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(hourly("llms-full.txt", llmsFullTxt), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
