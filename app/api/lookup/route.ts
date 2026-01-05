import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getNeynarClient } from "@/lib/neynar/client";
import { runIngestionPipeline } from "@/lib/neynar/ingest";

// POST /api/lookup?fid=123 or /api/lookup?username=vitalik.eth
// Looks up a user by FID or username, ensures they exist in DB, triggers ingestion if needed
export async function POST(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const usernameParam = req.nextUrl.searchParams.get("username");

  let fid: number | null = null;
  let username: string | null = null;
  let displayName: string | null = null;
  let pfpUrl: string | null = null;

  const client = getNeynarClient();

  // If username provided, look up FID from Neynar
  if (usernameParam) {
    try {
      const profile = await client.fetchUserByUsername(usernameParam);
      if (!profile) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      fid = profile.fid;
      username = profile.username;
      displayName = profile.displayName;
      pfpUrl = profile.pfpUrl;
    } catch (error) {
      console.error("Username lookup error:", error);
      return NextResponse.json(
        { error: "Failed to look up username" },
        { status: 500 }
      );
    }
  } else if (fidParam) {
    fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      return NextResponse.json(
        { error: "Invalid FID" },
        { status: 400 }
      );
    }

    // Fetch profile from Neynar
    try {
      const profile = await client.fetchUserProfile(fid);
      if (profile) {
        username = profile.username;
        displayName = profile.displayName;
        pfpUrl = profile.pfpUrl;
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
      // Continue without profile data
    }
  } else {
    return NextResponse.json(
      { error: "Provide fid or username parameter" },
      { status: 400 }
    );
  }

  if (!fid) {
    return NextResponse.json(
      { error: "Could not determine FID" },
      { status: 400 }
    );
  }

  // Check if user exists in our DB
  const existingUser = await db.query.users.findFirst({
    where: eq(users.fid, fid),
  });

  if (!existingUser) {
    // Create user and run ingestion
    await db.insert(users).values({
      fid,
      username,
      displayName,
      pfpUrl,
      ingestStatus: "in_progress",
    });

    // Run ingestion (this may take a while)
    try {
      await runIngestionPipeline(fid);
    } catch (error) {
      console.error("Ingestion error:", error);
      // Continue - user can refresh later
    }
  } else if (
    existingUser.ingestStatus !== "complete" ||
    !existingUser.totalCasts ||
    existingUser.totalCasts === 0
  ) {
    // User exists but needs ingestion
    try {
      await runIngestionPipeline(fid);
    } catch (error) {
      console.error("Ingestion error:", error);
    }
  }

  return NextResponse.json({
    fid,
    username,
    displayName,
    pfpUrl,
  });
}

// Allow longer execution for ingestion
export const maxDuration = 300;
