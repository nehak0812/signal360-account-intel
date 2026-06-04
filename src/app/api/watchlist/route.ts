import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const userId = "default-user";

  try {
    const list = await db.watchlist.findMany({
      where: { userId },
    });

    const accounts = await Promise.all(
      list.map(async (item) => {
        const entity = await db.entity.findUnique({
          where: { id: item.accountId },
        });

        if (!entity) return null;

        const score = await db.score.findFirst({
          where: { accountId: item.accountId },
          orderBy: { computedAt: "desc" },
        });

        const latestSignal = await db.signal.findFirst({
          where: { accountId: item.accountId },
          orderBy: { publishedAt: "desc" },
        });

        return {
          entity: {
            id: entity.id,
            display_name: entity.displayName,
            tickers: entity.tickers ? JSON.parse(entity.tickers) : [],
          },
          momentum: score?.momentum ?? 50,
          status: score?.overallStatus ?? "mixed",
          latest_signal: latestSignal ? latestSignal.title : "No recent signals",
        };
      })
    );

    return NextResponse.json({ accounts: accounts.filter(Boolean) });
  } catch (err) {
    console.error("GET api/watchlist failed:", err);
    return NextResponse.json({ error: "Failed to retrieve watchlist" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = "default-user";

  try {
    const body = await request.json() as { accountId: string };
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const linked = await db.watchlist.findUnique({
      where: {
        userId_accountId: { userId, accountId },
      },
    });

    if (!linked) {
      await db.watchlist.create({
        data: {
          userId,
          accountId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST api/watchlist failed:", err);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}
