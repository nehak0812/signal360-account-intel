import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    // 2. Fetch Theme Clusters dynamically via Gemini
    let finalThemes: any[] = [];
    
    if (dbSignals.length > 0) {
      const prompt = `
        You are an intelligence analyst summarizing news signals into strategic themes for ${entity.legalName}.
        Review the following recent news events:
        
        ${dbSignals.slice(0, 15).map(s => `- ID: ${s.id} | Title: ${s.title} | Type: ${s.type} | Summary: ${s.summary}`).join("\n")}
        
        Group these events into exactly 2 or 3 distinct Strategic Theme Clusters (e.g. "AI Acceleration", "Regulatory Scrutiny", "Portfolio Sharpening").
        For each cluster, determine if it represents primarily "growth", "risk", or "neutral".
        Provide a 1-sentence narrative describing the theme.
        Provide a strength score (0.0 to 1.0) based on how dominant the theme is.
        List the IDs of the news events that belong to this cluster.

        Return a JSON object with a "themes" array, where each item has:
        - "label": String (Theme name)
        - "type": String ("growth", "risk", or "neutral")
        - "narrative": String (1-sentence description)
        - "strength": Number (0.0 to 1.0)
        - "signal_ids": Array of Strings (The IDs of the signals that belong to this theme)
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
              required: ["themes"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          finalThemes = parsed.themes;
        }
      } catch (genAiErr) {
        console.error("Gemini failed to generate themes:", genAiErr);
      }
    }

    // Fallback if Gemini fails
    if (finalThemes.length === 0) {
      finalThemes = [
        {
          label: "Strategic Portfolio Updates",
          type: "growth",
          narrative: "Recent structural and strategic shifts based on the latest signals.",
          strength: 0.90,
          signal_ids: dbSignals.slice(0, 3).map(s => s.id),
        }
      ];
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
      themes: finalThemes,
    });
  } catch (err) {
    console.error("API accounts/map failed:", err);
    return NextResponse.json({ error: "Failed to retrieve map aggregation" }, { status: 500 });
  }
}
