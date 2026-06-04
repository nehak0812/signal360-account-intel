import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSweep } from "@/lib/agents/sweep";

export async function POST(request: NextRequest) {
  try {
    const candidate = await request.json();
    
    if (!candidate.displayName || !candidate.legalName) {
      return NextResponse.json({ error: "Missing displayName or legalName" }, { status: 400 });
    }

    // Check if the entity already exists in DB
    let entity = await db.entity.findFirst({
      where: {
        legalName: candidate.legalName,
      },
    });

    if (!entity) {
      console.log(`Creating new entity in database: ${candidate.displayName}`);
      entity = await db.entity.create({
        data: {
          legalName: candidate.legalName,
          displayName: candidate.displayName,
          domain: candidate.domain || null,
          tickers: candidate.tickers ? JSON.stringify(candidate.tickers) : "[]",
          industry: candidate.industry || "FMCG",
          hqCountry: candidate.hqCountry || null,
          hqCity: candidate.hqCity || null,
          identifiers: candidate.identifiers ? JSON.stringify(candidate.identifiers) : "{}",
          isPublic: candidate.isPublic ?? true,
        },
      });

      // Add to default-user's watchlist
      await db.watchlist.upsert({
        where: {
          userId_accountId: {
            userId: "default-user",
            accountId: entity.id,
          },
        },
        update: {},
        create: {
          userId: "default-user",
          accountId: entity.id,
        },
      });

      // Run initial sweep for this brand
      console.log(`Running initial sweep for newly registered entity: ${entity.displayName}`);
      try {
        await runSweep(entity.id);
      } catch (sweepErr) {
        console.error("Initial sweep failed for newly registered entity:", sweepErr);
      }
    }

    return NextResponse.json({ id: entity.id });
  } catch (err) {
    console.error("POST api/accounts failed:", err);
    return NextResponse.json({ error: "Failed to register entity" }, { status: 500 });
  }
}
