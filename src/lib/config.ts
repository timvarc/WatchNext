import { z } from "zod";

const envSchema = z.object({
  PLEX_URL: z.string().url(),
  PLEX_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o"),
  TMDB_API_KEY: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./data/watchnext.db"),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing or invalid environment variables: ${missing}. Check your .env file against .env.example.`,
    );
  }
  return {
    plexUrl: parsed.data.PLEX_URL.replace(/\/$/, ""),
    plexToken: parsed.data.PLEX_TOKEN,
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    openaiModel: parsed.data.OPENAI_MODEL,
    tmdbApiKey: parsed.data.TMDB_API_KEY,
    databasePath: parsed.data.DATABASE_PATH,
  };
}

let cachedConfig: ReturnType<typeof loadConfig> | undefined;

export function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
