import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { RecommendationRow } from "@/lib/types";

const patchSchema = z.object({
  status: z.enum(["pending", "yes", "no", "watched"]),
  userRating: z.number().min(1).max(10).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const db = getDb();
    const updatedAt = new Date().toISOString();

    const result = db
      .prepare(
        `UPDATE recommendations SET status = ?, user_rating = ?, updated_at = ? WHERE id = ?`,
      )
      .run(body.status, body.userRating ?? null, updatedAt, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const row = db
      .prepare<[string], RecommendationRow>(`SELECT * FROM recommendations WHERE id = ?`)
      .get(id);
    return NextResponse.json(row);
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
