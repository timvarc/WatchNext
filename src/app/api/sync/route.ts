import { NextResponse } from "next/server";
import { matchWishlistToLibrary, syncLibrary } from "@/lib/recommend";

export async function POST() {
  try {
    const result = await syncLibrary();
    const fetchedMatchCount = matchWishlistToLibrary();
    return NextResponse.json({ ...result, fetchedMatchCount });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
