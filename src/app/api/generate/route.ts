import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateRecommendations } from "@/lib/recommend";

const bodySchema = z.object({
  libraryGroupId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const parsed = rawBody ? bodySchema.parse(JSON.parse(rawBody)) : {};
    const result = await generateRecommendations(parsed.libraryGroupId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
