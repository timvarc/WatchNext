import { NextRequest, NextResponse } from "next/server";
import { deleteLibraryGroup } from "@/lib/library-groups";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = deleteLibraryGroup(id);
    if (!deleted) {
      return NextResponse.json({ error: "Library group not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
