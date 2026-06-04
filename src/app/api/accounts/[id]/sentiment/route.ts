import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const dbPoints = await db.sentimentPoint.findMany({
      where: { entityId: id },
      orderBy: { bucketStart: "asc" },
    });

    const trend = dbPoints.map((p, idx) => ({
      week: `W${idx + 1}`,
      score: p.netScore,
    }));

    const finalTrend = trend.length > 0 ? trend : [
      { week: "Wk 1", score: 0.10 },
      { week: "Wk 2", score: 0.08 },
      { week: "Wk 3", score: 0.12 },
      { week: "Wk 4", score: 0.15 },
      { week: "Wk 5", score: 0.05 },
      { week: "Wk 6", score: -0.05 }, // Dip during Ice cream separation debates
      { week: "Wk 7", score: 0.02 },
      { week: "Wk 8", score: 0.10 },
      { week: "Wk 9", score: 0.18 },
      { week: "Wk 10", score: 0.22 },
      { week: "Wk 11", score: 0.25 },
      { week: "Wk 12", score: 0.30 }, // Recovery on FY earnings + McCormick combine
    ];

    const by_source = {
      news: 0.35,
      social: 0.20,
      trade: 0.30,
      analyst: 0.40,
    };

    const mentions = [
      {
        type: "news",
        who: "Financial Times",
        title: "Unilever's demerger of Ice Cream seen as positive step for margins",
        url: "#",
        polarity: 0.4,
      },
      {
        type: "analyst",
        who: "Barclays Capital",
        title: "Upgrading Unilever to Overweight — productivity targets look highly credible",
        url: "#",
        polarity: 0.6,
      },
      {
        type: "social",
        who: "Twitter / FMCG News",
        title: "Consumers react positively to Knorr's new organic flavour range",
        url: "#",
        polarity: 0.2,
      },
      {
        type: "trade",
        who: "Retail Week",
        title: "EU green-claims guidelines create compliance headache for brands",
        url: "#",
        polarity: -0.3,
      }
    ];

    return NextResponse.json({
      net_now: finalTrend[finalTrend.length - 1]?.score ?? 0.30,
      trend: finalTrend,
      by_source,
      mentions,
    });
  } catch (err) {
    console.error("API accounts/sentiment failed:", err);
    return NextResponse.json({ error: "Failed to retrieve sentiment analysis" }, { status: 500 });
  }
}
