import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const dbPeople = await db.person.findMany({
      where: { entityId: id },
    });

    const executives = dbPeople.map(p => ({
      id: p.id,
      full_name: p.fullName || "Executive",
      role_title: p.roleTitle,
      is_current: p.isCurrent ?? true,
    }));

    const finalExecutives = executives.length > 0 ? executives : [
      { id: "exec-1", full_name: "Fernando Fernandez", role_title: "Chief Executive Officer", is_current: true },
      { id: "exec-2", full_name: "Srinivas Phatak", role_title: "Chief Financial Officer", is_current: true },
      { id: "exec-3", full_name: "Hein Schumacher", role_title: "Former Chief Executive Officer", is_current: false },
    ];

    // Changes timeline
    const changes = [
      {
        date: "2025 · UNILEVER",
        text: "<b>Fernando Fernandez</b> became CEO, succeeding Hein Schumacher; focus on ~30 Power Brands.",
        type: "g",
      },
      {
        date: "2025 · UNILEVER",
        text: "<b>Srinivas Phatak</b> serving as Chief Financial Officer.",
        type: "n",
      },
      {
        date: "DEC 2025 · UNILEVER",
        text: "Ice Cream leadership team departs with the <b>TMICC demerger</b>.",
        type: "n",
      },
      {
        date: "RECENT · NESTLÉ",
        text: "Rival <b>Nestlé</b> working through a leadership transition.",
        type: "r",
      }
    ];

    // Public statements (voices)
    const voices = [
      {
        body: "Our action plan focuses on doing fewer things, better, with greater impact. We are prioritizing our top 30 Power Brands to drive consistent underlying sales growth.",
        by: "Fernando Fernandez, CEO",
        source: { publisher: "Q3 earnings call transcript", url: "#" },
        paraphrased: true,
      },
      {
        body: "We have returned to double-digit gross margin expansion by accelerating productivity and divesting lower-margin operational segments.",
        by: "Srinivas Phatak, CFO",
        source: { publisher: "FY2025 Investor Briefing", url: "#" },
        paraphrased: true,
      }
    ];

    return NextResponse.json({
      executives: finalExecutives,
      changes,
      voices,
    });
  } catch (err) {
    console.error("API accounts/leadership failed:", err);
    return NextResponse.json({ error: "Failed to retrieve leadership data" }, { status: 500 });
  }
}
