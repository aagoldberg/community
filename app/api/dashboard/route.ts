import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCachedDashboard, cacheDashboard } from "@/lib/cache";
import { computeDashboard } from "@/lib/metrics/compute";

// GET /api/dashboard?fid=123&range=30d
export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  if (!fid || isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid parameter" },
      { status: 400 }
    );
  }

  // Get range parameter
  const range =
    (req.nextUrl.searchParams.get("range") as "7d" | "30d") || "30d";
  if (range !== "7d" && range !== "30d") {
    return NextResponse.json(
      { error: "Invalid range. Use 7d or 30d" },
      { status: 400 }
    );
  }

  // Check if user exists and has data
  const userRecord = await db.query.users.findFirst({
    where: eq(users.fid, fid),
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
  const cached = await getCachedDashboard(fid, range);
  if (cached) {
    return NextResponse.json({
      ...cached,
      cached: true,
      range,
    });
  }

  // Compute fresh dashboard
  try {
    const dashboard = await computeDashboard(fid, range);

    // Cache for 15 minutes
    await cacheDashboard(fid, range, dashboard);

    return NextResponse.json({
      ...dashboard,
      cached: false,
      range,
    });
  } catch (error) {
    console.error("Dashboard computation error for FID", fid, ":", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to compute dashboard", details: errorMessage },
      { status: 500 }
    );
  }
}
