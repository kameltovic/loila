import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // OG/icon renderers read fonts with fs; make sure standalone output ships them.
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*.ttf", "./seed/metiers/*.json", "./seed/lettres/*.json", "./seed/content/*.json.gz"] }, // métier pages read their JSON at runtime
  // DB path is computed at runtime (process.cwd()/data), so tracing would copy the whole local data dir (XML cache, SQLite).
  outputFileTracingExcludes: { "/**": ["./data/**", "./public/og/**"] },
  // /sitemap.xml is the conventional address (Search Console): serve the index of the split sitemaps there.
  async rewrites() {
    return { beforeFiles: [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }] };
  },
};

export default nextConfig;
