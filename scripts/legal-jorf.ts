// Journal officiel → legal graph. npm run legal-jorf [-- --links] [--meta] [--decisions] [--refresh]  (no flag = all three)
//  --links      LEGI/KALI article XML cached under data/raw (scripts/ingest.ts) → jorf_texts + jorf_article_links.
//               Local, no network: each article lists the JORF texts that created, modified, repealed, codified or cite it.
//  --meta       Official JORF metadata per text (full title, JO issue, publication date, NOR, ELI) from the DILA JORF dump,
//               via the daily git mirror (same files as echanges.dila.gouv.fr/OPENDATA/JORF). Reads each file only up to
//               </TITREFULL>. Only texts not fetched yet, unless --refresh.
//  --decisions  "loi n° …" / "décret n° …" mentions in decisions, resolved against jorf_texts → jorf_decision_links.
export {}; // every script declares its own main()
import fs from "node:fs";
import path from "node:path";
try { process.loadEnvFile(); } catch { /* no .env */ }

const EXTRACTOR_VERSION = "legal-jorf/1";
const MIRROR = "https://git.tricoteuses.fr/dila/jorf/raw/branch/main/global/texte/version";
const argv = process.argv.slice(2);
const all = !argv.some((a) => ["--links", "--meta", "--decisions"].includes(a));
const want = (f: string) => all || argv.includes(f);

function* xmlFiles(dir: string, re: RegExp): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* xmlFiles(p, re);
    else if (re.test(e.name)) yield p;
  }
}

const jorfPath = (id: string) => {
  const d = id.slice(8); // JORFTEXT000051538879 → 0000/51/53/88 path segments of 2 digits
  return `JORF/TEXT/${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(8, 10)}/${id}.xml`;
};

/** Head of a JORF version file, up to the end of its metadata (the body can weigh megabytes). */
async function fetchHead(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" } });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let head = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (value) head += dec.decode(value, { stream: true });
        if (done || /<\/TITREFULL>|<\/META>/.test(head) || head.length > 400_000) break;
      }
      await reader.cancel().catch(() => {});
      return head;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function main() {
  const { getDb } = await import("../src/lib/db");
  const J = await import("../src/lib/jorf");
  const db = getDb();

  if (want("--links")) {
    const t = Date.now();
    const known = new Set((db.prepare("SELECT id FROM articles").all() as { id: string }[]).map((r) => r.id));
    const upText = db.prepare(
      `INSERT INTO jorf_texts (id, nature, num, nor, date_texte, titre) VALUES (@id, @nature, @num, @nor, @date, @titre)
       ON CONFLICT(id) DO UPDATE SET nature = COALESCE(jorf_texts.nature, excluded.nature), num = COALESCE(jorf_texts.num, excluded.num),
         nor = COALESCE(jorf_texts.nor, excluded.nor), date_texte = COALESCE(jorf_texts.date_texte, excluded.date_texte)`,
    );
    const link = db.prepare("INSERT OR IGNORE INTO jorf_article_links (article_id, jorf_text_id, jorf_article, relation) VALUES (?, ?, ?, ?)");
    let files = 0, linked = 0;
    const batch: { id: string; links: ReturnType<typeof J.parseJorfLinks> }[] = [];
    const flush = () => db.transaction(() => {
      for (const { id, links } of batch.splice(0)) for (const l of links) {
        upText.run({ id: l.cid, nature: l.nature || null, num: l.num || null, nor: l.nor || null, date: l.date || null, titre: J.shortTitle(l) });
        link.run(id, l.cid, l.article, l.relation);
      }
    })();
    db.exec("DELETE FROM jorf_article_links"); // derived from the cache: rebuilt whole
    for (const dir of ["legi", "kali"]) {
      for (const f of xmlFiles(path.join(process.cwd(), "data", "raw", dir), /^(LEGI|KALI)ARTI\d+\.xml$/)) {
        const id = path.basename(f, ".xml");
        files++;
        if (!known.has(id)) continue; // only article versions Loilà carries
        const links = J.parseJorfLinks(fs.readFileSync(f, "utf8"));
        if (!links.length) continue;
        linked++;
        batch.push({ id, links });
        if (batch.length >= 2000) flush();
      }
    }
    flush();
    const n = db.prepare("SELECT (SELECT COUNT(*) FROM jorf_texts) texts, (SELECT COUNT(*) FROM jorf_article_links) links").get() as { texts: number; links: number };
    console.log(`[jorf] links: ${files} files, ${linked} articles linked · ${n.texts} JORF texts · ${n.links} edges · ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }

  if (want("--meta")) {
    const t = Date.now();
    const todo = (db.prepare(`SELECT id FROM jorf_texts ${argv.includes("--refresh") ? "" : "WHERE fetched_at IS NULL"} ORDER BY id`).all() as { id: string }[]).map((r) => r.id);
    const tag = (x: string, k: string) => x.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1]?.trim() || null;
    const up = db.prepare(
      `UPDATE jorf_texts SET nature = COALESCE(@nature, nature), num = COALESCE(@num, num), nor = COALESCE(@nor, nor),
         date_texte = COALESCE(@date_texte, date_texte), date_publi = @date_publi, jo = @jo, titre = COALESCE(@titre, titre),
         titre_full = @titre_full, eli = @eli, fetched_at = unixepoch() WHERE id = @id`,
    );
    const missing = db.prepare("UPDATE jorf_texts SET fetched_at = 0 WHERE id = ?");
    const prov = db.prepare(
      `INSERT OR REPLACE INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, mirror, extractor, extractor_version)
       VALUES ('jorf_text', ?, 'JORF', 'DILA', ?, ?, 1, 'legal-jorf', ?)`,
    );
    let i = 0, ok = 0, miss = 0, failed = 0;
    await Promise.all(Array.from({ length: 16 }, async () => {
      while (i < todo.length) {
        const id = todo[i++];
        const url = `${MIRROR}/${jorfPath(id)}`;
        try {
          const x = await fetchHead(url);
          if (!x) { missing.run(id); miss++; continue; }
          const nature = tag(x, "NATURE"), num = tag(x, "NUM"), dateTexte = tag(x, "DATE_TEXTE")?.replace(/^2999.*/, "") || null;
          const raw = tag(x, "TITRE") ?? "";
          const titre = raw ? J.shortTitle({ nature: nature ?? "", num: num ?? "", date: dateTexte ?? "", label: raw }) : null;
          up.run({
            id, nature, num, nor: tag(x, "NOR"), date_texte: dateTexte,
            date_publi: tag(x, "DATE_PUBLI")?.replace(/^2999.*/, "") || null, jo: tag(x, "ORIGINE_PUBLI"),
            titre,
            titre_full: tag(x, "TITREFULL")?.replace(/\s*\(\d+\)\s*$/, "") ?? null, eli: tag(x, "ID_ELI"),
          });
          prov.run(id, url, `texte/version/${jorfPath(id)}`, EXTRACTOR_VERSION);
          ok++;
        } catch (e) {
          failed++;
          if (failed <= 5) console.error(`[jorf] ${id}: ${e instanceof Error ? e.message : e}`);
        }
        if ((ok + miss + failed) % 2000 === 0) console.log(`[jorf] meta ${ok + miss + failed}/${todo.length}`);
      }
    }));
    console.log(`[jorf] meta: ${ok} fetched, ${miss} absent from the JORF dump, ${failed} failed · ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }

  if (want("--decisions")) {
    const t = Date.now();
    const byNum = new Map<string, { id: string; nature: string | null }[]>();
    for (const r of db.prepare("SELECT id, nature, num FROM jorf_texts WHERE num IS NOT NULL").all() as { id: string; nature: string | null; num: string }[]) {
      byNum.set(r.num, [...(byNum.get(r.num) ?? []), r]);
    }
    const ins = db.prepare("INSERT INTO jorf_decision_links (decision_id, jorf_text_id, mentions) VALUES (?, ?, ?)");
    // Collect first: better-sqlite3 cannot write while an iterator is open on the same connection.
    const pairs: [string, string, number][] = [];
    const cited = new Set<string>();
    for (const d of db.prepare("SELECT id, COALESCE(sommaire, '') || ' ' || COALESCE(texte, '') AS t FROM decisions").iterate() as Iterable<{ id: string; t: string }>) {
      for (const [jid, n] of J.resolveLawRefs(d.t, byNum)) { pairs.push([d.id, jid, n]); cited.add(d.id); }
    }
    db.transaction(() => {
      db.exec("DELETE FROM jorf_decision_links");
      for (const p of pairs) ins.run(...p);
    })();
    const decisions = cited.size, edges = pairs.length;
    console.log(`[jorf] decisions: ${decisions} decisions cite ${edges} (decision, text) pairs · ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
