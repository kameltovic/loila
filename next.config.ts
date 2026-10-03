import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // OG/icon renderers read fonts with fs; make sure standalone output ships them.
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*.ttf", "./seed/metiers/*.json", "./seed/lettres/*.json", "./seed/content/*.json.gz"] }, // métier pages read their JSON at runtime
  // DB path is computed at runtime (process.cwd()/data), so tracing would copy the whole local data dir (XML cache, SQLite).
  outputFileTracingExcludes: { "/**": ["./data/**", "./public/og/**"] },
  // /sitemap.xml is the conventional address (Search Console): serve the index of the split sitemaps there.
  poweredByHeader: false,
  // Security headers on every response; the CSP (per-request nonce) is set in src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return { beforeFiles: [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }] };
  },
};

export default nextConfig;
