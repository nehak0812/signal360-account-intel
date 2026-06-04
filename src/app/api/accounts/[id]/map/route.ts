import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const score = await db.score.findFirst({
      where: { accountId: id },
      orderBy: { computedAt: "desc" },
    });

    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: { publishedAt: "desc" },
    });

    // 1. Map signals into plot points
    const plot = dbSignals.map((sig, index) => {
      // Map to 2D coordinates
      // x_momentum (growth moves right, risk moves left)
      let x_momentum = 50;
      if (sig.type === "growth") {
        x_momentum = 60 + (sig.severity * 7) + (index % 5); // 67 to 99
      } else if (sig.type === "risk") {
        x_momentum = 40 - (sig.severity * 7) - (index % 5); // 33 to 1
      } else {
        x_momentum = 45 + (index % 10); // 45 to 55
      }

      // y_impact (severity maps to higher impact)
      const y_impact = (sig.severity * 18) + (index % 8); // 18 to 98

      return {
        id: sig.id,
        label: sig.title,
        x_momentum,
        y_impact,
        severity: sig.severity,
        type: sig.type,
      };
    });

    // 2. Fetch Theme Clusters
    const dbThemes = await db.theme.findMany({
      where: { accountId: id },
      orderBy: { computedAt: "desc" },
    });

    const themes = dbThemes.map(t => ({
      label: t.label,
      type: t.type,
      narrative: t.narrative,
      strength: t.strength,
      signal_ids: JSON.parse(t.signalIds),
    }));

    // If no themes in DB, return default rule-based clusters
    const finalThemes = themes.length > 0 ? themes : [
      {
        label: "Strategic Portfolio Sharpening",
        type: "growth",
        narrative: "Focusing core operations on Beauty, Well-being and Personal Care via major demergers and brand integrations.",
        strength: 0.90,
        signal_ids: dbSignals.filter(s => s.category === "ma" || s.category === "restructure").map(s => s.id),
      },
      {
        label: "Regulatory ESG Scrutiny",
        type: "risk",
        narrative: "Adapting to tightening EU environmental substantiation and packaging compliance guidelines.",
        strength: 0.65,
        signal_ids: dbSignals.filter(s => s.category === "regulatory" || s.category === "esg").map(s => s.id),
      }
    ];

    return NextResponse.json({
      plot,
      balance: {
        growth: score?.growthCount30d ?? dbSignals.filter(s => s.type === "growth").length,
        risk: score?.riskCount30d ?? dbSignals.filter(s => s.type === "risk").length,
        neutral: score?.neutralCount30d ?? dbSignals.filter(s => s.type === "neutral").length,
        ratio_30d: score?.ratioGrowthRisk ?? 1.0,
      },
      themes: finalThemes,
    });
  } catch (err) {
    console.error("API accounts/map failed:", err);
    return NextResponse.json({ error: "Failed to retrieve map aggregation" }, { status: 500 });
  }
}
