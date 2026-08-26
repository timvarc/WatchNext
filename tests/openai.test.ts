import { describe, expect, it, vi, beforeEach } from "vitest";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { parse: parseMock } };
    },
  };
});

vi.mock("openai/helpers/zod", () => ({
  zodResponseFormat: vi.fn(() => ({ type: "json_schema" })),
}));

describe("requestRecommendations", () => {
  beforeEach(() => {
    parseMock.mockReset();
    vi.resetModules();
  });

  it("returns the parsed recommendations array", async () => {
    parseMock.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              recommendations: [
                { title: "Arrival", year: 2016, mediaType: "movie", reason: "sci-fi" },
              ],
            },
          },
        },
      ],
    });

    const { requestRecommendations } = await import("@/lib/openai");
    const result = await requestRecommendations("system", "user");
    expect(result).toEqual([
      { title: "Arrival", year: 2016, mediaType: "movie", reason: "sci-fi" },
    ]);
  });

  it("throws when the response has no parsed payload", async () => {
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: null } }] });

    const { requestRecommendations } = await import("@/lib/openai");
    await expect(requestRecommendations("system", "user")).rejects.toThrow(
      "OpenAI returned no parsed structured output",
    );
  });
});
