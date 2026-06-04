import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const body = await request.json() as { alert_ids?: string[] };
    const { alert_ids = [] } = body;

    if (alert_ids.length > 0) {
      await db.alert.updateMany({
        where: {
          id: { in: alert_ids },
          accountId: id,
        },
        data: {
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API accounts/alerts/read failed:", err);
    return NextResponse.json({ error: "Failed to mark alerts as read" }, { status: 500 });
  }
}
