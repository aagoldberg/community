import { analyzeLexicon, hasActionSignal as checkActionSignal, maybeSarcastic } from "./lexicon";
import { classifyBatchWithLLM, LLMClassification } from "./llm";
import {
  getCachedClassifications,
  cacheClassification,
  ClassificationCache,
} from "@/lib/cache";

export { hasActionSignal } from "./lexicon";

export interface Classification {
  sentiment: "positive" | "negative" | "neutral";
  hasAnger: boolean;
  angerConfidence: number;
  hasAgency: boolean;
}

const LEXICON_CONFIDENCE_THRESHOLD = 0.6;
const BATCH_SIZE = 20;

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export async function classifyBatch(
  posts: { hash: string; text: string }[]
): Promise<Map<string, Classification>> {
  const results = new Map<string, Classification>();

  if (posts.length === 0) return results;

  // 1. Check cache for already-classified posts
  const hashes = posts.map((p) => p.hash);
  const cached = await getCachedClassifications(hashes);

  // Separate cached and uncached
  const uncached: { hash: string; text: string }[] = [];
  for (const post of posts) {
    const cachedResult = cached.get(post.hash);
    if (cachedResult) {
      results.set(post.hash, {
        sentiment: cachedResult.sentiment,
        hasAnger: cachedResult.hasAnger,
        angerConfidence: cachedResult.angerConfidence,
        hasAgency: cachedResult.hasAgency,
      });
    } else {
      uncached.push(post);
    }
  }

  if (uncached.length === 0) return results;

  // 2. Run lexicon analysis on uncached
  const needsLLM: { hash: string; text: string }[] = [];
  const lexiconResults = new Map<string, Classification>();

  for (const post of uncached) {
    const lexicon = analyzeLexicon(post.text);
    const isSarcastic = maybeSarcastic(post.text);

    // If lexicon has high confidence and not sarcastic, use it
    if (lexicon.angerConfidence === "high" && !isSarcastic) {
      const result: Classification = {
        sentiment: "negative",
        hasAnger: true,
        angerConfidence: lexicon.angerScore,
        hasAgency: lexicon.hasAgency,
      };
      lexiconResults.set(post.hash, result);
    } else if (lexicon.angerScore < 0.1 && !isSarcastic) {
      // Clear non-anger: still need LLM for sentiment but can set anger
      needsLLM.push(post);
    } else {
      // Uncertain: need LLM
      needsLLM.push(post);
    }
  }

  // Store lexicon results
  for (const [hash, result] of Array.from(lexiconResults.entries())) {
    results.set(hash, result);
    await cacheClassification(hash, {
      sentiment: result.sentiment,
      hasAnger: result.hasAnger,
      angerConfidence: result.angerConfidence,
      hasAgency: result.hasAgency,
    });
  }

  // 3. Run LLM on posts that need it
  if (needsLLM.length > 0) {
    // Process in batches
    for (const batch of chunk(needsLLM, BATCH_SIZE)) {
      const llmResults = await classifyBatchWithLLM(batch);

      for (const post of batch) {
        const llmResult = llmResults.get(post.hash);
        const lexicon = analyzeLexicon(post.text);

        const result: Classification = {
          sentiment: llmResult?.sentiment || "neutral",
          hasAnger: llmResult?.hasAnger || false,
          angerConfidence: llmResult?.angerConfidence || 0,
          hasAgency: lexicon.hasAgency, // Always use lexicon for agency
        };

        results.set(post.hash, result);
        await cacheClassification(post.hash, {
          sentiment: result.sentiment,
          hasAnger: result.hasAnger,
          angerConfidence: result.angerConfidence,
          hasAgency: result.hasAgency,
        });
      }
    }
  }

  return results;
}

// Classify a single post (useful for testing)
export async function classifyPost(
  hash: string,
  text: string
): Promise<Classification> {
  const results = await classifyBatch([{ hash, text }]);
  return (
    results.get(hash) || {
      sentiment: "neutral",
      hasAnger: false,
      angerConfidence: 0,
      hasAgency: false,
    }
  );
}
