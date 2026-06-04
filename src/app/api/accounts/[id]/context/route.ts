import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Parser from "rss-parser";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({ where: { id } });
    if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    const parser = new Parser();
    
    // Define 3 context queries
    const queries = [
      `${entity.legalName} Europe market`,
      `${entity.legalName} Asia market`,
      `${entity.legalName} FMCG industry retail`
    ];

    let allItems: any[] = [];

    // Fetch RSS for each query
    for (const q of queries) {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const feed = await parser.parseURL(feedUrl);
        // Take top 2 from each query to get 6 total context signals
        allItems.push(...feed.items.slice(0, 2));
      } catch (e) {
        console.error(`RSS parser failed for query ${q}:`, e);
      }
    }

    // Deduplicate by title
    const uniqueItemsMap = new Map();
    for (const item of allItems) {
      if (item.title && !uniqueItemsMap.has(item.title)) {
        uniqueItemsMap.set(item.title, item);
      }
    }
    const uniqueItems = Array.from(uniqueItemsMap.values()).slice(0, 5); // Take top 5 unique

    let contextItems: any[] = [];

    const prompt = `
      You are an intelligence analyst categorizing macro context events for the company ${entity.legalName}.
      Review the following news headlines and snippets:
      
      ${uniqueItems.map((item, i) => `[${i+1}] Source: ${item.source || 'News'} | Title: ${item.title} | Snippet: ${item.contentSnippet || ''}`).join("\n\n")}

      For each news event, perform the following:
      - Categorize it as either a Geo or Industry event (e.g. "GEO · ASIA", "GEO · EUROPE", "INDUSTRY · RETAIL", "INDUSTRY · REGULATORY", "GEO · NORTH AMERICA"). Use exactly this "CATEGORY · SUBCATEGORY" uppercase format.
      - Write a short, analytical 1-sentence summary of how this specifically impacts ${entity.legalName}.

      Return a JSON object with an array "items" containing objects with:
      - "category_label": String (the formatted label)
      - "title": String (the article title)
      - "body": String (the analytical summary)
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
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category_label: { type: Type.STRING },
                    title: { type: Type.STRING },
                    body: { type: Type.STRING }
                  },
                  required: ["category_label", "title", "body"]
                }
              }
            },
            required: ["items"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        
        contextItems = parsed.items.map((m: any, i: number) => ({
          ...m,
          source: { publisher: uniqueItems[i]?.source || "News", url: uniqueItems[i]?.link || "#" },
          published_at: uniqueItems[i]?.pubDate ? new Date(uniqueItems[i].pubDate).toISOString() : new Date().toISOString()
        }));
      }
    } catch (genAiErr) {
      console.error("Gemini failed to analyze context:", genAiErr);
    }

    // Fallback if Gemini fails
    if (contextItems.length === 0) {
      contextItems = uniqueItems.map(item => ({
        category_label: "INDUSTRY · UPDATE",
        title: item.title,
        body: item.contentSnippet || "No summary available.",
        source: { publisher: item.source || "News", url: item.link || "#" },
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      }));
    }

    return NextResponse.json({ items: contextItems });
  } catch (err) {
    console.error("API accounts/context failed:", err);
    return NextResponse.json({ error: "Failed to retrieve context data" }, { status: 500 });
  }
}
