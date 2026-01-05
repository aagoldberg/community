import { NextRequest, NextResponse } from "next/server";
import { getNeynarClient } from "@/lib/neynar/client";
import { db, casts } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";

// GET /api/debug-replies?fid=5650
// Debug endpoint to test reply fetching
export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  if (!fid) {
    return NextResponse.json({ error: "Missing fid" }, { status: 400 });
  }

  const client = getNeynarClient();

  // Get a few root casts from this user
  const rootCasts = await db
    .select({ hash: casts.hash, text: casts.text })
    .from(casts)
    .where(eq(casts.fid, fid))
    .limit(3);

  if (rootCasts.length === 0) {
    return NextResponse.json({ error: "No casts found for this user" });
  }

  // Try to fetch replies for each cast
  const results = [];
  for (const cast of rootCasts) {
    try {
      const replies = await client.fetchCastReplies(cast.hash, { limit: 10 });
      results.push({
        castHash: cast.hash,
        castText: cast.text.slice(0, 50),
        repliesFound: replies.length,
        sampleReply: replies[0]?.text?.slice(0, 50) || null,
      });
    } catch (error) {
      results.push({
        castHash: cast.hash,
        castText: cast.text.slice(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    fid,
    castsChecked: rootCasts.length,
    results,
  });
}
