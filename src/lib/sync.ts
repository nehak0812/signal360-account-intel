import { db } from "@/lib/db";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import Parser from "rss-parser";
import crypto from "crypto";
import { Type } from "@google/genai";

export async function syncSignals(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, count: 0, error: "GEMINI_API_KEY is not set in the environment variables" };
  }
  try {
    const parser = new Parser();
    const unilever = await db.entity.findFirst({
      where: { legalName: "Unilever PLC" }
    });

    if (!unilever) {
      return { success: false, count: 0, error: "Target entity not found" };
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

    interface PendingItem {
      hash: string;
      title: string;
      snippet: string;
      link: string;
      pubDate: string;
      source: string;
      entityId: string;
      role: string;
    }

    const pendingItemsMap = new Map<string, PendingItem>();

    // 1. Gather all unique raw news items from queries
    for (const q of queries) {
      try {
        const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q.name)}&hl=en-US&gl=US&ceid=US:en`;
        const feed = await parser.parseURL(feedUrl);
        
        // Fetch up to 15 items per query for a holistic sweep
        const latestItems = feed.items.slice(0, 15);
        
        for (const item of latestItems) {
          const title = item.title || "";
          const hash = crypto.createHash('sha256').update(title).digest('hex');
          
          if (pendingItemsMap.has(hash)) continue;

          let sourceName = "News";
          if (item.source) {
            if (typeof item.source === 'string') {
              sourceName = item.source;
            } else if (typeof item.source === 'object') {
              sourceName = (item.source as any).title || (item.source as any).text || "News";
            }
          }

          pendingItemsMap.set(hash, {
            hash,
            title,
            snippet: item.contentSnippet || item.content || "",
            link: item.link || "",
            pubDate: item.pubDate || new Date().toISOString(),
            source: sourceName,
            entityId: q.entityId,
            role: q.role,
          });
        }
      } catch (feedErr) {
        console.error(`Failed to fetch feed for query: ${q.name}`, feedErr);
      }
    }

    const allPending = Array.from(pendingItemsMap.values());
    if (allPending.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Query database in one batch to find which hashes already exist
    const pendingHashes = allPending.map(item => item.hash);
    const existingSignals = await db.signal.findMany({
      where: {
        accountId: unilever.id,
        dedupHash: { in: pendingHashes }
      },
      select: { dedupHash: true }
    });

    const existingHashesSet = new Set(existingSignals.map(s => s.dedupHash));
    
    // Filter out items that are already in the DB
    const newPending = allPending.filter(item => !existingHashesSet.has(item.hash));

    if (newPending.length === 0) {
      return { success: true, count: 0 };
    }

    let newSignalsCount = 0;
    const batchSize = 25;
    // Process up to 3 batches (max 75 items total) to avoid timeout but still cover a massive sweep
    const totalToProcess = Math.min(newPending.length, 75);

    for (let offset = 0; offset < totalToProcess; offset += batchSize) {
      const batchToProcess = newPending.slice(offset, offset + batchSize);

      const prompt = `
        You are a corporate intelligence analyst classifying news items for an account dashboard tracking ${unilever.legalName} and its competitors.
        Analyze the following list of news items and determine which ones are strategically relevant (e.g. M&A, AI pivots, earnings, leadership, restructures, regulations, expansions, or operational crises).
        Ignore general noise, duplicate reports of the same event, or irrelevant items.
        
        For each relevant item, specify:
        - category: one of [ma, ai_pivot, earnings, leadership, restructure, regulatory, partnership, expansion, crisis, esg, major_contract, other]
        - type: one of [growth, risk, neutral]
        - severity: 1 (lowest) to 5 (highest impact)
        - summary: a short 1-sentence analytical summary

        News Items to Analyze:
        ${batchToProcess.map((item, idx) => `
        [ITEM ${idx}]
        Title: ${item.title}
        Snippet: ${item.snippet}
        `).join("\n")}

        Return a JSON object containing a "signals" array matching this schema:
        {
          "signals": [
            {
              "index": Number (the ITEM index, e.g. 0, 1, etc.),
              "category": "regulatory",
              "type": "risk",
              "severity": 3,
              "summary": "Analysed summary text..."
            }
          ]
        }
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
                signals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      index: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      type: { type: Type.STRING },
                      severity: { type: Type.INTEGER },
                      summary: { type: Type.STRING }
                    },
                    required: ["index", "category", "type", "severity", "summary"]
                  }
                }
              },
              required: ["signals"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          const classifications = parsed.signals || [];

          for (const classification of classifications) {
            const idx = classification.index;
            if (idx >= 0 && idx < batchToProcess.length) {
              const item = batchToProcess[idx];

              const doubleCheck = await db.signal.findFirst({
                where: {
                  accountId: unilever.id,
                  dedupHash: item.hash
                }
              });
              if (doubleCheck) continue;

              await db.signal.create({
                data: {
                  entityId: item.entityId,
                  aboutRole: item.role,
                  accountId: unilever.id,
                  category: classification.category || "other",
                  type: classification.type || "neutral",
                  severity: classification.severity || 1,
                  title: item.title || "Untitled",
                  summary: classification.summary || "No summary available",
                  rawExcerpt: item.snippet.slice(0, 200),
                  publishedAt: new Date(item.pubDate),
                  sources: JSON.stringify([{ publisher: item.source || "News", url: item.link }]),
                  dedupHash: item.hash,
                  isIllustrative: false
                }
              });
              newSignalsCount++;
            }
          }
        }
      } catch (genAiError) {
        console.error("Gemini batch classification failed for batch offset:", offset, genAiError);
      }
    }

    return { success: true, count: newSignalsCount };
  } catch (error) {
    console.error("Sync Logic Error:", error);
    return { success: false, count: 0, error: String(error) };
  }
}
