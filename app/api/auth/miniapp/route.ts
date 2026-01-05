import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { runIngestionPipeline } from "@/lib/neynar/ingest";

// POST /api/auth/miniapp - Register user from Mini App context
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, username, displayName, pfpUrl } = body;

    console.log("[auth/miniapp] Received:", { fid, username, displayName });

    if (!fid || typeof fid !== "number") {
      console.log("[auth/miniapp] Invalid FID:", fid);
      return NextResponse.json(
        { error: "Missing or invalid fid" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.fid, fid),
    });

    console.log("[auth/miniapp] Existing user:", existingUser ? {
      fid: existingUser.fid,
      status: existingUser.ingestStatus,
      totalCasts: existingUser.totalCasts
    } : null);

    if (!existingUser) {
      // Create new user
      console.log("[auth/miniapp] Creating new user:", fid);
      await db.insert(users).values({
        fid,
        username,
        displayName,
        pfpUrl,
        ingestStatus: "in_progress",
      });

      // Run ingestion directly (no QStash needed for small accounts)
      console.log("[auth/miniapp] Running ingestion for new user:", fid);
      const result = await runIngestionPipeline(fid);
      console.log("[auth/miniapp] Ingestion result:", result);

      return NextResponse.json({
        success: true,
        isNew: true,
        user: { fid, username, displayName, pfpUrl },
      });
    }

    // Update existing user profile
    await db
      .update(users)
      .set({
        username,
        displayName,
        pfpUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.fid, fid));

    // If ingestion never completed OR user has no casts, run it now
    const needsIngestion =
      existingUser.ingestStatus !== "complete" ||
      !existingUser.totalCasts ||
      existingUser.totalCasts === 0;

    console.log("[auth/miniapp] Needs ingestion:", needsIngestion);

    if (needsIngestion) {
      console.log("[auth/miniapp] Running ingestion for existing user:", fid);
      await db
        .update(users)
        .set({ ingestStatus: "in_progress" })
        .where(eq(users.fid, fid));

      const result = await runIngestionPipeline(fid);
      console.log("[auth/miniapp] Ingestion result:", result);
    }

    return NextResponse.json({
      success: true,
      isNew: false,
      user: {
        fid,
        username,
        displayName,
        pfpUrl,
        ingestStatus: existingUser.ingestStatus,
      },
    });
  } catch (error) {
    console.error("Mini app auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

// Allow longer execution for ingestion
export const maxDuration = 300;
