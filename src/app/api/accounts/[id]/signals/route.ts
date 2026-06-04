import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range"); // "7" | "30" | "180" | "all"
  const category = searchParams.get("category"); // specific category or "all"
  const type = searchParams.get("type"); // "growth" | "risk" | "neutral" | "all"
  const scope = searchParams.get("scope"); // "all" | "target"
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const entity = await db.entity.findUnique({ where: { id } });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Build Prisma query filters
    const whereClause: any = {
      accountId: id,
    };

    // Filter by Time Range
    if (range && range !== "all") {
      const days = parseInt(range, 10);
      if (!isNaN(days)) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - days);
        whereClause.publishedAt = {
          gte: dateLimit,
        };
      }
    }

    // Filter by Category
    if (category && category !== "all") {
      whereClause.category = category;
    }

    // Filter by Type
    if (type && type !== "all") {
      whereClause.type = type;
    }

    // Filter by Scope (aboutRole = target vs all)
    if (scope === "target") {
      whereClause.aboutRole = "target";
    }

    const totalCount = await db.signal.count({
      where: { accountId: id }
    });

    const dbSignals = await db.signal.findMany({
      where: whereClause,
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    const items = dbSignals.map(sig => {
      // Calculate age_days derived field
      const ageMs = new Date().getTime() - new Date(sig.publishedAt).getTime();
      const age_days = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));

      return {
        id: sig.id,
        entity: { id: sig.entityId, display_name: sig.entityId === id ? entity.displayName : "Competitor" },
        about_role: sig.aboutRole,
        category: sig.category,
        type: sig.type,
        severity: sig.severity,
        title: sig.title,
        summary: sig.summary,
        raw_excerpt: sig.rawExcerpt,
        published_at: sig.publishedAt.toISOString(),
        retrieved_at: sig.retrievedAt.toISOString(),
        age_days,
        sources: JSON.parse(sig.sources),
        confidence: sig.confidence,
        is_illustrative: sig.isIllustrative,
      };
    });

    return NextResponse.json({
      items,
      total: totalCount,
      shown: items.length,
    });
  } catch (err) {
    console.error("API accounts/signals failed:", err);
    return NextResponse.json({ error: "Failed to retrieve signals feed" }, { status: 500 });
  }
}
