import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { RecommendationRow, RecommendationStatus } from "@/lib/types";

const VALID_STATUSES: RecommendationStatus[] = ["pending", "yes", "no", "watched"];

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get("status");
    const libraryGroupId = request.nextUrl.searchParams.get("libraryGroupId");
    const db = getDb();

    if (statusParam && !VALID_STATUSES.includes(statusParam as RecommendationStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${statusParam}` },
        { status: 400 },
      );
    }

    const conditions: string[] = [];
    const params: string[] = [];
    if (statusParam) {
      conditions.push("status = ?");
      params.push(statusParam);
    }
    if (libraryGroupId) {
      conditions.push("library_group_id IS ?");
      params.push(libraryGroupId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = db
      .prepare<string[], RecommendationRow>(
        `SELECT * FROM recommendations ${where} ORDER BY created_at DESC`,
      )
      .all(...params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
