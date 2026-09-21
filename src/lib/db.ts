import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

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
      const { articles = [], faq = [], deleteArticleIds = [] } = JSON.parse(gunzipSync(buf).toString("utf8")) as {
        articles?: Article[]; faq?: Omit<Faq, "id">[]; deleteArticleIds?: string[]; // ids no longer in force (re-ingest diffs)
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
        for (const f of faq) q.run({ ...f, topic: f.topic ?? null, emoji: f.emoji ?? null, article_ids: typeof f.article_ids === "string" ? f.article_ids : JSON.stringify(f.article_ids) });
        d.prepare("INSERT INTO content_imports (name, sha) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET sha = excluded.sha, imported_at = unixepoch()").run(file, sha);
      })();
      console.log(`[db] content ${file}: ${articles.length} articles, ${faq.length} faq, ${deleteArticleIds.length} deleted`);
    } catch (e) {
      console.error(`[db] content ${file} failed`, e instanceof Error ? e.message : e);
    }
  }
}

export type Article = {
  id: string; code: string; num: string; section: string | null;
  texte: string; date_debut: string | null; url: string;
};
export type Faq = {
  id: number; theme: string; topic: string | null; slug: string; emoji: string | null; question: string;
  short: string; answer_md: string; article_ids: string;
};
