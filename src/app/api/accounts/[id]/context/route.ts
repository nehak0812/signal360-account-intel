import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Parser from "rss-parser";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

function parseFeedItem(item: any) {
  const title = item.title || "";
  let cleanTitle = title;
  let publisher = "News";
  
  // Google News titles are usually "Title Text - Publisher Name"
  const dashIndex = title.lastIndexOf(" - ");
  if (dashIndex !== -1) {
    cleanTitle = title.substring(0, dashIndex).trim();
    publisher = title.substring(dashIndex + 3).trim();
  }
  
  return {
    title: cleanTitle,
    rawTitle: title,
    publisher,
    link: item.link || "#",
    pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
    snippet: item.contentSnippet || ""
  };
}

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
    
    // Clean name for query (e.g. Unilever PLC -> Unilever)
    const cleanedName = (entity.displayName || entity.legalName)
      .replace(/\s+(PLC|Inc\.|Corp\.|Co\.|Ltd\.|Group|Active)\b/gi, "")
      .trim();

    // Determine industry search terms based on entity.industry
    let industryTerms = '"FMCG" OR "Consumer Goods"';
    if (entity.industry) {
      if (entity.industry.toLowerCase().includes("fmcg")) {
        industryTerms = '"FMCG" OR "Consumer Goods" OR "consumer packaged goods"';
      } else {
        const cleanIndustry = entity.industry.replace(/[()]/g, " ").trim();
        industryTerms = `"${cleanIndustry}"`;
      }
    }

    // Build highly relevant query strings for Geos & Industry (100% macro/environmental, no company names)
    const queries = [
      // 1. Regional macro-economic indicators (consumer spending, inflation, retail market trends in key geos)
      `(${industryTerms}) (Europe OR UK OR Asia OR US) ("consumer spending" OR "inflation" OR "retail market")`,
      // 2. Supply chain, sustainability and sector-wide developments
      `(${industryTerms}) (Europe OR UK OR Asia OR US) ("supply chain" OR "sustainability" OR "trend" OR "sales growth")`,
      // 3. Geopolitical and regulatory environment (tariffs, packaging rules, green claims, macro economy)
      `(${industryTerms}) (geopolitics OR "macro economy" OR inflation OR regulation OR regulatory)`
    ];

    const parsedItems: any[] = [];

    // Fetch RSS for each query
    for (const q of queries) {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const feed = await parser.parseURL(feedUrl);
        // Take top 5 from each query
        for (const rawItem of feed.items.slice(0, 5)) {
          parsedItems.push(parseFeedItem(rawItem));
        }
      } catch (e) {
        console.error(`RSS parser failed for query ${q}:`, e);
      }
    }

    // Deduplicate by cleaned title to make sure we don't duplicate context cards
    const uniqueItemsMap = new Map();
    for (const item of parsedItems) {
      const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normTitle && !uniqueItemsMap.has(normTitle)) {
        uniqueItemsMap.set(normTitle, item);
      }
    }
    
    // Sort all unique items by pubDate descending to ensure they are live/current
    const sortedItems = Array.from(uniqueItemsMap.values())
      .sort((a: any, b: any) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 6); // Take top 6 most recent unique articles

    let contextItems: any[] = [];

    if (sortedItems.length > 0) {
      const prompt = `
        You are an intelligence analyst categorizing macro context events for the company ${entity.legalName}.
        Review the following news headlines and snippets:
        
        ${sortedItems.map((item, i) => `[${i+1}] Source: ${item.publisher} | Title: ${item.title} | Snippet: ${item.snippet}`).join("\n\n")}

        For each news event, perform the following:
        - Categorize it as either a Geo or Industry event (e.g. "GEO · ASIA", "GEO · EUROPE", "INDUSTRY · RETAIL", "INDUSTRY · REGULATORY", "GEO · NORTH AMERICA", "GEO · UNITED KINGDOM", "INDUSTRY · FMCG"). Use exactly this "CATEGORY · SUBCATEGORY" uppercase format.
        - Write a short, analytical 1-sentence summary of how this specifically impacts ${entity.legalName} as a leading firm in ${entity.industry || 'its industry'}.

        Return a JSON object with an array "items" containing objects with:
        - "index": Number (the 1-based index from the input list, e.g. 1, 2, 3...)
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
                      index: { type: Type.NUMBER },
                      category_label: { type: Type.STRING },
                      title: { type: Type.STRING },
                      body: { type: Type.STRING }
                    },
                    required: ["index", "category_label", "title", "body"]
                  }
                }
              },
              required: ["items"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          
          contextItems = parsed.items.map((m: any, i: number) => {
            const origIndex = typeof m.index === "number" ? m.index - 1 : i;
            const origItem = sortedItems[origIndex] || sortedItems[i] || {};
            return {
              category_label: m.category_label || "INDUSTRY · UPDATE",
              title: m.title || origItem.title || "News Update",
              body: m.body || "No summary available.",
              source: { 
                publisher: origItem.publisher || "News", 
                url: origItem.link || "#" 
              },
              published_at: origItem.pubDate ? new Date(origItem.pubDate).toISOString() : new Date().toISOString()
            };
          });
        }
      } catch (genAiErr) {
        console.error("Gemini failed to analyze context:", genAiErr);
      }
    }

    // Fallback if Gemini fails
    if (contextItems.length === 0) {
      contextItems = sortedItems.map(item => ({
        category_label: "INDUSTRY · UPDATE",
        title: item.title,
        body: item.snippet || "No summary available.",
        source: { publisher: item.publisher || "News", url: item.link || "#" },
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      }));
    }

    return NextResponse.json({ items: contextItems });
  } catch (err) {
    console.error("API accounts/context failed:", err);
    return NextResponse.json({ error: "Failed to retrieve context data" }, { status: 500 });
  }
}
