import { db } from "../db";
import { fetchNewsForEntity } from "./news-retrieval";
import { classifyArticle } from "./classifier";
import { ingestSignal } from "./ingestion";
import { ai, DEFAULT_MODEL } from "../gemini";

export async function runSweep(accountId: string): Promise<boolean> {
  console.log(`Starting account intelligence sweep for account ID: ${accountId}`);

  try {
    const entity = await db.entity.findUnique({
      where: { id: accountId },
    });

    if (!entity) {
      console.error(`Entity not found for sweep: ${accountId}`);
      return false;
    }

    // 1. Crawl news from GDELT (free)
    const aliases = ["Dove", "Knorr", "Hellmann's", "Ben & Jerry's", "Rexona", "Magnum"];
    const rawArticles = await fetchNewsForEntity(entity.displayName, aliases, 7);
    console.log(`Retrieved ${rawArticles.length} raw articles from feed.`);

    // 2. Classify and Ingest each article (limit to 10 for rate limits & API quotas)
    const activeSignals: string[] = [];
    for (const art of rawArticles.slice(0, 10)) {
      try {
        const classified = await classifyArticle(art, entity.displayName);
        const signalId = await ingestSignal({
          entityId: entity.id,
          aboutRole: "target",
          accountId: entity.id,
          category: classified.category,
          type: classified.type,
          severity: classified.severity,
          title: classified.title,
          summary: classified.summary,
          rawExcerpt: classified.rawExcerpt,
          publishedAt: new Date(art.publishedAt),
          sources: [{ publisher: art.publisher, url: art.url }],
          confidence: classified.confidence,
          embedding: classified.embedding,
        });
        activeSignals.push(signalId);
      } catch (err) {
        console.error(`Failed to process article "${art.title}":`, err);
      }
    }

    // 3. Fetch Stock Price (Twelve Data free tier fallback to yfinance / dummy quotes)
    try {
      let price = 4850;
      let changePct = 0.9;
      const twelveKey = process.env.TWELVEDATA_API_KEY;
      
      if (twelveKey) {
        // Query LSE stock ULVR
        const res = await fetch(`https://api.twelvedata.com/time_series?symbol=ULVR&interval=1day&outputsize=1&apikey=${twelveKey}`);
        if (res.ok) {
          const data = await res.json() as { values?: { close: string }[] };
          if (data.values && data.values.length > 0) {
            price = parseFloat(data.values[0].close);
          }
        }
      }

      await db.marketQuote.upsert({
        where: { id: "22222222-0000-0000-0000-000000000001" }, // reuse same quote id for simplicity
        update: {
          price,
          changePct,
          asOf: new Date(),
        },
        create: {
          id: "22222222-0000-0000-0000-000000000001",
          entityId: entity.id,
          ticker: "ULVR",
          price,
          currency: "GBp",
          changePct,
          week52Low: 4180,
          week52High: 5120,
          marketCap: "£115B",
          pe: 19,
          dividendYield: 3.4,
          consensus: JSON.stringify({ buy: 11, hold: 6, sell: 1, rating: "Buy" }),
          asOf: new Date(),
          source: JSON.stringify({ publisher: "Twelve Data (delayed)", url: "https://twelvedata.com" }),
        }
      });
      console.log(`Updated stock price: ${price} GBp`);
    } catch (e) {
      console.error("Market-data sweep failed:", e);
    }

    // 4. Calculate Trail 30d Momentum & Score
    const dbSignals = await db.signal.findMany({
      where: { accountId },
    });

    const growthSignals = dbSignals.filter(s => s.type === "growth");
    const riskSignals = dbSignals.filter(s => s.type === "risk");
    const neutralSignals = dbSignals.filter(s => s.type === "neutral");

    let growthForce = 0;
    let riskForce = 0;

    growthSignals.forEach(s => {
      const ageDays = (new Date().getTime() - new Date(s.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      const decay = Math.exp(-ageDays / 14);
      growthForce += s.severity * decay;
    });

    riskSignals.forEach(s => {
      const ageDays = (new Date().getTime() - new Date(s.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      const decay = Math.exp(-ageDays / 14);
      riskForce += s.severity * decay;
    });

    const totalForce = growthForce + riskForce + 0.001;
    const rawVal = (growthForce - riskForce) / totalForce; // -1 to +1
    const momentum = Math.round((rawVal + 1) * 50); // 0 to 100

    const ratioGrowthRisk = growthSignals.length / (riskSignals.length || 1);
    const overallStatus = ratioGrowthRisk >= 1.5 
      ? "net_positive" 
      : ratioGrowthRisk < 0.67 
      ? "elevated_risk" 
      : "mixed";

    await db.score.create({
      data: {
        accountId,
        momentum,
        competitiveRank: 2,
        competitiveOf: 5,
        growthCount30d: growthSignals.length,
        riskCount30d: riskSignals.length,
        neutralCount30d: neutralSignals.length,
        ratioGrowthRisk,
        overallStatus,
      }
    });
    console.log(`Updated scores: Momentum=${momentum}, status=${overallStatus}`);

    // 5. Synthesis: command center summary + theme clusters (using Gemini)
    try {
      const prompt = `Synthesize an account intelligence report for "${entity.displayName}".
We have collected ${dbSignals.length} active signals. Here are the top signals:
${dbSignals.slice(0, 5).map((s, i) => `${i+1}. [${s.category}] (${s.type}): ${s.title} - ${s.summary}`).join("\n")}

Write a concise synthesised paragraph (3-4 sentences) summarizing the week's key events and their impact.
Then, write 1-2 major theme clusters that represent the narrative trend.

Return the response as a strict JSON object:
{
  "summaryText": "...",
  "themes": [
    {
      "label": "...",
      "type": "growth|risk|watch",
      "narrative": "...",
      "strength": 0.85
    }
  ]
}
Do not write any code or explanation. Return ONLY the valid JSON object.`;

      const synthRes = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const synthText = synthRes.text;
      if (synthText) {
        const parsed = JSON.parse(synthText) as { summaryText: string; themes: { label: string; type: string; narrative: string; strength: number }[] };
        
        // Save theme in DB
        await db.theme.create({
          data: {
            accountId,
            label: parsed.themes[0]?.label || "General Narrative",
            type: parsed.themes[0]?.type || "watch",
            narrative: parsed.summaryText,
            strength: parsed.themes[0]?.strength || 0.80,
            signalIds: JSON.stringify(activeSignals.slice(0, 3)),
          }
        });
      }
    } catch (synthErr) {
      console.error("Gemini synthesis / theme clustering failed:", synthErr);
    }

    // 6. Generate Alerts (for any signal with severity >= 4)
    const highSevSignals = dbSignals.filter(s => s.severity >= 4);
    for (const sig of highSevSignals.slice(0, 2)) {
      // Check if alert already exists for this signal
      const alertExists = await db.alert.findFirst({
        where: { signalId: sig.id },
      });
      if (!alertExists) {
        await db.alert.create({
          data: {
            accountId,
            signalId: sig.id,
            severity: sig.severity,
            title: sig.title,
            body: sig.summary,
          }
        });
        console.log(`Generated alert for high-severity signal: ${sig.title}`);
      }
    }

    console.log(`Sweep completed successfully for ${entity.displayName}`);
    return true;
  } catch (err) {
    console.error("Agent sweep failed:", err);
    return false;
  }
}
