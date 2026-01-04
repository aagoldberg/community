import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { invalidateDashboardCache } from "@/lib/cache";
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// POST /api/me/refresh - Trigger data refresh
export async function POST(req: NextRequest) {
  // Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user exists
  const userRecord = await db.query.users.findFirst({
    where: eq(users.fid, user.fid),
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

  // Rate limit: don't allow refresh more than once per hour
  if (userRecord.lastIngestAt) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (userRecord.lastIngestAt > hourAgo) {
      const waitMinutes = Math.ceil(
        (userRecord.lastIngestAt.getTime() + 60 * 60 * 1000 - Date.now()) /
          60000
      );
      return NextResponse.json(
        {
          status: "rate_limited",
          message: `Please wait ${waitMinutes} minutes before refreshing again`,
          nextRefreshAt: new Date(
            userRecord.lastIngestAt.getTime() + 60 * 60 * 1000
          ).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  try {
    // Invalidate cache
    await invalidateDashboardCache(user.fid);

    // Queue incremental update job
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const result = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/ingest`,
      body: { fid: user.fid, incremental: true },
    });

    return NextResponse.json({
      status: "queued",
      jobId: result.messageId,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Failed to queue refresh" },
      { status: 500 }
    );
  }
}
