import { NextResponse } from "next/server";
import { listSections } from "@/lib/plex";

export async function GET() {
  try {
    const sections = await listSections();
    return NextResponse.json(sections);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
