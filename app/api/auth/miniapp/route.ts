import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// POST /api/auth/miniapp - Register user from Mini App context
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, username, displayName, pfpUrl } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid fid" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.fid, fid),
    });

    if (!existingUser) {
      // Create new user
      await db.insert(users).values({
        fid,
        username,
        displayName,
        pfpUrl,
        ingestStatus: "pending",
      });

      // Queue ingestion job for new user
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await qstash.publishJSON({
        url: `${appUrl}/api/jobs/ingest`,
        body: { fid },
      });

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
