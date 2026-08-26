import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./config";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS library_items (
  id              TEXT PRIMARY KEY,
  plex_rating_key TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK(type IN ('movie','show')),
  title           TEXT NOT NULL,
  year            INTEGER,
  tmdb_id         INTEGER,
  imdb_id         TEXT,
  tvdb_id         INTEGER,
  genres          TEXT,
  summary         TEXT,
  user_rating     REAL,
  view_count      INTEGER NOT NULL DEFAULT 0,
  last_viewed_at  INTEGER,
  section_key     TEXT NOT NULL DEFAULT '',
  section_title   TEXT NOT NULL DEFAULT '',
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_library_items_title_year_type ON library_items(title, year, type);
CREATE INDEX IF NOT EXISTS idx_library_items_tmdb_id ON library_items(tmdb_id);

CREATE TABLE IF NOT EXISTS recommendation_batches (
  id                    TEXT PRIMARY KEY,
  created_at            TEXT NOT NULL,
  model                 TEXT NOT NULL,
  taste_profile_summary TEXT,
  item_count            INTEGER NOT NULL DEFAULT 0,
  library_group_id      TEXT,
  library_group_name    TEXT,
  section_keys          TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS recommendations (
  id           TEXT PRIMARY KEY,
  batch_id     TEXT NOT NULL REFERENCES recommendation_batches(id),
  title        TEXT NOT NULL,
  year         INTEGER,
  media_type   TEXT NOT NULL CHECK(media_type IN ('movie','tv')),
  reason       TEXT,
  tmdb_id      INTEGER,
  poster_path  TEXT,
  overview     TEXT,
  vote_average REAL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','yes','no','watched')),
  user_rating  REAL,
  genres       TEXT,
  library_group_id TEXT,
  fetched_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_title_year_type ON recommendations(title, year, media_type);

CREATE TABLE IF NOT EXISTS library_groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  section_keys TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
`;

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string,
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

export function ensureWatchedStatusSupport(db: Database.Database) {
  const row = db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='recommendations'`,
    )
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'watched'")) return;

  db.exec(`
    ALTER TABLE recommendations RENAME TO recommendations_old;
    CREATE TABLE recommendations (
      id           TEXT PRIMARY KEY,
      batch_id     TEXT NOT NULL REFERENCES recommendation_batches(id),
      title        TEXT NOT NULL,
      year         INTEGER,
      media_type   TEXT NOT NULL CHECK(media_type IN ('movie','tv')),
      reason       TEXT,
      tmdb_id      INTEGER,
      poster_path  TEXT,
      overview     TEXT,
      vote_average REAL,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','yes','no','watched')),
      user_rating  REAL,
      genres       TEXT,
      library_group_id TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    INSERT INTO recommendations (
      id, batch_id, title, year, media_type, reason, tmdb_id, poster_path,
      overview, vote_average, status, library_group_id, created_at, updated_at
    )
    SELECT
      id, batch_id, title, year, media_type, reason, tmdb_id, poster_path,
      overview, vote_average, status, library_group_id, created_at, updated_at
    FROM recommendations_old;
    DROP TABLE recommendations_old;
    CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_recommendations_title_year_type ON recommendations(title, year, media_type);
  `);
}

function runMigrations(db: Database.Database) {
  ensureColumn(db, "library_items", "section_key", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "library_items", "section_title", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "recommendation_batches", "library_group_id", "TEXT");
  ensureColumn(db, "recommendation_batches", "library_group_name", "TEXT");
  ensureColumn(
    db,
    "recommendation_batches",
    "section_keys",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  ensureColumn(db, "recommendations", "library_group_id", "TEXT");
  ensureWatchedStatusSupport(db);
  ensureColumn(db, "recommendations", "genres", "TEXT");
  ensureColumn(db, "recommendations", "fetched_at", "TEXT");
}

let dbInstance: Database.Database | undefined;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const databasePath = getConfig().databasePath;
  if (databasePath !== ":memory:") {
    const dir = path.dirname(databasePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(databasePath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.exec(SCHEMA);
  runMigrations(dbInstance);
  return dbInstance;
}
