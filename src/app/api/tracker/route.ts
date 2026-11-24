import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { analyzeTrackerPerformanceWithGemini } from "@/lib/ai/gemini-service";
import {
  deleteSocialTracker,
  listBrands,
  listSocialTrackers,
  upsertSocialTracker,
} from "@/lib/db/repository";
import type { SocialPostTracker } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      action: "upsert" | "analyze";
      creativeId?: string;
      brandId?: string;
      trackingStatus?: SocialPostTracker["trackingStatus"];
      scheduledFor?: string;
      publishedUrl?: string;
      utmTag?: string;
      impressions?: number;
      clicks?: number;
      engagements?: number;
      notes?: string;
    };

    if (body.action === "analyze") {
      const trackers = listSocialTrackers(wsId);
      const brands = listBrands(wsId);
      const targetBrand =
        (body.brandId ? brands.find((b) => b.id === body.brandId) : null) ??
        brands[0];

      const insight = await analyzeTrackerPerformanceWithGemini({
        brandName: targetBrand?.name ?? session.activeWorkspace.name,
        trackers: body.brandId
          ? trackers.filter((t) => t.brandId === body.brandId)
          : trackers,
        geminiContext: { workspaceId: wsId, userId: session.user.id },
      });

      return NextResponse.json({ insight });
    }

    if (!body.creativeId) {
      return NextResponse.json(
        { error: "creativeId is required to track a social post." },
        { status: 400 }
      );
    }

    const tracker = upsertSocialTracker(wsId, {
      creativeId: body.creativeId,
      trackingStatus: body.trackingStatus,
      scheduledFor: body.scheduledFor,
      publishedUrl: body.publishedUrl,
      utmTag: body.utmTag,
      impressions: body.impressions,
      clicks: body.clicks,
      engagements: body.engagements,
      notes: body.notes,
    });

    return NextResponse.json({ tracker });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Social tracker operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const trackerId = req.nextUrl.searchParams.get("trackerId");
    if (!trackerId) {
      return NextResponse.json(
        { error: "trackerId is required." },
        { status: 400 }
      );
    }
    deleteSocialTracker(session.activeWorkspace.id, trackerId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to remove tracker record.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
