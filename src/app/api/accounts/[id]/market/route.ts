import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const market = await db.marketQuote.findFirst({
      where: { entityId: id },
      orderBy: { asOf: "desc" },
    });

    // Default sparkline points matching the trend
    const sparkline = [4800, 4820, 4850, 4830, 4840, 4860, 4850];

    // Correlate market reactions to recent signals (illustration)
    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: { publishedAt: "desc" },
      take: 2,
    });

    const reactions = dbSignals.map((sig, index) => ({
      signal_id: sig.id,
      dir: sig.type === "growth" ? "up" : sig.type === "risk" ? "down" : "flat",
      note: sig.category === "ma" 
        ? "Shares jumped +2.3% on combinations details" 
        : sig.category === "earnings" 
        ? "Price rose +1.1% post productivity savings confirmation"
        : "Market reacted neutrally to sector regulations details",
    }));

    const responseData = market ? {
      price: market.price,
      currency: market.currency,
      change_pct: market.changePct,
      week52: { low: market.week52Low, high: market.week52High },
      market_cap: market.marketCap,
      pe: market.pe ?? 19,
      dividend_yield: market.dividendYield ?? 3.4,
      consensus: market.consensus ? JSON.parse(market.consensus) : { buy: 11, hold: 6, sell: 1, rating: "Buy" },
      sparkline,
      reactions,
      is_delayed: market.isDelayed,
      as_of: market.asOf.toISOString(),
      source: JSON.parse(market.source),
    } : {
      price: 4850,
      currency: "GBp",
      change_pct: 0.9,
      week52: { low: 4180, high: 5120 },
      market_cap: "≈ £115B",
      pe: 19,
      dividend_yield: 3.4,
      consensus: { buy: 11, hold: 6, sell: 1, rating: "Buy" },
      sparkline,
      reactions,
      is_delayed: true,
      as_of: new Date().toISOString(),
      source: { publisher: "Twelve Data (delayed)", url: "https://twelvedata.com" },
    };

    return NextResponse.json(responseData);
  } catch (err) {
    console.error("API accounts/market failed:", err);
    return NextResponse.json({ error: "Failed to retrieve market data" }, { status: 500 });
  }
}
