import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Search + AI crawlers explicitly welcome (GEO): being quoted by ChatGPT/Perplexity/AI Overviews is the goal.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      { userAgent: AI_BOTS, allow: "/", disallow: "/api/" },
    ],
    // Split sitemaps (generateSitemaps in app/sitemap.ts): one per entity family, each listing only indexable URLs.
    sitemap: [0, 1, 2, 3, 4].map((i) => `${SITE_URL}/sitemap/${i}.xml`),
    host: SITE_URL,
  };
}
