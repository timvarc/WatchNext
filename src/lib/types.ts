export type MediaType = "movie" | "tv";
export type PlexLibraryType = "movie" | "show";
export type RecommendationStatus = "pending" | "yes" | "no" | "watched";

export interface LibraryItemRow {
  id: string;
  plex_rating_key: string;
  type: PlexLibraryType;
  title: string;
  year: number | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  tvdb_id: number | null;
  genres: string | null;
  summary: string | null;
  user_rating: number | null;
  view_count: number;
  last_viewed_at: number | null;
  section_key: string;
  section_title: string;
  updated_at: string;
}

export interface RecommendationBatchRow {
  id: string;
  created_at: string;
  model: string;
  taste_profile_summary: string | null;
  item_count: number;
  library_group_id: string | null;
  library_group_name: string | null;
  section_keys: string;
}

export interface LibraryGroup {
  id: string;
  name: string;
  sectionKeys: string[];
  createdAt: string;
}

export interface RecommendationRow {
  id: string;
  batch_id: string;
  title: string;
  year: number | null;
  media_type: MediaType;
  reason: string | null;
  tmdb_id: number | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
  status: RecommendationStatus;
  user_rating: number | null;
  genres: string | null;
  library_group_id: string | null;
  fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TasteProfile {
  genreStats: { genre: string; weightedScore: number }[];
  topRated: { title: string; year: number | null; genre: string; rating: number }[];
  recentlyWatched: { title: string; year: number | null; genre: string }[];
}
