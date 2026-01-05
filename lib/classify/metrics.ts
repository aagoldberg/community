/**
 * Community-level metrics computed from message emotions
 * Supports rolling windows (7d, 30d) and per-channel aggregation
 */

import { MessageEmotion } from "./emotion";

export interface CommunityMetrics {
  // Rage Density: (count of anger > 0.6) / totalMessages * 1000
  rageDensity: number;

  // Hope Index
  hopeIndex: number; // mean hope score
  hopeHighPct: number; // percentage of messages with hope >= 0.7

  // Trust / Reciprocity (requires interaction data)
  reciprocity: number; // mutual_replies / total_replies
  trustGradient: number; // mean(positivity) * reciprocity

  // Agency Rate
  agencyRate: number; // percentage of emotional messages (pos >= 0.4 or anger >= 0.4) with agency >= 0.6

  // Additional useful metrics
  avgSentiment: number;
  avgPositivity: number;
  avgNegativity: number;
  avgAnger: number;
  avgAgency: number;
  avgConfidence: number;
  totalMessages: number;
}

export interface InteractionData {
  authorFid: number;
  repliedToFid: number;
}

/**
 * Compute community metrics from a set of emotions
 */
export function computeCommunityMetrics(
  emotions: MessageEmotion[],
  interactions?: InteractionData[]
): CommunityMetrics {
  const total = emotions.length;

  if (total === 0) {
    return {
      rageDensity: 0,
      hopeIndex: 0,
      hopeHighPct: 0,
      reciprocity: 0,
      trustGradient: 0,
      agencyRate: 0,
      avgSentiment: 0,
      avgPositivity: 0,
      avgNegativity: 0,
      avgAnger: 0,
      avgAgency: 0,
      avgConfidence: 0,
      totalMessages: 0,
    };
  }

  // Compute sums
  let sentimentSum = 0;
  let positivitySum = 0;
  let negativitySum = 0;
  let angerSum = 0;
  let hopeSum = 0;
  let agencySum = 0;
  let confidenceSum = 0;

  let highAngerCount = 0; // anger > 0.6
  let highHopeCount = 0; // hope >= 0.7
  let emotionalMessages = 0; // pos >= 0.4 or anger >= 0.4
  let emotionalWithAgency = 0; // emotional AND agency >= 0.6

  for (const e of emotions) {
    sentimentSum += e.sentiment;
    positivitySum += e.positivity;
    negativitySum += e.negativity;
    angerSum += e.anger;
    hopeSum += e.hope;
    agencySum += e.agency;
    confidenceSum += e.confidence;

    if (e.anger > 0.6) {
      highAngerCount++;
    }

    if (e.hope >= 0.7) {
      highHopeCount++;
    }

    const isEmotional = e.positivity >= 0.4 || e.anger >= 0.4;
    if (isEmotional) {
      emotionalMessages++;
      if (e.agency >= 0.6) {
        emotionalWithAgency++;
      }
    }
  }

  // Compute averages
  const avgSentiment = sentimentSum / total;
  const avgPositivity = positivitySum / total;
  const avgNegativity = negativitySum / total;
  const avgAnger = angerSum / total;
  const avgConfidence = confidenceSum / total;
  const avgAgency = agencySum / total;

  // Rage Density: per 1000 messages
  const rageDensity = (highAngerCount / total) * 1000;

  // Hope Index
  const hopeIndex = hopeSum / total;
  const hopeHighPct = (highHopeCount / total) * 100;

  // Agency Rate: among emotional messages, what % have high agency
  const agencyRate =
    emotionalMessages > 0
      ? (emotionalWithAgency / emotionalMessages) * 100
      : 0;

  // Trust / Reciprocity (requires interaction data)
  let reciprocity = 0;
  let trustGradient = 0;

  if (interactions && interactions.length > 0) {
    const { reciprocityScore, mutualPairs, totalReplies } =
      computeReciprocity(interactions);
    reciprocity = reciprocityScore;
    trustGradient = avgPositivity * reciprocity;
  }

  return {
    rageDensity: round2(rageDensity),
    hopeIndex: round3(hopeIndex),
    hopeHighPct: round2(hopeHighPct),
    reciprocity: round3(reciprocity),
    trustGradient: round3(trustGradient),
    agencyRate: round2(agencyRate),
    avgSentiment: round3(avgSentiment),
    avgPositivity: round3(avgPositivity),
    avgNegativity: round3(avgNegativity),
    avgAnger: round3(avgAnger),
    avgAgency: round3(avgAgency),
    avgConfidence: round3(avgConfidence),
    totalMessages: total,
  };
}

/**
 * Compute reciprocity from interaction data
 */
function computeReciprocity(interactions: InteractionData[]): {
  reciprocityScore: number;
  mutualPairs: number;
  totalReplies: number;
} {
  // Build adjacency map: who replied to whom
  const repliedTo = new Map<string, Set<number>>(); // "author" -> set of fids they replied to

  for (const { authorFid, repliedToFid } of interactions) {
    const key = authorFid.toString();
    if (!repliedTo.has(key)) {
      repliedTo.set(key, new Set());
    }
    repliedTo.get(key)!.add(repliedToFid);
  }

  // Count mutual pairs (A replied to B AND B replied to A)
  let mutualPairs = 0;
  const countedPairs = new Set<string>();

  for (const [authorStr, recipients] of repliedTo.entries()) {
    const author = parseInt(authorStr);
    for (const recipient of recipients) {
      // Check if recipient also replied to author
      const recipientReplies = repliedTo.get(recipient.toString());
      if (recipientReplies && recipientReplies.has(author)) {
        // Create canonical pair key to avoid double counting
        const pairKey = [Math.min(author, recipient), Math.max(author, recipient)].join("-");
        if (!countedPairs.has(pairKey)) {
          countedPairs.add(pairKey);
          mutualPairs++;
        }
      }
    }
  }

  const totalReplies = interactions.length;

  // Reciprocity = mutual pairs * 2 / total unique reply relationships
  // (mutual pair = 2 replies that reciprocate)
  const uniqueRelationships = countedPairs.size + (totalReplies - mutualPairs * 2) / 2;
  const reciprocityScore =
    uniqueRelationships > 0 ? (mutualPairs * 2) / totalReplies : 0;

  return {
    reciprocityScore: Math.min(reciprocityScore, 1),
    mutualPairs,
    totalReplies,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Compute metrics for a specific time window
 */
export interface TimestampedEmotion {
  timestamp: Date;
  emotion: MessageEmotion;
}

export function computeMetricsForWindow(
  emotions: TimestampedEmotion[],
  windowDays: number,
  endDate: Date = new Date()
): CommunityMetrics {
  const windowStart = new Date(endDate);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const inWindow = emotions
    .filter((e) => e.timestamp >= windowStart && e.timestamp <= endDate)
    .map((e) => e.emotion);

  return computeCommunityMetrics(inWindow);
}

/**
 * Compute daily aggregated metrics
 */
export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  metrics: CommunityMetrics;
}

export function computeDailyMetrics(
  emotions: TimestampedEmotion[]
): DailyMetrics[] {
  // Group by date
  const byDate = new Map<string, MessageEmotion[]>();

  for (const { timestamp, emotion } of emotions) {
    const dateStr = timestamp.toISOString().split("T")[0];
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, []);
    }
    byDate.get(dateStr)!.push(emotion);
  }

  // Compute metrics for each day
  const results: DailyMetrics[] = [];
  for (const [date, dayEmotions] of byDate.entries()) {
    results.push({
      date,
      metrics: computeCommunityMetrics(dayEmotions),
    });
  }

  // Sort by date
  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}
