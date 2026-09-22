import { SITE_URL } from "@/lib/seo";
import { SECTIONS } from "../sitemap";

// Sitemap index listing the split sitemaps of app/sitemap.ts (/sitemap/0.xml …). Also served at /sitemap.xml by a
// rewrite in next.config.ts: that path is reserved by the sitemap metadata file, so it cannot be a route itself.
export const revalidate = 3600;

export function GET() {
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SECTIONS.map((_, i) => `  <sitemap><loc>${SITE_URL}/sitemap/${i}.xml</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
