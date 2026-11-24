import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { getCreativeById } from "@/lib/db/repository";
import { slugify } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const { id: creativeId } = await context.params;

    const creative = getCreativeById(wsId, creativeId);
    if (!creative) {
      return NextResponse.json({ error: "Creative not found." }, { status: 404 });
    }

    const requestedVersionId = req.nextUrl.searchParams.get("versionId");
    const layer = req.nextUrl.searchParams.get("layer") === "background" ? "background" : "rendered";
    const format = req.nextUrl.searchParams.get("format") === "webp" ? "webp" : "png";
    const isDownload = req.nextUrl.searchParams.get("download") === "1";

    const targetVersion =
      (requestedVersionId
        ? creative.versions?.find((v) => v.id === requestedVersionId)
        : creative.currentVersion) ?? creative.currentVersion;

    if (!targetVersion) {
      return NextResponse.json({ error: "Creative version not found." }, { status: 404 });
    }

    const renderedFilePath =
      format === "webp" ? targetVersion.renderedWebpPath : targetVersion.renderedPngPath;
    const filePath =
      layer === "background" &&
      targetVersion.backgroundAssetPath &&
      fs.existsSync(targetVersion.backgroundAssetPath)
        ? targetVersion.backgroundAssetPath
        : renderedFilePath;

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Rendered image file missing." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = `${ creative.platform }-${slugify(creative.formatName)}-${creative.width}x${creative.height}-var${creative.variationIndex}-v${targetVersion.versionNumber}.${format}`;
    const resolvedContentType =
      layer === "background"
        ? filePath.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : filePath.toLowerCase().endsWith(".jpg") || filePath.toLowerCase().endsWith(".jpeg")
            ? "image/jpeg"
            : "image/png"
        : format === "webp"
          ? "image/webp"
          : "image/png";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": resolvedContentType,
        "Cache-Control": "no-store",
        ...(isDownload
          ? { "Content-Disposition": `attachment; filename="${fileName}"` }
          : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stream creative image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
