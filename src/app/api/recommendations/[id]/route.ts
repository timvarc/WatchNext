import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { RecommendationRow } from "@/lib/types";

const patchSchema = z
  .object({
    status: z.enum(["pending", "yes", "no", "watched"]).optional(),
    userRating: z.number().min(1).max(10).optional(),
    fetched: z.boolean().optional(),
  })
  .refine((data) => data.status !== undefined || data.fetched !== undefined, {
    message: "Provide status and/or fetched",
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

    const sets: string[] = ["updated_at = ?"];
    const values: (string | number | null)[] = [updatedAt];
    if (body.status !== undefined) {
      sets.push("status = ?", "user_rating = ?");
      values.push(body.status, body.userRating ?? null);
    }
    if (body.fetched !== undefined) {
      sets.push("fetched_at = ?");
      values.push(body.fetched ? updatedAt : null);
    }
    values.push(id);

    const result = db
      .prepare(`UPDATE recommendations SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);

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
