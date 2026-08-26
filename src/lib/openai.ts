import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getConfig } from "./config";

const RecommendationItemSchema = z.object({
  title: z.string(),
  year: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  reason: z.string(),
});

export const RecommendationListSchema = z.object({
  recommendations: z.array(RecommendationItemSchema),
});

export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getConfig().openaiApiKey });
  }
  return client;
}

export async function requestRecommendations(
  systemPrompt: string,
  userPrompt: string,
): Promise<RecommendationItem[]> {
  const completion = await getClient().chat.completions.parse({
    model: getConfig().openaiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(
      RecommendationListSchema,
      "recommendation_list",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("OpenAI returned no parsed structured output");
  }
  return parsed.recommendations;
}
