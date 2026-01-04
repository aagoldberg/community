import { NextRequest, NextResponse } from "next/server";
import { createToken, UserSession } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// POST /api/auth - Sign in with Farcaster via Neynar
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { signer_uuid, fid, username, display_name, pfp_url } = body;

    if (!fid) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create/update user in database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.fid, fid),
    });

    if (!existingUser) {
      await db.insert(users).values({
        fid,
        username,
        displayName: display_name,
        pfpUrl: pfp_url,
        ingestStatus: "pending",
      });

      // Queue ingestion job for new user
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await qstash.publishJSON({
        url: `${appUrl}/api/jobs/ingest`,
        body: { fid },
      });
    } else {
      // Update profile info
      await db
        .update(users)
        .set({
          username,
          displayName: display_name,
          pfpUrl: pfp_url,
          updatedAt: new Date(),
        })
        .where(eq(users.fid, fid));
    }

    // Create JWT
    const session: UserSession = {
      fid,
      username: username || "",
      displayName: display_name || username || "",
      pfpUrl: pfp_url || "",
    };

    const token = await createToken(session);

    // Set cookie
    const response = NextResponse.json({ success: true, user: session });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth - Sign out
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  return response;
}
