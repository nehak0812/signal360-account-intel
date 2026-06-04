import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const dbPosts = await db.leadershipPost.findMany({
      where: { entityId: id },
    });

    const posts = dbPosts.map(p => ({
      id: p.id,
      person_role: p.personId || "Executive Persona",
      entity: "Unilever",
      about_role: p.aboutRole || "target",
      body: p.body,
      topics: p.topics ? JSON.parse(p.topics) : [],
      engagement: p.engagement ? JSON.parse(p.engagement) : { reactions: 120, comments: 14, reposts: 5 },
      posted_at: p.postedAt ? p.postedAt.toISOString() : new Date().toISOString(),
      source: JSON.parse(p.source),
      is_illustrative: p.isIllustrative,
    }));

    const finalPosts = posts.length > 0 ? posts : [
      {
        person_role: "CEO Persona",
        entity: "Unilever PLC",
        about_role: "target",
        body: "Today we share an update on the execution of our Growth Action Plan. Focused execution on 30 Power Brands, driving productivity savings of €670M, and reinvesting back in marketing. Consistent, competitive growth is our single priority.",
        topics: ["#PowerBrands", "#GrowthActionPlan", "#FMCG"],
        engagement: { reactions: 1420, comments: 84, reposts: 32 },
        posted_at: new Date("2026-06-03T10:00:00Z").toISOString(),
        source: { publisher: "paraphrased statement from company blog", url: "#" },
        is_illustrative: true,
      },
      {
        person_role: "Beauty & Wellbeing Executive",
        entity: "Unilever PLC",
        about_role: "target",
        body: "Scaling AI across our formulation pipelines is yielding incredible results. By matching molecular dynamics models with consumer preferences, we are accelerating product iteration cycles for our beauty brands by 40%.",
        topics: ["#RAndD", "#AIPivot", "#Innovation"],
        engagement: { reactions: 840, comments: 56, reposts: 18 },
        posted_at: new Date("2026-06-01T14:30:00Z").toISOString(),
        source: { publisher: "paraphrased statement from trade brief", url: "#" },
        is_illustrative: true,
      },
      {
        person_role: "Rival Exec (P&G)",
        entity: "Procter & Gamble",
        about_role: "competitor",
        body: "Strong organic sales growth continues. Focusing on superior product performance and margin optimization allows us to sustain investment through raw material volatility.",
        topics: ["#OrganicGrowth", "#CompetitorInsight"],
        engagement: { reactions: 1100, comments: 62, reposts: 22 },
        posted_at: new Date("2026-05-28T09:00:00Z").toISOString(),
        source: { publisher: "paraphrased statement from earnings brief", url: "#" },
        is_illustrative: true,
      }
    ];

    const trending_topics = ["#PowerBrands", "#GrowthActionPlan", "#AIPivot", "#ESG", "#Innovation", "#RAndD"];

    return NextResponse.json({
      trending_topics,
      posts: finalPosts,
    });
  } catch (err) {
    console.error("API accounts/linkedin-voices failed:", err);
    return NextResponse.json({ error: "Failed to retrieve LinkedIn voices" }, { status: 500 });
  }
}
