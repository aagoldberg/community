import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { db, casts, classifications } from "@/lib/db";
import { eq, and, desc, lt, sql } from "drizzle-orm";

type Label = "rage" | "agency" | "positive" | "negative";

// GET /api/me/posts?label=rage&limit=20&cursor=...
export async function GET(req: NextRequest) {
  // Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse parameters
  const label = req.nextUrl.searchParams.get("label") as Label | null;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "20"),
    100
  );
  const cursor = req.nextUrl.searchParams.get("cursor");

  if (!label || !["rage", "agency", "positive", "negative"].includes(label)) {
    return NextResponse.json(
      { error: "Invalid label. Use rage, agency, positive, or negative" },
      { status: 400 }
    );
  }

  try {
    // Build where conditions based on label
    const conditions = [eq(casts.fid, user.fid)];

    // Add cursor condition if provided
    if (cursor) {
      const cursorDate = new Date(cursor);
      conditions.push(lt(casts.timestamp, cursorDate));
    }

    // Label-specific conditions
    let labelCondition;
    switch (label) {
      case "rage":
        labelCondition = and(
          eq(classifications.hasAnger, true),
          sql`${classifications.angerConfidence}::numeric >= 0.5`
        );
        break;
      case "agency":
        labelCondition = eq(classifications.hasAgency, true);
        break;
      case "positive":
        labelCondition = eq(classifications.sentiment, "positive");
        break;
      case "negative":
        labelCondition = eq(classifications.sentiment, "negative");
        break;
    }

    // Query posts
    const posts = await db
      .select({
        hash: casts.hash,
        text: casts.text,
        timestamp: casts.timestamp,
        replyCount: casts.replyCount,
        sentiment: classifications.sentiment,
        hasAnger: classifications.hasAnger,
        angerConfidence: classifications.angerConfidence,
        hasAgency: classifications.hasAgency,
      })
      .from(casts)
      .innerJoin(classifications, eq(casts.hash, classifications.castHash))
      .where(and(...conditions, labelCondition))
      .orderBy(desc(casts.timestamp))
      .limit(limit + 1); // Fetch one extra to check if there are more

    // Check if there are more results
    const hasMore = posts.length > limit;
    const results = hasMore ? posts.slice(0, limit) : posts;

    // Get next cursor
    const nextCursor = hasMore
      ? results[results.length - 1].timestamp.toISOString()
      : null;

    return NextResponse.json({
      posts: results.map((post) => ({
        hash: post.hash,
        excerpt: post.text.slice(0, 200) + (post.text.length > 200 ? "..." : ""),
        timestamp: post.timestamp.toISOString(),
        replyCount: post.replyCount,
        labels: {
          sentiment: post.sentiment,
          hasAnger: post.hasAnger,
          angerConfidence: Number(post.angerConfidence),
          hasAgency: post.hasAgency,
        },
        warpcastUrl: `https://warpcast.com/~/conversations/${post.hash}`,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Posts query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
