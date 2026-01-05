import { NextRequest, NextResponse } from "next/server";
import { db, users, casts, replies, classifications, engagers } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// GET /api/debug?fid=123 - Get debug info for a user
export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  if (!fid || isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid parameter" },
      { status: 400 }
    );
  }

  // Get user record
  const user = await db.query.users.findFirst({
    where: eq(users.fid, fid),
  });

  // Count casts
  const castCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(casts)
    .where(eq(casts.fid, fid));

  // Count root casts (not replies)
  const rootCastCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(casts)
    .where(sql`${casts.fid} = ${fid} AND ${casts.parentHash} IS NULL`);

  // Count classifications
  const classificationCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(classifications)
    .innerJoin(casts, eq(casts.hash, classifications.castHash))
    .where(eq(casts.fid, fid));

  // Count replies to this user
  const replyCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(replies)
    .where(eq(replies.targetFid, fid));

  // Count engagers
  const engagerCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(engagers)
    .where(eq(engagers.targetFid, fid));

  // Sample 3 recent casts
  const sampleCasts = await db
    .select({
      hash: casts.hash,
      text: casts.text,
      timestamp: casts.timestamp,
      replyCount: casts.replyCount,
    })
    .from(casts)
    .where(eq(casts.fid, fid))
    .orderBy(sql`${casts.timestamp} DESC`)
    .limit(3);

  // Classification breakdown
  const classificationStats = await db
    .select({
      positiveCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'positive')`,
      negativeCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'negative')`,
      neutralCount: sql<number>`count(*) filter (where ${classifications.sentiment} = 'neutral')`,
      angerCount: sql<number>`count(*) filter (where ${classifications.hasAnger} = true)`,
      agencyCount: sql<number>`count(*) filter (where ${classifications.hasAgency} = true)`,
    })
    .from(classifications)
    .innerJoin(casts, eq(casts.hash, classifications.castHash))
    .where(eq(casts.fid, fid));

  // Casts in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCastCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(casts)
    .where(sql`${casts.fid} = ${fid} AND ${casts.timestamp} >= ${thirtyDaysAgo}`);

  return NextResponse.json({
    user: user
      ? {
          fid: user.fid,
          username: user.username,
          ingestStatus: user.ingestStatus,
          lastIngestAt: user.lastIngestAt?.toISOString() ?? null,
          totalCasts: user.totalCasts,
        }
      : null,
    counts: {
      casts: Number(castCount[0]?.count ?? 0),
      rootCasts: Number(rootCastCount[0]?.count ?? 0),
      classifications: Number(classificationCount[0]?.count ?? 0),
      repliesReceived: Number(replyCount[0]?.count ?? 0),
      engagers: Number(engagerCount[0]?.count ?? 0),
    },
    sampleCasts: sampleCasts.map((c) => ({
      hash: c.hash.slice(0, 10) + "...",
      text: c.text.slice(0, 50) + (c.text.length > 50 ? "..." : ""),
      timestamp: c.timestamp.toISOString(),
      replyCount: c.replyCount,
    })),
    classificationBreakdown: {
      positive: Number(classificationStats[0]?.positiveCount ?? 0),
      negative: Number(classificationStats[0]?.negativeCount ?? 0),
      neutral: Number(classificationStats[0]?.neutralCount ?? 0),
      hasAnger: Number(classificationStats[0]?.angerCount ?? 0),
      hasAgency: Number(classificationStats[0]?.agencyCount ?? 0),
    },
    castsInLast30Days: Number(recentCastCount[0]?.count ?? 0),
    rangeInfo: {
      now: new Date().toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
    },
  });
}
