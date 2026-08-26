import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensureWatchedStatusSupport } from "@/lib/db";

const OLD_RECOMMENDATIONS_DDL = `
CREATE TABLE recommendation_batches (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  model TEXT NOT NULL,
  taste_profile_summary TEXT,
  item_count INTEGER NOT NULL DEFAULT 0
);

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
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','yes','no')),
  library_group_id TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
`;

function makeOldDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(OLD_RECOMMENDATIONS_DDL);
  return db;
}

describe("ensureWatchedStatusSupport", () => {
  it("rebuilds the table to allow 'watched' status while preserving existing rows", () => {
    const db = makeOldDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recommendation_batches (id, created_at, model, taste_profile_summary, item_count) VALUES ('b1', ?, 'gpt-4o', '{}', 1)`,
    ).run(now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, tmdb_id, poster_path, overview, vote_average, status, library_group_id, created_at, updated_at)
       VALUES ('r1', 'b1', 'Existing Title', 2020, 'movie', 'because', 42, '/p.jpg', 'overview text', 7.5, 'yes', 'g1', ?, ?)`,
    ).run(now, now);

    ensureWatchedStatusSupport(db);

    // Old row survived with all its original values intact.
    const row = db.prepare(`SELECT * FROM recommendations WHERE id = 'r1'`).get() as Record<
      string,
      unknown
    >;
    expect(row.title).toBe("Existing Title");
    expect(row.year).toBe(2020);
    expect(row.media_type).toBe("movie");
    expect(row.tmdb_id).toBe(42);
    expect(row.poster_path).toBe("/p.jpg");
    expect(row.vote_average).toBe(7.5);
    expect(row.status).toBe("yes");
    expect(row.library_group_id).toBe("g1");
    expect(row.user_rating).toBeNull();

    // New status value is now accepted.
    expect(() =>
      db
        .prepare(
          `INSERT INTO recommendations (id, batch_id, title, media_type, status, created_at, updated_at)
           VALUES ('r2', 'b1', 'New Title', 'tv', 'watched', ?, ?)`,
        )
        .run(now, now),
    ).not.toThrow();

    // user_rating is writable on the rebuilt table.
    db.prepare(`UPDATE recommendations SET user_rating = 8 WHERE id = 'r2'`).run();
    const updated = db.prepare(`SELECT user_rating FROM recommendations WHERE id = 'r2'`).get() as {
      user_rating: number;
    };
    expect(updated.user_rating).toBe(8);
  });

  it("is a no-op when the table already supports 'watched'", () => {
    const db = makeOldDb();
    ensureWatchedStatusSupport(db);
    const before = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='recommendations'`)
      .get();
    ensureWatchedStatusSupport(db);
    const after = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='recommendations'`)
      .get();
    expect(after).toEqual(before);
  });
});
