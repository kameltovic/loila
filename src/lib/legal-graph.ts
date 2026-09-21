// Legal knowledge graph: deterministic builders over the tables declared in db.ts (legal_codes, provenance,
// citations, decision_relations, article_relations, article_stats…). No LLM here: every row is derived from
// official data with a documented method, and keeps its provenance.
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { CODES } from "./themes";
import { EXTRACTOR_VERSION, LINK_CONFIDENCE, appliesOldCivilLaw, inCivilReformRange, normalizeNum, parseRefs, type ParsedRef } from "./legal-refs";

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

// ---------- Codes & articles ----------

const codeKind = (slug: string) => (slug.startsWith("ccn-") ? "convention" : slug.startsWith("loi-") ? "loi" : slug.startsWith("decret-") ? "decret" : "code");

/** legal_codes mirrors themes.ts CODES (the single source of truth for which texts Loilà carries). */
export function syncCodes(db: Database.Database) {
  const up = db.prepare(
    `INSERT INTO legal_codes (id, name, kind, official_id, source) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, official_id = excluded.official_id, source = excluded.source`,
  );
  db.transaction(() => {
    for (const [slug, c] of Object.entries(CODES)) up.run(slug, c.name, codeKind(slug), c.legitext, slug.startsWith("ccn-") ? "KALI" : "LEGI");
  })();
}

const LEGACY_MIRRORS = {
  LEGI: "https://git.tricoteuses.fr/dila/legi",
  KALI: "https://git.tricoteuses.fr/dila/kali",
};

/**
 * Fills the graph columns of articles imported before them (num_norm, checksum, etat, source) and records their
 * provenance honestly: legacy import from the tricoteuses.fr mirror of DILA LEGI/KALI, raw checksum not kept.
 */
export function backfillArticles(db: Database.Database) {
  const rows = db.prepare("SELECT id, code, num, texte, num_norm, checksum FROM articles").all() as { id: string; code: string; num: string; texte: string; num_norm: string | null; checksum: string | null }[];
  const upd = db.prepare("UPDATE articles SET num_norm = ?, checksum = ?, etat = COALESCE(etat, 'VIGUEUR'), source = COALESCE(source, ?) WHERE id = ?");
  const prov = db.prepare(
    `INSERT OR IGNORE INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, mirror, raw_checksum, extractor, extractor_version)
     VALUES ('article', ?, ?, 'DILA', ?, ?, 1, NULL, 'scripts/ingest.ts', 'legacy')`,
  );
  let changed = 0;
  db.transaction(() => {
    for (const a of rows) {
      const dataset = a.code.startsWith("ccn-") ? "KALI" : "LEGI";
      const norm = normalizeNum(a.num);
      const sum = sha256(a.texte);
      if (a.num_norm !== norm || a.checksum !== sum) {
        upd.run(norm, sum, dataset, a.id);
        changed++;
      }
      prov.run(a.id, dataset, LEGACY_MIRRORS[dataset], a.id);
    }
  })();
  return { articles: rows.length, changed };
}

// ---------- Decision → article citations ----------

export type Segment = { location: string; start: number };
const MARKERS: [RegExp, string][] = [
  [/Faits et procédure/gi, "faits"],
  // Annexed grounds come after the operative part ("MOYENS ANNEXES au présent arrêt", "Moyen produit par la SCP…").
  [/(?:Examen|Enoncé|Énoncé) d(?:u|es) moyens?|Sur le (?:premier |second |deuxième |troisième )?moyen|moyens?\s+annex[eé]s?\s+au|moyens?\s+produits?\s+(?:au|par)/gi, "moyen"],
  [/Réponse de la Cour|Motivation/gi, "motifs"],
  [/PAR CES MOTIFS/g, "dispositif"],
];

/** Where each part of a decision starts (by its official headings), in text order; before any heading: "texte". */
export function segments(texte: string): Segment[] {
  const found: Segment[] = [{ location: "texte", start: 0 }];
  for (const [re, location] of MARKERS) for (const m of texte.matchAll(re)) found.push({ location, start: m.index });
  return found.sort((a, b) => a.start - b.start);
}

function locationAt(texte: string, segs: Segment[], index: number) {
  // A "Vu l'article …" sentence is a visa wherever it appears.
  const lineStart = texte.lastIndexOf("\n", index) + 1;
  if (/^\s*Vu\b/.test(texte.slice(lineStart, index + 1)) || /\bVu\s+(?:l['’]article|les articles)\s*$/i.test(texte.slice(Math.max(0, index - 30), index + 12))) return "visa";
  let loc = "texte";
  for (const s of segs) if (s.start <= index) loc = s.location;
  return loc;
}

type CitationRow = {
  decision_id: string; article_id: string | null; code_id: string | null; num: string; reference_raw: string; location: string;
  context: string; status: string; match_method: string; confidence: number; extractor_version: string;
};

export type ArticleResolver = (code: string, num: string) => { id: string; date_debut: string | null } | undefined;

export function articleResolver(db: Database.Database): ArticleResolver {
  const byNorm = db.prepare("SELECT id, date_debut FROM articles WHERE code = ? AND num_norm = ? LIMIT 2");
  const cache = new Map<string, { id: string; date_debut: string | null } | undefined>();
  return (code, num) => {
    const k = `${code}|${num}`;
    if (!cache.has(k)) {
      const rows = byNorm.all(code, num) as { id: string; date_debut: string | null }[];
      cache.set(k, rows.length === 1 ? rows[0] : undefined); // 2 matches = homonyms in one code: never guess
    }
    return cache.get(k);
  };
}

/** Final status of a parsed reference once checked against the articles table (and the decision date). */
export function resolveRef(r: ParsedRef, resolve: ArticleResolver, date: string): { status: string; article_id: string | null } {
  if (!r.code || r.status === "no_code" || r.status === "historical" || r.status === "code_not_carried") return { status: r.status, article_id: null };
  const a = resolve(r.code, r.num);
  if (!a) return { status: "unknown_article", article_id: null };
  if (r.status === "versioned") {
    // "dans sa rédaction issue de…": today's article only if the decision is not older than today's version.
    return a.date_debut && date >= a.date_debut.slice(0, 10) ? { status: "resolved", article_id: a.id } : { status: "historical", article_id: null };
  }
  return { status: "resolved", article_id: a.id };
}

/** Every reference of one decision, with location and context. `liens`: the official "textes appliqués". */
export function extractCitations(
  d: { id: string; date: string; sommaire: string | null; texte: string; liens?: string },
  resolve: ArticleResolver,
): CitationRow[] {
  const out: CitationRow[] = [];
  const parts = [
    { refs: parseRefs(d.sommaire ?? "", d.date), text: d.sommaire ?? "", loc: () => "sommaire" },
    { refs: parseRefs(d.liens ?? "", d.date), text: d.liens ?? "", loc: () => "textes_appliques" },
  ];
  const segs = segments(d.texte);
  const body = parseRefs(d.texte, d.date);
  const oldCivil = appliesOldCivilLaw(`${d.sommaire ?? ""}\n${d.liens ?? ""}\n${d.texte}`, [...parts.flatMap((p) => p.refs), ...body]);
  const push = (parsed: ParsedRef, location: string) => {
    // One regime per decision (see legal-refs.ts): old civil law → no link to today's 1100–1386-1.
    const r: ParsedRef =
      oldCivil && inCivilReformRange(parsed.code, parsed.num) && parsed.status !== "no_code"
        ? { ...parsed, status: "historical", method: `${parsed.method}+old_civil_regime` }
        : parsed;
    const { status, article_id } = resolveRef(r, resolve, d.date);
    out.push({
      decision_id: d.id, article_id, code_id: r.code, num: r.num, reference_raw: r.raw, location, context: r.context,
      status, match_method: r.method, confidence: r.confidence, extractor_version: EXTRACTOR_VERSION,
    });
  };
  for (const p of parts) for (const r of p.refs) push(r, p.loc());
  for (const r of body) push(r, locationAt(d.texte, segs, r.index));
  return out;
}

/** Replace a decision's citations and rebuild its decision_articles projection. Idempotent. */
export function saveCitations(db: Database.Database, decisionId: string, rows: CitationRow[]) {
  db.prepare("DELETE FROM citations WHERE decision_id = ?").run(decisionId);
  const ins = db.prepare(
    `INSERT INTO citations (decision_id, article_id, code_id, num, reference_raw, location, context, status, match_method, confidence, extractor_version)
     VALUES (@decision_id, @article_id, @code_id, @num, @reference_raw, @location, @context, @status, @match_method, @confidence, @extractor_version)`,
  );
  for (const r of rows) ins.run(r);
  db.prepare("DELETE FROM decision_articles WHERE decision_id = ?").run(decisionId);
  db.prepare(
    `INSERT OR IGNORE INTO decision_articles (decision_id, article_id)
     SELECT decision_id, article_id FROM citations WHERE decision_id = ? AND status = 'resolved' AND confidence >= ?`,
  ).run(decisionId, LINK_CONFIDENCE);
}

// ---------- Decision ↔ decision ----------

/** "23-20.428", "23-20428", "n° 23-20 428" → "23-20428". */
export const normalizePourvoi = (s: string) => s.replace(/[^\d-]/g, "").replace(/^(\d{2})-?(\d{2})(\d{3})$/, "$1-$2$3");

// "(Soc., 19 juin 2024, pourvoi n° 23-10.817" / "Cass. 3e civ., …, n° 21-18.520" / "1re Civ., 1er mars 2023, pourvoi n° 21-22.121"
const CITED_POURVOI = /(?:pourvoi|n°)\s*(?:n°\s*)?(\d{2}-\d{2}\.?\s?\d{3})/g;

export type DecisionRelationRow = { from_id: string; kind: string; target_ref: string; to_id: string | null; method: string; confidence: number; extractor_version: string };

/**
 * Relations stated by the data: numbers of the decision itself are excluded from "cites"; the decision under appeal
 * (DATE_DEC_ATT / FORM_DEC_ATT) is kept as an external reference until the appeal courts are imported.
 */
export function extractDecisionRelations(
  d: { id: string; texte: string; numbers: string[]; attaquee?: { juridiction?: string; date?: string } },
  byNumber: (numero: string) => string[],
): DecisionRelationRow[] {
  const own = new Set(d.numbers);
  const out = new Map<string, DecisionRelationRow>();
  const add = (r: Omit<DecisionRelationRow, "extractor_version">) => out.set(`${r.kind}|${r.target_ref}`, { ...r, extractor_version: EXTRACTOR_VERSION });
  for (const m of d.texte.matchAll(CITED_POURVOI)) {
    const num = normalizePourvoi(m[1]);
    if (own.has(num)) continue;
    const ids = byNumber(num).filter((id) => id !== d.id);
    add({ from_id: d.id, kind: "cites", target_ref: num, to_id: ids.length === 1 ? ids[0] : null, method: "pourvoi_number_in_text", confidence: ids.length === 1 ? 0.95 : 0.5 });
  }
  for (const num of own) {
    for (const other of byNumber(num)) if (other !== d.id) add({ from_id: d.id, kind: "same_case", target_ref: num, to_id: other, method: "shared_pourvoi_number", confidence: 1 });
  }
  if (d.attaquee?.date) {
    add({ from_id: d.id, kind: "appeal_from", target_ref: `${d.attaquee.juridiction ?? "?"}|${d.attaquee.date}`, to_id: null, method: "date_dec_att", confidence: 1 });
  }
  return [...out.values()];
}

// ---------- Article ↔ article (co-citation) ----------

// Metric, chosen after measuring CASS 2017+ (7 191 decisions, 6 108 articles, degree p50 = 2, p99 = 40, max = 410;
// 41 878 pairs of which 84 % share a single decision):
// - raw count lets very frequent articles (2224, 1240 cc) top every list;
// - PMI / NPMI over-reward rare pairs and are unstable at small counts;
// - Jaccard and cosine (Ochiai) rank almost identically; cosine = shared / √(degA·degB) is symmetric, bounded, and
//   damps hubs without erasing them. Pairs need ≥ 2 shared decisions (a single co-occurrence is noise).
export const CO_CITATION_METRIC = "cosine_ochiai/min2";
const MIN_SHARED = 2;

export function buildCoCitations(db: Database.Database) {
  db.transaction(() => {
    db.prepare("DELETE FROM article_relations WHERE kind = 'co_citation'").run();
    db.prepare(
      `WITH deg AS (SELECT article_id, COUNT(*) n FROM decision_articles GROUP BY article_id),
       pj AS (SELECT a.article_id x, b.article_id y, d.juridiction j, COUNT(*) c, MIN(d.date) f, MAX(d.date) l
              FROM decision_articles a JOIN decision_articles b ON b.decision_id = a.decision_id AND a.article_id < b.article_id
              JOIN decisions d ON d.id = a.decision_id GROUP BY x, y, j),
       p AS (SELECT x, y, SUM(c) s, MIN(f) f, MAX(l) l, json_group_object(j, c) js FROM pj GROUP BY x, y HAVING SUM(c) >= ?)
       INSERT INTO article_relations (a_id, b_id, kind, shared, first_date, last_date, juridictions, score, metric)
       SELECT x, y, 'co_citation', s, f, l, js, s / sqrt(dx.n * dy.n), ? FROM p JOIN deg dx ON dx.article_id = x JOIN deg dy ON dy.article_id = y
       UNION ALL
       SELECT y, x, 'co_citation', s, f, l, js, s / sqrt(dx.n * dy.n), ? FROM p JOIN deg dx ON dx.article_id = x JOIN deg dy ON dy.article_id = y`,
    ).run(MIN_SHARED, CO_CITATION_METRIC, CO_CITATION_METRIC);
  })();
  return (db.prepare("SELECT COUNT(*) n FROM article_relations WHERE kind = 'co_citation'").get() as { n: number }).n / 2;
}

// ---------- Per-article statistics ----------

export function buildArticleStats(db: Database.Database) {
  db.transaction(() => {
    db.prepare("DELETE FROM article_stats").run();
    db.prepare(
      `WITH x AS (SELECT da.article_id a, d.date, substr(d.date, 1, 4) y, d.juridiction j, COALESCE(NULLIF(d.formation, ''), '?') f
                  FROM decision_articles da JOIN decisions d ON d.id = da.decision_id),
       by_y AS (SELECT a, json_group_object(y, n) js FROM (SELECT a, y, COUNT(*) n FROM x GROUP BY a, y) GROUP BY a),
       by_j AS (SELECT a, json_group_object(j, n) js FROM (SELECT a, j, COUNT(*) n FROM x GROUP BY a, j) GROUP BY a),
       by_f AS (SELECT a, json_group_object(f, n) js FROM (SELECT a, f, COUNT(*) n FROM x GROUP BY a, f) GROUP BY a)
       INSERT INTO article_stats (article_id, decisions, first_date, last_date, by_year, by_juridiction, by_formation)
       SELECT x.a, COUNT(*), MIN(x.date), MAX(x.date), by_y.js, by_j.js, by_f.js
       FROM x JOIN by_y ON by_y.a = x.a JOIN by_j ON by_j.a = x.a JOIN by_f ON by_f.a = x.a GROUP BY x.a`,
    ).run();
  })();
  return (db.prepare("SELECT COUNT(*) n FROM article_stats").get() as { n: number }).n;
}

// ---------- Topics (deterministic: an editorial topic's answers cite the article) ----------

export function buildTopics(db: Database.Database, topics: { slug: string; title: string }[]) {
  db.transaction(() => {
    const up = db.prepare("INSERT INTO legal_topics (id, label, source) VALUES (?, ?, 'loila:topics') ON CONFLICT(id) DO UPDATE SET label = excluded.label");
    for (const t of topics) up.run(t.slug, t.title);
    db.prepare("DELETE FROM topic_articles WHERE method = 'faq_citation'").run();
    db.prepare(
      `INSERT OR IGNORE INTO topic_articles (topic_id, article_id, method)
       SELECT f.topic, j.value, 'faq_citation' FROM faq f, json_each(f.article_ids) j
       WHERE f.topic IS NOT NULL AND EXISTS (SELECT 1 FROM articles a WHERE a.id = j.value) AND EXISTS (SELECT 1 FROM legal_topics t WHERE t.id = f.topic)`,
    ).run();
  })();
}

// ---------- Metrics (npm run legal-graph) ----------

export function graphMetrics(db: Database.Database) {
  const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const byStatus = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM citations GROUP BY status").all() as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  const linked = n("SELECT COUNT(DISTINCT article_id) n FROM decision_articles");
  const links = n("SELECT COUNT(*) n FROM decision_articles");
  const carried = (byStatus.resolved ?? 0) + (byStatus.unknown_article ?? 0);
  return {
    articles: n("SELECT COUNT(*) n FROM articles"),
    decisions: n("SELECT COUNT(*) n FROM decisions"),
    decision_article_links: links,
    articles_with_decision: linked,
    avg_decisions_per_linked_article: linked ? Math.round((links / linked) * 100) / 100 : 0,
    article_relations: n("SELECT COUNT(*) n FROM article_relations") / 2,
    decision_relations: n("SELECT COUNT(*) n FROM decision_relations"),
    decision_relations_resolved: n("SELECT COUNT(*) n FROM decision_relations WHERE to_id IS NOT NULL"),
    citations: n("SELECT COUNT(*) n FROM citations"),
    citations_by_status: byStatus,
    // Among references to a code Loilà carries, the share that points to an existing article.
    resolution_rate: carried ? Math.round(((byStatus.resolved ?? 0) / carried) * 1000) / 10 : 0,
    ambiguous_no_code: byStatus.no_code ?? 0,
    unresolved_unknown_article: byStatus.unknown_article ?? 0,
    potential_duplicate_decisions: n(
      "SELECT COUNT(*) n FROM (SELECT dn.numero, d.date FROM decision_numbers dn JOIN decisions d ON d.id = dn.decision_id GROUP BY dn.numero, d.date HAVING COUNT(DISTINCT d.id) > 1)",
    ),
    decisions_without_provenance: n("SELECT COUNT(*) n FROM decisions d WHERE NOT EXISTS (SELECT 1 FROM provenance p WHERE p.entity_type = 'decision' AND p.entity_id = d.id)"),
    articles_without_provenance: n("SELECT COUNT(*) n FROM articles a WHERE NOT EXISTS (SELECT 1 FROM provenance p WHERE p.entity_type = 'article' AND p.entity_id = a.id)"),
    articles_from_mirror_only: n(
      "SELECT COUNT(*) n FROM articles a WHERE NOT EXISTS (SELECT 1 FROM provenance p WHERE p.entity_type = 'article' AND p.entity_id = a.id AND p.mirror = 0)",
    ),
    // No decision, no FAQ answer, no letter: nothing in Loilà points to it (raw text only).
    orphan_articles: n(
      `SELECT COUNT(*) n FROM articles a WHERE NOT EXISTS (SELECT 1 FROM decision_articles da WHERE da.article_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM faq, json_each(faq.article_ids) j WHERE j.value = a.id)`,
    ),
    top_unresolved_codes: db
      .prepare("SELECT code_id, COUNT(*) n FROM citations WHERE status = 'code_not_carried' GROUP BY code_id ORDER BY n DESC LIMIT 5")
      .all(),
  };
}

// ---------- Rebuild from the DB alone (production import, extractor upgrades) ----------

/** "cites" and "same_case" relations of every decision (needs the whole set), plus "appeal_from" from stored fields. */
export function rebuildDecisionRelations(db: Database.Database) {
  const nums = db.prepare("SELECT decision_id FROM decision_numbers WHERE numero = ?");
  const byNumber = (n: string) => (nums.all(n) as { decision_id: string }[]).map((r) => r.decision_id);
  const own = db.prepare("SELECT numero FROM decision_numbers WHERE decision_id = ?");
  const ins = db.prepare(
    `INSERT OR REPLACE INTO decision_relations (from_id, kind, target_ref, to_id, method, confidence, extractor_version)
     VALUES (@from_id, @kind, @target_ref, @to_id, @method, @confidence, @extractor_version)`,
  );
  const decs = db.prepare("SELECT id, texte, attaquee_juridiction, attaquee_date FROM decisions").all() as { id: string; texte: string; attaquee_juridiction: string | null; attaquee_date: string | null }[];
  db.transaction(() => {
    db.prepare("DELETE FROM decision_relations WHERE kind IN ('cites', 'same_case', 'appeal_from')").run();
    for (const d of decs) {
      const numbers = (own.all(d.id) as { numero: string }[]).map((r) => r.numero);
      const attaquee = d.attaquee_date ? { juridiction: d.attaquee_juridiction ?? undefined, date: d.attaquee_date } : undefined;
      for (const r of extractDecisionRelations({ id: d.id, texte: d.texte, numbers, attaquee }, byNumber)) ins.run(r);
    }
  })();
}

/** Re-extract every decision's citations from stored fields, then relations, co-citations and stats. */
export function rebuildGraph(db: Database.Database, { reextract = true } = {}) {
  syncCodes(db);
  backfillArticles(db);
  if (reextract) {
    const resolve = articleResolver(db);
    const decs = db.prepare("SELECT id, date, sommaire, texte, liens FROM decisions").all() as { id: string; date: string; sommaire: string | null; texte: string; liens: string | null }[];
    db.transaction(() => {
      for (const d of decs) saveCitations(db, d.id, extractCitations({ ...d, liens: d.liens ?? "" }, resolve));
      db.prepare("UPDATE decisions SET extractor_version = ?").run(EXTRACTOR_VERSION);
    })();
    rebuildDecisionRelations(db);
  }
  return { pairs: buildCoCitations(db), stats: buildArticleStats(db) };
}
