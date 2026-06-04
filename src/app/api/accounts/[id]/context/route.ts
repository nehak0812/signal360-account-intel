import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const dbSignals = await db.signal.findMany({
      where: {
        accountId: id,
        aboutRole: { in: ["industry", "geo"] },
      },
      orderBy: { publishedAt: "desc" },
    });

    const items = dbSignals.map(sig => ({
      category_label: sig.category.toUpperCase(),
      title: sig.title,
      body: sig.summary,
      source: sig.sources ? JSON.parse(sig.sources)[0] || { publisher: "news", url: "#" } : { publisher: "news", url: "#" },
      published_at: sig.publishedAt.toISOString(),
    }));

    const finalItems = items.length > 0 ? items : [
      {
        category_label: "REGULATORY · EU",
        title: "EU green-claims & packaging rules tighten",
        body: "Stricter substantiation for environmental marketing across consumer goods — directly relevant to Unilever's brand claims.",
        source: { publisher: "SECTOR REGULATION", url: "#" },
        published_at: new Date("2026-06-02T08:00:00Z").toISOString(),
      },
      {
        category_label: "CONSUMER",
        title: "GLP-1 weight-loss drugs reshape food & snacking demand",
        body: "Shifting appetite patterns are a structural watch-item for the whole packaged-food sector.",
        source: { publisher: "MACRO TREND", url: "#" },
        published_at: new Date("2026-05-25T08:00:00Z").toISOString(),
      },
      {
        category_label: "GEO · EM",
        title: "Emerging-market consumption recovering",
        body: "Improving demand in India and other key markets supports Unilever's large EM exposure.",
        source: { publisher: "REGIONAL DEMAND", url: "#" },
        published_at: new Date("2026-05-20T08:00:00Z").toISOString(),
      },
      {
        category_label: "RETAIL",
        title: "Private-label pressure persists",
        body: "Value-seeking shoppers keep retailer own-brands competitive — a margin headwind for branded FMCG.",
        source: { publisher: "CHANNEL DYNAMICS", url: "#" },
        published_at: new Date("2026-05-15T08:00:00Z").toISOString(),
      }
    ];

    return NextResponse.json({ items: finalItems });
  } catch (err) {
    console.error("API accounts/context failed:", err);
    return NextResponse.json({ error: "Failed to retrieve context data" }, { status: 500 });
  }
}
