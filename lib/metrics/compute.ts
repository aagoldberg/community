import { db, casts, replies, classifications, engagers } from "@/lib/db";
import { eq, and, gte, lt, sql, isNull, desc, inArray } from "drizzle-orm";
import { DashboardData, ExamplePost } from "@/lib/cache";

type Range = "7d" | "30d";

function getRangeDates(range: Range): {
  rangeStart: Date;
  prevRangeStart: Date;
  prevRangeEnd: Date;
} {
  const now = new Date();
  const days = range === "7d" ? 7 : 30;

  const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevRangeEnd = rangeStart;
  const prevRangeStart = new Date(
    rangeStart.getTime() - days * 24 * 60 * 60 * 1000
  );

  return { rangeStart, prevRangeStart, prevRangeEnd };
}

export async function computeDashboard(
  fid: number,
  range: Range
): Promise<DashboardData> {
  const { rangeStart, prevRangeStart, prevRangeEnd } = getRangeDates(range);

  // Run all computations in parallel
  const [
    activation,
    retention,
    depth,
    reciprocity,
    agencyStats,
    emotionStats,
    hopeStats,
    topExamples,
    dataContext,
  ] = await Promise.all([
    computeActivation(fid, rangeStart, prevRangeStart, prevRangeEnd),
    computeRetention(fid, rangeStart, prevRangeStart, prevRangeEnd),
    computeConversationDepth(fid, rangeStart),
    computeReciprocity(fid, rangeStart),
    computeAgencyStats(fid, rangeStart),
    computeEmotionStats(fid, rangeStart),
    computeHopeStats(fid, rangeStart),
    computeTopExamples(fid, rangeStart),
    computeDataContext(fid, rangeStart),
  ]);

  return {
    activation,
    retention,
    conversationDepth: depth,
    reciprocity,
    agencyRate: agencyStats,
    rageDensity: emotionStats.rage,
    positiveRate: emotionStats.positive,
    hopeIndex: hopeStats,
    topExamples,
    dataContext,
  };
}

// ACTIVATION: New unique repliers in range
async function computeActivation(
  fid: number,
  rangeStart: Date,
  prevRangeStart: Date,
  prevRangeEnd: Date
): Promise<{ value: number; change: number }> {
  const [currentResult, previousResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(engagers)
      .where(
        and(eq(engagers.targetFid, fid), gte(engagers.firstReplyAt, rangeStart))
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(engagers)
      .where(
        and(
          eq(engagers.targetFid, fid),
          gte(engagers.firstReplyAt, prevRangeStart),
          lt(engagers.firstReplyAt, prevRangeEnd)
        )
      ),
  ]);

  const value = Number(currentResult[0]?.count ?? 0);
  const prev = Number(previousResult[0]?.count ?? 0);
  const change = prev > 0 ? Math.round(((value - prev) / prev) * 100) : 0;

  return { value, change };
}

// RETENTION: % of previous period repliers who came back
async function computeRetention(
  fid: number,
  rangeStart: Date,
  prevRangeStart: Date,
  prevRangeEnd: Date
): Promise<{ value: number; change: number }> {
  // Get repliers from previous period
  const prevRepliers = await db
    .selectDistinct({ authorFid: replies.authorFid })
    .from(replies)
    .where(
      and(
        eq(replies.targetFid, fid),
        gte(replies.timestamp, prevRangeStart),
        lt(replies.timestamp, prevRangeEnd)
      )
    );

  if (prevRepliers.length === 0) {
    return { value: 0, change: 0 };
  }

  // Check how many came back in current period
  const prevFids = prevRepliers.map((r) => r.authorFid);
  const returnedRepliers = await db
    .selectDistinct({ authorFid: replies.authorFid })
    .from(replies)
    .where(
      and(
        eq(replies.targetFid, fid),
        gte(replies.timestamp, rangeStart),
        inArray(replies.authorFid, prevFids)
      )
    );

  const value = Math.round((returnedRepliers.length / prevRepliers.length) * 100);

  return { value, change: 0 }; // Would need another period for change
}

// CONVERSATION DEPTH: Replies per root cast
async function computeConversationDepth(
  fid: number,
  rangeStart: Date
): Promise<{ avgReplies: number; pctWithReplies: number }> {
  const result = await db
    .select({
      avgReplies: sql<number>`coalesce(avg(${casts.replyCount}), 0)`,
      total: sql<number>`count(*)`,
      withReplies: sql<number>`count(*) filter (where ${casts.replyCount} > 0)`,
    })
    .from(casts)
    .where(
      and(
        eq(casts.fid, fid),
        isNull(casts.parentHash), // Root casts only
        gte(casts.timestamp, rangeStart)
      )
    );

  const total = Number(result[0]?.total ?? 0);
  const withReplies = Number(result[0]?.withReplies ?? 0);
  const avgReplies = Number(result[0]?.avgReplies ?? 0);

  return {
    avgReplies: Math.round(avgReplies * 10) / 10,
    pctWithReplies: total > 0 ? Math.round((withReplies / total) * 100) : 0,
  };
}

// RECIPROCITY: Reply-back rate + mutual dyads
async function computeReciprocity(
  fid: number,
  rangeStart: Date
): Promise<{ replyBackRate: number; mutualDyads: number }> {
  // Get people who replied to me
  const repliersResult = await db
    .selectDistinct({ authorFid: replies.authorFid })
    .from(replies)
    .where(and(eq(replies.targetFid, fid), gte(replies.timestamp, rangeStart)));

  const repliers = new Set(repliersResult.map((r) => r.authorFid));

  if (repliers.size === 0) {
    return { replyBackRate: 0, mutualDyads: 0 };
  }

  // Get people I replied to (from my casts that are replies)
  const iRepliedToResult = await db
    .selectDistinct({ parentFid: casts.parentFid })
    .from(casts)
    .where(
      and(
        eq(casts.fid, fid),
        sql`${casts.parentHash} IS NOT NULL`,
        gte(casts.timestamp, rangeStart)
      )
    );

  const iRepliedTo = new Set(
    iRepliedToResult
      .map((r) => r.parentFid)
      .filter((fid): fid is number => fid !== null)
  );

  // Count how many repliers I replied back to
  let repliedBack = 0;
  let mutualDyads = 0;

  for (const replierFid of repliers) {
    if (iRepliedTo.has(replierFid)) {
      repliedBack++;
      mutualDyads++;
    }
  }

  const replyBackRate = Math.round((repliedBack / repliers.size) * 100);

  return { replyBackRate, mutualDyads };
}

// AGENCY: Posts with agency that got action-signal replies
async function computeAgencyStats(
  fid: number,
  rangeStart: Date
): Promise<{ value: number; postsWithActionReplies: number }> {
  // Get agency posts
  const agencyPosts = await db
    .select({ hash: casts.hash })
    .from(casts)
    .innerJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(
      and(
        eq(casts.fid, fid),
        gte(casts.timestamp, rangeStart),
        eq(classifications.hasAgency, true)
      )
    );

  // Get total posts (for rate calculation)
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(casts)
    .where(and(eq(casts.fid, fid), gte(casts.timestamp, rangeStart)));

  const total = Number(totalResult[0]?.count ?? 0);
  const agencyCount = agencyPosts.length;

  // Count agency posts with action-signal replies
  let postsWithActionReplies = 0;

  if (agencyPosts.length > 0) {
    const agencyHashes = agencyPosts.map((p) => p.hash);
    const actionReplies = await db
      .selectDistinct({ parentHash: replies.parentHash })
      .from(replies)
      .where(
        and(
          eq(replies.targetFid, fid),
          eq(replies.hasActionSignal, true),
          inArray(replies.parentHash, agencyHashes)
        )
      );

    postsWithActionReplies = actionReplies.length;
  }

  const value = total > 0 ? Math.round((agencyCount / total) * 100) : 0;

  return { value, postsWithActionReplies };
}

// EMOTION STATS: Rage density + positive rate
async function computeEmotionStats(
  fid: number,
  rangeStart: Date
): Promise<{
  rage: { value: number; count: number };
  positive: { value: number };
}> {
  const result = await db
    .select({
      total: sql<number>`count(*)`,
      angerCount: sql<number>`count(*) filter (where ${classifications.hasAnger} = true and ${classifications.angerConfidence}::numeric >= 0.5)`,
      positiveCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'positive')`,
    })
    .from(casts)
    .innerJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(and(eq(casts.fid, fid), gte(casts.timestamp, rangeStart)));

  const total = Number(result[0]?.total ?? 1);
  const angerCount = Number(result[0]?.angerCount ?? 0);
  const positiveCount = Number(result[0]?.positiveCount ?? 0);

  return {
    rage: {
      value: Math.round((angerCount / total) * 1000), // Per 1000
      count: angerCount,
    },
    positive: {
      value: Math.round((positiveCount / total) * 100),
    },
  };
}

// HOPE STATS: Hope Index based on positive/future-oriented content
// NOTE: For now uses positivity as proxy. Future: add hope score to DB
async function computeHopeStats(
  fid: number,
  rangeStart: Date
): Promise<{ value: number; highPct: number }> {
  // Use positive rate with future-oriented weighting as hope proxy
  // A more sophisticated implementation would analyze text for future markers
  const result = await db
    .select({
      total: sql<number>`count(*)`,
      positiveCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'positive')`,
      // Strong positivity as "high hope" proxy
      highPositiveCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'positive' and ${classifications.hasAgency} = true)`,
    })
    .from(casts)
    .innerJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(and(eq(casts.fid, fid), gte(casts.timestamp, rangeStart)));

  const total = Number(result[0]?.total ?? 1);
  const positiveCount = Number(result[0]?.positiveCount ?? 0);
  const highPositiveCount = Number(result[0]?.highPositiveCount ?? 0);

  // Hope index: weighted combination of positivity and action-oriented positivity
  const positiveRate = positiveCount / total;
  const actionPositiveRate = highPositiveCount / total;
  const hopeValue = Math.round((0.7 * positiveRate + 0.3 * actionPositiveRate) * 100);

  return {
    value: hopeValue,
    highPct: Math.round((highPositiveCount / Math.max(positiveCount, 1)) * 100),
  };
}

// TOP EXAMPLES: Rage and agency posts
async function computeTopExamples(
  fid: number,
  rangeStart: Date
): Promise<{ rage: ExamplePost[]; agency: ExamplePost[] }> {
  // Top rage posts
  const ragePosts = await db
    .select({
      hash: casts.hash,
      text: casts.text,
      timestamp: casts.timestamp,
      score: classifications.angerConfidence,
    })
    .from(casts)
    .innerJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(
      and(
        eq(casts.fid, fid),
        gte(casts.timestamp, rangeStart),
        eq(classifications.hasAnger, true),
        sql`${classifications.angerConfidence}::numeric >= 0.5`
      )
    )
    .orderBy(desc(classifications.angerConfidence))
    .limit(5);

  // Top agency posts (ordered by reply count as proxy for impact)
  const agencyPosts = await db
    .select({
      hash: casts.hash,
      text: casts.text,
      timestamp: casts.timestamp,
      replyCount: casts.replyCount,
    })
    .from(casts)
    .innerJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(
      and(
        eq(casts.fid, fid),
        gte(casts.timestamp, rangeStart),
        eq(classifications.hasAgency, true)
      )
    )
    .orderBy(desc(casts.replyCount))
    .limit(5);

  return {
    rage: ragePosts.map((p) => ({
      hash: p.hash,
      excerpt: p.text.slice(0, 100) + (p.text.length > 100 ? "..." : ""),
      timestamp: p.timestamp.toISOString(),
      score: Number(p.score),
    })),
    agency: agencyPosts.map((p) => ({
      hash: p.hash,
      excerpt: p.text.slice(0, 100) + (p.text.length > 100 ? "..." : ""),
      timestamp: p.timestamp.toISOString(),
      score: p.replyCount ?? 0,
    })),
  };
}

// DATA CONTEXT: Counts to help user understand their metrics
async function computeDataContext(
  fid: number,
  rangeStart: Date
): Promise<{
  totalPosts: number;
  rootPosts: number;
  repliesReceived: number;
  uniqueEngagers: number;
  positivePosts: number;
  negativePosts: number;
}> {
  const [postStats, replyStats, engagerStats, sentimentStats] = await Promise.all([
    // Post counts
    db
      .select({
        total: sql<number>`count(*)`,
        root: sql<number>`count(*) filter (where ${casts.parentHash} is null)`,
      })
      .from(casts)
      .where(and(eq(casts.fid, fid), gte(casts.timestamp, rangeStart))),

    // Replies received
    db
      .select({ count: sql<number>`count(*)` })
      .from(replies)
      .where(and(eq(replies.targetFid, fid), gte(replies.timestamp, rangeStart))),

    // Unique engagers
    db
      .selectDistinct({ authorFid: replies.authorFid })
      .from(replies)
      .where(and(eq(replies.targetFid, fid), gte(replies.timestamp, rangeStart))),

    // Sentiment breakdown
    db
      .select({
        positive: sql<number>`count(*) filter (where ${classifications.sentiment} = 'positive')`,
        negative: sql<number>`count(*) filter (where ${classifications.sentiment} = 'negative')`,
      })
      .from(casts)
      .innerJoin(classifications, eq(casts.hash, classifications.castHash))
      .where(and(eq(casts.fid, fid), gte(casts.timestamp, rangeStart))),
  ]);

  return {
    totalPosts: Number(postStats[0]?.total ?? 0),
    rootPosts: Number(postStats[0]?.root ?? 0),
    repliesReceived: Number(replyStats[0]?.count ?? 0),
    uniqueEngagers: engagerStats.length,
    positivePosts: Number(sentimentStats[0]?.positive ?? 0),
    negativePosts: Number(sentimentStats[0]?.negative ?? 0),
  };
}
