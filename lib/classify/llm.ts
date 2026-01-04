import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface LLMClassification {
  sentiment: "positive" | "negative" | "neutral";
  hasAnger: boolean;
  angerConfidence: number;
}

const BATCH_PROMPT = `Classify each social media post for sentiment and anger.

For each post, determine:
1. sentiment: "positive" (optimistic, happy, grateful), "negative" (angry, sad, frustrated), or "neutral"
2. has_anger: true if the post expresses frustration, outrage, or anger
3. anger_confidence: 0.0-1.0 indicating how confident you are about anger detection

Return a JSON array with one object per post in the same order.
Format: [{"sentiment": "...", "has_anger": bool, "anger_confidence": 0.0-1.0}, ...]

Posts to classify:
{posts}

Return only valid JSON, no explanation.`;

const SINGLE_PROMPT = `Classify this social media post:
"{text}"

Return JSON: {"sentiment": "positive"|"negative"|"neutral", "has_anger": bool, "anger_confidence": 0.0-1.0}`;

export async function classifyWithLLM(text: string): Promise<LLMClassification> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: SINGLE_PROMPT.replace("{text}", text.slice(0, 500)),
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return { sentiment: "neutral", hasAnger: false, angerConfidence: 0 };
    }

    const parsed = JSON.parse(content.text);
    return {
      sentiment: parsed.sentiment || "neutral",
      hasAnger: parsed.has_anger || false,
      angerConfidence: parsed.anger_confidence || 0,
    };
  } catch (error) {
    console.error("LLM classification error:", error);
    return { sentiment: "neutral", hasAnger: false, angerConfidence: 0 };
  }
}

export async function classifyBatchWithLLM(
  posts: { hash: string; text: string }[]
): Promise<Map<string, LLMClassification>> {
  const results = new Map<string, LLMClassification>();

  if (posts.length === 0) return results;

  // Format posts for batch classification
  const postsText = posts
    .map((p, i) => `[${i}] "${p.text.slice(0, 300).replace(/"/g, "'")}"`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: BATCH_PROMPT.replace("{posts}", postsText),
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "");
    }

    const parsed = JSON.parse(jsonText) as Array<{
      sentiment: string;
      has_anger: boolean;
      anger_confidence: number;
    }>;

    parsed.forEach((result, i) => {
      if (posts[i]) {
        results.set(posts[i].hash, {
          sentiment: (result.sentiment as "positive" | "negative" | "neutral") || "neutral",
          hasAnger: result.has_anger || false,
          angerConfidence: result.anger_confidence || 0,
        });
      }
    });
  } catch (error) {
    console.error("Batch LLM classification error:", error);
    // Fallback: classify individually
    for (const post of posts) {
      const result = await classifyWithLLM(post.text);
      results.set(post.hash, result);
    }
  }

  return results;
}
