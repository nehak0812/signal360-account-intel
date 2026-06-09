import { ai, DEFAULT_MODEL } from "../gemini";
import { RawArticle } from "./news-retrieval";

export interface ClassifiedSignal {
  category: "ma" | "ai_pivot" | "earnings" | "leadership" | "restructure" | "regulatory" | "partnership" | "expansion" | "crisis" | "esg" | "major_contract";
  type: "growth" | "risk" | "neutral";
  severity: number; // 1 to 5
  title: string;
  summary: string;     // Short paraphrase
  rawExcerpt: string;  // Direct verbatim snippet
  confidence: number;  // 0.0 to 1.0
  relevance: number;   // Relevance score (0 to 10)
  embedding?: number[]; // 768 float array
}

export async function classifyArticle(
  article: RawArticle,
  entityName: string
): Promise<ClassifiedSignal> {
  const prompt = `You are the Classifier Agent for SIGNAL, an AI-driven account intelligence platform.
Your task is to analyze the following raw news article and classify it into a structured signal concerning the entity "${entityName}".

Article URL: ${article.url}
Article Title: ${article.title}
Article Publisher: ${article.publisher}
Article Snippet: ${article.snippet || "N/A"}

Classify the article based on these strict guidelines:
1. Relevance - Rate how directly relevant this article is to the target company "${entityName}" on a scale from 0 to 10:
   - 10: The article is explicitly and primarily about "${entityName}" (e.g. quarterly earnings call, merger announcement, leadership hire).
   - 7-9: The article prominently discusses "${entityName}" as a major player alongside others.
   - 4-6: The article mentions "${entityName}" only in passing or as part of a general list of firms.
   - 0-3: The article is not about "${entityName}" at all (e.g., matching a noise acronym like "EY" or unrelated content).

2. Category - must be one of:
   - "ma": acquisitions, mergers, divestitures, demergers
   - "ai_pivot": AI strategy, tech shifts, digital transformations
   - "earnings": results, guidance, analyst ratings, dividends, financial metrics
   - "leadership": executive hires, exits, promotions, board changes
   - "restructure": reorgs, layoffs, cost reduction programs
   - "regulatory": compliance, litigation, fines, official audits/investigations
   - "partnership": alliances, JVs, channel deals
   - "expansion": new geographies, factories, brand launches
   - "crisis": cyber breaches, product recalls, major scandals, public PR disasters
   - "esg": carbon targets, packaging rules, sustainability initiatives
   - "major_contract": marquee customer wins or major supply contracts (if relevant)

3. Type - must be one of:
   - "growth": likely to strengthen the business (wins, beats, expansions, productivity savings)
   - "risk": likely to weaken or threaten the business (regulatory fines, recalls, competitive losses, reputational hits)
   - "neutral": directionally ambiguous or material transition (leadership change, demergers in transition)

4. Severity - integer between 1 and 5:
   - 5: Transformational, market-wide impact (e.g. multi-billion merger, CEO exit, major recall)
   - 4: Significant material change (e.g. quarterly earnings beat, restructuring, legal probe)
   - 3: Moderate business impact (e.g. regional partnership, product pivot, ESG updates)
   - 2: Minor impact (e.g. single brand marketing campaign, routine regulatory compliance)
   - 1: Very low material impact (e.g. minor press mention, standard administrative notice)

5. Title - Keep it short, active, and professional.
6. Summary - A short, professional paraphrased sentence summarizing the core event. The summary must be ground in the snippet and title, do not hallucinate facts.
7. Raw Excerpt - A short, verbatim snippet from the article text showing proof of the claim. If the snippet is empty, use a relevant fragment of the title.

Return the classification as a strict JSON object following this format:
{
  "category": "ma",
  "type": "growth",
  "severity": 3,
  "title": "...",
  "summary": "...",
  "rawExcerpt": "...",
  "confidence": 0.92,
  "relevance": 9
}

Do not write any code or explanation. Return ONLY the valid JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    const classified = JSON.parse(text) as ClassifiedSignal;
    
    // 2. Compute embedding using Gemini embedding model (text-embedding-004)
    try {
      const embedInput = `${classified.title} ${classified.summary}`;
      const embedRes = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: embedInput,
      });
      if (embedRes.embeddings && embedRes.embeddings[0]?.values) {
        classified.embedding = embedRes.embeddings[0].values;
      }
    } catch (embedErr) {
      console.error("Embedding generation failed, saving without embedding:", embedErr);
    }

    return classified;
  } catch (err) {
    console.error("Gemini classification failed, returning default fallback:", err);
    
    // Fallback classification if Gemini is down or key is invalid
    const isRisk = article.title.toLowerCase().match(/(fine|probe|lawsuit|investigate|audit|risk|decline|drop|miss|regulatory|court)/);
    const isGrowth = article.title.toLowerCase().match(/(combine|merger|acquisition|growth|launch|expand|beat|raise|dividend|success)/);
    
    const type = isRisk ? "risk" : isGrowth ? "growth" : "neutral";
    const category = article.title.toLowerCase().includes("m&a") || article.title.toLowerCase().includes("combine") ? "ma" : "regulatory";
    
    // Fallback heuristic for relevance
    const isExplicitEY = entityName.toLowerCase().match(/(ernst|ey|young)/) && article.title.toLowerCase().match(/(ernst|ey|young)/);
    const isExplicitUnilever = entityName.toLowerCase().includes("unilever") && article.title.toLowerCase().includes("unilever");
    const isExplicitTarget = article.title.toLowerCase().includes(entityName.toLowerCase());
    const relevance = (isExplicitEY || isExplicitUnilever || isExplicitTarget) ? 9 : 4;

    return {
      category,
      type,
      severity: 3,
      title: article.title,
      summary: article.title,
      rawExcerpt: article.title.slice(0, 100),
      confidence: 0.5,
      relevance
    };
  }
}
