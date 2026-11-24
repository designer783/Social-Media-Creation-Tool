import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { detectTrendsAndRadarWithGemini } from "@/lib/ai/gemini-service";
import {
  createRadarSignals,
  getBrandById,
  getBrandKitById,
  listBrandKits,
  updateRadarSignalStatus,
} from "@/lib/db/repository";
import type { TrendSignal } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      brandId: string;
      competitorDomains?: string[];
      focusQuery?: string;
    };

    const brand = getBrandById(wsId, body.brandId);
    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found in this workspace." },
        { status: 404 }
      );
    }

    const kits = listBrandKits(wsId, brand.id);
    const brandKit =
      (brand.activeKitId ? getBrandKitById(wsId, brand.activeKitId) : null) ??
      kits[0];
    if (!brandKit) {
      return NextResponse.json(
        { error: "Brand does not have an extracted Brand Kit yet." },
        { status: 400 }
      );
    }

    const detected = await detectTrendsAndRadarWithGemini({
      brand,
      brandKit,
      competitorDomains: body.competitorDomains,
      focusQuery: body.focusQuery,
      geminiContext: { workspaceId: wsId, userId: session.user.id },
    });

    const signals = createRadarSignals(wsId, brand.id, detected);
    return NextResponse.json({ signals });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Radar trend detection failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      signalId: string;
      status: TrendSignal["status"];
    };

    if (!body.signalId || !body.status) {
      return NextResponse.json(
        { error: "signalId and status are required." },
        { status: 400 }
      );
    }

    updateRadarSignalStatus(wsId, body.signalId, body.status);
    return NextResponse.json({ updated: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update signal status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
