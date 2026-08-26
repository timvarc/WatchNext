import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchTitle, buildTmdbPosterUrl, mapGenreIds } from "@/lib/tmdb";

describe("mapGenreIds", () => {
  it("maps movie genre ids to names", () => {
    expect(mapGenreIds([28, 35], "movie")).toEqual(["Action", "Comedy"]);
  });

  it("maps tv genre ids to names using the tv-specific table", () => {
    expect(mapGenreIds([10759, 16], "tv")).toEqual(["Action & Adventure", "Animation"]);
  });

  it("silently drops unrecognized ids", () => {
    expect(mapGenreIds([28, 999999], "movie")).toEqual(["Action"]);
  });

  it("returns an empty array for undefined input", () => {
    expect(mapGenreIds(undefined, "movie")).toEqual([]);
  });
});

describe("buildTmdbPosterUrl", () => {
  it("builds a full TMDb image URL", () => {
    expect(buildTmdbPosterUrl("/abc.jpg")).toBe(
      "https://image.tmdb.org/t/p/w500/abc.jpg",
    );
  });

  it("returns null when posterPath is null", () => {
    expect(buildTmdbPosterUrl(null)).toBeNull();
  });
});

describe("searchTitle", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function jsonResponse(body: unknown) {
    return { ok: true, json: async () => body } as unknown as Response;
  }

  it("returns the first result on a successful year-filtered search", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            id: 1,
            poster_path: "/a.jpg",
            overview: "overview",
            vote_average: 7.5,
            genre_ids: [28],
          },
        ],
      }),
    );

    const match = await searchTitle("Inception", 2010, "movie");
    expect(match).toEqual({
      tmdbId: 1,
      posterPath: "/a.jpg",
      overview: "overview",
      voteAverage: 7.5,
      genres: ["Action"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries without the year when the year-filtered search is empty", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            { id: 2, poster_path: null, overview: "o", vote_average: 5 },
          ],
        }),
      );

    const match = await searchTitle("Some Show", 1999, "tv");
    expect(match?.tmdbId).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when both attempts are empty", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    const match = await searchTitle("Nonexistent Thing", 2020, "movie");
    expect(match).toBeNull();
  });

  it("does not retry when no year was provided", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [] }));

    const match = await searchTitle("No Year Title", undefined, "movie");
    expect(match).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
