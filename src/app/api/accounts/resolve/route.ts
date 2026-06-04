import { NextRequest, NextResponse } from "next/server";
import { resolveEntity } from "@/lib/agents/entity-resolution";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ candidates: [] });
  }

  try {
    const candidates = await resolveEntity(q);

    // For each candidate, check if it's already in the DB and return its DB ID if present
    const enrichedCandidates = await Promise.all(
      candidates.map(async (cand) => {
        const dbEntity = await db.entity.findFirst({
          where: {
            legalName: cand.legalName,
          },
        });
        return {
          ...cand,
          id: dbEntity?.id || null, // If it exists in DB, provide the real ID
        };
      })
    );

    return NextResponse.json({ candidates: enrichedCandidates });
  } catch (err) {
    console.error("API accounts/resolve failed:", err);
    return NextResponse.json({ error: "Failed to resolve entity" }, { status: 500 });
  }
}
