import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import Parser from "rss-parser";
import crypto from "crypto";
import { Type } from "@google/genai";

export async function POST() {
  try {
    const parser = new Parser();
    const unilever = await db.entity.findFirst({
      where: { legalName: "Unilever PLC" }
    });

    if (!unilever) {
      return NextResponse.json({ error: "Target entity not found" }, { status: 404 });
    }

    const competitors = await db.competitorSet.findMany({
      where: { accountId: unilever.id },
      include: { competitorEntity: true }
    });

    const queries = [
      { name: "Unilever", role: "target", entityId: unilever.id },
      ...competitors.map((c: any) => ({ name: c.competitorEntity.legalName, role: "competitor", entityId: c.competitorEntity.id })),
      { name: "FMCG regulations", role: "industry", entityId: unilever.id },
      { name: "Consumer Goods supply chain", role: "industry", entityId: unilever.id }
    ];

    let newSignalsCount = 0;

    for (const q of queries) {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q.name)}&hl=en-US&gl=US&ceid=US:en`;
      const feed = await parser.parseURL(feedUrl);
      
      const latestItems = feed.items.slice(0, 3); // Get top 3 news for this query
      
      for (const item of latestItems) {
        // Hash for deduplication
        const hash = crypto.createHash('sha256').update(item.title || "").digest('hex');
        
        const existing = await db.signal.findUnique({
          where: {
            accountId_dedupHash: {
              accountId: unilever.id,
              dedupHash: hash
            }
          }
        });

        if (existing) continue;

        // Use Gemini to classify
        const prompt = `
          Analyze the following news article title and snippet:
          Title: ${item.title}
          Snippet: ${item.contentSnippet || item.content || ""}
          
          Classify this news event for an intelligence dashboard.
          - category: one of [ma, ai_pivot, earnings, leadership, restructure, regulatory, partnership, expansion, crisis, esg, major_contract, other]
          - type: one of [growth, risk, neutral]
          - severity: 1 (lowest) to 5 (highest impact)
          - summary: a short 1-sentence summary
        `;

        try {
          const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  type: { type: Type.STRING },
                  severity: { type: Type.INTEGER },
                  summary: { type: Type.STRING }
                },
                required: ["category", "type", "severity", "summary"]
              }
            }
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            
            await db.signal.create({
              data: {
                entityId: q.entityId,
                aboutRole: q.role,
                accountId: unilever.id,
                category: parsed.category || "other",
                type: parsed.type || "neutral",
                severity: parsed.severity || 1,
                title: item.title || "Untitled",
                summary: parsed.summary || "No summary available",
                rawExcerpt: (item.contentSnippet || "").slice(0, 200),
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                sources: JSON.stringify([{ publisher: item.source || "News", url: item.link }]),
                dedupHash: hash,
                isIllustrative: false
              }
            });
            newSignalsCount++;
          }
        } catch (genAiError) {
          console.error("Gemini classification failed for article:", item.title, genAiError);
          // Continue to next item even if one fails
        }
      }
    }

    return NextResponse.json({ success: true, count: newSignalsCount });
  } catch (error) {
    console.error("Sync API Error:", error);
    return NextResponse.json({ error: "Failed to sync signals" }, { status: 500 });
  }
}
