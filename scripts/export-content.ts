// Bundles legal texts + reviewed FAQ rows for production (applied at startup by importContent in src/lib/db.ts).
// npx tsx scripts/export-content.ts <bundle-name> [--codes code-a,code-b] [--faq seed/generated/x.json ...]
//   → seed/content/<bundle-name>.json.gz   (re-export after changes: a new hash re-applies the bundle)
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const argv = process.argv.slice(2);
  const name = argv[0];
  if (!name || name.startsWith("--")) throw new Error("usage: export-content.ts <bundle-name> [--codes a,b] [--faq file.json ...]");
  const codes = (argv[argv.indexOf("--codes") + 1] ?? "").split(",").filter((c) => argv.includes("--codes") && c);
  const faqFiles = argv.flatMap((a, i) => (argv[i - 1] === "--faq" ? [a] : []));
  const db = getDb();
  const articles = codes.flatMap((c) => db.prepare("SELECT * FROM articles WHERE code = ? ORDER BY id").all(c));
  const faq = faqFiles.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")) as unknown[]);
  const missing = codes.filter((c) => !articles.some((a) => (a as { code: string }).code === c));
  if (missing.length) throw new Error(`no articles for: ${missing.join(", ")} (ingest first)`);
  const out = path.join("seed", "content", `${name}.json.gz`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const buf = gzipSync(JSON.stringify({ articles, faq }), { level: 9 });
  fs.writeFileSync(out, buf);
  console.log(`${out}: ${articles.length} articles, ${faq.length} faq, ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
