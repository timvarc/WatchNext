import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";
import { getConfig } from "./config";
import { getLibraryGroup } from "./library-groups";
import { requestRecommendations, type RecommendationItem } from "./openai";
import { searchTitle } from "./tmdb";
import type {
  LibraryItemRow,
  MediaType,
  RecommendationRow,
  TasteProfile,
} from "./types";

export { syncLibrary } from "./plex";

const TOP_RATED_LIMIT = 30;
const RECENTLY_WATCHED_LIMIT = 30;
const GENRE_STATS_LIMIT = 15;
const DEFAULT_GENRE_WEIGHT = 3;

function normalizeKey(title: string, year: number | null, mediaType: string): string {
  return `${title.trim().toLowerCase()}|${year ?? ""}|${mediaType}`;
}

export function sectionScopeClause(sectionKeys?: string[]): {
  where: string;
  params: string[];
} {
  if (!sectionKeys || sectionKeys.length === 0) return { where: "1=1", params: [] };
  return {
    where: `section_key IN (${sectionKeys.map(() => "?").join(",")})`,
    params: sectionKeys,
  };
}

export function buildTasteProfile(
  db: Database.Database = getDb(),
  sectionKeys?: string[],
  libraryGroupId: string | null = null,
): TasteProfile {
  const scope = sectionScopeClause(sectionKeys);
  const relevantItems = db
    .prepare<string[], LibraryItemRow>(
      `SELECT * FROM library_items WHERE (user_rating IS NOT NULL OR view_count > 0) AND ${scope.where}`,
    )
    .all(...scope.params);

  const genreWeights = new Map<string, number>();
  for (const item of relevantItems) {
    if (!item.genres) continue;
    const genres: string[] = JSON.parse(item.genres);
    const weight = item.user_rating ?? DEFAULT_GENRE_WEIGHT;
    for (const genre of genres) {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight);
    }
  }

  const watchedGenreRows = db
    .prepare<
      [string | null],
      Pick<RecommendationRow, "genres" | "user_rating">
    >(
      `SELECT genres, user_rating FROM recommendations
       WHERE status = 'watched' AND user_rating IS NOT NULL AND genres IS NOT NULL
         AND library_group_id IS ?`,
    )
    .all(libraryGroupId);
  for (const row of watchedGenreRows) {
    const genres: string[] = JSON.parse(row.genres as string);
    const weight = row.user_rating as number;
    for (const genre of genres) {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight);
    }
  }

  const genreStats = [...genreWeights.entries()]
    .map(([genre, weightedScore]) => ({ genre, weightedScore }))
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, GENRE_STATS_LIMIT);

  const topRatedRows = db
    .prepare<(string | number)[], LibraryItemRow>(
      `SELECT * FROM library_items WHERE user_rating IS NOT NULL AND ${scope.where} ORDER BY user_rating DESC LIMIT ?`,
    )
    .all(...scope.params, TOP_RATED_LIMIT);
  const topRated = topRatedRows.map((row) => ({
    title: row.title,
    year: row.year,
    genre: firstGenre(row.genres),
    rating: row.user_rating as number,
  }));

  const recentRows = db
    .prepare<(string | number)[], LibraryItemRow>(
      `SELECT * FROM library_items WHERE last_viewed_at IS NOT NULL AND ${scope.where} ORDER BY last_viewed_at DESC LIMIT ?`,
    )
    .all(...scope.params, RECENTLY_WATCHED_LIMIT);
  const recentlyWatched = recentRows.map((row) => ({
    title: row.title,
    year: row.year,
    genre: firstGenre(row.genres),
  }));

  return { genreStats, topRated, recentlyWatched };
}

function firstGenre(genresJson: string | null): string {
  if (!genresJson) return "Unknown";
  const genres: string[] = JSON.parse(genresJson);
  return genres[0] ?? "Unknown";
}

export function getOwnedTitleLines(
  db: Database.Database = getDb(),
  sectionKeys?: string[],
): string[] {
  const scope = sectionScopeClause(sectionKeys);
  const rows = db
    .prepare<string[], Pick<LibraryItemRow, "title" | "year" | "type">>(
      `SELECT title, year, type FROM library_items WHERE ${scope.where}`,
    )
    .all(...scope.params);
  return rows.map(
    (row) => `${row.title} (${row.year ?? "?"}) [${row.type === "show" ? "tv" : "movie"}]`,
  );
}

export function getPreviouslyRecommendedTitleLines(
  libraryGroupId: string | null,
  db: Database.Database = getDb(),
): string[] {
  const rows = db
    .prepare<[string | null], Pick<RecommendationRow, "title" | "year" | "media_type">>(
      `SELECT DISTINCT title, year, media_type FROM recommendations WHERE library_group_id IS ?`,
    )
    .all(libraryGroupId);
  return rows.map((row) => `${row.title} (${row.year ?? "?"}) [${row.media_type}]`);
}

export function getDismissedTitleLines(
  libraryGroupId: string | null,
  db: Database.Database = getDb(),
): string[] {
  const rows = db
    .prepare<[string | null], Pick<RecommendationRow, "title" | "year" | "media_type">>(
      `SELECT DISTINCT title, year, media_type FROM recommendations WHERE status = 'no' AND library_group_id IS ?`,
    )
    .all(libraryGroupId);
  return rows.map((row) => `${row.title} (${row.year ?? "?"}) [${row.media_type}]`);
}

export function getWatchedFeedback(
  libraryGroupId: string | null,
  db: Database.Database = getDb(),
): { title: string; year: number | null; rating: number }[] {
  const rows = db
    .prepare<
      [string | null],
      { title: string; year: number | null; rating: number }
    >(
      `SELECT title, year, user_rating as rating FROM recommendations
       WHERE status = 'watched' AND user_rating IS NOT NULL AND library_group_id IS ?
       ORDER BY updated_at DESC`,
    )
    .all(libraryGroupId);
  return rows;
}

export function buildRecommendationPrompt(
  profile: TasteProfile,
  ownedLines: string[],
  previouslyRecommendedLines: string[],
  watchedFeedback: { title: string; year: number | null; rating: number }[] = [],
  dismissedLines: string[] = [],
): { system: string; user: string } {
  const system = `You are a movie and TV recommendation engine. Given a viewer's taste profile,
suggest titles they do not already own and have not already been recommended before.
Only recommend real, existing movies or TV shows. Ground each recommendation's "reason" in
specific signals from the taste profile (genres, rated titles, or recently watched titles).
Use the ratings of previously recommended titles they've watched, and the titles they
dismissed, to steer future suggestions toward what actually landed and away from what didn't.
Respond using the provided structured schema only.`;

  const genreStatsText = profile.genreStats
    .map((g) => `- ${g.genre}: weighted score ${g.weightedScore.toFixed(1)}`)
    .join("\n");
  const topRatedText = profile.topRated
    .map((t) => `- ${t.title} (${t.year ?? "?"}) [${t.genre}] — rated ${t.rating}/10`)
    .join("\n");
  const recentlyWatchedText = profile.recentlyWatched
    .map((t) => `- ${t.title} (${t.year ?? "?"}) [${t.genre}]`)
    .join("\n");
  const watchedFeedbackText = watchedFeedback
    .map((t) => `- ${t.title} (${t.year ?? "?"}) — rated ${t.rating}/10`)
    .join("\n");

  const user = `## Genre preferences (weighted by rating)
${genreStatsText || "(no genre data yet)"}

## Top-rated titles
${topRatedText || "(no rated titles yet)"}

## Recently watched titles
${recentlyWatchedText || "(no watch history yet)"}

## Your ratings of previous recommendations you've watched
${watchedFeedbackText || "(none yet)"}

## Owned titles (do not recommend any of these)
${ownedLines.join("\n") || "(none)"}

## Previously recommended titles (do not recommend again)
${previouslyRecommendedLines.join("\n") || "(none)"}

## Titles you dismissed (avoid recommending similar titles)
${dismissedLines.join("\n") || "(none)"}

Suggest a diverse list of 10-15 new recommendations based on the taste profile above.`;

  return { system, user };
}

export function isDuplicate(
  candidate: { title: string; year: number; mediaType: MediaType },
  ownedSet: Set<string>,
  recommendedSet: Set<string>,
): boolean {
  const key = normalizeKey(candidate.title, candidate.year, candidate.mediaType);
  return ownedSet.has(key) || recommendedSet.has(key);
}

function toNormalizedSet(lines: string[]): Set<string> {
  const set = new Set<string>();
  const pattern = /^(.*) \((\d{4}|\?)\) \[(movie|tv)\]$/;
  for (const line of lines) {
    const match = pattern.exec(line);
    if (!match) continue;
    const [, title, yearStr, mediaType] = match;
    const year = yearStr === "?" ? "" : yearStr;
    set.add(`${title.trim().toLowerCase()}|${year}|${mediaType}`);
  }
  return set;
}

export async function generateRecommendations(
  libraryGroupId?: string,
  db: Database.Database = getDb(),
): Promise<{ batchId: string; recommendations: RecommendationRow[] }> {
  let sectionKeys: string[] | undefined;
  let groupName: string | null = null;
  if (libraryGroupId) {
    const group = getLibraryGroup(libraryGroupId, db);
    if (!group) throw new Error(`Library group not found: ${libraryGroupId}`);
    sectionKeys = group.sectionKeys;
    groupName = group.name;
  }

  const profile = buildTasteProfile(db, sectionKeys, libraryGroupId ?? null);
  const ownedLines = getOwnedTitleLines(db, sectionKeys);
  const previouslyRecommendedLines = getPreviouslyRecommendedTitleLines(
    libraryGroupId ?? null,
    db,
  );
  const dismissedLines = getDismissedTitleLines(libraryGroupId ?? null, db);
  const watchedFeedback = getWatchedFeedback(libraryGroupId ?? null, db);

  const { system, user } = buildRecommendationPrompt(
    profile,
    ownedLines,
    previouslyRecommendedLines,
    watchedFeedback,
    dismissedLines,
  );

  const items = await requestRecommendations(system, user);

  const ownedSet = toNormalizedSet(ownedLines);
  const recommendedSet = toNormalizedSet(previouslyRecommendedLines);
  const filteredItems: RecommendationItem[] = items.filter(
    (item) =>
      !isDuplicate(
        { title: item.title, year: item.year, mediaType: item.mediaType },
        ownedSet,
        recommendedSet,
      ),
  );

  const enriched = await Promise.all(
    filteredItems.map(async (item) => {
      const match = await searchTitle(item.title, item.year, item.mediaType).catch(
        () => null,
      );
      return { item, match };
    }),
  );

  const batchId = randomUUID();
  const now = new Date().toISOString();
  const model = getConfig().openaiModel;

  const insertBatch = db.prepare(`
    INSERT INTO recommendation_batches (
      id, created_at, model, taste_profile_summary, item_count,
      library_group_id, library_group_name, section_keys
    )
    VALUES (
      @id, @created_at, @model, @taste_profile_summary, @item_count,
      @library_group_id, @library_group_name, @section_keys
    )
  `);
  const insertRecommendation = db.prepare(`
    INSERT INTO recommendations (
      id, batch_id, title, year, media_type, reason, tmdb_id, poster_path,
      overview, vote_average, status, genres, library_group_id, created_at, updated_at
    ) VALUES (
      @id, @batch_id, @title, @year, @media_type, @reason, @tmdb_id, @poster_path,
      @overview, @vote_average, 'pending', @genres, @library_group_id, @created_at, @updated_at
    )
  `);

  const rows: RecommendationRow[] = enriched.map(({ item, match }) => ({
    id: randomUUID(),
    batch_id: batchId,
    title: item.title,
    year: item.year,
    media_type: item.mediaType,
    reason: item.reason,
    tmdb_id: match?.tmdbId ?? null,
    poster_path: match?.posterPath ?? null,
    overview: match?.overview ?? null,
    vote_average: match?.voteAverage ?? null,
    status: "pending",
    user_rating: null,
    genres: match?.genres && match.genres.length > 0 ? JSON.stringify(match.genres) : null,
    library_group_id: libraryGroupId ?? null,
    created_at: now,
    updated_at: now,
  }));

  const insertAll = db.transaction(() => {
    insertBatch.run({
      id: batchId,
      created_at: now,
      model,
      taste_profile_summary: JSON.stringify({
        profile,
        ownedCount: ownedLines.length,
        previouslyRecommendedCount: previouslyRecommendedLines.length,
        dismissedCount: dismissedLines.length,
        watchedFeedbackCount: watchedFeedback.length,
      }),
      item_count: rows.length,
      library_group_id: libraryGroupId ?? null,
      library_group_name: groupName,
      section_keys: JSON.stringify(sectionKeys ?? []),
    });
    for (const row of rows) insertRecommendation.run(row);
  });
  insertAll();

  return { batchId, recommendations: rows };
}
