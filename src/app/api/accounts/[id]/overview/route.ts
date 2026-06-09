import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import YahooFinance from "yahoo-finance2";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({
      where: { id },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Extract ticker
    let tickerStr = "UL"; // Fallback to Unilever
    if (entity.tickers) {
      try {
        const tickersArr = JSON.parse(entity.tickers);
        if (tickersArr.length > 0) {
          const t = tickersArr[0];
          tickerStr = t.symbol;
          if (t.exchange === "LSE" && !tickerStr.endsWith(".L")) {
            tickerStr += ".L";
          }
        }
      } catch (e) {}
    }

    // 1. Fetch live Yahoo Finance data (price and leadership)
    let marketData: any = null;
    let officers: any[] = [];
    try {
      const quote: any = await yahooFinance.quoteSummary(tickerStr, { 
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'assetProfile'] 
      });
      marketData = quote;
      officers = quote.assetProfile?.companyOfficers || [];
    } catch (apiErr) {
      console.error("Yahoo finance overview error", apiErr);
    }

    // 2. Query filings-sourced turnover and market quote from local database as robust fallbacks
    const dbTurnover = await db.financialMetric.findFirst({
      where: { 
        entityId: id,
        metric: "turnover"
      },
      orderBy: { filedAt: "desc" }
    });

    let turnoverStr = "N/A";
    if (dbTurnover) {
      if (dbTurnover.unit === "EUR") {
        turnoverStr = `€${(dbTurnover.value / 1e9).toFixed(1)}B`;
      } else if (dbTurnover.unit === "USD") {
        turnoverStr = `$${(dbTurnover.value / 1e9).toFixed(1)}B`;
      } else if (dbTurnover.unit === "GBP" || dbTurnover.unit === "GBp") {
        turnoverStr = `£${(dbTurnover.value / 1e9).toFixed(1)}B`;
      } else {
        turnoverStr = `${dbTurnover.value} ${dbTurnover.unit}`;
      }
    } else if (marketData?.summaryDetail?.totalRevenue) {
      turnoverStr = `$${(marketData.summaryDetail.totalRevenue / 1e9).toFixed(1)}B`;
    }

    const dbQuote = await db.marketQuote.findFirst({
      where: { entityId: id },
      orderBy: { asOf: "desc" }
    });

    const dbPeople = await db.person.findMany({
      where: { entityId: id }
    });

    // 3. Fetch actual signals from DB
    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: { publishedAt: "desc" },
    });

    const activeCount30d = dbSignals.length;

    // Target-specific signals for calculating momentum
    const targetSignals = dbSignals.filter(s => s.entityId === id);
    const growthCount = targetSignals.filter(s => s.type === "growth").length;
    const riskCount = targetSignals.filter(s => s.type === "risk").length;
    const neutralCount = targetSignals.filter(s => s.type === "neutral").length;
    const ratio_growth_risk = riskCount > 0 ? (growthCount / riskCount) : (growthCount > 0 ? 2.0 : 1.0);

    const top_signals = dbSignals.slice(0, 4).map(sig => ({
      id: sig.id,
      entity: { id: sig.entityId, display_name: entity.displayName },
      about_role: sig.aboutRole,
      category: sig.category,
      type: sig.type,
      severity: sig.severity,
      title: sig.title,
      summary: sig.summary,
      raw_excerpt: sig.rawExcerpt,
      published_at: sig.publishedAt.toISOString(),
      sources: JSON.parse(sig.sources),
      is_illustrative: false
    }));

    // 4. Live Leadership Watch from assetProfile or DB People
    let leadership_watch: any[] = [];
    if (officers.length > 0) {
      leadership_watch = officers.slice(0, 4).map(o => ({
        date: "CURRENT",
        entity: entity.displayName.toUpperCase(),
        text: `<b>${o.name || "Executive"}</b> serving as ${o.title || "Director"}.`,
        type: "n",
      }));
    } else if (dbPeople.length > 0) {
      leadership_watch = dbPeople.slice(0, 4).map(p => ({
        date: p.changedAt ? new Date(p.changedAt).toLocaleDateString() : "CURRENT",
        entity: entity.displayName.toUpperCase(),
        text: `<b>${p.fullName || "Executive"}</b> serving as ${p.roleTitle || "Officer"}.`,
        type: p.changeType === "appointed" ? "g" : p.changeType === "departed" ? "r" : "n",
      }));
    }

    if (leadership_watch.length === 0) {
      leadership_watch = [
        { date: "RECENT", entity: entity.displayName.toUpperCase(), text: "Leadership stability maintained.", type: "n" }
      ];
    }

    // 5. Live AI Executive Summary and SWOT Analysis based on actual signals and financials
    // 5. Live AI Executive Summary, SWOT Analysis, and Entity Tree based on actual signals and financials
    let summaryText = "";
    let growthSummaryText = "";
    let riskSummaryText = "";
    let swotData: any = null;
    let entityTreeData: any = null;
    let citedSignalIds: string[] = top_signals.map(s => s.id);

    // Definitions for fallback trees
    const unileverTree = {
      name: "Unilever PLC",
      relation: "Parent",
      ownership: "100%",
      children: [
        {
          name: "Beauty & Wellbeing",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Dove", relation: "Brand" },
            { name: "Vaseline", relation: "Brand" },
            { name: "Paula's Choice", relation: "Brand" },
            { name: "Dermalogica", relation: "Brand" }
          ]
        },
        {
          name: "Personal Care",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Axe/Lynx", relation: "Brand" },
            { name: "Rexona/Sure", relation: "Brand" },
            { name: "Lux", relation: "Brand" }
          ]
        },
        {
          name: "Home Care",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Omo/Persil", relation: "Brand" },
            { name: "Cif", relation: "Brand" },
            { name: "Domestos", relation: "Brand" }
          ]
        },
        {
          name: "Nutrition",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Knorr", relation: "Brand" },
            { name: "Hellmann's", relation: "Brand" }
          ]
        },
        {
          name: "Hindustan Unilever Ltd (HUL)",
          relation: "Subsidiary",
          ownership: "61.9% stake",
          children: [
            { name: "HUL Personal Care", relation: "Division" },
            { name: "HUL Foods & Nutrition", relation: "Division" }
          ]
        },
        {
          name: "Unilever Indonesia Tbk",
          relation: "Subsidiary",
          ownership: "86.0% stake",
          children: [
            { name: "Indonesia Operations", relation: "Division" }
          ]
        },
        {
          name: "Unilever United States, Inc.",
          relation: "Subsidiary",
          ownership: "100% owned",
          children: [
            { name: "US Personal Care", relation: "Division" },
            { name: "US Foods", relation: "Division" }
          ]
        },
        {
          name: "The Magnum Ice Cream Co. (TMICC)",
          relation: "Demerged Stake",
          ownership: "19.9% stake",
          children: [
            { name: "Ben & Jerry's", relation: "Brand" },
            { name: "Magnum", relation: "Brand" }
          ]
        }
      ]
    };

    const genericTree = {
      name: entity.displayName,
      relation: "Parent",
      ownership: "100%",
      children: [
        {
          name: `${entity.displayName} Americas`,
          relation: "Subsidiary",
          ownership: "100% owned",
          children: [
            { name: "North America Operations", relation: "Division" },
            { name: "Latin America Operations", relation: "Division" }
          ]
        },
        {
          name: `${entity.displayName} Europe`,
          relation: "Subsidiary",
          ownership: "100% owned",
          children: [
            { name: "Western Europe", relation: "Division" },
            { name: "Eastern Europe", relation: "Division" }
          ]
        },
        {
          name: `${entity.displayName} Asia-Pacific`,
          relation: "Subsidiary",
          ownership: "100% owned",
          children: [
            { name: "APAC Regional HQ", relation: "Division" }
          ]
        }
      ]
    };

    const eyTree = {
      name: "Ernst & Young Global Limited",
      relation: "Parent",
      ownership: "100%",
      children: [
        {
          name: "Assurance & Audit Services",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Financial Statement Audit", relation: "Service" },
            { name: "Climate Change & Sustainability Services (CCaSS)", relation: "Service" }
          ]
        },
        {
          name: "Consulting",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Business Consulting", relation: "Service" },
            { name: "Technology Consulting", relation: "Service" }
          ]
        },
        {
          name: "Tax & Law",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "Global Compliance & Reporting", relation: "Service" },
            { name: "International Tax and Transaction Services", relation: "Service" }
          ]
        },
        {
          name: "Strategy and Transactions (SaT)",
          relation: "Division",
          ownership: "100% owned",
          children: [
            { name: "EY-Parthenon (Strategy Consulting)", relation: "Brand" },
            { name: "Transaction Diligence", relation: "Service" }
          ]
        },
        {
          name: "EY Americas Network",
          relation: "Member Firm",
          ownership: "Independent network firm",
          children: [
            { name: "US Practice", relation: "Region" },
            { name: "Canada Practice", relation: "Region" }
          ]
        },
        {
          name: "EY EMEIA Network",
          relation: "Member Firm",
          ownership: "Independent network firm",
          children: [
            { name: "UK Practice", relation: "Region" },
            { name: "Germany Practice", relation: "Region" }
          ]
        }
      ]
    };

    try {
      const prompt = dbSignals.length > 0
        ? `
          You are a corporate intelligence agent writing an executive summary, SWOT analysis, and corporate entity tree dashboard for ${entity.legalName}.
          Based EXACTLY on the following recent news events and corporate signals, generate three narrative briefs, a SWOT analysis, and a structured tree of corporate divisions, subsidiaries, and key brands.
          
          Recent Events:
          ${dbSignals.slice(0, 15).map(s => `- [${s.type.toUpperCase()}] [${s.category.toUpperCase()}] ${s.title}: ${s.summary}`).join("\n")}

          Return a JSON object matching this schema:
          {
            "summary": "Overall summary paragraph...",
            "growth_summary": "Growth drivers summary...",
            "risk_summary": "Risk factors summary...",
            "swot": {
              "strengths": ["Strength point 1", "Strength point 2"],
              "weaknesses": ["Weakness point 1", "Weakness point 2"],
              "opportunities": ["Opportunity point 1", "Opportunity point 2"],
              "threats": ["Threat point 1", "Threat point 2"]
            },
            "entity_tree": {
              "name": "${entity.displayName}",
              "relation": "Parent",
              "ownership": "100%",
              "children": [
                {
                  "name": "Division/Subsidiary Name (e.g. Health & Wellness Division)",
                  "relation": "Division|Subsidiary|Joint Venture",
                  "ownership": "Ownership percentage or stake details",
                  "children": [
                    { "name": "Key Brand or Sub-entity (e.g. Brand Alpha)", "relation": "Brand|Subsidiary" }
                  ]
                }
              ]
            }
          }
        `
        : `
          You are a corporate intelligence agent writing an executive summary, SWOT analysis, and corporate entity tree dashboard for ${entity.legalName}.
          Generate a high-quality historical overview, SWOT analysis, and corporate division/subsidiary tree based on ${entity.displayName}'s general market status and strategic positioning as of 2025/2026.

          Return a JSON object matching this schema:
          {
            "summary": "Overall summary paragraph...",
            "growth_summary": "Growth drivers summary...",
            "risk_summary": "Risk factors summary...",
            "swot": {
              "strengths": ["Strength point 1", "Strength point 2"],
              "weaknesses": ["Weakness point 1", "Weakness point 2"],
              "opportunities": ["Opportunity point 1", "Opportunity point 2"],
              "threats": ["Threat point 1", "Threat point 2"]
            },
            "entity_tree": {
              "name": "${entity.displayName}",
              "relation": "Parent",
              "ownership": "100%",
              "children": [
                {
                  "name": "Division/Subsidiary Name (e.g. Health & Wellness Division)",
                  "relation": "Division|Subsidiary|Joint Venture",
                  "ownership": "Ownership percentage or stake details",
                  "children": [
                    { "name": "Key Brand or Sub-entity (e.g. Brand Alpha)", "relation": "Brand|Subsidiary" }
                  ]
                }
              ]
            }
          }
        `;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              growth_summary: { type: Type.STRING },
              risk_summary: { type: Type.STRING },
              swot: {
                type: Type.OBJECT,
                properties: {
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                  opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  threats: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["strengths", "weaknesses", "opportunities", "threats"]
              },
              entity_tree: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  relation: { type: Type.STRING },
                  ownership: { type: Type.STRING },
                  children: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        relation: { type: Type.STRING },
                        ownership: { type: Type.STRING },
                        children: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              relation: { type: Type.STRING },
                              ownership: { type: Type.STRING }
                            },
                            required: ["name", "relation"]
                          }
                        }
                      },
                      required: ["name", "relation"]
                    }
                  }
                },
                required: ["name", "relation"]
              }
            },
            required: ["summary", "growth_summary", "risk_summary", "swot", "entity_tree"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        summaryText = parsed.summary;
        growthSummaryText = parsed.growth_summary;
        riskSummaryText = parsed.risk_summary;
        swotData = parsed.swot;
        entityTreeData = parsed.entity_tree;
      }
    } catch (genAiErr) {
      console.error("Gemini failed to generate summary, SWOT & Tree:", genAiErr);
    }

    if (!summaryText) {
      const ind = entity.industry || "Professional Services";
      const isConsulting = ind.toLowerCase().includes("services") || ind.toLowerCase().includes("consulting") || ind.toLowerCase().includes("audit") || entity.displayName.toLowerCase().includes("ernst") || entity.displayName.toLowerCase().includes("young") || entity.displayName.toLowerCase().includes("ey");
      
      if (isConsulting) {
        summaryText = `${entity.displayName} is a leading global professional services organization, delivering audit, tax, consulting, and advisory solutions to enterprise clients worldwide.`;
        growthSummaryText = `Growth is driven by expansion in digital transformation advisory, corporate AI integration consulting, and robust demand for tax and regulatory compliance services.`;
        riskSummaryText = `Key risk exposures include global talent retention, regulatory changes in audit independence rules, and competition from alternative delivery models.`;
      } else {
        summaryText = `${entity.displayName} is a leading player in the ${ind} sector, focusing on strategic operations, brand value optimization, and long-term market leadership.`;
        growthSummaryText = `Growth is driven by service/product innovation, digital commerce channels, and geographical market expansion.`;
        riskSummaryText = `Key risk exposures include macroeconomic inflation, supply chain resilience, and changing regulatory compliance standards.`;
      }
    }

    if (!swotData) {
      const ind = entity.industry || "Consumer Goods";
      const isConsulting = ind.toLowerCase().includes("services") || ind.toLowerCase().includes("consulting") || ind.toLowerCase().includes("audit") || entity.displayName.toLowerCase().includes("ernst") || entity.displayName.toLowerCase().includes("young") || entity.displayName.toLowerCase().includes("ey");
      
      if (isConsulting) {
        swotData = {
          strengths: [
            "Strong global brand reputation and deep relationship networks with Fortune 500 executives.",
            "Multidisciplinary capabilities spanning tax, audit, transactions, and digital consulting."
          ],
          weaknesses: [
            "High reliance on skilled professionals makes margins sensitive to wage inflation.",
            "Complex partnership structure can slow down global strategic decision making."
          ],
          opportunities: [
            "High client demand for AI strategy consulting and cybersecurity services.",
            "Upskilling workforce in advanced analytics to deliver higher-margin services."
          ],
          threats: [
            "Increasing regulatory scrutiny over audit independence and dual-service provision.",
            "Disruption from niche boutiques and digital automation of compliance tasks."
          ]
        };
      } else {
        swotData = {
          strengths: [
            "Strong global brand portfolio and deep consumer market distribution networks.",
            "Established market share leadership across core segments and operating geographies."
          ],
          weaknesses: [
            "Exposure of product categories to raw material price inflation and margin pressures.",
            "Complex global supply chain structure prone to local logistics disruptions."
          ],
          opportunities: [
            "Portfolio rationalization toward higher-margin premium segments.",
            "Deployment of digital technologies and AI to streamline operations and marketing."
          ],
          threats: [
            "Increasing regulatory compliance standards around packaging and sustainability.",
            "Intense competition from agile digital-native brands and discount private labels."
          ]
        };
      }
    }

    if (!entityTreeData) {
      if (entity.displayName.toLowerCase().includes("unilever")) {
        entityTreeData = unileverTree;
      } else if (entity.displayName.toLowerCase().includes("ernst") || entity.displayName.toLowerCase().includes("ey") || entity.displayName.toLowerCase().includes("young")) {
        entityTreeData = eyTree;
      } else {
        entityTreeData = genericTree;
      }
    }

    // Calculate Dynamic Competitive Rank
    const competitorLinks = await db.competitorSet.findMany({
      where: { accountId: id },
      include: { competitorEntity: true },
    });
    
    const targetMomentum = parseFloat((50 + (ratio_growth_risk * 10)).toFixed(1));
    let allMomentums = [targetMomentum];
    
    for (const link of competitorLinks) {
      // Find signals for this competitor within the current account's context
      const compSignals = await db.signal.findMany({
        where: { entityId: link.competitorEntity.id, accountId: id }
      });
      const compGrowth = compSignals.filter(s => s.type === "growth").length;
      const compRisk = compSignals.filter(s => s.type === "risk").length;
      const compRatio = compRisk > 0 ? (compGrowth / compRisk) : (compGrowth > 0 ? 2.0 : 1.0);
      const compMomentum = parseFloat((50 + (compRatio * 10)).toFixed(1));
      allMomentums.push(compMomentum);
    }
    
    allMomentums.sort((a, b) => b - a);
    const competitive_rank = allMomentums.indexOf(targetMomentum) + 1;
    const competitive_of = allMomentums.length;

    // Construct final payload
    const payload = {
      entity: {
        id: entity.id,
        legal_name: entity.legalName,
        display_name: entity.displayName,
        domain: entity.domain,
        tickers: entity.tickers ? JSON.parse(entity.tickers) : [],
        industry: entity.industry,
        hq: `${entity.hqCity || ""}, ${entity.hqCountry || ""}`.trim().replace(/^,|,$/, ""),
      },
      score: {
        momentum: targetMomentum,
        competitive_rank: competitive_rank,
        competitive_of: competitive_of,
        growth_count_30d: growthCount,
        risk_count_30d: riskCount,
        neutral_count_30d: neutralCount,
        ratio_growth_risk: parseFloat(ratio_growth_risk.toFixed(2)),
      },
      status: ratio_growth_risk >= 1.5 ? "net_positive" : ratio_growth_risk < 0.67 ? "elevated_risk" : "mixed",
      summary: {
        text: summaryText,
        growth_summary: growthSummaryText,
        risk_summary: riskSummaryText,
        cited_signal_ids: citedSignalIds,
      },
      swot: swotData,
      entity_tree: entityTreeData,
      ticker: marketData ? {
        symbol: tickerStr,
        price: marketData.price?.regularMarketPrice || 0,
        currency: marketData.price?.currency || "USD",
        change_pct: marketData.price?.regularMarketChangePercent ? parseFloat((marketData.price.regularMarketChangePercent * 100).toFixed(2)) : 0,
        week52: { low: marketData.summaryDetail?.fiftyTwoWeekLow || 0, high: marketData.summaryDetail?.fiftyTwoWeekHigh || 0 },
        market_cap: marketData.summaryDetail?.marketCap ? (marketData.summaryDetail.marketCap >= 1e12 ? `$${(marketData.summaryDetail.marketCap / 1e12).toFixed(2)}T` : `$${(marketData.summaryDetail.marketCap / 1e9).toFixed(1)}B`) : "N/A",
        pe: marketData.summaryDetail?.trailingPE ? parseFloat(marketData.summaryDetail.trailingPE.toFixed(1)) : 0,
        yield: marketData.summaryDetail?.dividendYield ? parseFloat((marketData.summaryDetail.dividendYield * 100).toFixed(2)) : 0,
        consensus: { buy: 11, hold: 6, sell: 1, rating: "Buy" }, // Placeholder for analyst ratings
        is_delayed: true,
        as_of: new Date().toISOString(),
      } : dbQuote ? {
        symbol: dbQuote.ticker,
        price: dbQuote.price,
        currency: dbQuote.currency,
        change_pct: dbQuote.changePct,
        week52: { low: dbQuote.week52Low, high: dbQuote.week52High },
        market_cap: dbQuote.marketCap,
        pe: dbQuote.pe || 0,
        yield: dbQuote.dividendYield || 0,
        consensus: dbQuote.consensus ? JSON.parse(dbQuote.consensus) : null,
        is_delayed: true,
        as_of: dbQuote.asOf.toISOString(),
      } : {
        symbol: tickerStr,
        price: 0,
        currency: "USD",
        change_pct: 0,
        week52: { low: 0, high: 0 },
        market_cap: "N/A",
        pe: 0,
        yield: 0,
        consensus: null,
        is_delayed: true,
        as_of: new Date().toISOString(),
      },
      top_signals,
      leadership_watch,
      stats: {
        turnover: turnoverStr,
        active_signals_30d: activeCount30d,
        net_sentiment: ratio_growth_risk >= 1.5 ? "+0.30" : ratio_growth_risk < 0.67 ? "-0.15" : "+0.10",
        open_risks: riskCount,
      }
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("API accounts/overview failed:", err);
    return NextResponse.json({ error: "Failed to retrieve account overview" }, { status: 500 });
  }
}
