import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // OG/icon renderers read fonts with fs; make sure standalone output ships them.
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*.ttf"] },
  // DB path is computed at runtime (process.cwd()/data), so tracing would copy the whole local data dir (XML cache, SQLite).
  outputFileTracingExcludes: { "/**": ["./data/**", "./public/og/**"] },
};

export default nextConfig;
