// Pre-renders Open Graph images to public/og/<path>.png with the same renderer as the routes (src/lib/og.tsx).
// Pages keep using the route-based opengraph-image; this is for pushing images to a CDN/S3.
// npx tsx scripts/og-batch.ts [--limit N] [--out public/og]
import fs from "node:fs";
import path from "node:path";

try { process.loadEnvFile(); } catch { /* no .env */ }

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { THEMES, faqUrl } = await import("../src/lib/themes");
  const { renderOg, topicOg } = await import("../src/lib/og");

  const argv = process.argv.slice(2);
  const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const limit = Number(opt("limit") ?? Infinity);
  const out = path.resolve(opt("out") ?? "public/og");

  type Job = [urlPath: string, render: () => Response | Promise<Response>];
  const jobs: Job[] = [["/", () => renderOg({ kind: "home" })]];
  for (const t of THEMES) jobs.push([`/${t.slug}`, () => renderOg({ kind: "theme", theme: t.slug, title: t.title, tagline: t.tagline })]);

  const topics = await import("../src/lib/topics").then((m) => m.getTopics()).catch(() => []); // topics.json may not exist yet
  const topicTitle = new Map(topics.map((t) => [t.slug, t.title]));
  for (const t of topics) jobs.push([`/sujets/${t.slug}`, () => topicOg(t)]);

  const faqs = getDb().prepare("SELECT * FROM faq ORDER BY id").all() as { theme: string; slug: string; topic?: string | null; question: string }[];
  for (const f of faqs) {
    const themeTitle = (f.topic && topicTitle.get(f.topic)) || THEMES.find((t) => t.slug === f.theme)?.title || "Droit";
    jobs.push([faqUrl(f), () => renderOg({ kind: "faq", theme: f.theme, themeTitle, question: f.question })]);
  }

  let n = 0;
  for (const [urlPath, render] of jobs.slice(0, limit)) {
    const file = path.join(out, `${urlPath === "/" ? "index" : urlPath.slice(1)}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await (await render()).arrayBuffer()));
    n++;
  }
  console.log(`og-batch: ${n}/${jobs.length} images -> ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
