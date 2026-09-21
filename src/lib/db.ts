import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { rebuildGraph } from "./legal-graph";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "loila.db");

// Shared contract between ingestion, batch, API and UI. Change here only.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY,        -- Légifrance id, e.g. LEGIARTI000006901112
  code         TEXT NOT NULL,           -- slug from THEMES[].codes, e.g. 'code-du-travail'
  num          TEXT NOT NULL,           -- 'L1234-5'
  section      TEXT,                    -- breadcrumb: 'Partie législative > Livre Ier > ...'
  texte        TEXT NOT NULL,           -- plain text
  date_debut   TEXT,                    -- ISO date version in force
  url          TEXT NOT NULL            -- https://www.legifrance.gouv.fr/codes/article_lc/<id>
);
CREATE INDEX IF NOT EXISTS articles_code_num ON articles(code, num);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  num, section, texte, content='articles', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, num, section, texte) VALUES (new.rowid, new.num, new.section, new.texte);
END;
CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, num, section, texte) VALUES ('delete', old.rowid, old.num, old.section, old.texte);
END;
CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, num, section, texte) VALUES ('delete', old.rowid, old.num, old.section, old.texte);
  INSERT INTO articles_fts(rowid, num, section, texte) VALUES (new.rowid, new.num, new.section, new.texte);
END;

CREATE TABLE IF NOT EXISTS faq (
  id          INTEGER PRIMARY KEY,
  theme       TEXT NOT NULL,            -- THEMES[].slug, or 'sujets'
  topic       TEXT,                     -- seed/topics.json slug, null for theme FAQs
  slug        TEXT NOT NULL UNIQUE,
  emoji       TEXT,
  question    TEXT NOT NULL,
  short       TEXT NOT NULL,            -- 1-2 sentence answer ("En bref")
  answer_md   TEXT NOT NULL,            -- full answer, markdown
  article_ids TEXT NOT NULL DEFAULT '[]' -- JSON array of articles.id
);
CREATE VIRTUAL TABLE IF NOT EXISTS faq_fts USING fts5(
  question, short, content='faq', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS faq_ai AFTER INSERT ON faq BEGIN
  INSERT INTO faq_fts(rowid, question, short) VALUES (new.id, new.question, new.short);
END;
CREATE TRIGGER IF NOT EXISTS faq_ad AFTER DELETE ON faq BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, short) VALUES ('delete', old.id, old.question, old.short);
END;
CREATE TRIGGER IF NOT EXISTS faq_au AFTER UPDATE ON faq BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, short) VALUES ('delete', old.id, old.question, old.short);
  INSERT INTO faq_fts(rowid, question, short) VALUES (new.id, new.question, new.short);
END;

CREATE TABLE IF NOT EXISTS qa_cache (
  hash        TEXT PRIMARY KEY,         -- sha256 of normalized question
  question    TEXT NOT NULL,
  answer_md   TEXT NOT NULL,
  article_ids TEXT NOT NULL DEFAULT '[]',
  model       TEXT,
  hits        INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Billing & auth. Timestamps are unix seconds.
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,  -- lowercased
  stripe_customer_id TEXT UNIQUE,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,              -- sha256 of the cookie token
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                INTEGER PRIMARY KEY REFERENCES users(id),
  stripe_subscription_id TEXT NOT NULL,
  plan                   TEXT NOT NULL,     -- OfferId of a subscription offer ('pro')
  status                 TEXT NOT NULL,     -- Stripe status
  current_period_start   INTEGER NOT NULL,
  current_period_end     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,                 -- 'purchase' | 'use'
  stripe_ref TEXT UNIQUE,                   -- checkout session id: a purchase is granted once
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS credit_ledger_user ON credit_ledger(user_id); -- legacy (never-expiring credits), no longer read
-- One row per Dossier purchase. Expired batches are ignored, never deleted (dispute history).
CREATE TABLE IF NOT EXISTS credit_batches (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  credits_granted INTEGER NOT NULL,
  credits_left    INTEGER NOT NULL CHECK (credits_left >= 0),
  expires_at      INTEGER NOT NULL,
  stripe_ref      TEXT UNIQUE,              -- checkout session id: a purchase is granted once
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS credit_batches_user ON credit_batches(user_id, expires_at);
CREATE TABLE IF NOT EXISTS pro_waitlist (
  email      TEXT PRIMARY KEY,
  metier     TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS usage (
  id         INTEGER PRIMARY KEY,
  subject    TEXT NOT NULL,                 -- 'user:<id>' (asking requires an account)
  kind       TEXT NOT NULL,                 -- 'free' | 'credit' | 'sub'
  batch_id   INTEGER,                       -- credit_batches.id when kind = 'credit'
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS usage_subject ON usage(subject, kind, created_at);
-- Global anti-runaway cap: one row per UTC day, incremented before every live LLM call (src/lib/budget.ts).
CREATE TABLE IF NOT EXISTS llm_budget (
  day   TEXT PRIMARY KEY,                   -- YYYY-MM-DD (UTC): the counter resets at 00:00 UTC
  calls INTEGER NOT NULL DEFAULT 0
);
-- Dossier wizard (src/lib/wizard.ts). JSON columns are written and read by wizard.ts only.
CREATE TABLE IF NOT EXISTS dossiers (
  id           TEXT PRIMARY KEY,            -- random, unguessable
  user_id      INTEGER NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL,               -- 'analyse' | 'questions' | 'answered' | 'generating' | 'done' | 'hors_sujet' | 'failed'
  story        TEXT NOT NULL,
  analysis     TEXT,                        -- JSON: theme, title, facts, legal_terms, likely_articles, unknowns, high_stakes
  questions    TEXT,                        -- JSON: [{ id, question, type, options, article, why }]
  answers      TEXT,                        -- JSON: { items: [{ id, question, answer }], note }
  synthesis_md TEXT,
  article_ids  TEXT NOT NULL DEFAULT '[]',  -- cited in the synthesis
  calls        TEXT NOT NULL DEFAULT '[]',  -- JSON: [{ step, model, provider, ms, cost, note }]
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS dossiers_user ON dossiers(user_id, created_at);
CREATE TABLE IF NOT EXISTS dossier_messages (
  id          INTEGER PRIMARY KEY,
  dossier_id  TEXT NOT NULL REFERENCES dossiers(id),
  question    TEXT NOT NULL,
  answer_md   TEXT NOT NULL,
  article_ids TEXT NOT NULL DEFAULT '[]',
  calls       TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS dossier_messages_dossier ON dossier_messages(dossier_id, id);
CREATE TABLE IF NOT EXISTS stripe_events (
  id          TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Every question sent to /api/ask, for stats (admin). ponytail: no retention/pseudonymisation yet (RGPD to frame later).
CREATE TABLE IF NOT EXISTS question_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),  -- NULL: asked before signing up
  question   TEXT NOT NULL,
  theme      TEXT,
  outcome    TEXT NOT NULL,                 -- faq | cache | llm | none | paywall | auth | error
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS question_log_created ON question_log(created_at);
-- /contact form. Stored before emailing so a failed send loses nothing.
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  company    TEXT,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  emailed    INTEGER NOT NULL DEFAULT 0,  -- 1 once the notification email was accepted by Sweego
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Case law (scripts/ingest-juri.ts, DILA open data), linked to the articles each decision cites.
CREATE TABLE IF NOT EXISTS decisions (
  id          TEXT PRIMARY KEY,             -- JURITEXT… (Légifrance id)
  source      TEXT NOT NULL,                -- 'cass' (Cour de cassation, published)…
  juridiction TEXT NOT NULL,
  formation   TEXT,                         -- e.g. CHAMBRE_SOCIALE
  date        TEXT NOT NULL,                -- YYYY-MM-DD
  numero      TEXT,                         -- case number, e.g. 23-20428
  solution    TEXT,                         -- Cassation, Rejet…
  titre       TEXT NOT NULL,
  ecli        TEXT,
  publie      INTEGER NOT NULL DEFAULT 0,   -- published in the Bulletin
  sommaire    TEXT,                         -- official abstract (may be empty)
  texte       TEXT NOT NULL,
  url         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decision_articles (
  decision_id TEXT NOT NULL,
  article_id  TEXT NOT NULL,
  PRIMARY KEY (decision_id, article_id)
);
CREATE INDEX IF NOT EXISTS decision_articles_article ON decision_articles(article_id);
CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
  titre, sommaire, texte, content='decisions', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN
  INSERT INTO decisions_fts(rowid, titre, sommaire, texte) VALUES (new.rowid, new.titre, new.sommaire, new.texte);
END;
CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, titre, sommaire, texte) VALUES ('delete', old.rowid, old.titre, old.sommaire, old.texte);
END;
CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, titre, sommaire, texte) VALUES ('delete', old.rowid, old.titre, old.sommaire, old.texte);
  INSERT INTO decisions_fts(rowid, titre, sommaire, texte) VALUES (new.rowid, new.titre, new.sommaire, new.texte);
END;
-- Plain-language summaries of decisions (scripts/batch-decisions.ts). A decision page is indexable only with one.
CREATE TABLE IF NOT EXISTS decision_summaries (
  decision_id TEXT PRIMARY KEY,
  summary     TEXT NOT NULL,
  points      TEXT NOT NULL,                -- JSON array
  model       TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ===== Legal knowledge graph (src/lib/legal-graph.ts). Relations are explicit rows, each with its provenance. =====
-- Codes and texts (ARTICLE_BELONGS_TO_CODE = articles.code → legal_codes.id). Synced from themes.ts CODES.
CREATE TABLE IF NOT EXISTS legal_codes (
  id          TEXT PRIMARY KEY,             -- slug, e.g. 'code-civil'
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- code | loi | decret | convention
  official_id TEXT,                         -- LEGITEXT… / JORFTEXT… / KALICONT…
  source      TEXT NOT NULL                 -- dataset: LEGI | KALI
);
-- Where every imported row comes from. Several rows per entity when several sources carry it (dedup keeps them all).
CREATE TABLE IF NOT EXISTS provenance (
  entity_type       TEXT NOT NULL,          -- article | decision | code
  entity_id         TEXT NOT NULL,
  dataset           TEXT NOT NULL,          -- LEGI | KALI | CASS | CAPP | INCA | JADE | CONSTIT
  source            TEXT NOT NULL,          -- publisher: 'DILA'
  origin_url        TEXT NOT NULL,          -- archive or file URL actually fetched
  origin_ref        TEXT,                   -- path inside the archive / official id
  mirror            INTEGER NOT NULL DEFAULT 0, -- 1: fetched from a non-official mirror (tricoteuses.fr)
  raw_checksum      TEXT,                   -- sha256 of the raw source file (NULL: not recorded, legacy import)
  extractor         TEXT NOT NULL,          -- script
  extractor_version TEXT NOT NULL,
  imported_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  verified_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (entity_type, entity_id, dataset, origin_url)
);
-- DECISION_CITES_ARTICLE, every detected reference (resolved or not). decision_articles is its projection:
-- status = 'resolved' AND confidence >= 0.9 (rebuilt by the extractor).
CREATE TABLE IF NOT EXISTS citations (
  id                INTEGER PRIMARY KEY,
  decision_id       TEXT NOT NULL,
  article_id        TEXT,                   -- set only when status = 'resolved'
  code_id           TEXT,
  num               TEXT NOT NULL,          -- normalized number
  reference_raw     TEXT NOT NULL,
  location          TEXT NOT NULL,          -- sommaire | textes_appliques | visa | moyen | motifs | dispositif | texte
  context           TEXT,
  status            TEXT NOT NULL,          -- resolved | unknown_article | historical | versioned | no_code
  match_method      TEXT NOT NULL,
  confidence        REAL NOT NULL,
  extractor_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS citations_decision ON citations(decision_id);
CREATE INDEX IF NOT EXISTS citations_article ON citations(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS citations_status ON citations(status, code_id);
-- Case numbers (a decision can join several pourvois): search by number and SAME_CASE relations.
CREATE TABLE IF NOT EXISTS decision_numbers (
  decision_id TEXT NOT NULL,
  numero      TEXT NOT NULL,                -- normalized: digits and dashes, e.g. 23-20428
  PRIMARY KEY (decision_id, numero)
);
CREATE INDEX IF NOT EXISTS decision_numbers_numero ON decision_numbers(numero);
-- DECISION_RELATED_DECISION, only what the data states (citation of a decision, same case, decision under appeal).
-- to_id NULL: target not (yet) in Loilà, kept with its raw reference so a later import can resolve it.
CREATE TABLE IF NOT EXISTS decision_relations (
  from_id           TEXT NOT NULL,
  kind              TEXT NOT NULL,          -- cites | same_case | appeal_from | (later: similar)
  target_ref        TEXT NOT NULL,          -- raw reference or external key (pourvoi number, "CA Paris 2023-01-18")
  to_id             TEXT,
  method            TEXT NOT NULL,
  confidence        REAL NOT NULL,
  extractor_version TEXT NOT NULL,
  PRIMARY KEY (from_id, kind, target_ref)
);
CREATE INDEX IF NOT EXISTS decision_relations_to ON decision_relations(to_id) WHERE to_id IS NOT NULL;
-- ARTICLE_RELATED_ARTICLE, both directions stored so "related to X by score" is one indexed range scan.
CREATE TABLE IF NOT EXISTS article_relations (
  a_id         TEXT NOT NULL,
  b_id         TEXT NOT NULL,
  kind         TEXT NOT NULL,               -- co_citation
  shared       INTEGER NOT NULL,            -- decisions citing both
  first_date   TEXT,
  last_date    TEXT,
  juridictions TEXT,                        -- JSON {juridiction: shared count}, descriptive
  score        REAL NOT NULL,
  metric       TEXT NOT NULL,
  computed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (a_id, b_id, kind)
);
CREATE INDEX IF NOT EXISTS article_relations_rank ON article_relations(a_id, kind, score DESC);
-- ARTICLE_VERSION_OF (prepared: the LEGI import keeps only the version in force today).
CREATE TABLE IF NOT EXISTS article_versions (
  version_id  TEXT PRIMARY KEY,             -- LEGIARTI of the version
  article_cid TEXT NOT NULL,                -- stable common id across versions
  article_id  TEXT,                         -- current version in articles, when known
  date_debut  TEXT,
  date_fin    TEXT,
  etat        TEXT
);
-- Precomputed per-article case-law statistics (recomputed by legal-graph.ts).
CREATE TABLE IF NOT EXISTS article_stats (
  article_id     TEXT PRIMARY KEY,
  decisions      INTEGER NOT NULL,
  first_date     TEXT,
  last_date      TEXT,
  by_year        TEXT NOT NULL,             -- JSON {year: n}
  by_juridiction TEXT NOT NULL,             -- JSON
  by_formation   TEXT NOT NULL,             -- JSON
  computed_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
-- LEGAL_TOPIC (prepared; filled deterministically from the editorial topics, no AI).
CREATE TABLE IF NOT EXISTS legal_topics (
  id     TEXT PRIMARY KEY,                  -- slug
  label  TEXT NOT NULL,
  source TEXT NOT NULL                      -- 'loila:topics' (seed/topics.json)
);
CREATE TABLE IF NOT EXISTS topic_articles (
  topic_id   TEXT NOT NULL,
  article_id TEXT NOT NULL,
  method     TEXT NOT NULL,                 -- 'faq_citation': an answer of the topic cites the article
  PRIMARY KEY (topic_id, article_id)
);
-- Graph size over time (npm run legal-graph).
CREATE TABLE IF NOT EXISTS graph_snapshots (
  taken_at INTEGER PRIMARY KEY,
  metrics  TEXT NOT NULL                    -- JSON
);

-- Plain-language "En clair" summaries of article pages (scripts/batch-articles.ts, shipped in content bundles).
CREATE TABLE IF NOT EXISTS article_summaries (
  article_id TEXT PRIMARY KEY,              -- articles.id
  texte_sha  TEXT NOT NULL,                 -- sha256 of the texte summarized: a re-ingested text makes the summary stale (hidden)
  summary    TEXT NOT NULL,                 -- 2 to 4 sentences
  points     TEXT NOT NULL,                 -- JSON array of short key points
  model      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

let db: Database.Database | undefined;

// Retention (see /mentions-legales#donnees-personnelles): question stats 12 months, contact messages 3 years,
// used/expired login links 1 day.
function purgeExpired(d: Database.Database) {
  try {
    d.exec(`DELETE FROM question_log WHERE created_at < unixepoch() - ${365 * 86400}`);
    d.exec(`DELETE FROM contact_messages WHERE created_at < unixepoch() - ${3 * 365 * 86400}`);
    d.exec("DELETE FROM login_tokens WHERE expires_at < unixepoch() - 86400");
    d.exec("DELETE FROM sessions WHERE expires_at < unixepoch()");
  } catch (e) {
    console.error("[db] purge", e instanceof Error ? e.message : e);
  }
}

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA);
    // Migration for DBs created before faq.topic existed.
    const cols = db.prepare("PRAGMA table_info(faq)").all() as { name: string }[];
    if (!cols.some((c) => c.name === "topic")) db.exec("ALTER TABLE faq ADD COLUMN topic TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS faq_topic ON faq(topic)");
    purgeExpired(db);
    // Daily, for the long-running server (retention periods published in /mentions-legales).
    setInterval(() => purgeExpired(db!), 86_400_000).unref();
    // Legal graph columns on tables created before them (additive, nullable).
    const addCols = (table: string, cols: [string, string][]) => {
      const have = new Set((db!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
      for (const [name, def] of cols) if (!have.has(name)) db!.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
    };
    addCols("articles", [["num_norm", "TEXT"], ["etat", "TEXT"], ["date_fin", "TEXT"], ["checksum", "TEXT"], ["source", "TEXT"]]);
    // liens / attaquee_*: raw fields kept so the whole graph can be re-extracted from the DB alone (production).
    addCols("decisions", [["checksum", "TEXT"], ["extractor_version", "TEXT"], ["liens", "TEXT"], ["attaquee_juridiction", "TEXT"], ["attaquee_date", "TEXT"]]);
    db.exec("CREATE INDEX IF NOT EXISTS articles_code_num_norm ON articles(code, num_norm)");
    db.exec("CREATE INDEX IF NOT EXISTS decisions_date ON decisions(date)");
    db.exec("CREATE INDEX IF NOT EXISTS decisions_ecli ON decisions(ecli) WHERE ecli IS NOT NULL AND ecli <> ''");
    // Migration for DBs created before credit batches existed.
    const usageCols = db.prepare("PRAGMA table_info(usage)").all() as { name: string }[];
    if (!usageCols.some((c) => c.name === "batch_id")) db.exec("ALTER TABLE usage ADD COLUMN batch_id INTEGER");
    if (process.env.NODE_ENV === "production" || process.env.CONTENT_IMPORT === "1") importContent(db);
  }
  return db;
}

// Content bundles (seed/content/*.json.gz, made by scripts/export-content.ts): new legal texts and reviewed FAQ rows
// for a DB that can't be rebuilt (it holds user data). Each bundle is applied once per content hash, as upserts.
export function importContent(d: Database.Database, dir = path.join(process.cwd(), "seed", "content")) {
  if (!fs.existsSync(dir)) return;
  d.exec("CREATE TABLE IF NOT EXISTS content_imports (name TEXT PRIMARY KEY, sha TEXT NOT NULL, imported_at INTEGER NOT NULL DEFAULT (unixepoch()))");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort()) {
    try {
      const buf = fs.readFileSync(path.join(dir, file));
      const sha = createHash("sha256").update(buf).digest("hex");
      const done = d.prepare("SELECT sha FROM content_imports WHERE name = ?").get(file) as { sha: string } | undefined;
      if (done?.sha === sha) continue;
      const { articles = [], faq = [], deleteArticleIds = [], summaries = [], decisions = [], decisionNumbers = [], decisionProvenance = [], decisionSummaries = [] } = JSON.parse(gunzipSync(buf).toString("utf8")) as {
        decisions?: Record<string, unknown>[]; decisionNumbers?: { decision_id: string; numero: string }[]; decisionProvenance?: Record<string, unknown>[];
        decisionSummaries?: { decision_id: string; summary: string; points: string; model: string | null }[];
        articles?: Article[]; faq?: Omit<Faq, "id">[]; deleteArticleIds?: string[]; // ids no longer in force (re-ingest diffs)
        summaries?: Omit<ArticleSummary, "created_at">[];
      };
      const art = d.prepare(
        `INSERT INTO articles (id, code, num, section, texte, date_debut, url) VALUES (@id, @code, @num, @section, @texte, @date_debut, @url)
         ON CONFLICT(id) DO UPDATE SET code = excluded.code, num = excluded.num, section = excluded.section, texte = excluded.texte, date_debut = excluded.date_debut, url = excluded.url`,
      );
      const q = d.prepare(
        `INSERT INTO faq (theme, topic, slug, emoji, question, short, answer_md, article_ids) VALUES (@theme, @topic, @slug, @emoji, @question, @short, @answer_md, @article_ids)
         ON CONFLICT(slug) DO UPDATE SET theme = excluded.theme, topic = excluded.topic, emoji = excluded.emoji, question = excluded.question, short = excluded.short, answer_md = excluded.answer_md, article_ids = excluded.article_ids`,
      );
      d.transaction(() => {
        for (const a of articles) art.run(a);
        const del = d.prepare("DELETE FROM articles WHERE id = ?");
        for (const id of deleteArticleIds) del.run(id);
        const sum = d.prepare(
          `INSERT INTO article_summaries (article_id, texte_sha, summary, points, model) VALUES (@article_id, @texte_sha, @summary, @points, @model)
           ON CONFLICT(article_id) DO UPDATE SET texte_sha = excluded.texte_sha, summary = excluded.summary, points = excluded.points, model = excluded.model`,
        );
        for (const s of summaries) sum.run(s);
        const dec = d.prepare(
          `INSERT INTO decisions (id, source, juridiction, formation, date, numero, solution, titre, ecli, publie, sommaire, texte, url, checksum, extractor_version, liens, attaquee_juridiction, attaquee_date)
           VALUES (@id, @source, @juridiction, @formation, @date, @numero, @solution, @titre, @ecli, @publie, @sommaire, @texte, @url, @checksum, @extractor_version, @liens, @attaquee_juridiction, @attaquee_date)
           ON CONFLICT(id) DO UPDATE SET juridiction = excluded.juridiction, formation = excluded.formation, date = excluded.date, numero = excluded.numero,
             solution = excluded.solution, titre = excluded.titre, ecli = excluded.ecli, publie = excluded.publie, sommaire = excluded.sommaire, texte = excluded.texte,
             url = excluded.url, checksum = excluded.checksum, extractor_version = excluded.extractor_version, liens = excluded.liens,
             attaquee_juridiction = excluded.attaquee_juridiction, attaquee_date = excluded.attaquee_date`,
        );
        for (const x of decisions) dec.run({ checksum: null, extractor_version: null, liens: null, attaquee_juridiction: null, attaquee_date: null, ...x });
        const num = d.prepare("INSERT OR IGNORE INTO decision_numbers (decision_id, numero) VALUES (?, ?)");
        for (const n of decisionNumbers) num.run(n.decision_id, n.numero);
        const prov = d.prepare(
          `INSERT OR REPLACE INTO provenance (entity_type, entity_id, dataset, source, origin_url, origin_ref, mirror, raw_checksum, extractor, extractor_version, imported_at, verified_at)
           VALUES (@entity_type, @entity_id, @dataset, @source, @origin_url, @origin_ref, @mirror, @raw_checksum, @extractor, @extractor_version, @imported_at, @verified_at)`,
        );
        for (const p of decisionProvenance) prov.run(p);
        const dsum = d.prepare(
          `INSERT INTO decision_summaries (decision_id, summary, points, model) VALUES (@decision_id, @summary, @points, @model)
           ON CONFLICT(decision_id) DO UPDATE SET summary = excluded.summary, points = excluded.points, model = excluded.model`,
        );
        for (const s of decisionSummaries) dsum.run(s);
        for (const f of faq) q.run({ ...f, topic: f.topic ?? null, emoji: f.emoji ?? null, article_ids: typeof f.article_ids === "string" ? f.article_ids : JSON.stringify(f.article_ids) });
        d.prepare("INSERT INTO content_imports (name, sha) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET sha = excluded.sha, imported_at = unixepoch()").run(file, sha);
      })();
      // Derived graph layers (citations, relations, co-citations, stats) are recomputed, never shipped.
      if (decisions.length || articles.length || deleteArticleIds.length) rebuildGraph(d, { reextract: decisions.length > 0 || articles.length > 0 });
      console.log(`[db] content ${file}: ${articles.length} articles, ${faq.length} faq, ${summaries.length} summaries, ${decisions.length} decisions, ${deleteArticleIds.length} deleted`);
    } catch (e) {
      console.error(`[db] content ${file} failed`, e instanceof Error ? e.message : e);
    }
  }
}

export type Article = {
  id: string; code: string; num: string; section: string | null;
  texte: string; date_debut: string | null; url: string;
};
export type ArticleSummary = { article_id: string; texte_sha: string; summary: string; points: string; model: string | null; created_at: number };
export type Faq = {
  id: number; theme: string; topic: string | null; slug: string; emoji: string | null; question: string;
  short: string; answer_md: string; article_ids: string;
};
