/**
 * Main classification module
 * Exports the hybrid VADER + lexicon emotion scoring system
 */

import {
  computeEmotion,
  emotionToClassification,
  MessageEmotion,
  Classification,
} from "./emotion";
import {
  getCachedClassifications,
  cacheClassification,
} from "@/lib/cache";

// Re-export types and functions
export { hasActionSignal } from "./lexicon";
export { computeEmotion, emotionToClassification } from "./emotion";
export type { MessageEmotion, Classification } from "./emotion";
export type { VaderScore } from "./vader";
export type { LexiconHits, LexiconDeltas } from "./lexicon";

/**
 * Classify a batch of posts using the hybrid emotion system
 * Returns backward-compatible Classification objects
 */
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

  // 2. Compute emotions for uncached posts
  for (const post of uncached) {
    const emotion = computeEmotion(post.text);
    const classification = emotionToClassification(emotion);

    results.set(post.hash, classification);
    await cacheClassification(post.hash, {
      sentiment: classification.sentiment,
      hasAnger: classification.hasAnger,
      angerConfidence: classification.angerConfidence,
      hasAgency: classification.hasAgency,
    });
  }

  return results;
}

/**
 * Compute full emotions for a batch of posts (not just classification)
 * Returns the complete MessageEmotion with explainability
 */
export async function computeEmotionBatch(
  posts: { hash: string; text: string }[]
): Promise<Map<string, MessageEmotion>> {
  const results = new Map<string, MessageEmotion>();

  for (const post of posts) {
    results.set(post.hash, computeEmotion(post.text));
  }

  return results;
}

/**
 * Classify a single post (useful for testing)
 */
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

/**
 * Get full emotion analysis for a single post
 */
export function analyzePost(text: string): MessageEmotion {
  return computeEmotion(text);
}
