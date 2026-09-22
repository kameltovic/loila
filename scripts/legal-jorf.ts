// Journal officiel → legal graph. npm run legal-jorf [-- --links] [--meta] [--decisions] [--refresh]  (no flag = these three)
// Full JORF index: npm run legal-jorf -- --archive --decisions
//  --links      LEGI/KALI article XML cached under data/raw (scripts/ingest.ts) → jorf_texts + jorf_article_links.
//               Local, no network: each article lists the JORF texts that created, modified, repealed, codified or cite it.
//  --meta       Official JORF metadata per text (full title, JO issue, publication date, NOR, ELI) from the DILA JORF dump,
//               via the daily git mirror (same files as echanges.dila.gouv.fr/OPENDATA/JORF). Reads each file only up to
//               </TITREFULL>. Only texts not fetched yet, unless --refresh.
//  --decisions  "loi n° …" / "décret n° …" mentions in decisions, resolved against jorf_texts → jorf_decision_links.
//  --archive    (opt-in) every loi, ordonnance and décret from the official DILA archive (echanges.dila.gouv.fr/OPENDATA/JORF:
//               global dump + daily increments, streamed, ≈ 3.7 GB, no disk). --increments-since YYYYMMDD: increments only.
export {}; // every script declares its own main()
import fs from "node:fs";
import path from "node:path";
try { process.loadEnvFile(); } catch { /* no .env */ }

const EXTRACTOR_VERSION = "legal-jorf/1";
const MIRROR = "https://git.tricoteuses.fr/dila/jorf/raw/branch/main/global/texte/version";
const argv = process.argv.slice(2);
const all = !argv.some((a) => ["--links", "--meta", "--decisions", "--archive", "--increments-since"].includes(a));
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

/**
 * Stream a .tar.gz over HTTP and hand each regular file whose path matches `want` to `onFile` with its first
 * `headBytes` bytes. Nothing is written to disk; a minimal ustar/GNU/pax reader (no dependency).
 */
async function streamTarGz(url: string, want: RegExp, headBytes: number, onFile: (name: string, head: string) => void) {
  const zlib = await import("node:zlib");
  const { Readable } = await import("node:stream");
  const res = await fetch(url, { headers: { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} on ${url}`);
  const gz = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(zlib.createGunzip());
  type Entry = { name: string; type: string; left: number; keep: boolean; head: Buffer[]; got: number };
  let pending = Buffer.alloc(0);
  let cur: Entry | null = null;
  let longName: string | null = null;
  const str = (h: Buffer, a: number, b: number) => h.subarray(a, b).toString("utf8").replace(/\0[\s\S]*$/, "");
  for await (const chunk of gz as AsyncIterable<Buffer>) {
    const buf = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    let off = 0;
    for (;;) {
      if (!cur) {
        if (buf.length - off < 512) break;
        const h = buf.subarray(off, off + 512);
        off += 512;
        if (h[0] === 0) continue; // end-of-archive padding
        const size = parseInt(str(h, 124, 136).trim() || "0", 8);
        const type = String.fromCharCode(h[156] || 48);
        const name: string = longName ?? (str(h, 345, 500) ? `${str(h, 345, 500)}/${str(h, 0, 100)}` : str(h, 0, 100));
        longName = null;
        const meta = type === "L" || type === "x"; // GNU long name / pax header: read whole, applies to the next entry
        cur = { name, type, left: size + ((512 - (size % 512)) % 512), keep: meta || ((type === "0" || type === "\0") && want.test(name)), head: [], got: 0 };
        if (meta) cur.keep = true;
        continue;
      }
      const take = Math.min(cur.left, buf.length - off);
      const limit = cur.type === "L" || cur.type === "x" ? Infinity : headBytes;
      if (cur.keep && cur.got < limit) {
        const part = buf.subarray(off, off + Math.min(take, limit - cur.got));
        cur.head.push(Buffer.from(part));
        cur.got += part.length;
      }
      off += take;
      cur.left -= take;
      if (cur.left > 0) break;
      const body: string = cur.keep ? Buffer.concat(cur.head).toString("utf8").replace(/\0+$/, "") : "";
      if (cur.type === "L") longName = body.replace(/\0[\s\S]*$/, "");
      else if (cur.type === "x") longName = body.match(/\d+ path=([^\n]*)\n/)?.[1] ?? null;
      else if (cur.keep) onFile(cur.name, body);
      cur = null;
    }
    pending = Buffer.from(buf.subarray(off));
  }
}

const tag = (x: string, k: string) => x.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1]?.trim() || null;
const noDate = (d: string | null) => (d && !d.startsWith("2999") ? d : null);

/** Metadata of a JORF TEXTE_VERSION head (up to </TITREFULL>). */
function parseMeta(x: string, shortTitle: (l: { nature: string; num: string; date: string; label: string }) => string) {
  const nature = tag(x, "NATURE"), num = tag(x, "NUM"), date_texte = noDate(tag(x, "DATE_TEXTE"));
  const raw = tag(x, "TITRE") ?? "";
  return {
    nature, num, nor: tag(x, "NOR"), date_texte, date_publi: noDate(tag(x, "DATE_PUBLI")), jo: tag(x, "ORIGINE_PUBLI"),
    titre: raw ? shortTitle({ nature: nature ?? "", num: num ?? "", date: date_texte ?? "", label: raw }) : null,
    titre_full: tag(x, "TITREFULL")?.replace(/\s*\(\d+\)\s*$/, "") ?? null, eli: tag(x, "ID_ELI"),
  };
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
          up.run({ id, ...parseMeta(x, J.shortTitle) });
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

  // Every loi, ordonnance and décret of the JORF (plus the texts already linked), from the official DILA archive:
  // the global dump, then the daily increments published since. Heavy (≈ 3.7 GB streamed): opt-in, never in "all".
  // --increments-since YYYYMMDD skips the global dump (periodic refresh).
  if (argv.includes("--archive") || argv.includes("--increments-since")) {
    const t = Date.now();
    const BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/";
    const listing = await (await fetch(BASE)).text();
    const global = [...listing.matchAll(/href="(Freemium_jorf_global_(\d{8})-\d{6}\.tar\.gz)"/g)].map((m) => ({ file: m[1], day: m[2] })).sort((a, b) => a.day.localeCompare(b.day)).at(-1);
    const since = argv[argv.indexOf("--increments-since") + 1] ?? (global?.day ?? "99999999");
    const increments = [...listing.matchAll(/href="(JORF_(\d{8})-\d{6}\.tar\.gz)"/g)].map((m) => ({ file: m[1], day: m[2] })).filter((f) => f.day > since).sort((a, b) => a.file.localeCompare(b.file));
    const files = [...(argv.includes("--archive") && global ? [global] : []), ...increments];
    const KEEP = new Set(["LOI", "LOI_ORGANIQUE", "LOI_CONSTIT", "LOI_PROGRAMME", "ORDONNANCE", "DECRET", "DECRET_LOI"]);
    const known = new Set((db.prepare("SELECT id FROM jorf_texts").all() as { id: string }[]).map((r) => r.id));
    const up = db.prepare(
      `INSERT INTO jorf_texts (id, nature, num, nor, date_texte, date_publi, jo, titre, titre_full, eli, fetched_at)
       VALUES (@id, @nature, @num, @nor, @date_texte, @date_publi, @jo, @titre, @titre_full, @eli, unixepoch())
       ON CONFLICT(id) DO UPDATE SET nature = COALESCE(excluded.nature, nature), num = COALESCE(excluded.num, num), nor = COALESCE(excluded.nor, nor),
         date_texte = COALESCE(excluded.date_texte, date_texte), date_publi = COALESCE(excluded.date_publi, date_publi), jo = COALESCE(excluded.jo, jo),
         titre = excluded.titre, titre_full = COALESCE(excluded.titre_full, titre_full), eli = COALESCE(excluded.eli, eli), fetched_at = unixepoch()`,
    );
    const prov = db.prepare(
      `INSERT OR REPLACE INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, mirror, extractor, extractor_version)
       VALUES ('jorf_text', ?, 'JORF', 'DILA', ?, ?, 0, 'legal-jorf', ?)`,
    );
    let seen = 0, kept = 0, added = 0;
    for (const f of files) {
      const url = BASE + f.file;
      const rows: { id: string; path: string; meta: ReturnType<typeof parseMeta> }[] = [];
      const flush = () => db.transaction(() => {
        for (const r of rows.splice(0)) {
          if (!known.has(r.id)) { known.add(r.id); added++; }
          up.run({ id: r.id, ...r.meta, titre: r.meta.titre ?? r.id });
          prov.run(r.id, url, r.path, EXTRACTOR_VERSION);
        }
      })();
      for (let attempt = 0; ; attempt++) {
        try {
          await streamTarGz(url, /texte\/version\/JORF\/TEXT\/.*JORFTEXT\d{12}\.xml$/, 64 * 1024, (name, head) => {
            seen++;
            const id = name.match(/(JORFTEXT\d{12})\.xml$/)![1];
            const meta = parseMeta(head, J.shortTitle);
            // Numbered texts only: unnumbered décrets are individual measures (nominations, naturalisations) naming people.
            if (!known.has(id) && (!KEEP.has(meta.nature ?? "") || !meta.num)) return;
            kept++;
            rows.push({ id, path: name, meta });
            if (rows.length >= 5000) flush();
          });
          break;
        } catch (e) {
          if (attempt >= 2) throw e; // a stream cut mid-way: the upserts are idempotent, start the file over
          console.error(`[jorf] ${f.file}: ${e instanceof Error ? e.message : e}, retrying`);
        }
      }
      flush();
      if (f === global || increments.indexOf(f) % 50 === 0) console.log(`[jorf] archive ${f.file}: ${seen} versions read, ${kept} kept, ${added} new texts · ${((Date.now() - t) / 60000).toFixed(1)} min`);
    }
    console.log(`[jorf] archive: ${files.length} files, ${seen} text versions read, ${added} texts added · ${((Date.now() - t) / 60000).toFixed(1)} min`);
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
