import { NextRequest, NextResponse } from "next/server";
import { invalidateDashboardCache } from "@/lib/cache";

// POST /api/cache-clear?fid=123 - Clear dashboard cache without full refresh
export async function POST(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  if (!fid || isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid parameter" },
      { status: 400 }
    );
  }

  await invalidateDashboardCache(fid);

  return NextResponse.json({ success: true, message: "Cache cleared" });
}
