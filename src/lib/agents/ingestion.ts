import { db } from "../db";
import { ClassifiedSignal } from "./classifier";
import { createHash } from "crypto";

export interface SignalIngestInput {
  entityId: string;
  aboutRole: "target" | "competitor" | "industry" | "geo";
  accountId: string;
  category: string;
  type: "growth" | "risk" | "neutral";
  severity: number;
  title: string;
  summary: string;
  rawExcerpt?: string | null;
  publishedAt: Date;
  sources: { publisher: string; url: string; retrievedAt?: Date }[];
  confidence?: number;
  embedding?: number[];
  isIllustrative?: boolean;
}

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function generateDedupHash(url: string, title: string): string {
  // Normalize URL: remove protocol, www, query params, trailing slashes
  let normUrl = url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("?")[0];
  if (normUrl.endsWith("/")) normUrl = normUrl.slice(0, -1);

  // Normalize Title: lowercase, remove punctuation and whitespace
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");

  return createHash("sha256")
    .update(`${normUrl}:${normTitle}`)
    .digest("hex");
}

export async function ingestSignal(input: SignalIngestInput): Promise<string> {
  const primarySource = input.sources[0];
  if (!primarySource || !primarySource.url) {
    throw new Error("Cannot ingest signal: No source URL provided. Provenance-first is enforced.");
  }

  const dedupHash = generateDedupHash(primarySource.url, input.title);

  // 1. Check for exact match via dedupHash
  const exactMatch = await db.signal.findFirst({
    where: {
      accountId: input.accountId,
      dedupHash: dedupHash,
    },
  });

  if (exactMatch) {
    console.log(`Exact duplicate found via hash: ${input.title}. Merging sources.`);
    // Merge sources, ensuring no duplicates in source list
    const existingSources = JSON.parse(exactMatch.sources) as { publisher: string; url: string; retrievedAt?: string }[];
    const mergedSources = [...existingSources];

    for (const newSrc of input.sources) {
      if (!mergedSources.some(s => s.url.toLowerCase() === newSrc.url.toLowerCase())) {
        mergedSources.push({
          publisher: newSrc.publisher,
          url: newSrc.url,
          retrievedAt: newSrc.retrievedAt?.toISOString() || new Date().toISOString(),
        });
      }
    }

    await db.signal.update({
      where: { id: exactMatch.id },
      data: {
        sources: JSON.stringify(mergedSources),
      },
    });

    return exactMatch.id;
  }

  // 2. Vector-based similarity check (Cosine similarity on last 100 signals of the account)
  if (input.embedding && input.embedding.length > 0) {
    const recentSignals = await db.signal.findMany({
      where: {
        accountId: input.accountId,
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });

    for (const signal of recentSignals) {
      if (signal.embedding) {
        try {
          const signalEmbed = JSON.parse(signal.embedding) as number[];
          const similarity = computeCosineSimilarity(input.embedding, signalEmbed);
          
          if (similarity > 0.92) {
            console.log(`Vector duplicate found (similarity: ${similarity.toFixed(3)}): ${input.title} matches ${signal.title}. Merging sources.`);
            
            const existingSources = JSON.parse(signal.sources) as { publisher: string; url: string; retrievedAt?: string }[];
            const mergedSources = [...existingSources];

            for (const newSrc of input.sources) {
              if (!mergedSources.some(s => s.url.toLowerCase() === newSrc.url.toLowerCase())) {
                mergedSources.push({
                  publisher: newSrc.publisher,
                  url: newSrc.url,
                  retrievedAt: newSrc.retrievedAt?.toISOString() || new Date().toISOString(),
                });
              }
            }

            await db.signal.update({
              where: { id: signal.id },
              data: {
                sources: JSON.stringify(mergedSources),
              },
            });

            return signal.id;
          }
        } catch (err) {
          console.error("Error parsing signal embedding for comparison:", err);
        }
      }
    }
  }

  // 3. No duplicate found, create new signal
  const sourceList = input.sources.map(src => ({
    publisher: src.publisher,
    url: src.url,
    retrievedAt: src.retrievedAt?.toISOString() || new Date().toISOString(),
  }));

  const created = await db.signal.create({
    data: {
      entityId: input.entityId,
      aboutRole: input.aboutRole,
      accountId: input.accountId,
      category: input.category,
      type: input.type,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      rawExcerpt: input.rawExcerpt || "",
      publishedAt: input.publishedAt,
      sources: JSON.stringify(sourceList),
      confidence: input.confidence || 1.0,
      embedding: input.embedding ? JSON.stringify(input.embedding) : null,
      dedupHash,
      isIllustrative: input.isIllustrative || false,
    },
  });

  console.log(`Ingested new signal: ${input.title}`);
  return created.id;
}
