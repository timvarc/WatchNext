import { getConfig } from "./config";
import { getDb } from "./db";
import type { PlexLibraryType } from "./types";

export interface PlexSection {
  key: string;
  title: string;
  type: PlexLibraryType;
}

export interface ParsedGuids {
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: number;
}

interface PlexGuid {
  id: string;
}

interface PlexGenre {
  tag: string;
}

export interface PlexMetadataItem {
  ratingKey: string;
  title: string;
  year?: number;
  summary?: string;
  userRating?: number;
  viewCount?: number;
  lastViewedAt?: number;
  Genre?: PlexGenre[];
  Guid?: PlexGuid[];
}

interface PlexDirectory {
  key: string;
  title: string;
  type: string;
}

interface PlexContainerResponse<T> {
  MediaContainer: {
    Directory?: T extends PlexDirectory ? PlexDirectory[] : never;
    Metadata?: PlexMetadataItem[];
  };
}

function plexHeaders(): Record<string, string> {
  const { plexToken } = getConfig();
  return {
    Accept: "application/json",
    "X-Plex-Token": plexToken,
  };
}

async function plexFetch<T>(
  urlPath: string,
  extraHeaders: Record<string, string> = {},
): Promise<PlexContainerResponse<T>> {
  const { plexUrl } = getConfig();
  const res = await fetch(`${plexUrl}${urlPath}`, {
    headers: { ...plexHeaders(), ...extraHeaders },
  });
  if (!res.ok) {
    throw new Error(`Plex request failed (${res.status}): ${urlPath}`);
  }
  return res.json() as Promise<PlexContainerResponse<T>>;
}

export async function listSections(): Promise<PlexSection[]> {
  const data = await plexFetch<PlexDirectory>("/library/sections");
  const directories = data.MediaContainer.Directory ?? [];
  return directories
    .filter((d) => d.type === "movie" || d.type === "show")
    .map((d) => ({ key: d.key, title: d.title, type: d.type as PlexLibraryType }));
}

export async function* paginateSectionItems(
  sectionKey: string,
  mediaType: 1 | 2,
  pageSize = 100,
): AsyncGenerator<PlexMetadataItem[]> {
  let start = 0;
  for (;;) {
    const data = await plexFetch<never>(
      `/library/sections/${sectionKey}/all?type=${mediaType}&includeGuids=1`,
      {
        "X-Plex-Container-Start": String(start),
        "X-Plex-Container-Size": String(pageSize),
      },
    );
    const items = data.MediaContainer.Metadata ?? [];
    if (items.length === 0) return;
    yield items;
    if (items.length < pageSize) return;
    start += pageSize;
  }
}

export function parseGuids(guidArray: PlexGuid[] | undefined): ParsedGuids {
  const result: ParsedGuids = {};
  if (!guidArray) return result;
  for (const guid of guidArray) {
    const [scheme, value] = guid.id.split("://");
    if (!scheme || !value) continue;
    if (scheme === "tmdb") {
      const n = Number(value);
      if (!Number.isNaN(n)) result.tmdbId = n;
    } else if (scheme === "imdb") {
      result.imdbId = value;
    } else if (scheme === "tvdb") {
      const n = Number(value);
      if (!Number.isNaN(n)) result.tvdbId = n;
    }
  }
  return result;
}

export async function syncLibrary(): Promise<{
  moviesCount: number;
  showsCount: number;
  syncedAt: string;
}> {
  const db = getDb();
  const sections = await listSections();
  const syncedAt = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO library_items (
      id, plex_rating_key, type, title, year, tmdb_id, imdb_id, tvdb_id,
      genres, summary, user_rating, view_count, last_viewed_at,
      section_key, section_title, updated_at
    ) VALUES (
      @id, @plex_rating_key, @type, @title, @year, @tmdb_id, @imdb_id, @tvdb_id,
      @genres, @summary, @user_rating, @view_count, @last_viewed_at,
      @section_key, @section_title, @updated_at
    )
    ON CONFLICT(plex_rating_key) DO UPDATE SET
      type = excluded.type,
      title = excluded.title,
      year = excluded.year,
      tmdb_id = excluded.tmdb_id,
      imdb_id = excluded.imdb_id,
      tvdb_id = excluded.tvdb_id,
      genres = excluded.genres,
      summary = excluded.summary,
      user_rating = excluded.user_rating,
      view_count = excluded.view_count,
      last_viewed_at = excluded.last_viewed_at,
      section_key = excluded.section_key,
      section_title = excluded.section_title,
      updated_at = excluded.updated_at
  `);

  let moviesCount = 0;
  let showsCount = 0;

  for (const section of sections) {
    const mediaType = section.type === "movie" ? 1 : 2;
    for await (const page of paginateSectionItems(section.key, mediaType)) {
      const rows = page.map((item) => {
        const guids = parseGuids(item.Guid);
        return {
          id: item.ratingKey,
          plex_rating_key: item.ratingKey,
          type: section.type,
          title: item.title,
          year: item.year ?? null,
          tmdb_id: guids.tmdbId ?? null,
          imdb_id: guids.imdbId ?? null,
          tvdb_id: guids.tvdbId ?? null,
          genres: item.Genre ? JSON.stringify(item.Genre.map((g) => g.tag)) : null,
          summary: item.summary ?? null,
          user_rating: item.userRating ?? null,
          view_count: item.viewCount ?? 0,
          last_viewed_at: item.lastViewedAt ?? null,
          section_key: section.key,
          section_title: section.title,
          updated_at: syncedAt,
        };
      });

      const insertMany = db.transaction((entries: typeof rows) => {
        for (const entry of entries) upsert.run(entry);
      });
      insertMany(rows);

      if (section.type === "movie") moviesCount += rows.length;
      else showsCount += rows.length;
    }
  }

  return { moviesCount, showsCount, syncedAt };
}
