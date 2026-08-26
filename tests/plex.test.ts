import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseGuids, paginateSectionItems } from "@/lib/plex";

describe("parseGuids", () => {
  it("parses tmdb, imdb, and tvdb guids", () => {
    const result = parseGuids([
      { id: "tmdb://12345" },
      { id: "imdb://tt0111161" },
      { id: "tvdb://456" },
    ]);
    expect(result).toEqual({ tmdbId: 12345, imdbId: "tt0111161", tvdbId: 456 });
  });

  it("returns an empty object for undefined input", () => {
    expect(parseGuids(undefined)).toEqual({});
  });

  it("returns an empty object for an empty array", () => {
    expect(parseGuids([])).toEqual({});
  });

  it("ignores unrecognized schemes", () => {
    const result = parseGuids([{ id: "anidb://789" }, { id: "tmdb://42" }]);
    expect(result).toEqual({ tmdbId: 42 });
  });

  it("handles a mixed array with only some recognized entries", () => {
    const result = parseGuids([{ id: "tmdb://1" }, { id: "malformed" }]);
    expect(result).toEqual({ tmdbId: 1 });
  });
});

describe("paginateSectionItems", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockPage(metadata: { ratingKey: string; title: string }[]) {
    return {
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: metadata } }),
    };
  }

  it("yields full pages and stops on a short page", async () => {
    const fetchMock = vi.mocked(fetch);
    const fullPage = Array.from({ length: 2 }, (_, i) => ({
      ratingKey: `${i}`,
      title: `Item ${i}`,
    }));
    const shortPage = [{ ratingKey: "2", title: "Item 2" }];

    fetchMock
      .mockResolvedValueOnce(mockPage(fullPage) as unknown as Response)
      .mockResolvedValueOnce(mockPage(shortPage) as unknown as Response);

    const pages: unknown[] = [];
    for await (const page of paginateSectionItems("1", 1, 2)) {
      pages.push(page);
    }

    expect(pages).toEqual([fullPage, shortPage]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops immediately on an empty page", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockPage([]) as unknown as Response);

    const pages: unknown[] = [];
    for await (const page of paginateSectionItems("1", 1, 100)) {
      pages.push(page);
    }

    expect(pages).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
