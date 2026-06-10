import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({ where: { id } });
    if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    const score = await db.score.findFirst({
      where: { accountId: id },
      orderBy: { computedAt: "desc" },
    });

    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: { publishedAt: "desc" },
    });

    // 1. Map signals into plot points
    const plot = dbSignals.map((sig, index) => {
      // Map to 2D coordinates
      // x_momentum (growth moves right, risk moves left)
      let x_momentum = 50;
      if (sig.type === "growth") {
        x_momentum = 60 + (sig.severity * 7) + (index % 5); // 67 to 99
      } else if (sig.type === "risk") {
        x_momentum = 40 - (sig.severity * 7) - (index % 5); // 33 to 1
      } else {
        x_momentum = 45 + (index % 10); // 45 to 55
      }

      // y_impact (severity maps to higher impact)
      const y_impact = (sig.severity * 18) + (index % 8); // 18 to 98

      return {
        id: sig.id,
        label: sig.title,
        x_momentum,
        y_impact,
        severity: sig.severity,
        type: sig.type,
      };
    });

    // 2. Fetch Theme Clusters and Qualitative Insights dynamically via Gemini
    let finalThemes: any[] = [];
    let summaryText = "";
    let growthInsights: any[] = [];
    let riskInsights: any[] = [];
    
    if (dbSignals.length > 0) {
      const prompt = `
        You are a corporate intelligence analyst writing a qualitative risk and growth synthesis for ${entity.legalName}.
        Review the following recent news events and corporate signals:
        
        ${dbSignals.slice(0, 15).map(s => `- ID: ${s.id} | Title: ${s.title} | Type: ${s.type} | Summary: ${s.summary}`).join("\n")}
        
        Generate:
        1. An overall qualitative mapping summary (2-3 sentences) explaining the coordinates distribution of these signals (e.g. why certain growth factors represent high materiality, or how regulatory/cost risks dominate the high impact sector).
        2. Exactly 2 Emerging Growth Themes with detailed descriptions, estimated strategic value (e.g., "High", "Very High"), and activation timelines.
        3. Exactly 2 Emerging Risk Areas with detailed descriptions, vulnerability level (e.g., "Critical", "Moderate"), and recommended mitigation actions.
        4. Exactly 2 or 3 distinct Strategic Theme Clusters (existing theme clusters format). Each theme must have a label, type ("growth", "risk", or "neutral"), 1-sentence narrative, strength score (0.0 to 1.0), and a list of matching signal IDs.

        Return a JSON object matching this schema:
        {
          "summary": "Overall qualitative summary...",
          "growth_insights": [
            {
              "theme": "Theme Name",
              "description": "Qualitative description of why this theme is emerging and how it impacts the business...",
              "strategic_value": "High",
              "timeline": "Near-term (0-6 months)"
            }
          ],
          "risk_insights": [
            {
              "area": "Risk Area Name",
              "description": "Qualitative analysis of the risk, its drivers, and potential impact on operations...",
              "vulnerability_level": "Critical",
              "mitigation": "Recommended action to monitor or hedge against this exposure..."
            }
          ],
          "themes": [
            {
              "label": "Theme label",
              "type": "growth",
              "narrative": "Theme narrative...",
              "strength": 0.85,
              "signal_ids": ["id1", "id2"]
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
                summary: { type: Type.STRING },
                growth_insights: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      theme: { type: Type.STRING },
                      description: { type: Type.STRING },
                      strategic_value: { type: Type.STRING },
                      timeline: { type: Type.STRING }
                    },
                    required: ["theme", "description", "strategic_value", "timeline"]
                  }
                },
                risk_insights: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      area: { type: Type.STRING },
                      description: { type: Type.STRING },
                      vulnerability_level: { type: Type.STRING },
                      mitigation: { type: Type.STRING }
                    },
                    required: ["area", "description", "vulnerability_level", "mitigation"]
                  }
                },
                themes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      type: { type: Type.STRING },
                      narrative: { type: Type.STRING },
                      strength: { type: Type.NUMBER },
                      signal_ids: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["label", "type", "narrative", "strength", "signal_ids"]
                  }
                }
              },
              required: ["summary", "growth_insights", "risk_insights", "themes"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          summaryText = parsed.summary;
          growthInsights = parsed.growth_insights;
          riskInsights = parsed.risk_insights;
          finalThemes = parsed.themes;
        }
      } catch (genAiErr) {
        console.error("Gemini failed to generate themes & insights:", genAiErr);
      }
    }

    // Fallbacks if Gemini fails or database is empty
    if (!summaryText || growthInsights.length === 0 || riskInsights.length === 0 || finalThemes.length === 0) {
      const ind = (entity.industry || "FMCG").toLowerCase();
      const nameLower = entity.displayName.toLowerCase();
      const isConsulting = (ind.includes("services") && !ind.includes("financial") && !ind.includes("consumer") && !ind.includes("internet") && !ind.includes("technology")) || ind.includes("consulting") || ind.includes("audit") || nameLower.includes("ernst") || nameLower.includes("ey") || nameLower.includes("young") || nameLower.includes("deloitte") || nameLower.includes("pwc") || nameLower.includes("kpmg") || nameLower.includes("mckinsey") || nameLower.includes("accenture");
      const isFinancial = ind.includes("financial") || ind.includes("banking") || ind.includes("wealth") || ind.includes("investment") || nameLower.includes("goldman") || nameLower.includes("sachs") || nameLower.includes("jpmorgan") || nameLower.includes("morgan stanley") || nameLower.includes("citi");
      const isPharma = ind.includes("pharma") || ind.includes("life science") || ind.includes("health") || ind.includes("biotech") || nameLower.includes("astrazeneca") || nameLower.includes("pfizer") || nameLower.includes("roche") || nameLower.includes("novartis");
      const isTech = ind.includes("technology") || ind.includes("software") || ind.includes("internet") || nameLower.includes("google") || nameLower.includes("alphabet") || nameLower.includes("microsoft") || nameLower.includes("apple");

      if (isConsulting) {
        if (!summaryText) {
          summaryText = `${entity.legalName}'s Risk and Growth Map shows growth clusters in cloud transformation advisory and carbon accounting services, offset by risk nodes around audit conflict of interest compliance.`;
        }
        if (growthInsights.length === 0) {
          growthInsights = [
            {
              theme: "Enterprise AI Transformation",
              description: "Establishing specialized business consulting frameworks to guide corporate AI rollouts and digital modernization projects.",
              strategic_value: "High",
              timeline: "Active / Near-term"
            },
            {
              theme: "Sustainability Advisory Scaling",
              description: "Expanding consulting capacity to support corporate ESG reporting demands and green energy transition audits.",
              strategic_value: "Very High",
              timeline: "Near-to-mid-term"
            }
          ];
        }
        if (riskInsights.length === 0) {
          riskInsights = [
            {
              area: "Audit Independence Regulations",
              description: "Scrutiny on non-audit advisory fees for audit clients prompts strict partition controls between services.",
              vulnerability_level: "Critical",
              mitigation: "Enforce separation audits, independent review partners, and strict client onboarding checks."
            },
            {
              area: "Client Discretionary Budget Cuts",
              description: "Macro cost pressures prompt enterprise clients to defer large-scale strategy advisory initiatives.",
              vulnerability_level: "Moderate",
              mitigation: "Shift portfolio mix toward immediate efficiency-delivering advisory offerings."
            }
          ];
        }
        if (finalThemes.length === 0) {
          finalThemes = [
            {
              label: "AI & Sustainability Advisory",
              type: "growth",
              narrative: "Scaling tech alliances and green disclosures consulting.",
              strength: 0.90,
              signal_ids: dbSignals.slice(0, 3).map(s => s.id),
            },
            {
              label: "Service Independence Audits",
              type: "risk",
              narrative: "Navigating advisory/audit conflict separations and corporate budget cuts.",
              strength: 0.85,
              signal_ids: dbSignals.filter(s => s.type === "risk").slice(0, 2).map(s => s.id),
            }
          ];
        }
      } else if (isFinancial) {
        if (!summaryText) {
          summaryText = `${entity.legalName}'s Risk and Growth Map shows key growth clusters in investment advisory platforms and capital optimization. Regulatory risks are focused around Basel III capital rules compliance.`;
        }
        if (growthInsights.length === 0) {
          growthInsights = [
            {
              theme: "Institutional Advisory Integration",
              description: "Expanding private wealth digital platforms and quant trading execution services, driving recurring advisory fee inflows.",
              strategic_value: "High",
              timeline: "Active / Near-term"
            },
            {
              theme: "Capital Efficiency Program",
              description: "Strategic realignment to exit low-margin segments, concentrating resources on core market operations and higher-yield corporate banking.",
              strategic_value: "Very High",
              timeline: "Mid-term (12-18 months)"
            }
          ];
        }
        if (riskInsights.length === 0) {
          riskInsights = [
            {
              area: "Capital Adequacy Mandates",
              description: "Evolving Basel III compliance adjustments require capital allocation changes, introducing potential asset leverage constraints.",
              vulnerability_level: "Moderate",
              mitigation: "Strengthen Tier 1 buffers and conduct weekly stress testing under macroeconomic interest rate fluctuations."
            },
            {
              area: "Cybersecurity Threat Exposures",
              description: "Vulnerability to sophisticated infrastructure hacks threatens transaction routing and client trust across payment systems.",
              vulnerability_level: "Critical",
              mitigation: "Deploy zero-trust network architectures, multi-factor hardware keys, and real-time transaction screening."
            }
          ];
        }
        if (finalThemes.length === 0) {
          finalThemes = [
            {
              label: "Capital Desks Optimization",
              type: "growth",
              narrative: "Enhancing advisory and trading desk profitability.",
              strength: 0.90,
              signal_ids: dbSignals.slice(0, 3).map(s => s.id),
            },
            {
              label: "Regulatory Capital Compliance",
              type: "risk",
              narrative: "Navigating Basel III buffers and SEC private fund disclosures.",
              strength: 0.85,
              signal_ids: dbSignals.filter(s => s.type === "risk").slice(0, 2).map(s => s.id),
            }
          ];
        }
      } else if (isPharma) {
        if (!summaryText) {
          summaryText = `${entity.legalName}'s Risk and Growth Map identifies oncology research and specialty care pipelines as major growth drivers, offsetting risk nodes associated with legacy patent expiries and drug price regulations.`;
        }
        if (growthInsights.length === 0) {
          growthInsights = [
            {
              theme: "Specialty Oncology Approvals",
              description: "Securing new therapeutic indication approvals and accelerating clinical launch timelines for blockbuster cancer care pipelines.",
              strategic_value: "Very High",
              timeline: "Active / Near-term"
            },
            {
              theme: "Biotech Pipeline Partnerships",
              description: "Finalizing R&D joint ventures and targeted M&A to co-develop rare disease mRNA therapeutics.",
              strategic_value: "High",
              timeline: "Mid-term (12-18 months)"
            }
          ];
        }
        if (riskInsights.length === 0) {
          riskInsights = [
            {
              area: "Specialty Patent Expirations",
              description: "Loss of market exclusivity on key pipeline blockbusters opens paths for biosimilar and generic competition.",
              vulnerability_level: "Critical",
              mitigation: "Establish combination therapies, expand brand equity programs, and accelerate next-gen replacements."
            },
            {
              area: "Drug Pricing Controls",
              description: "Government pricing caps and insurance refund rules restrict target profit margin expectations.",
              vulnerability_level: "Moderate",
              mitigation: "Leverage real-world clinical efficacy data to support value-based pricing arguments."
            }
          ];
        }
        if (finalThemes.length === 0) {
          finalThemes = [
            {
              label: "Oncology Pipeline Success",
              type: "growth",
              narrative: "Sustaining clinical study progress and new indication approvals.",
              strength: 0.90,
              signal_ids: dbSignals.slice(0, 3).map(s => s.id),
            },
            {
              label: "Exclusivity Loss & Pricing Risk",
              type: "risk",
              narrative: "Countering biosimilar market entry and government pricing negotiations.",
              strength: 0.85,
              signal_ids: dbSignals.filter(s => s.type === "risk").slice(0, 2).map(s => s.id),
            }
          ];
        }
      } else if (isTech) {
        if (!summaryText) {
          summaryText = `${entity.legalName}'s Risk and Growth Map showcases growth momentum driven by hyperscale AI data centers and software-as-a-service expansions, balancing regulatory risk clusters around global antitrust scrutiny.`;
        }
        if (growthInsights.length === 0) {
          growthInsights = [
            {
              theme: "Hyperscale Cloud AI Expansion",
              description: "Deploying next-gen custom compute nodes and developer AI models to capture rising enterprise cloud modernization spend.",
              strategic_value: "Very High",
              timeline: "Active / Near-term"
            },
            {
              theme: "SaaS Ecosystem Integration",
              description: "Integrating smart tools and productivity features across commercial suite lines, increasing customer retention and ARPU.",
              strategic_value: "High",
              timeline: "Near-term"
            }
          ];
        }
        if (riskInsights.length === 0) {
          riskInsights = [
            {
              area: "Global Antitrust Enforcement",
              description: "Heightened regulatory focus on cloud service packaging, platform bundlings, and interoperability conditions.",
              vulnerability_level: "Critical",
              mitigation: "Engage proactive regulatory reviews and establish open-API access standards for third-party tools."
            },
            {
              area: "Data Sovereignty Requirements",
              description: "New sovereign cloud residency rules demand localized storage nodes, increasing data center setup overhead.",
              vulnerability_level: "Moderate",
              mitigation: "Launch regional sovereign cloud zones in partnership with local telecom firms."
            }
          ];
        }
        if (finalThemes.length === 0) {
          finalThemes = [
            {
              label: "AI & Platform Monetization",
              type: "growth",
              narrative: "Scaling developer API lines and custom computing arrays.",
              strength: 0.90,
              signal_ids: dbSignals.slice(0, 3).map(s => s.id),
            },
            {
              label: "Antitrust & Data Regulations",
              type: "risk",
              narrative: "Adapting cloud services to regional competition and sovereignty laws.",
              strength: 0.85,
              signal_ids: dbSignals.filter(s => s.type === "risk").slice(0, 2).map(s => s.id),
            }
          ];
        }
      } else {
        // Consumer / FMCG / Unilever defaults
        if (!summaryText) {
          summaryText = `${entity.legalName}'s Risk and Growth Map shows clustering of critical regulatory risks in the high-materiality quadrant, primarily driven by packaging waste laws and green-claims scrutiny. Growth themes are concentrated in the mid-to-high momentum range, supported by generative AI formulation acceleration and strong brand equity.`;
        }
        if (growthInsights.length === 0) {
          growthInsights = [
            {
              theme: "AI Pivot in R&D Formulation",
              description: "Accelerating product development cycles by using generative AI models to simulate chemical formulations, reducing development timelines for core brands.",
              strategic_value: "High",
              timeline: "Active / Near-term"
            },
            {
              theme: "Structural Capital Unlock",
              description: "Planned separation of business divisions allows for streamlining corporate overhead, sharpening brand investment in higher-margin segments, and returning capital to shareholders.",
              strategic_value: "Very High",
              timeline: "Mid-term (12-18 months)"
            }
          ];
        }
        if (riskInsights.length === 0) {
          riskInsights = [
            {
              area: "Strict Environmental Directives",
              description: "New directives targeting plastic packaging waste and unsubstantiated 'green' claims present substantial legal and compliance risks, demanding product packaging redesigns.",
              vulnerability_level: "Critical",
              mitigation: "Establish a dedicated green-claims governance panel and accelerate transitions to 100% recyclable post-consumer plastics."
            },
            {
              area: "Commodity Cost Volatility",
              description: "Vulnerability to raw input costs threatens operating margins for Personal and Home Care products.",
              vulnerability_level: "Moderate",
              mitigation: "Execute multi-year commodity futures hedging and reformulate products to utilize cheaper bio-based alternative ingredients."
            }
          ];
        }
        if (finalThemes.length === 0) {
          finalThemes = [
            {
              label: "Strategic Portfolio Updates",
              type: "growth",
              narrative: "Recent structural and strategic shifts based on the latest signals.",
              strength: 0.90,
              signal_ids: dbSignals.slice(0, 3).map(s => s.id),
            },
            {
              label: "Regulatory & Green Claims Compliance",
              type: "risk",
              narrative: "Tighter packaging laws and greenwashing penalties across the markets.",
              strength: 0.85,
              signal_ids: dbSignals.filter(s => s.type === "risk").slice(0, 2).map(s => s.id),
            }
          ];
        }
      }
    }

    return NextResponse.json({
      plot,
      balance: {
        growth: dbSignals.filter(s => s.type === "growth").length,
        risk: dbSignals.filter(s => s.type === "risk").length,
        neutral: dbSignals.filter(s => s.type === "neutral").length,
        ratio_30d: dbSignals.filter(s => s.type === "risk").length > 0 
          ? parseFloat((dbSignals.filter(s => s.type === "growth").length / dbSignals.filter(s => s.type === "risk").length).toFixed(2)) 
          : 1.0,
      },
      summary: summaryText,
      growth_insights: growthInsights,
      risk_insights: riskInsights,
      themes: finalThemes,
    });
  } catch (err) {
    console.error("API accounts/map failed:", err);
    return NextResponse.json({ error: "Failed to retrieve map aggregation" }, { status: 500 });
  }
}
