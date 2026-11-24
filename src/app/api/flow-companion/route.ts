import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  getOrCreateFlowCreditSnapshot,
  updateFlowCreditSnapshot,
  getVideoProjectById,
  getOrCreateStoryboard,
  listReferenceEntities,
  createUnifiedAsset,
} from "@/lib/db/repository";
import { FlowCompanionPackage } from "@/types/domain";

export async function GET(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const sceneId = searchParams.get("sceneId");

    const creditSnapshot = getOrCreateFlowCreditSnapshot(session.activeWorkspace.id);

    // If requesting a specific prepared scene package for Google Flow
    let companionPackage: FlowCompanionPackage | null = null;
    if (projectId && sceneId) {
      const project = getVideoProjectById(session.activeWorkspace.id, projectId);
      const storyboard = getOrCreateStoryboard(session.activeWorkspace.id, projectId);
      const scene = storyboard.scenes.find((s) => s.id === sceneId);
      const references = listReferenceEntities(session.activeWorkspace.id, projectId);

      if (scene) {
        const assignedRefs = references.filter((r) =>
          scene.assignedReferenceIds?.includes(r.id)
        );

        const continuityNotes = assignedRefs.map(
          (r) => `${r.name}: ${r.continuityRules}`
        );

        const promptWithContinuity = [
          scene.videoPrompt || scene.visualDescription,
          assignedRefs.length > 0
            ? `VISUAL CONTINUITY: ${assignedRefs.map((r) => `${r.name} (${r.userApprovedDescription})`).join(", ")}`
            : "",
          `Camera: ${scene.cameraFraming}, ${scene.cameraMovement}. Lighting: ${scene.lighting}. Mood: ${scene.mood}.`,
        ]
          .filter(Boolean)
          .join(" | ");

        companionPackage = {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          durationSeconds: scene.durationSeconds,
          aspectRatio: project?.aspectRatio || "9:16",
          composedPrompt: promptWithContinuity,
          negativePrompt: scene.negativePrompt || "blurry, low quality, distorted text, flickering, morphing limbs",
          continuityNotes,
          attachedReferences: assignedRefs.map((r) => ({
            name: r.name,
            type: r.type,
            rules: r.continuityRules,
          })),
          flowUrl: "https://labs.google/fx/tools/flow",
        };
      }
    }

    return NextResponse.json({
      creditSnapshot,
      companionPackage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load Flow companion state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const body = await req.json();
    const { action } = body;

    // 1. Update manual credit planner snapshot (§6.3)
    if (action === "update_credits") {
      const updated = updateFlowCreditSnapshot(session.activeWorkspace.id, {
        planLabel: body.planLabel,
        monthlyAllocation: Number(body.monthlyAllocation),
        dailyAllocation: Number(body.dailyAllocation),
        billingResetDate: body.billingResetDate,
        userEnteredBalance: Number(body.userEnteredBalance),
        estimatedCostPerGeneration: Number(body.estimatedCostPerGeneration),
        notes: body.notes,
      });
      return NextResponse.json({ success: true, creditSnapshot: updated });
    }

    // 2. Import Google Flow generated asset (§6.2 step 7-9)
    if (action === "import_flow_asset") {
      const { projectId, sceneId, assetType, storagePath, prompt, mimeType, fileSizeBytes, durationSeconds } = body;

      const asset = createUnifiedAsset(session.activeWorkspace.id, {
        projectId: projectId || null,
        sceneId: sceneId || null,
        assetType: assetType || "video",
        provider: "google_flow",
        modelId: "google-flow-pro",
        prompt: prompt || "Imported from Google Flow companion session",
        storagePath: storagePath || "/storage/videos/flow-import.mp4",
        mimeType: mimeType || "video/mp4",
        fileSizeBytes: Number(fileSizeBytes) || 5000000,
        durationSeconds: Number(durationSeconds) || 4,
        approvalStatus: "approved",
        version: 1,
      });

      return NextResponse.json({ success: true, asset });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process Flow companion action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
