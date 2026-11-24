import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  auditCreativeWithGeminiVision,
  runGeminiCopilotTurn,
} from "@/lib/ai/gemini-service";
import {
  getBrandById,
  getBrandKitById,
  getCreativeById,
  listSocialTrackers,
  saveCreativeAudit,
} from "@/lib/db/repository";
import { editOrRegenerateCreative } from "@/lib/services/creative-service";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      action: "audit" | "chat";
      creativeId: string;
      instruction?: string;
      applyChanges?: boolean;
    };

    const creative = getCreativeById(wsId, body.creativeId);
    if (!creative || !creative.currentVersion) {
      return NextResponse.json(
        { error: "Creative post not found in this workspace." },
        { status: 404 }
      );
    }

    const brand = getBrandById(wsId, creative.brandId);
    const brandKit = getBrandKitById(wsId, creative.brandKitId);
    if (!brand || !brandKit) {
      return NextResponse.json(
        { error: "Associated Brand or Brand Kit not found." },
        { status: 404 }
      );
    }

    const renderedPngBuffer = fs.existsSync(
      creative.currentVersion.renderedPngPath
    )
      ? fs.readFileSync(creative.currentVersion.renderedPngPath)
      : undefined;

    if (body.action === "audit") {
      if (!renderedPngBuffer) {
        return NextResponse.json(
          { error: "Rendered graphic file is missing." },
          { status: 404 }
        );
      }

      const auditResult = await auditCreativeWithGeminiVision({
        creative,
        brand,
        brandKit,
        renderedPngBuffer,
        geminiContext: { workspaceId: wsId, userId: session.user.id },
      });

      const savedAudit = saveCreativeAudit(wsId, {
        creativeId: creative.id,
        versionId: creative.currentVersionId,
        ...auditResult,
      });

      return NextResponse.json({ audit: savedAudit });
    }

    if (!body.instruction?.trim()) {
      return NextResponse.json(
        { error: "Provide an instruction for the Gemini Creative Co-Pilot." },
        { status: 400 }
      );
    }

    const trackers = listSocialTrackers(wsId).filter(
      (t) => t.brandId === brand.id && t.impressions > 0
    );
    const perfSummary =
      trackers.length > 0
        ? `Top tracked posts average ${Math.round(
            trackers.reduce((a, b) => a + b.engagements, 0) / trackers.length
          )} engagements.`
        : undefined;

    const copilotResult = await runGeminiCopilotTurn({
      instruction: body.instruction.trim(),
      brand,
      brandKit,
      creative,
      renderedPngBuffer,
      trackedPerformanceSummary: perfSummary,
      geminiContext: { workspaceId: wsId, userId: session.user.id },
    });

    let updatedCreative = creative;
    if (body.applyChanges !== false) {
      const hasTextUpdates = Boolean(
        copilotResult.textUpdates &&
          Object.values(copilotResult.textUpdates).some((v) => v !== undefined)
      );
      const hasLayoutUpdates = Boolean(
        copilotResult.layoutUpdates &&
          Object.values(copilotResult.layoutUpdates).some((v) => v !== undefined)
      );
      const hasVisualEdit = Boolean(copilotResult.visualEditInstruction);

      if (hasTextUpdates || hasLayoutUpdates || hasVisualEdit) {
        updatedCreative = await editOrRegenerateCreative({
          workspaceId: wsId,
          userId: session.user.id,
          creativeId: creative.id,
          visualEditInstruction: copilotResult.visualEditInstruction,
          layoutOverrides: copilotResult.layoutUpdates,
          textOverrides: copilotResult.textUpdates,
        });
      }
    }

    return NextResponse.json({
      copilot: copilotResult,
      creative: updatedCreative,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gemini Co-Pilot request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
