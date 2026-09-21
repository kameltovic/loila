// Case law from DILA open data into the legal knowledge graph (decisions, citations, relations, provenance).
// npx tsx scripts/ingest-juri.ts [--source cass] [--since 2017-01-01] [--dry-run] [--force]
//
// Per corpus: official "Freemium" archive → data/raw/juri/<source>.tar.gz → extracted once → every decision parsed.
// Idempotent and resumable: a decision whose raw file checksum and extractor version are unchanged is skipped
// (--force re-extracts all). Kept: decisions since --since with at least one reference to a code Loilà carries.
// Citations (resolved or not) go to `citations` (decision_articles is their resolved projection), relations to
// `decision_relations`, origin to `provenance`. Dedup across corpora by ECLI (the extra origin is still recorded).
// ponytail: recent decisions only by default: before the 2008/2016 renumberings an article number means another
// article (legal-refs.ts renumberedAt handles it, but older corpora add volume for little SEO value).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

try { process.loadEnvFile(); } catch { /* no .env */ }

/** One decision, whatever the corpus. */
export type DecisionRecord = {
  id: string; juridiction: string; formation: string; date: string; numeros: string[]; solution: string; titre: string;
  ecli: string; publie: number; sommaire: string; texte: string; liens: string; attaquee?: { juridiction?: string; date?: string };
};

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
const tag = (xml: string, t: string) => xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "";

/** Judicial format TEXTE_JURI_JUDI (CASS, INCA, CAPP). */
export function parseJudi(xml: string): DecisionRecord {
  return {
    id: tag(xml, "ID"),
    juridiction: decode(tag(xml, "JURIDICTION")),
    formation: decode(tag(xml, "FORMATION")),
    date: tag(xml, "DATE_DEC"),
    numeros: [...xml.matchAll(/<NUMERO_AFFAIRE>([^<]*)<\/NUMERO_AFFAIRE>/g)].map((m) => decode(m[1])).filter(Boolean),
    solution: decode(tag(xml, "SOLUTION")),
    titre: decode(tag(xml, "TITRE")),
    ecli: decode(tag(xml, "ECLI")),
    publie: /<PUBLI_BULL[^>]*publie="oui"/.test(xml) ? 1 : 0,
    sommaire: [...xml.matchAll(/<ANA[^>]*>([\s\S]*?)<\/ANA>/g)].map((m) => decode(m[1])).filter(Boolean).join("\n\n"),
    texte: decode(tag(xml, "CONTENU")),
    liens: [...xml.matchAll(/<LIEN [^>]*>([^<]*)<\/LIEN>/g)].map((m) => decode(m[1])).join("\n"),
    attaquee: { juridiction: decode(tag(xml, "FORM_DEC_ATT")) || undefined, date: tag(xml, "DATE_DEC_ATT") || undefined },
  };
}

/** Administrative format TEXTE_JURI_ADMIN (JADE: Conseil d'État, CAA, TA). */
export function parseAdmin(xml: string): DecisionRecord {
  const recueil = tag(xml, "PUBLI_RECUEIL").trim().toUpperCase();
  return {
    id: tag(xml, "ID"),
    juridiction: decode(tag(xml, "JURIDICTION")),
    formation: decode(tag(xml, "FORMATION")),
    date: tag(xml, "DATE_DEC"),
    numeros: [decode(tag(xml, "NUMERO"))].filter(Boolean),
    solution: decode(tag(xml, "SOLUTION")),
    titre: decode(tag(xml, "TITRE")),
    ecli: decode(tag(xml, "ECLI")),
    publie: recueil === "A" || recueil === "B" ? 1 : 0, // A: published in the Recueil, B: mentioned in its tables
    sommaire: [...xml.matchAll(/<(?:SCT|ANA)[^>]*>([\s\S]*?)<\/(?:SCT|ANA)>/g)].map((m) => decode(m[1])).filter(Boolean).join("\n\n"),
    texte: decode(tag(xml, "CONTENU")),
    liens: [...xml.matchAll(/<LIEN [^>]*>([^<]*)<\/LIEN>/g)].map((m) => decode(m[1])).join("\n"),
  };
}

/** Conseil constitutionnel TEXTE_JURI_CONSTIT: the nature (DC, QPC…) goes in formation. */
export function parseConstit(xml: string): DecisionRecord {
  return {
    id: tag(xml, "ID"),
    juridiction: "Conseil constitutionnel",
    formation: decode(tag(xml, "NATURE")),
    date: tag(xml, "DATE_DEC"),
    numeros: [decode(tag(xml, "NUMERO"))].filter(Boolean),
    solution: decode(tag(xml, "SOLUTION")),
    titre: decode(tag(xml, "TITRE")),
    ecli: decode(tag(xml, "ECLI")),
    publie: 1, // all published in the Journal officiel
    sommaire: "",
    texte: decode(tag(xml, "CONTENU")),
    liens: [...xml.matchAll(/<LIEN [^>]*>([^<]*)<\/LIEN>/g)].map((m) => decode(m[1])).join("\n"),
  };
}

const DILA = "https://echanges.dila.gouv.fr/OPENDATA";
const legifrance = (kind: string) => (id: string) => `https://www.legifrance.gouv.fr/${kind}/id/${id}`;
const always = () => true;
// Corpus adapters. Order of import recommended by the corpus report: CONSTIT → INCA → JADE → CAPP.
const CORPORA = {
  cass: { dataset: "CASS", url: `${DILA}/CASS/Freemium_cass_global_20250713-140000.tar.gz`, parse: parseJudi, url_of: legifrance("juri"), keep: always },
  // Unpublished Cassation rulings: withdrawals and "non-lieu" carry no rule.
  inca: { dataset: "INCA", url: `${DILA}/INCA/Freemium_inca_global_20250713-140000.tar.gz`, parse: parseJudi, url_of: legifrance("juri"), keep: (r: DecisionRecord) => !/désistement|non-lieu/i.test(r.solution) },
  capp: { dataset: "CAPP", url: `${DILA}/CAPP/Freemium_capp_global_20250713-140000.tar.gz`, parse: parseJudi, url_of: legifrance("juri"), keep: always },
  jade: { dataset: "JADE", url: `${DILA}/JADE/Freemium_jade_global_20250713-140000.tar.gz`, parse: parseAdmin, url_of: legifrance("ceta"), keep: always },
  // Only constitutional review (DC, QPC): election litigation is 57 % of the corpus and useless for Loilà.
  constit: { dataset: "CONSTIT", url: `${DILA}/CONSTIT/Freemium_constit_global_20250713-140000.tar.gz`, parse: parseConstit, url_of: legifrance("cons"), keep: (r: DecisionRecord) => /^(DC|QPC)$/i.test(r.formation) },
} as const;
type Corpus = keyof typeof CORPORA;

const EXTRACTOR = "scripts/ingest-juri.ts";

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { EXTRACTOR_VERSION, isCarried } = await import("../src/lib/legal-refs");
  const G = await import("../src/lib/legal-graph");
  const argv = process.argv.slice(2);
  const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const source = opt("source", "cass") as Corpus;
  const corpus = CORPORA[source];
  if (!corpus) throw new Error(`unknown source ${source} (known: ${Object.keys(CORPORA).join(", ")})`);
  const since = opt("since", "2017-01-01");
  // --archive <url>: use another archive of the same corpus (e.g. a small daily increment for a dry run).
  const archiveUrl = opt("archive", corpus.url);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");

  const dir = path.join(process.cwd(), "data", "raw", "juri");
  const custom = archiveUrl !== corpus.url;
  const archive = path.join(dir, custom ? path.basename(archiveUrl) : `${source}.tar.gz`);
  const out = path.join(dir, custom ? path.basename(archiveUrl, ".tar.gz") : source);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(archive)) {
    console.log(`Downloading ${archiveUrl}…`);
    const res = await fetch(archiveUrl);
    if (!res.ok || !res.body) throw new Error(`DILA ${res.status}`);
    // Streamed to disk (JADE is 1.2 GB): never held in memory; ".part" until complete, so a crash can't leave a truncated archive.
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), fs.createWriteStream(`${archive}.part`));
    fs.renameSync(`${archive}.part`, archive);
  }
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out);
    execFileSync("tar", ["-xzf", archive, "-C", out]);
  }

  const db = getDb();
  G.syncCodes(db);
  G.backfillArticles(db);
  const resolve = G.articleResolver(db);
  const known = db.prepare("SELECT checksum, extractor_version FROM decisions WHERE id = ?");
  const byEcli = db.prepare("SELECT id FROM decisions WHERE ecli = ? AND id <> ?");
  const upsert = db.prepare(
    `INSERT INTO decisions (id, source, juridiction, formation, date, numero, solution, titre, ecli, publie, sommaire, texte, url, checksum, extractor_version, liens, attaquee_juridiction, attaquee_date)
     VALUES (@id, @source, @juridiction, @formation, @date, @numero, @solution, @titre, @ecli, @publie, @sommaire, @texte, @url, @checksum, @extractor_version, @liens, @attaquee_juridiction, @attaquee_date)
     ON CONFLICT(id) DO UPDATE SET juridiction = excluded.juridiction, formation = excluded.formation, date = excluded.date, numero = excluded.numero,
       solution = excluded.solution, titre = excluded.titre, ecli = excluded.ecli, publie = excluded.publie, sommaire = excluded.sommaire,
       texte = excluded.texte, url = excluded.url, checksum = excluded.checksum, extractor_version = excluded.extractor_version,
       liens = excluded.liens, attaquee_juridiction = excluded.attaquee_juridiction, attaquee_date = excluded.attaquee_date`,
  );
  const prov = db.prepare(
    `INSERT INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, mirror, raw_checksum, extractor, extractor_version)
     VALUES ('decision', ?, ?, 'DILA', ?, ?, 0, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id, dataset, origin_url) DO UPDATE SET origin_ref = excluded.origin_ref, raw_checksum = excluded.raw_checksum,
       extractor_version = excluded.extractor_version, verified_at = unixepoch()`,
  );
  const touch = db.prepare("UPDATE provenance SET verified_at = unixepoch() WHERE entity_type = 'decision' AND entity_id = ? AND dataset = ?");
  const delNums = db.prepare("DELETE FROM decision_numbers WHERE decision_id = ?");
  const insNum = db.prepare("INSERT OR IGNORE INTO decision_numbers (decision_id, numero) VALUES (?, ?)");

  const files = (fs.readdirSync(out, { recursive: true }) as string[]).filter((f) => /(?:JURI|CETA|CONS)TEXT\d+\.xml$/.test(f)).sort();
  const stats = { files: files.length, recent: 0, unchanged: 0, updated: 0, created: 0, skippedNoRef: 0, duplicates: 0, duplicateFiles: 0, filtered: 0, citations: 0, byStatus: {} as Record<string, number> };
  const seen = new Set<string>();
  type Work = { rec: DecisionRecord; rel: string; raw: string; sum: string; isNew: boolean };
  let batch: Work[] = [];
  const flush = db.transaction((items: Work[]) => {
    for (const { rec, rel, sum } of items) {
      upsert.run({
        id: rec.id, source, juridiction: rec.juridiction, formation: rec.formation, date: rec.date, numero: rec.numeros[0] ?? null,
        solution: rec.solution, titre: rec.titre, ecli: rec.ecli, publie: rec.publie, sommaire: rec.sommaire, texte: rec.texte,
        url: corpus.url_of(rec.id), checksum: sum, extractor_version: EXTRACTOR_VERSION,
        liens: rec.liens, attaquee_juridiction: rec.attaquee?.juridiction ?? null, attaquee_date: rec.attaquee?.date ?? null,
      });
      prov.run(rec.id, corpus.dataset, archiveUrl, rel, sum, EXTRACTOR, EXTRACTOR_VERSION);
      delNums.run(rec.id);
      for (const n of rec.numeros) insNum.run(rec.id, G.normalizePourvoi(n));
      G.saveCitations(db, rec.id, G.extractCitations({ id: rec.id, date: rec.date, sommaire: rec.sommaire, texte: rec.texte, liens: rec.liens }, resolve));
    }
  });

  for (const rel of files) {
    const raw = fs.readFileSync(path.join(out, rel), "utf8");
    const date = tag(raw, "DATE_DEC");
    if (date < since) continue;
    stats.recent++;
    const rec = corpus.parse(raw);
    if (!corpus.keep(rec)) {
      stats.filtered++;
      continue;
    }
    // The archive sometimes holds the same decision in two folders: first path (sorted) wins, deterministic.
    if (seen.has(rec.id)) {
      stats.duplicateFiles++;
      continue;
    }
    seen.add(rec.id);
    const sum = G.sha256(raw);
    const prev = known.get(rec.id) as { checksum: string | null; extractor_version: string | null } | undefined;
    if (!force && prev?.checksum === sum && prev.extractor_version === EXTRACTOR_VERSION) {
      stats.unchanged++;
      if (!dryRun) touch.run(rec.id, corpus.dataset);
      continue;
    }
    // Same decision already imported from another corpus: keep one row, record this origin too.
    const dup = rec.ecli && (byEcli.get(rec.ecli, rec.id) as { id: string } | undefined);
    if (dup) {
      stats.duplicates++;
      if (!dryRun) prov.run(dup.id, corpus.dataset, archiveUrl, rel, sum, EXTRACTOR, EXTRACTOR_VERSION);
      continue;
    }
    const cites = G.extractCitations({ id: rec.id, date: rec.date, sommaire: rec.sommaire, texte: rec.texte, liens: rec.liens }, resolve);
    if (!cites.some((c) => c.code_id && isCarried(c.code_id))) {
      stats.skippedNoRef++;
      continue;
    }
    stats.citations += cites.length;
    for (const c of cites) stats.byStatus[c.status] = (stats.byStatus[c.status] ?? 0) + 1;
    if (prev) stats.updated++;
    else stats.created++;
    batch.push({ rec, rel, raw, sum, isNew: !prev });
    if (!dryRun && batch.length >= 300) { flush(batch); batch = []; }
  }
  if (!dryRun && batch.length) flush(batch);

  // Relations needing the whole set (explicit citations, same case), recomputed from the DB.
  if (!dryRun) G.rebuildDecisionRelations(db);

  // Upstream deletions are reported, never applied silently.
  // Only a global archive is complete: an increment says nothing about what disappeared.
  const missing = custom ? [] : (db.prepare("SELECT id FROM decisions WHERE source = ? AND date >= ?").all(source, since) as { id: string }[]).filter((r) => !seen.has(r.id));
  console.log(`${source}: ${stats.files} files, ${stats.recent} since ${since}, ${stats.filtered} filtered out by the corpus rule · created ${stats.created}, updated ${stats.updated}, unchanged ${stats.unchanged}, no reference ${stats.skippedNoRef}, ECLI duplicates ${stats.duplicates}, same decision twice in the archive ${stats.duplicateFiles}`);
  console.log(`citations extracted: ${stats.citations} · by status: ${JSON.stringify(stats.byStatus)}`);
  console.log(`in Loilà but not in this archive anymore (review, not deleted): ${missing.length}${dryRun ? " · dry run, nothing written" : ""}`);
}

if (process.argv[1]?.endsWith("ingest-juri.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
