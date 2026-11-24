import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { getVideoGenerationById } from "@/lib/db/repository";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const { id: videoId } = await context.params;

    const video = getVideoGenerationById(wsId, videoId);
    if (!video) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    if (!fs.existsSync(video.videoAssetPath)) {
      return NextResponse.json(
        { error: "Video asset file missing on disk." },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(video.videoAssetPath);
    const isWebm = video.videoAssetPath.endsWith(".webm") || (video.mimeType && video.mimeType.includes("webm"));
    const contentType = isWebm ? "video/webm" : "video/mp4";
    const ext = isWebm ? "webm" : "mp4";
    const isDownload = req.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        ...(isDownload
          ? {
              "Content-Disposition": `attachment; filename="${video.platform}-reel-${video.id.slice(
                0,
                8
              )}.${ext}"`,
            }
          : {}),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to stream generated video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
