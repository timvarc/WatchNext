import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA } from "@/lib/db";
import {
  buildTasteProfile,
  buildRecommendationPrompt,
  getDismissedTitleLines,
  getOwnedTitleLines,
  getPreviouslyRecommendedTitleLines,
  getWatchedFeedback,
  isDuplicate,
  sectionScopeClause,
} from "@/lib/recommend";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  return db;
}

function insertLibraryItem(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    title: string;
    year: number;
    type: "movie" | "show";
    genres: string[];
    user_rating: number | null;
    view_count: number;
    last_viewed_at: number | null;
    section_key: string;
  }>,
) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    plex_rating_key: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "movie",
    title: overrides.title ?? "Untitled",
    year: overrides.year ?? 2020,
    tmdb_id: null,
    imdb_id: null,
    tvdb_id: null,
    genres: JSON.stringify(overrides.genres ?? ["Drama"]),
    summary: null,
    user_rating: overrides.user_rating ?? null,
    view_count: overrides.view_count ?? 0,
    last_viewed_at: overrides.last_viewed_at ?? null,
    section_key: overrides.section_key ?? "",
    section_title: "",
    updated_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO library_items (id, plex_rating_key, type, title, year, tmdb_id, imdb_id, tvdb_id, genres, summary, user_rating, view_count, last_viewed_at, section_key, section_title, updated_at)
     VALUES (@id, @plex_rating_key, @type, @title, @year, @tmdb_id, @imdb_id, @tvdb_id, @genres, @summary, @user_rating, @view_count, @last_viewed_at, @section_key, @section_title, @updated_at)`,
  ).run(row);
}

describe("buildTasteProfile", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("weights genres by rating and defaults unrated-but-watched items to a neutral weight", () => {
    insertLibraryItem(db, { title: "A", genres: ["Sci-Fi"], user_rating: 9, view_count: 1 });
    insertLibraryItem(db, { title: "B", genres: ["Sci-Fi"], user_rating: null, view_count: 1 });
    insertLibraryItem(db, { title: "C", genres: ["Comedy"], user_rating: 2, view_count: 1 });

    const profile = buildTasteProfile(db);
    const sciFi = profile.genreStats.find((g) => g.genre === "Sci-Fi");
    const comedy = profile.genreStats.find((g) => g.genre === "Comedy");

    expect(sciFi?.weightedScore).toBe(9 + 3);
    expect(comedy?.weightedScore).toBe(2);
    expect(profile.genreStats[0].genre).toBe("Sci-Fi");
  });

  it("excludes items with no rating and no view count", () => {
    insertLibraryItem(db, { title: "Untouched", genres: ["Horror"], user_rating: null, view_count: 0 });
    const profile = buildTasteProfile(db);
    expect(profile.genreStats.find((g) => g.genre === "Horror")).toBeUndefined();
  });

  it("orders topRated by rating desc and limits to 30", () => {
    for (let i = 0; i < 35; i++) {
      insertLibraryItem(db, { title: `Movie ${i}`, user_rating: i, view_count: 1 });
    }
    const profile = buildTasteProfile(db);
    expect(profile.topRated).toHaveLength(30);
    expect(profile.topRated[0].rating).toBe(34);
  });

  it("orders recentlyWatched by last_viewed_at desc and limits to 30", () => {
    for (let i = 0; i < 35; i++) {
      insertLibraryItem(db, { title: `Show ${i}`, view_count: 1, last_viewed_at: i });
    }
    const profile = buildTasteProfile(db);
    expect(profile.recentlyWatched).toHaveLength(30);
    expect(profile.recentlyWatched[0].title).toBe("Show 34");
  });

  it("folds rated-and-genre'd watched recommendations into genre weights, scoped by library group", () => {
    insertLibraryItem(db, { title: "Base", genres: ["Comedy"], user_rating: 5, view_count: 1 });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recommendation_batches (id, created_at, model, taste_profile_summary, item_count) VALUES ('b1', ?, 'gpt-4o', '{}', 0)`,
    ).run(now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, media_type, reason, status, user_rating, genres, library_group_id, created_at, updated_at)
       VALUES ('r1', 'b1', 'Watched Sci-Fi', 'movie', 'x', 'watched', 9, ?, 'g1', ?, ?)`,
    ).run(JSON.stringify(["Sci-Fi"]), now, now);
    // Different group's feedback must not bleed into g1's profile.
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, media_type, reason, status, user_rating, genres, library_group_id, created_at, updated_at)
       VALUES ('r2', 'b1', 'Other Group Horror', 'movie', 'x', 'watched', 10, ?, 'g2', ?, ?)`,
    ).run(JSON.stringify(["Horror"]), now, now);
    // Unrated watched recommendation shouldn't contribute.
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, media_type, reason, status, user_rating, genres, library_group_id, created_at, updated_at)
       VALUES ('r3', 'b1', 'Unrated', 'movie', 'x', 'watched', NULL, ?, 'g1', ?, ?)`,
    ).run(JSON.stringify(["Documentary"]), now, now);

    const profile = buildTasteProfile(db, undefined, "g1");
    expect(profile.genreStats.find((g) => g.genre === "Sci-Fi")?.weightedScore).toBe(9);
    expect(profile.genreStats.find((g) => g.genre === "Horror")).toBeUndefined();
    expect(profile.genreStats.find((g) => g.genre === "Documentary")).toBeUndefined();
  });
});

describe("getOwnedTitleLines / getPreviouslyRecommendedTitleLines", () => {
  it("formats owned titles as 'Title (Year) [movie|tv]'", () => {
    const db = makeDb();
    insertLibraryItem(db, { title: "The Wire", year: 2002, type: "show" });
    insertLibraryItem(db, { title: "Heat", year: 1995, type: "movie" });

    const lines = getOwnedTitleLines(db);
    expect(lines).toContain("The Wire (2002) [tv]");
    expect(lines).toContain("Heat (1995) [movie]");
  });

  it("returns previously recommended titles across all statuses for the ungrouped scope", () => {
    const db = makeDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recommendation_batches (id, created_at, model, taste_profile_summary, item_count) VALUES ('b1', ?, 'gpt-4o', '{}', 2)`,
    ).run(now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, library_group_id, created_at, updated_at)
       VALUES ('r1', 'b1', 'Pending Thing', 2021, 'movie', 'x', 'pending', NULL, ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, library_group_id, created_at, updated_at)
       VALUES ('r2', 'b1', 'Rejected Thing', 2019, 'tv', 'x', 'no', NULL, ?, ?)`,
    ).run(now, now);

    const lines = getPreviouslyRecommendedTitleLines(null, db);
    expect(lines).toContain("Pending Thing (2021) [movie]");
    expect(lines).toContain("Rejected Thing (2019) [tv]");
  });

  it("scopes owned titles to the given section keys", () => {
    const db = makeDb();
    insertLibraryItem(db, { title: "Mine Movie", section_key: "sec-mine" });
    insertLibraryItem(db, { title: "Kids Movie", section_key: "sec-kids" });

    const mineLines = getOwnedTitleLines(db, ["sec-mine"]);
    expect(mineLines).toContain("Mine Movie (2020) [movie]");
    expect(mineLines).not.toContain("Kids Movie (2020) [movie]");
  });

  it("scopes previously recommended titles to the given library group", () => {
    const db = makeDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recommendation_batches (id, created_at, model, taste_profile_summary, item_count) VALUES ('b1', ?, 'gpt-4o', '{}', 2)`,
    ).run(now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, library_group_id, created_at, updated_at)
       VALUES ('r1', 'b1', 'Mine Thing', 2021, 'movie', 'x', 'pending', 'group-mine', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, library_group_id, created_at, updated_at)
       VALUES ('r2', 'b1', 'Kids Thing', 2019, 'tv', 'x', 'no', 'group-kids', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, library_group_id, created_at, updated_at)
       VALUES ('r3', 'b1', 'Ungrouped Thing', 2018, 'movie', 'x', 'pending', NULL, ?, ?)`,
    ).run(now, now);

    expect(getPreviouslyRecommendedTitleLines("group-mine", db)).toEqual([
      "Mine Thing (2021) [movie]",
    ]);
    expect(getPreviouslyRecommendedTitleLines("group-kids", db)).toEqual([
      "Kids Thing (2019) [tv]",
    ]);
    expect(getPreviouslyRecommendedTitleLines(null, db)).toEqual([
      "Ungrouped Thing (2018) [movie]",
    ]);
  });
});

describe("getDismissedTitleLines / getWatchedFeedback", () => {
  function seedRecommendation(
    db: Database.Database,
    overrides: Partial<{
      id: string;
      title: string;
      year: number;
      media_type: "movie" | "tv";
      status: string;
      user_rating: number | null;
      library_group_id: string | null;
      updated_at: string;
    }>,
  ) {
    const now = overrides.updated_at ?? new Date().toISOString();
    db.prepare(
      `INSERT INTO recommendations (id, batch_id, title, year, media_type, reason, status, user_rating, library_group_id, created_at, updated_at)
       VALUES (@id, 'b1', @title, @year, @media_type, 'x', @status, @user_rating, @library_group_id, @created_at, @updated_at)`,
    ).run({
      id: overrides.id ?? crypto.randomUUID(),
      title: overrides.title ?? "Untitled",
      year: overrides.year ?? 2020,
      media_type: overrides.media_type ?? "movie",
      status: overrides.status ?? "pending",
      user_rating: overrides.user_rating ?? null,
      library_group_id: overrides.library_group_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }

  function makeDbWithBatch(): Database.Database {
    const db = makeDb();
    db.prepare(
      `INSERT INTO recommendation_batches (id, created_at, model, taste_profile_summary, item_count) VALUES ('b1', ?, 'gpt-4o', '{}', 0)`,
    ).run(new Date().toISOString());
    return db;
  }

  it("returns only dismissed ('no') titles for the given scope", () => {
    const db = makeDbWithBatch();
    seedRecommendation(db, { title: "Dismissed Thing", year: 2019, status: "no" });
    seedRecommendation(db, { title: "Pending Thing", year: 2020, status: "pending" });
    seedRecommendation(db, { title: "Watched Thing", year: 2021, status: "watched" });

    const lines = getDismissedTitleLines(null, db);
    expect(lines).toEqual(["Dismissed Thing (2019) [movie]"]);
  });

  it("scopes dismissed titles by library group", () => {
    const db = makeDbWithBatch();
    seedRecommendation(db, { title: "Mine Dismissed", status: "no", library_group_id: "g1" });
    seedRecommendation(db, { title: "Kids Dismissed", status: "no", library_group_id: "g2" });

    expect(getDismissedTitleLines("g1", db)).toEqual(["Mine Dismissed (2020) [movie]"]);
    expect(getDismissedTitleLines("g2", db)).toEqual(["Kids Dismissed (2020) [movie]"]);
  });

  it("returns only rated watched titles, ignoring unrated ones", () => {
    const db = makeDbWithBatch();
    seedRecommendation(db, { title: "Rated", status: "watched", user_rating: 8 });
    seedRecommendation(db, { title: "Unrated", status: "watched", user_rating: null });
    seedRecommendation(db, { title: "Still Pending", status: "pending" });

    const feedback = getWatchedFeedback(null, db);
    expect(feedback).toEqual([{ title: "Rated", year: 2020, rating: 8 }]);
  });

  it("scopes watched feedback by library group", () => {
    const db = makeDbWithBatch();
    seedRecommendation(db, { title: "Mine Watched", status: "watched", user_rating: 7, library_group_id: "g1" });
    seedRecommendation(db, { title: "Kids Watched", status: "watched", user_rating: 5, library_group_id: "g2" });

    expect(getWatchedFeedback("g1", db)).toEqual([{ title: "Mine Watched", year: 2020, rating: 7 }]);
    expect(getWatchedFeedback("g2", db)).toEqual([{ title: "Kids Watched", year: 2020, rating: 5 }]);
  });
});

describe("sectionScopeClause", () => {
  it("returns an always-true clause with no params when no keys are given", () => {
    expect(sectionScopeClause()).toEqual({ where: "1=1", params: [] });
    expect(sectionScopeClause([])).toEqual({ where: "1=1", params: [] });
  });

  it("builds an IN clause with matching placeholders and params", () => {
    const result = sectionScopeClause(["a", "b", "c"]);
    expect(result.where).toBe("section_key IN (?,?,?)");
    expect(result.params).toEqual(["a", "b", "c"]);
  });
});

describe("isDuplicate", () => {
  it("matches case-insensitively against the owned set", () => {
    const ownedSet = new Set(["heat|1995|movie"]);
    const rejectedSet = new Set<string>();
    expect(
      isDuplicate({ title: "HEAT", year: 1995, mediaType: "movie" }, ownedSet, rejectedSet),
    ).toBe(true);
  });

  it("matches against the previously-recommended set", () => {
    const ownedSet = new Set<string>();
    const recommendedSet = new Set(["arrival|2016|movie"]);
    expect(
      isDuplicate({ title: "Arrival", year: 2016, mediaType: "movie" }, ownedSet, recommendedSet),
    ).toBe(true);
  });

  it("returns false for a genuinely new title", () => {
    const ownedSet = new Set(["heat|1995|movie"]);
    const recommendedSet = new Set(["arrival|2016|movie"]);
    expect(
      isDuplicate({ title: "Dune", year: 2021, mediaType: "movie" }, ownedSet, recommendedSet),
    ).toBe(false);
  });
});

describe("buildRecommendationPrompt", () => {
  it("includes exclusion lists and taste profile sections", () => {
    const profile = {
      genreStats: [{ genre: "Sci-Fi", weightedScore: 10 }],
      topRated: [{ title: "Arrival", year: 2016, genre: "Sci-Fi", rating: 9 }],
      recentlyWatched: [{ title: "Dune", year: 2021, genre: "Sci-Fi" }],
    };
    const { system, user } = buildRecommendationPrompt(
      profile,
      ["Heat (1995) [movie]"],
      ["Rejected Thing (2019) [tv]"],
    );

    expect(system).toContain("recommendation engine");
    expect(user).toContain("Heat (1995) [movie]");
    expect(user).toContain("Rejected Thing (2019) [tv]");
    expect(user).toContain("Sci-Fi");
    expect(user).toContain("Arrival");
    expect(user).toContain("(none yet)");
    expect(user).toContain("(none)");
  });

  it("includes watched-feedback ratings and dismissed titles when provided", () => {
    const profile = { genreStats: [], topRated: [], recentlyWatched: [] };
    const { user } = buildRecommendationPrompt(
      profile,
      [],
      [],
      [{ title: "Hacks", year: 2021, rating: 9 }],
      ["Nope Thing (2018) [movie]"],
    );

    expect(user).toContain("Hacks (2021) — rated 9/10");
    expect(user).toContain("Nope Thing (2018) [movie]");
    expect(user).toContain("dismissed");
  });
});
