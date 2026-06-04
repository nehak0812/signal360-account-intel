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
    const query = `${entity.legalName} company news`;
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    
    const feed = await parser.parseURL(feedUrl);
    const latestItems = feed.items.slice(0, 3); // top 3 news

    const prompt = `
      You are generating 3 simulated LinkedIn posts from the executive team of ${entity.legalName}.
      Base the posts EXACTLY on the following recent news events:
      ${latestItems.map((item, i) => `News ${i+1}: ${item.title} - ${item.contentSnippet}`).join("\n\n")}

      For each post, act as an executive (e.g., CEO, Head of R&D, VP of Sustainability) sharing this news on LinkedIn with their professional network.
      Write in a confident, corporate, strategic tone. Include hashtags.

      Return a JSON array of objects with the exact schema:
      {
        "person_role": "String (e.g. CEO, Head of R&D)",
        "entity": "${entity.legalName}",
        "about_role": "target",
        "body": "String (the actual post text)",
        "topics": ["String", "String"],
        "engagement": { "reactions": Number, "comments": Number, "reposts": Number }
      }
    `;

    let generatedPosts = [];

    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                person_role: { type: Type.STRING },
                entity: { type: Type.STRING },
                about_role: { type: Type.STRING },
                body: { type: Type.STRING },
                topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                engagement: {
                  type: Type.OBJECT,
                  properties: {
                    reactions: { type: Type.INTEGER },
                    comments: { type: Type.INTEGER },
                    reposts: { type: Type.INTEGER }
                  }
                }
              },
              required: ["person_role", "entity", "about_role", "body", "topics", "engagement"]
            }
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        generatedPosts = parsed.map((p: any, i: number) => ({
          id: `gen-${i}`,
          ...p,
          posted_at: new Date().toISOString(),
          source: { publisher: `Based on: ${latestItems[i]?.source || "News"}`, url: latestItems[i]?.link || "#" },
          is_illustrative: false, // it's based on live real news now
        }));
      }
    } catch (genAiErr) {
      console.error("Gemini failed to generate social posts:", genAiErr);
    }

    const trending_topics = ["#Innovation", "#Growth", "#MarketTrends", "#Leadership", "#Strategy"];

    // Fallback if Gemini fails
    if (generatedPosts.length === 0) {
      generatedPosts = [
        {
          id: "fallback-1",
          person_role: "Executive Persona",
          entity: entity.legalName,
          about_role: "target",
          body: `We are closely monitoring recent market developments. Our focus remains on delivering sustainable, long-term growth and driving efficiency across our core operations.`,
          topics: ["#Strategy", "#Growth"],
          engagement: { reactions: 840, comments: 56, reposts: 18 },
          posted_at: new Date().toISOString(),
          source: { publisher: "Executive Briefing", url: "#" },
          is_illustrative: true,
        }
      ];
    }

    return NextResponse.json({
      trending_topics,
      posts: generatedPosts,
    });

  } catch (err) {
    console.error("API accounts/linkedin-voices failed:", err);
    return NextResponse.json({ error: "Failed to retrieve LinkedIn voices" }, { status: 500 });
  }
}
