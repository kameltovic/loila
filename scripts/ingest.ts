/**
 * Ingest in-force articles of the codes in CODES into `articles`.
 *
 *   npx tsx scripts/ingest.ts [code-slug...] [--refresh]
 *
 * Source: DILA LEGI + KALI open data, via the daily-updated git mirrors of the raw
 * XML dumps at https://git.tricoteuses.fr/dila/legi and /dila/kali (no account,
 * per-file fetch). We walk texte/struct -> section_ta (in force) -> article, so
 * only the files we need are downloaded. Raw XML is cached under data/raw/{legi,kali}/.
 * KALI: conteneur (IDCC) -> in-force base text, attached texts and recent salary texts.
 * --refresh re-fetches struct/section files (articles are immutable per id).
 */
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getDb } from "../src/lib/db";
import { CODES, type CodeSlug } from "../src/lib/themes";

const LEGI = { raw: "https://git.tricoteuses.fr/dila/legi/raw/branch/main/global/code_et_TNC_en_vigueur", cache: path.join(process.cwd(), "data", "raw", "legi") };
const KALI = { raw: "https://git.tricoteuses.fr/dila/kali/raw/branch/main/global", cache: path.join(process.cwd(), "data", "raw", "kali") };
type Src = typeof LEGI;
const API = "https://git.tricoteuses.fr/api/v1/repos/dila/legi/contents/global/code_et_TNC_en_vigueur";
const TODAY = new Date().toISOString().slice(0, 10);
const refresh = process.argv.includes("--refresh");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  stopNodes: ["*.CONTENU"],
  isArray: (name) => ["LIEN_SECTION_TA", "LIEN_ART", "VERSION", "TM", "LIEN_TXT"].includes(name),
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

async function cached(src: Src, rel: string, useCache = true): Promise<string> {
  const file = path.join(src.cache, rel);
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const xml = await get(`${src.raw}/${rel}`);
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
const vigueur = (etat: string) => etat.startsWith("VIGUEUR"); // VIGUEUR, VIGUEUR_ETEN, VIGUEUR_NON_ETEN (KALI)

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

type Node = { LIEN_SECTION_TA?: Link[]; LIEN_ART?: Link[] } | "";
type Root = { src: Src; dir: string; node: Node; crumbs: string[] };

async function legiRoot(textId: string): Promise<Root> {
  const dir = textDir(textId);
  // The struct file is named by the LEGITEXT id (differs from the JORFTEXT id for lois): list the folder.
  const listing = JSON.parse(await get(`${API}/${dir}/texte/struct`)) as { name: string }[];
  for (const { name } of listing) {
    const t = parser.parse(await cached(LEGI, `${dir}/texte/struct/${name}`, !refresh)).TEXTELR;
    if (t.VERSIONS.VERSION.some((v: { etat: string }) => v.etat === "VIGUEUR")) return { src: LEGI, dir: `${dir}/`, node: t.STRUCT, crumbs: [] };
  }
  throw new Error(`no in-force struct for ${textId}`);
}

async function kaliRoots(contId: string): Promise<Root[]> {
  const cont = parser.parse(await cached(KALI, `conteneur/KALI/CONT/${idDirs(contId)}/${contId}.xml`, !refresh)).IDCC;
  const roots: (Root & { debut: string; salaire: boolean })[] = [];
  for (const tm of cont.STRUCTURE_TXT.TM as { TITRE_TM: string; LIEN_TXT?: { idtxt: string; titretxt: string }[] }[]) {
    if (/extension/i.test(tm.TITRE_TM)) continue; // arrêtés d'extension: no substantive rules
    await Promise.all((tm.LIEN_TXT ?? []).map(async (l) => {
      const t = parser.parse(await cached(KALI, `texte/struct/KALI/TEXT/${idDirs(l.idtxt)}/${l.idtxt}.xml`, !refresh)).TEXTEKALI;
      const v = (t.VERSIONS.VERSION as { etat: string; LIEN_TXT: Link[] }[]).find((v) => vigueur(v.etat) && inForce(v.LIEN_TXT[0]));
      if (v) roots.push({ src: KALI, dir: "", node: t.STRUCT, crumbs: [String(l.titretxt).trim()], debut: v.LIEN_TXT[0].debut, salaire: /salaire/i.test(tm.TITRE_TM) });
    }));
  }
  // Salary avenants are rarely abrogated formally: keep only those from the last 2 years of the newest one.
  // ponytail: date heuristic, per-category/regional grids older than that are dropped.
  const newest = roots.filter((r) => r.salaire).map((r) => r.debut).sort().at(-1) ?? "";
  const cutoff = newest && `${+newest.slice(0, 4) - 2}${newest.slice(4)}`;
  return roots.filter((r) => !r.salaire || r.debut >= cutoff);
}

async function ingestCode(slug: CodeSlug): Promise<Row[]> {
  const id = CODES[slug].legitext;
  const kali = id.startsWith("KALICONT");
  const roots = kali ? await kaliRoots(id) : [await legiRoot(id)];
  if (kali) console.log(`  ${slug}: ${roots.length} texts in force`);

  const artLinks: { link: Link; crumbs: string[]; root: Root }[] = [];
  async function walk(root: Root, node: Node, crumbs: string[]) {
    if (!node) return;
    for (const a of node.LIEN_ART ?? []) if (vigueur(a.etat) && inForce(a)) artLinks.push({ link: a, crumbs, root });
    await Promise.all((node.LIEN_SECTION_TA ?? []).filter(inForce).map(async (s) => {
      const xml = await cached(root.src, `${root.dir}section_ta${s.url}`, !refresh);
      const sec = parser.parse(xml).SECTION_TA;
      await walk(root, sec.STRUCTURE_TA, [...crumbs, htmlToText(String(sec.TITRE_TA ?? s["#text"] ?? "")).replace(/\s+/g, " ")]);
    }));
  }
  await Promise.all(roots.map((r) => walk(r, r.node, r.crumbs)));

  let done = 0;
  const rows = await Promise.all(artLinks.map(async ({ link, crumbs, root }) => {
    const base = kali ? "KALI" : "LEGI";
    const xml = await cached(root.src, `${root.dir}article/${base}/ARTI/${idDirs(link.id)}/${link.id}.xml`);
    const art = parser.parse(xml).ARTICLE;
    const meta = art.META.META_SPEC.META_ARTICLE;
    if (++done % 1000 === 0) console.log(`  ${slug}: ${done}/${artLinks.length}`);
    const title = kali && meta.TITRE ? [htmlToText(String(meta.TITRE))] : [];
    return {
      id: link.id,
      code: slug,
      num: String(meta.NUM || link.num || "").replace(/\*/g, ""), // "R*421-14" (décret en CE marker) -> "R421-14"
      section: [...crumbs, ...title].join(" > "),
      texte: htmlToText(String(art.BLOC_TEXTUEL?.CONTENU ?? "")),
      date_debut: meta.DATE_DEBUT,
      url: kali
        ? `https://www.legifrance.gouv.fr/conv_coll/article/${link.id}`
        : `https://www.legifrance.gouv.fr/${slug === "loi-89-462" ? "loda" : "codes"}/article_lc/${link.id}`,
      etat: String(meta.ETAT),
    };
  }));
  const skipped = rows.filter((r) => !vigueur(r.etat)).length;
  if (skipped) console.log(`  ${slug}: ${skipped} linked articles not in force in their own metadata, skipped`);
  return rows.filter((r) => vigueur(r.etat)).map((r) => ({ ...r, etat: undefined }));
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
    // A KALI text can be attached to several IDCC (e.g. bâtiment 1596/1597): first code ingested keeps it.
    // ponytail: articles.id is the PK, so shared texts live under one slug only.
    const owner = db.prepare("SELECT code FROM articles WHERE id = ?");
    const unique = [...new Map(rows.map((r) => [r.id, r])).values()].filter((r) => {
      const o = owner.get(r.id) as { code: string } | undefined;
      return !o || o.code === slug;
    });
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
