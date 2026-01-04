import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import {
  runIngestionPipeline,
  runIncrementalUpdate,
} from "@/lib/neynar/ingest";

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, incremental } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json({ error: "Invalid fid" }, { status: 400 });
    }

    console.log(`Starting ${incremental ? "incremental" : "full"} ingestion for FID ${fid}`);

    let result;
    if (incremental) {
      result = await runIncrementalUpdate(fid);
    } else {
      result = await runIngestionPipeline(fid);
    }

    console.log(`Ingestion complete for FID ${fid}:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Ingestion job error:", error);
    return NextResponse.json(
      { error: "Ingestion failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Verify QStash signature in production
export const POST = process.env.NODE_ENV === "production"
  ? verifySignatureAppRouter(handler)
  : handler;

// Allow longer execution for ingestion
export const maxDuration = 300; // 5 minutes
