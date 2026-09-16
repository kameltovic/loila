import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // OG/icon renderers read fonts with fs; make sure standalone output ships them.
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/*.ttf"] },
};

export default nextConfig;
