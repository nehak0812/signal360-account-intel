import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const competitorLinks = await db.competitorSet.findMany({
      where: { accountId: id },
      include: { competitorEntity: true },
      orderBy: { rank: "asc" },
    });

    const set = await Promise.all(
      competitorLinks.map(async (link) => {
        const comp = link.competitorEntity;
        
        // Fetch their latest score
        const score = await db.score.findFirst({
          where: { accountId: comp.id },
          orderBy: { computedAt: "desc" },
        });

        // Fetch their latest signal
        const latestSignal = await db.signal.findFirst({
          where: { entityId: comp.id },
          orderBy: { publishedAt: "desc" },
        });

        // Set up mock/real comparison values matching the prototype
        let revenue = "€80.2B";
        let margin = "48%";
        let sentiment = "+0.25";

        if (comp.displayName === "Procter & Gamble") {
          revenue = "$84.0B"; margin = "51%"; sentiment = "+0.28";
        } else if (comp.displayName === "Nestlé") {
          revenue = "CHF 93.0B"; margin = "46%"; sentiment = "-0.05";
        } else if (comp.displayName === "Colgate-Palmolive") {
          revenue = "$19.5B"; margin = "58%"; sentiment = "+0.15";
        } else if (comp.displayName === "Reckitt") {
          revenue = "£14.6B"; margin = "57%"; sentiment = "+0.10";
        }

        return {
          entity: {
            id: comp.id,
            display_name: comp.displayName,
            tickers: comp.tickers ? JSON.parse(comp.tickers) : [],
            industry: comp.industry,
          },
          momentum: score?.momentum ?? 55,
          revenue,
          gross_margin: margin,
          latest_signal: latestSignal ? latestSignal.title : "No recent signals",
          sentiment,
        };
      })
    );

    // Also inject the target entity as part of the dataset to allow the UI to highlight it
    const targetEntity = await db.entity.findUnique({ where: { id } });
    if (targetEntity) {
      const targetScore = await db.score.findFirst({
        where: { accountId: id },
        orderBy: { computedAt: "desc" },
      });
      const targetLatest = await db.signal.findFirst({
        where: { entityId: id },
        orderBy: { publishedAt: "desc" },
      });

      // Insert target at rank 1 or highlight position
      set.unshift({
        entity: {
          id: targetEntity.id,
          display_name: targetEntity.displayName,
          tickers: targetEntity.tickers ? JSON.parse(targetEntity.tickers) : [],
          industry: targetEntity.industry,
        },
        momentum: targetScore?.momentum ?? 70,
        revenue: "€60.8B",
        gross_margin: "42%",
        latest_signal: targetLatest ? targetLatest.title : "No recent signals",
        sentiment: targetScore?.ratioGrowthRisk ? (targetScore.ratioGrowthRisk >= 1.5 ? "+0.30" : "+0.10") : "+0.10",
      });
    }

    return NextResponse.json({ set });
  } catch (err) {
    console.error("API accounts/competitors failed:", err);
    return NextResponse.json({ error: "Failed to retrieve competitor landscape" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const body = await request.json() as { add?: string[]; remove?: string[] };
    const { add = [], remove = [] } = body;

    // Delete removed competitors
    if (remove.length > 0) {
      await db.competitorSet.deleteMany({
        where: {
          accountId: id,
          competitorEntityId: { in: remove },
        },
      });
    }

    // Add new competitors
    if (add.length > 0) {
      for (const compId of add) {
        // Resolve if exists
        const exists = await db.entity.findUnique({ where: { id: compId } });
        if (exists) {
          // Check if already in competitor set
          const linked = await db.competitorSet.findUnique({
            where: {
              accountId_competitorEntityId: {
                accountId: id,
                competitorEntityId: compId,
              },
            },
          });

          if (!linked) {
            await db.competitorSet.create({
              data: {
                accountId: id,
                competitorEntityId: compId,
                rank: 99, // default rank
                source: "user",
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API accounts/competitors update failed:", err);
    return NextResponse.json({ error: "Failed to update competitor set" }, { status: 500 });
  }
}
