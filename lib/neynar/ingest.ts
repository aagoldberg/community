import { eq, sql, and, isNull } from "drizzle-orm";
import { db, users, casts, replies, engagers, classifications } from "@/lib/db";
import {
  getNeynarClient,
  sleep,
  chunk,
  NormalizedCast,
  NormalizedReply,
} from "./client";
import { classifyBatch, hasActionSignal } from "@/lib/classify";

const MAX_CASTS = 500;
const MAX_REPLIES_PER_ROOT = 100;
const RATE_LIMIT_DELAY = 250; // ms between API calls

export interface IngestResult {
  castsIngested: number;
  repliesIngested: number;
  classificationsCreated: number;
}

export async function runIngestionPipeline(fid: number): Promise<IngestResult> {
  const client = getNeynarClient();

  // Mark as in-progress
  await db
    .update(users)
    .set({ ingestStatus: "in_progress", updatedAt: new Date() })
    .where(eq(users.fid, fid));

  try {
    // 1. Fetch user's casts
    const userCasts = await fetchAllUserCasts(fid, MAX_CASTS);

    // 2. Store casts
    let castsIngested = 0;
    for (const cast of userCasts) {
      const result = await db
        .insert(casts)
        .values({
          hash: cast.hash,
          fid,
          timestamp: cast.timestamp,
          parentHash: cast.parentHash,
          parentFid: cast.parentFid,
          text: cast.text,
          charCount: cast.text.length,
          replyCount: 0,
        })
        .onConflictDoNothing()
        .returning();

      if (result.length > 0) castsIngested++;
    }

    // 3. Fetch replies to root casts
    const rootCasts = userCasts.filter((c) => !c.parentHash);
    const allReplies: NormalizedReply[] = [];

    // Batch fetch replies (with rate limiting)
    for (const batch of chunk(rootCasts, 10)) {
      const batchReplies = await Promise.all(
        batch.map((cast) =>
          client.fetchCastReplies(cast.hash, { limit: MAX_REPLIES_PER_ROOT })
        )
      );

      allReplies.push(...batchReplies.flat());
      await sleep(RATE_LIMIT_DELAY);
    }

    // 4. Store replies and update engager tracking
    let repliesIngested = 0;
    const replyCounts = new Map<string, number>();

    for (const reply of allReplies) {
      // Store reply
      const result = await db
        .insert(replies)
        .values({
          hash: reply.hash,
          parentHash: reply.parentHash,
          targetFid: fid,
          authorFid: reply.authorFid,
          timestamp: reply.timestamp,
          text: reply.text,
          hasActionSignal: hasActionSignal(reply.text),
        })
        .onConflictDoNothing()
        .returning();

      if (result.length > 0) {
        repliesIngested++;

        // Track reply count per parent
        replyCounts.set(
          reply.parentHash,
          (replyCounts.get(reply.parentHash) || 0) + 1
        );

        // Update engager tracking
        await db
          .insert(engagers)
          .values({
            targetFid: fid,
            engagerFid: reply.authorFid,
            firstReplyAt: reply.timestamp,
            lastReplyAt: reply.timestamp,
            replyCount: 1,
          })
          .onConflictDoUpdate({
            target: [engagers.targetFid, engagers.engagerFid],
            set: {
              lastReplyAt: sql`GREATEST(${engagers.lastReplyAt}, EXCLUDED.last_reply_at)`,
              replyCount: sql`${engagers.replyCount} + 1`,
            },
          });
      }
    }

    // Update reply counts on casts
    for (const [hash, count] of replyCounts) {
      await db
        .update(casts)
        .set({ replyCount: count })
        .where(eq(casts.hash, hash));
    }

    // 5. Classify unclassified casts
    const unclassified = await db
      .select({ hash: casts.hash, text: casts.text })
      .from(casts)
      .leftJoin(classifications, eq(casts.hash, classifications.castHash))
      .where(and(eq(casts.fid, fid), isNull(classifications.castHash)));

    let classificationsCreated = 0;
    if (unclassified.length > 0) {
      const results = await classifyBatch(unclassified);

      for (const [hash, result] of results) {
        await db
          .insert(classifications)
          .values({
            castHash: hash,
            sentiment: result.sentiment,
            hasAnger: result.hasAnger,
            angerConfidence: result.angerConfidence.toString(),
            hasAgency: result.hasAgency,
            classifierVersion: "v1.0",
          })
          .onConflictDoNothing();

        classificationsCreated++;
      }
    }

    // 6. Mark complete
    const lastCast = userCasts[0];
    await db
      .update(users)
      .set({
        ingestStatus: "complete",
        lastIngestAt: new Date(),
        lastCastTimestamp: lastCast?.timestamp,
        totalCasts: userCasts.length,
        updatedAt: new Date(),
      })
      .where(eq(users.fid, fid));

    return {
      castsIngested,
      repliesIngested,
      classificationsCreated,
    };
  } catch (error) {
    await db
      .update(users)
      .set({ ingestStatus: "failed", updatedAt: new Date() })
      .where(eq(users.fid, fid));

    throw error;
  }
}

async function fetchAllUserCasts(
  fid: number,
  limit: number
): Promise<NormalizedCast[]> {
  const client = getNeynarClient();
  const allCasts: NormalizedCast[] = [];
  let cursor: string | null = null;

  while (allCasts.length < limit) {
    const { casts: batch, nextCursor } = await client.fetchUserCasts(fid, {
      limit: Math.min(150, limit - allCasts.length),
      cursor,
      includeReplies: true,
    });

    allCasts.push(...batch);
    cursor = nextCursor;

    if (!cursor) break;
    await sleep(RATE_LIMIT_DELAY);
  }

  return allCasts.slice(0, limit);
}

// Incremental update: only fetch casts newer than last timestamp
export async function runIncrementalUpdate(fid: number): Promise<IngestResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.fid, fid),
  });

  if (!user?.lastCastTimestamp) {
    // No previous data, do full ingestion
    return runIngestionPipeline(fid);
  }

  const client = getNeynarClient();
  const lastTimestamp = user.lastCastTimestamp;

  // Fetch recent casts (stop when we hit ones we've seen)
  const newCasts: NormalizedCast[] = [];
  let cursor: string | null = null;
  let done = false;

  while (!done && newCasts.length < MAX_CASTS) {
    const { casts: batch, nextCursor } = await client.fetchUserCasts(fid, {
      limit: 150,
      cursor,
      includeReplies: true,
    });

    for (const cast of batch) {
      if (cast.timestamp <= lastTimestamp) {
        done = true;
        break;
      }
      newCasts.push(cast);
    }

    cursor = nextCursor;
    if (!cursor) break;
    await sleep(RATE_LIMIT_DELAY);
  }

  if (newCasts.length === 0) {
    return { castsIngested: 0, repliesIngested: 0, classificationsCreated: 0 };
  }

  // Store new casts
  let castsIngested = 0;
  for (const cast of newCasts) {
    const result = await db
      .insert(casts)
      .values({
        hash: cast.hash,
        fid,
        timestamp: cast.timestamp,
        parentHash: cast.parentHash,
        parentFid: cast.parentFid,
        text: cast.text,
        charCount: cast.text.length,
        replyCount: 0,
      })
      .onConflictDoNothing()
      .returning();

    if (result.length > 0) castsIngested++;
  }

  // Fetch replies to new root casts
  const newRootCasts = newCasts.filter((c) => !c.parentHash);
  const allReplies: NormalizedReply[] = [];

  for (const batch of chunk(newRootCasts, 10)) {
    const batchReplies = await Promise.all(
      batch.map((cast) =>
        client.fetchCastReplies(cast.hash, { limit: MAX_REPLIES_PER_ROOT })
      )
    );
    allReplies.push(...batchReplies.flat());
    await sleep(RATE_LIMIT_DELAY);
  }

  // Store replies
  let repliesIngested = 0;
  for (const reply of allReplies) {
    const result = await db
      .insert(replies)
      .values({
        hash: reply.hash,
        parentHash: reply.parentHash,
        targetFid: fid,
        authorFid: reply.authorFid,
        timestamp: reply.timestamp,
        text: reply.text,
        hasActionSignal: hasActionSignal(reply.text),
      })
      .onConflictDoNothing()
      .returning();

    if (result.length > 0) {
      repliesIngested++;

      await db
        .insert(engagers)
        .values({
          targetFid: fid,
          engagerFid: reply.authorFid,
          firstReplyAt: reply.timestamp,
          lastReplyAt: reply.timestamp,
          replyCount: 1,
        })
        .onConflictDoUpdate({
          target: [engagers.targetFid, engagers.engagerFid],
          set: {
            lastReplyAt: sql`GREATEST(${engagers.lastReplyAt}, EXCLUDED.last_reply_at)`,
            replyCount: sql`${engagers.replyCount} + 1`,
          },
        });
    }
  }

  // Classify new casts
  const unclassified = await db
    .select({ hash: casts.hash, text: casts.text })
    .from(casts)
    .leftJoin(classifications, eq(casts.hash, classifications.castHash))
    .where(and(eq(casts.fid, fid), isNull(classifications.castHash)));

  let classificationsCreated = 0;
  if (unclassified.length > 0) {
    const results = await classifyBatch(unclassified);

    for (const [hash, result] of results) {
      await db
        .insert(classifications)
        .values({
          castHash: hash,
          sentiment: result.sentiment,
          hasAnger: result.hasAnger,
          angerConfidence: result.angerConfidence.toString(),
          hasAgency: result.hasAgency,
          classifierVersion: "v1.0",
        })
        .onConflictDoNothing();

      classificationsCreated++;
    }
  }

  // Update user
  const latestCast = newCasts[0];
  await db
    .update(users)
    .set({
      lastIngestAt: new Date(),
      lastCastTimestamp: latestCast?.timestamp,
      totalCasts: sql`${users.totalCasts} + ${castsIngested}`,
      updatedAt: new Date(),
    })
    .where(eq(users.fid, fid));

  return { castsIngested, repliesIngested, classificationsCreated };
}
