// Case law for production: the selected decisions as year-range content bundles (each well under GitHub's 100 MB
// file limit), plus one bundle of their summaries. Raw decisions only: the server re-derives the graph on import.
// npx tsx scripts/export-juri.ts [--max-mb 22] [--prefix 2026-09-juri]
// Selection (decided 21/09/2026): Cour de cassation, Conseil constitutionnel, Conseil d'État / Tribunal des conflits,
// and CAA decisions applying urbanisme, construction-habitation or environnement articles.
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

try { process.loadEnvFile(); } catch { /* no .env */ }

export const SELECTION = `
  d.source IN ('cass', 'constit')
  OR (d.source = 'jade' AND (d.juridiction NOT LIKE 'CAA%' OR EXISTS (
    SELECT 1 FROM decision_articles da JOIN articles a ON a.id = da.article_id
    WHERE da.decision_id = d.id AND a.code IN ('code-urbanisme', 'code-construction-habitation', 'code-environnement'))))`;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const argv = process.argv.slice(2);
  const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const maxBytes = Number(opt("max-mb", "22")) * 1024 * 1024;
  const prefix = opt("prefix", "2026-09-juri");
  const db = getDb();
  const dir = path.join("seed", "content");
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${prefix}-`)) fs.rmSync(path.join(dir, f)); // re-export replaces

  const years = (db.prepare(`SELECT substr(d.date, 1, 4) y, COUNT(*) n FROM decisions d WHERE ${SELECTION} GROUP BY y ORDER BY y`).all() as { y: string; n: number }[]).map((r) => r.y);
  const load = (y: string) => ({
    decisions: db.prepare(`SELECT d.* FROM decisions d WHERE (${SELECTION}) AND substr(d.date, 1, 4) = ? ORDER BY d.id`).all(y),
    decisionNumbers: db.prepare(`SELECT n.decision_id, n.numero FROM decision_numbers n JOIN decisions d ON d.id = n.decision_id WHERE (${SELECTION}) AND substr(d.date, 1, 4) = ?`).all(y),
    decisionProvenance: db.prepare(`SELECT p.* FROM provenance p JOIN decisions d ON d.id = p.entity_id WHERE p.entity_type = 'decision' AND (${SELECTION}) AND substr(d.date, 1, 4) = ?`).all(y),
  });
  type Part = ReturnType<typeof load>;
  const write = (name: string, part: Part | Record<string, unknown>) => {
    const buf = gzipSync(JSON.stringify({ articles: [], faq: [], ...part }), { level: 9 });
    fs.writeFileSync(path.join(dir, `${name}.json.gz`), buf);
    return buf.length;
  };

  // Greedy grouping of consecutive years while the compressed bundle stays under the cap.
  let group: string[] = [];
  let acc: Part = { decisions: [], decisionNumbers: [], decisionProvenance: [] };
  let total = 0;
  const flush = () => {
    if (!group.length) return;
    const name = `${prefix}-${group[0]}${group.length > 1 ? `-${group.at(-1)}` : ""}`;
    const size = write(name, acc);
    total += acc.decisions.length;
    console.log(`${name}: ${acc.decisions.length} decisions, ${(size / 1048576).toFixed(1)} MB`);
    group = [];
    acc = { decisions: [], decisionNumbers: [], decisionProvenance: [] };
  };
  for (const y of years) {
    const part = load(y);
    const trial = { decisions: [...acc.decisions, ...part.decisions], decisionNumbers: [...acc.decisionNumbers, ...part.decisionNumbers], decisionProvenance: [...acc.decisionProvenance, ...part.decisionProvenance] };
    const size = gzipSync(JSON.stringify(trial), { level: 1 }).length * 0.85; // level 1 overestimates level 9 by ~15 %
    if (group.length && size > maxBytes) flush();
    if (group.length) acc = trial;
    else acc = part;
    group.push(y);
  }
  flush();

  const summaries = db.prepare(`SELECT s.decision_id, s.summary, s.points, s.model FROM decision_summaries s JOIN decisions d ON d.id = s.decision_id WHERE ${SELECTION} ORDER BY s.decision_id`).all();
  const size = write(`${prefix}-summaries`, { decisionSummaries: summaries });
  console.log(`${prefix}-summaries: ${summaries.length} summaries, ${(size / 1048576).toFixed(1)} MB · total ${total} decisions`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
