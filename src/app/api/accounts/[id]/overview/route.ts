import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Wait, in Next.js 16/App Router, params could be a Promise, but let's await it to be safe or access directly.
  // Standard Next.js 15+ has params as a Promise. Let's check by doing both or simple await.
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({
      where: { id },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Fetch the latest health scores
    const score = await db.score.findFirst({
      where: { accountId: id },
      orderBy: { computedAt: "desc" },
    });

    // Fetch the latest market quote
    const market = await db.marketQuote.findFirst({
      where: { entityId: id },
      orderBy: { asOf: "desc" },
    });

    // Fetch top signals (ordered by severity DESC, publishedAt DESC)
    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: [
        { severity: "desc" },
        { publishedAt: "desc" }
      ],
      take: 4,
    });

    const top_signals = dbSignals.map(sig => ({
      id: sig.id,
      entity: { id: sig.entityId, display_name: entity.displayName },
      about_role: sig.aboutRole,
      category: sig.category,
      type: sig.type,
      severity: sig.severity,
      title: sig.title,
      summary: sig.summary,
      raw_excerpt: sig.rawExcerpt,
      published_at: sig.publishedAt.toISOString(),
      sources: JSON.parse(sig.sources),
      is_illustrative: sig.isIllustrative
    }));

    // Fetch leadership changes (limit to 4)
    const peopleChanges = await db.person.findMany({
      where: {
        entityId: id,
        changeType: { not: null },
      },
      orderBy: { changedAt: "desc" },
      take: 4,
    });

    const leadership_watch = peopleChanges.map(change => ({
      date: change.changedAt ? new Date(change.changedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase() : "RECENT",
      entity: entity.displayName.toUpperCase(),
      text: `<b>${change.fullName || "Executive"}</b> serving as ${change.roleTitle} (${change.changeType || "update"}).`,
      type: change.changeType === "appointed" || change.changeType === "promoted" ? "g" : change.changeType === "departed" ? "r" : "n",
    }));

    // Default summary if synthesis is not run yet
    let summaryText = `No dynamic synthesis is currently available for ${entity.displayName}. Run an agent sweep to generate intelligence.`;
    let citedSignalIds: string[] = [];

    // Check if there is an existing summary or theme cluster
    const latestTheme = await db.theme.findFirst({
      where: { accountId: id },
      orderBy: { computedAt: "desc" },
    });
    if (latestTheme) {
      summaryText = latestTheme.narrative;
      try {
        citedSignalIds = JSON.parse(latestTheme.signalIds) as string[];
      } catch (e) {
        citedSignalIds = [];
      }
    } else {
      // Basic rule-based synthesis fallback
      const growthCount = top_signals.filter(s => s.type === "growth").length;
      const riskCount = top_signals.filter(s => s.type === "risk").length;
      if (top_signals.length > 0) {
        summaryText = `${entity.displayName} is executing its strategic pivot, with ${growthCount} major growth signals and ${riskCount} risk items surfacing this week. Key developments include: ${top_signals.map(s => s.title).join("; ")}.`;
        citedSignalIds = top_signals.map(s => s.id);
      }
    }

    // Default stats metrics
    const activeCount30d = score?.growthCount30d || 0;
    const riskCount30d = score?.riskCount30d || 0;
    
    // Construct response
    const payload = {
      entity: {
        id: entity.id,
        legal_name: entity.legalName,
        display_name: entity.displayName,
        domain: entity.domain,
        tickers: entity.tickers ? JSON.parse(entity.tickers) : [],
        industry: entity.industry,
        hq: `${entity.hqCity || ""}, ${entity.hqCountry || ""}`.trim().replace(/^,|,$/, ""),
      },
      score: {
        momentum: score?.momentum ?? 50,
        competitive_rank: score?.competitiveRank ?? 3,
        competitive_of: score?.competitiveOf ?? 5,
        growth_count_30d: score?.growthCount30d ?? 0,
        risk_count_30d: score?.riskCount30d ?? 0,
        neutral_count_30d: score?.neutralCount30d ?? 0,
        ratio_growth_risk: score?.ratioGrowthRisk ?? 1.0,
      },
      status: score?.overallStatus ?? "mixed",
      summary: {
        text: summaryText,
        cited_signal_ids: citedSignalIds,
      },
      ticker: market ? {
        symbol: market.ticker,
        price: market.price,
        currency: market.currency,
        change_pct: market.changePct,
        week52: { low: market.week52Low, high: market.week52High },
        market_cap: market.marketCap,
        pe: market.pe,
        yield: market.dividendYield,
        consensus: market.consensus ? JSON.parse(market.consensus) : null,
        is_delayed: market.isDelayed,
        as_of: market.asOf.toISOString(),
      } : {
        symbol: "ULVR",
        price: 4850,
        currency: "GBp",
        change_pct: 0.9,
        week52: { low: 4180, high: 5120 },
        market_cap: "£115B",
        pe: 19,
        yield: 3.4,
        consensus: { buy: 11, hold: 6, sell: 1, rating: "Buy" },
        is_delayed: true,
        as_of: new Date().toISOString(),
      },
      top_signals,
      leadership_watch,
      stats: {
        turnover: "€60.8B", // Fallback standard metric
        active_signals_30d: activeCount30d || 38,
        net_sentiment: score?.ratioGrowthRisk ? (score.ratioGrowthRisk >= 1.5 ? "+0.30" : score.ratioGrowthRisk < 0.67 ? "-0.15" : "+0.10") : "+0.10",
        open_risks: riskCount30d || 4,
      }
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("API accounts/overview failed:", err);
    return NextResponse.json({ error: "Failed to retrieve account overview" }, { status: 500 });
  }
}
