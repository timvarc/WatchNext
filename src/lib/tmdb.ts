import { getConfig } from "./config";
import type { MediaType } from "./types";

export { buildTmdbPosterUrl } from "./posters";

export interface TmdbMatch {
  tmdbId: number;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
  genres: string[];
}

interface TmdbSearchResult {
  id: number;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids?: number[];
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
}

// TMDb's genre id -> name lists are stable, publicly documented, and rarely
// change, so they're hardcoded here rather than fetched from
// /genre/{movie|tv}/list on every request.
const MOVIE_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

export function mapGenreIds(
  genreIds: number[] | undefined,
  mediaType: MediaType,
): string[] {
  if (!genreIds) return [];
  const table = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
  return genreIds.map((id) => table[id]).filter((name): name is string => Boolean(name));
}

async function searchOnce(
  title: string,
  year: number | undefined,
  mediaType: MediaType,
): Promise<TmdbSearchResult | null> {
  const { tmdbApiKey } = getConfig();
  const endpoint = mediaType === "movie" ? "movie" : "tv";
  const yearParam = mediaType === "movie" ? "year" : "first_air_date_year";

  const params = new URLSearchParams({
    api_key: tmdbApiKey,
    query: title,
  });
  if (year) params.set(yearParam, String(year));

  const res = await fetch(
    `https://api.themoviedb.org/3/search/${endpoint}?${params.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`TMDb search failed (${res.status}) for "${title}"`);
  }
  const data = (await res.json()) as TmdbSearchResponse;
  return data.results[0] ?? null;
}

export async function searchTitle(
  title: string,
  year: number | undefined,
  mediaType: MediaType,
): Promise<TmdbMatch | null> {
  let result = await searchOnce(title, year, mediaType);
  if (!result && year) {
    result = await searchOnce(title, undefined, mediaType);
  }
  if (!result) return null;

  return {
    tmdbId: result.id,
    posterPath: result.poster_path,
    overview: result.overview,
    voteAverage: result.vote_average,
    genres: mapGenreIds(result.genre_ids, mediaType),
  };
}
