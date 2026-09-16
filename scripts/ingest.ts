/**
 * Ingest in-force articles of the codes in CODES into `articles`.
 *
 *   npx tsx scripts/ingest.ts [code-slug...] [--refresh]
 *
 * Source: DILA LEGI open data, via the daily-updated git mirror of the raw XML
 * dump at https://git.tricoteuses.fr/dila/legi (no account, per-file fetch).
 * We walk texte/struct -> section_ta (in force) -> article, so only the files
 * we need are downloaded. Raw XML is cached under data/raw/legi/.
 * --refresh re-fetches struct/section files (articles are immutable per id).
 */
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getDb } from "../src/lib/db";
import { CODES, type CodeSlug } from "../src/lib/themes";

const RAW = "https://git.tricoteuses.fr/dila/legi/raw/branch/main/global/code_et_TNC_en_vigueur";
const API = "https://git.tricoteuses.fr/api/v1/repos/dila/legi/contents/global/code_et_TNC_en_vigueur";
const CACHE = path.join(process.cwd(), "data", "raw", "legi");
const TODAY = new Date().toISOString().slice(0, 10);
const refresh = process.argv.includes("--refresh");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  stopNodes: ["*.CONTENU"],
  isArray: (name) => ["LIEN_SECTION_TA", "LIEN_ART", "VERSION"].includes(name),
});

// ponytail: global fetch semaphore, enough to stay polite with the mirror.
let active = 0;
const queue: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 12) await new Promise<void>((r) => queue.push(r));
  active++;
  try { return await fn(); } finally { active--; queue.shift()?.(); }
}

async function get(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const res = await limited(() => fetch(url)).catch((e) => e as Error);
    if (!(res instanceof Error) && res.ok) return res.text();
    const why = res instanceof Error ? res.message : `HTTP ${res.status}`;
    if ((!(res instanceof Error) && res.status === 404) || attempt >= 5) throw new Error(`${why} ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function cached(rel: string, useCache = true): Promise<string> {
  const file = path.join(CACHE, rel);
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const xml = await get(`${RAW}/${rel}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, xml);
  return xml;
}

// LEGIARTI000028806696 -> 00/00/28/80/66
const idDirs = (id: string) => id.slice(8, 18).match(/../g)!.join("/");

function textDir(textId: string) {
  const base = textId.startsWith("JORFTEXT") ? "TNC_en_vigueur/JORF/TEXT" : "code_en_vigueur/LEGI/TEXT";
  return `${base}/${idDirs(textId)}/${textId}`;
}

type Link = { id: string; debut: string; fin: string; etat: string; num?: string; url?: string; "#text"?: string };
const inForce = (l: Link) => l.debut <= TODAY && TODAY < l.fin;

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Row = { id: string; code: string; num: string; section: string; texte: string; date_debut: string; url: string };

async function ingestCode(slug: CodeSlug): Promise<Row[]> {
  const dir = textDir(CODES[slug].legitext);
  // The struct file is named by the LEGITEXT id (differs from the JORFTEXT id for lois): list the folder.
  const listing = JSON.parse(await get(`${API}/${dir}/texte/struct`)) as { name: string }[];
  let root: { STRUCT: { LIEN_SECTION_TA?: Link[]; LIEN_ART?: Link[] } } | undefined;
  for (const { name } of listing) {
    const t = parser.parse(await cached(`${dir}/texte/struct/${name}`, !refresh)).TEXTELR;
    if (t.VERSIONS.VERSION.some((v: { etat: string }) => v.etat === "VIGUEUR")) root = t;
  }
  if (!root) throw new Error(`no in-force struct for ${slug}`);

  const artLinks: { link: Link; crumbs: string[] }[] = [];
  async function walk(node: { LIEN_SECTION_TA?: Link[]; LIEN_ART?: Link[] } | "", crumbs: string[]) {
    if (!node) return;
    for (const a of node.LIEN_ART ?? []) if (a.etat === "VIGUEUR" && inForce(a)) artLinks.push({ link: a, crumbs });
    await Promise.all((node.LIEN_SECTION_TA ?? []).filter(inForce).map(async (s) => {
      const xml = await cached(`${dir}/section_ta${s.url}`, !refresh);
      const sec = parser.parse(xml).SECTION_TA;
      await walk(sec.STRUCTURE_TA, [...crumbs, htmlToText(String(sec.TITRE_TA ?? s["#text"] ?? "")).replace(/\s+/g, " ")]);
    }));
  }
  await walk(root.STRUCT, []);

  let done = 0;
  const rows = await Promise.all(artLinks.map(async ({ link, crumbs }) => {
    const xml = await cached(`${dir}/article/LEGI/ARTI/${idDirs(link.id)}/${link.id}.xml`);
    const art = parser.parse(xml).ARTICLE;
    const meta = art.META.META_SPEC.META_ARTICLE;
    if (++done % 1000 === 0) console.log(`  ${slug}: ${done}/${artLinks.length}`);
    return {
      id: link.id,
      code: slug,
      num: String(meta.NUM || link.num || "").replace(/\*/g, ""), // "R*421-14" (décret en CE marker) -> "R421-14"
      section: crumbs.join(" > "),
      texte: htmlToText(String(art.BLOC_TEXTUEL?.CONTENU ?? "")),
      date_debut: meta.DATE_DEBUT,
      url: `https://www.legifrance.gouv.fr/${slug === "loi-89-462" ? "loda" : "codes"}/article_lc/${link.id}`,
      etat: meta.ETAT as string,
    };
  }));
  const skipped = rows.filter((r) => r.etat !== "VIGUEUR").length;
  if (skipped) console.log(`  ${slug}: ${skipped} linked articles not VIGUEUR in their own metadata, skipped`);
  return rows.filter((r) => r.etat === "VIGUEUR").map(({ etat: _e, ...r }) => r);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const slugs = (args.length ? args : Object.keys(CODES)) as CodeSlug[];
  for (const s of slugs) if (!(s in CODES)) throw new Error(`unknown code ${s}; known: ${Object.keys(CODES).join(", ")}`);

  const db = getDb();
  const upsert = db.prepare(`INSERT INTO articles (id, code, num, section, texte, date_debut, url)
    VALUES (@id, @code, @num, @section, @texte, @date_debut, @url)
    ON CONFLICT(id) DO UPDATE SET code=excluded.code, num=excluded.num, section=excluded.section,
      texte=excluded.texte, date_debut=excluded.date_debut, url=excluded.url
    WHERE articles.texte IS NOT excluded.texte OR articles.section IS NOT excluded.section
      OR articles.num IS NOT excluded.num OR articles.date_debut IS NOT excluded.date_debut`);
  const counts: Record<string, number> = {};

  for (const slug of slugs) {
    console.log(`> ${slug} (${CODES[slug].legitext})`);
    const rows = await ingestCode(slug);
    const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
    db.transaction(() => {
      for (const r of unique) upsert.run(r);
      // Drop articles no longer in force (sync, keeps the run idempotent).
      const keep = new Set(unique.map((r) => r.id));
      const stale = (db.prepare("SELECT id FROM articles WHERE code = ?").all(slug) as { id: string }[]).filter((r) => !keep.has(r.id));
      const del = db.prepare("DELETE FROM articles WHERE id = ?");
      for (const r of stale) del.run(r.id);
      if (stale.length) console.log(`  ${slug}: removed ${stale.length} articles no longer in force`);
    })();
    counts[slug] = unique.length;
  }

  console.log("\nArticles in force per code:");
  for (const [slug, n] of Object.entries(counts)) console.log(`  ${slug.padEnd(30)} ${n}`);
  const total = db.prepare("SELECT code, COUNT(*) n FROM articles GROUP BY code").all();
  console.log("DB totals:", total);
}

main().catch((e) => { console.error(e); process.exit(1); });
