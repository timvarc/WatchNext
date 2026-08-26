export function buildTmdbPosterUrl(
  posterPath: string | null,
  size = "w500",
): string | null {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
