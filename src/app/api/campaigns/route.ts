import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { deleteCampaign } from "@/lib/db/repository";
import {
  generateFullCampaignCreatives,
  type LaunchCampaignInput,
} from "@/lib/services/creative-service";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as Omit<LaunchCampaignInput, "workspaceId">;
    if (!body.brandId || !body.campaignName?.trim() || !body.presetIds?.length) {
      return NextResponse.json(
        {
          error:
            "Select a brand, provide a campaign name, and select at least one social media platform format.",
        },
        { status: 400 }
      );
    }

    const result = await generateFullCampaignCreatives({
      ...body,
      workspaceId: wsId,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate campaign creatives.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const campaignId = req.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
    }
    deleteCampaign(wsId, campaignId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete campaign.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
