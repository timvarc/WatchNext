import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLibraryGroup, listLibraryGroups } from "@/lib/library-groups";

const createSchema = z.object({
  name: z.string().min(1),
  sectionKeys: z.array(z.string()).min(1),
});

export async function GET() {
  try {
    return NextResponse.json(listLibraryGroups());
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createSchema.parse(await request.json());
    const group = createLibraryGroup(body.name, body.sectionKeys);
    return NextResponse.json(group, { status: 201 });
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
