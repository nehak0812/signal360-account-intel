import { NextResponse } from "next/server";
import { syncSignals } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncSignals();
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to sync signals" }, { status: 500 });
    }
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Sync API Error:", error);
    return NextResponse.json({ error: "Failed to sync signals" }, { status: 500 });
  }
}
