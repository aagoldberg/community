import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { invalidateDashboardCache } from "@/lib/cache";
import { runIngestionPipeline } from "@/lib/neynar/ingest";

// POST /api/refresh?fid=123 - Trigger data refresh
export async function POST(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  if (!fid || isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid parameter" },
      { status: 400 }
    );
  }

  // Check if user exists
  const userRecord = await db.query.users.findFirst({
    where: eq(users.fid, fid),
  });

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Don't allow refresh if already in progress
  if (userRecord.ingestStatus === "in_progress") {
    return NextResponse.json(
      {
        status: "already_in_progress",
        message: "A refresh is already in progress",
      },
      { status: 409 }
    );
  }

  // Rate limit: don't allow refresh more than once per 15 minutes
  if (userRecord.lastIngestAt) {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (userRecord.lastIngestAt > fifteenMinsAgo) {
      const waitMinutes = Math.ceil(
        (userRecord.lastIngestAt.getTime() + 15 * 60 * 1000 - Date.now()) /
          60000
      );
      return NextResponse.json(
        {
          status: "rate_limited",
          message: `Please wait ${waitMinutes} minutes before refreshing again`,
          nextRefreshAt: new Date(
            userRecord.lastIngestAt.getTime() + 15 * 60 * 1000
          ).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  try {
    // Invalidate cache
    await invalidateDashboardCache(fid);

    // Run full ingestion pipeline
    const result = await runIngestionPipeline(fid);

    return NextResponse.json({
      status: "complete",
      castsIngested: result.castsIngested,
      repliesIngested: result.repliesIngested,
      classificationsCreated: result.classificationsCreated,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh data" },
      { status: 500 }
    );
  }
}

// Allow longer execution
export const maxDuration = 300;
