import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const resolvedParams = await params;
  const accountId = resolvedParams.accountId;
  const userId = "default-user";

  try {
    await db.watchlist.deleteMany({
      where: {
        userId,
        accountId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE api/watchlist failed:", err);
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
  }
}
