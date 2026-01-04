import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCachedDashboard, cacheDashboard } from "@/lib/cache";
import { computeDashboard } from "@/lib/metrics/compute";

// GET /api/me/dashboard?range=30d
export async function GET(req: NextRequest) {
  // Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get range parameter
  const range = (req.nextUrl.searchParams.get("range") as "7d" | "30d") || "30d";
  if (range !== "7d" && range !== "30d") {
    return NextResponse.json(
      { error: "Invalid range. Use 7d or 30d" },
      { status: 400 }
    );
  }

  // Check if user exists and has data
  const userRecord = await db.query.users.findFirst({
    where: eq(users.fid, user.fid),
  });

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If backfill is not complete, return status
  if (userRecord.ingestStatus !== "complete") {
    return NextResponse.json(
      {
        status: "backfilling",
        ingestStatus: userRecord.ingestStatus,
        progress: userRecord.totalCasts || 0,
      },
      { status: 202 }
    );
  }

  // Check cache
  const cached = await getCachedDashboard(user.fid, range);
  if (cached) {
    return NextResponse.json({
      ...cached,
      cached: true,
      range,
    });
  }

  // Compute fresh dashboard
  try {
    const dashboard = await computeDashboard(user.fid, range);

    // Cache for 15 minutes
    await cacheDashboard(user.fid, range, dashboard);

    return NextResponse.json({
      ...dashboard,
      cached: false,
      range,
    });
  } catch (error) {
    console.error("Dashboard computation error:", error);
    return NextResponse.json(
      { error: "Failed to compute dashboard" },
      { status: 500 }
    );
  }
}
