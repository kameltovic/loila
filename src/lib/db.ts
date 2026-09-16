import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
`;

let db: Database.Database | undefined;

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
  }
  return db;
}

export type Article = {
  id: string; code: string; num: string; section: string | null;
  texte: string; date_debut: string | null; url: string;
};
export type Faq = {
  id: number; theme: string; topic: string | null; slug: string; emoji: string | null; question: string;
  short: string; answer_md: string; article_ids: string;
};
