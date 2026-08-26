import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare<[], { lastSyncedAt: string | null; libraryItemCount: number }>(
        `SELECT MAX(updated_at) AS lastSyncedAt, COUNT(*) AS libraryItemCount FROM library_items`,
      )
      .get();
    return NextResponse.json({
      lastSyncedAt: row?.lastSyncedAt ?? null,
      libraryItemCount: row?.libraryItemCount ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
