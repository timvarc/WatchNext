import { NextResponse } from "next/server";
import { syncLibrary } from "@/lib/recommend";

export async function POST() {
  try {
    const result = await syncLibrary();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
