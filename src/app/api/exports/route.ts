import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { getExportJobById } from "@/lib/db/repository";
import { exportApprovedCampaignZip } from "@/lib/exporter/campaign-zip";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      campaignId: string;
      format?: "png" | "webp" | "both";
    };

    if (!body.campaignId) {
      return NextResponse.json({ error: "Campaign ID is required." }, { status: 400 });
    }

    const { exportJob } = await exportApprovedCampaignZip({
      workspaceId: wsId,
      campaignId: body.campaignId,
      format: body.format ?? "both",
    });

    return NextResponse.json({ exportJob });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to package approved campaign export.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const exportId = req.nextUrl.searchParams.get("exportId");

    if (!exportId) {
      return NextResponse.json({ error: "exportId parameter is required." }, { status: 400 });
    }

    const job = getExportJobById(wsId, exportId);
    if (!job || !fs.existsSync(job.zipAssetPath)) {
      return NextResponse.json({ error: "Export ZIP archive not found." }, { status: 404 });
    }

    const zipBuffer = fs.readFileSync(job.zipAssetPath);
    const fileName = `${slugify(job.brandName)}-${slugify(job.campaignName)}-approved-creatives.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to download ZIP archive.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
