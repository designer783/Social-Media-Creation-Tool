import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  deleteCreatives,
  restoreCreativeVersion,
  setCreativeApprovalStatus,
} from "@/lib/db/repository";
import { editOrRegenerateCreative } from "@/lib/services/creative-service";
import type { ApprovalStatus, LayoutOverrides, TextOverrides } from "@/types/domain";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const { id: creativeId } = await context.params;

    const body = (await req.json()) as {
      action?: "edit" | "regenerate_bg" | "restore_version" | "set_approval";
      versionId?: string;
      approvalStatus?: ApprovalStatus;
      note?: string;
      customBackgroundDataUrl?: string;
      customBackgroundPrompt?: string;
      layoutOverrides?: Partial<LayoutOverrides>;
      textOverrides?: Partial<TextOverrides>;
    };

    if (body.action === "restore_version" && body.versionId) {
      const restored = restoreCreativeVersion(wsId, creativeId, body.versionId);
      return NextResponse.json({ creative: restored });
    }

    if (body.action === "set_approval" && body.approvalStatus) {
      const [updated] = setCreativeApprovalStatus(
        wsId,
        [creativeId],
        body.approvalStatus,
        session.user.name,
        body.note ?? ""
      );
      return NextResponse.json({ creative: updated });
    }

    let customBackgroundBuffer: Buffer | undefined;
    if (body.customBackgroundDataUrl?.startsWith("data:image/")) {
      const base64 = body.customBackgroundDataUrl.split(",")[1];
      if (base64) {
        customBackgroundBuffer = Buffer.from(base64, "base64");
      }
    }

    const updated = await editOrRegenerateCreative({
      workspaceId: wsId,
      userId: session.user.id,
      creativeId,
      regenerateBackground: body.action === "regenerate_bg",
      customBackgroundBuffer,
      customBackgroundPrompt: body.customBackgroundPrompt,
      layoutOverrides: body.layoutOverrides,
      textOverrides: body.textOverrides,
    });

    return NextResponse.json({ creative: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update creative variation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const { id: creativeId } = await context.params;
    const deletedCount = deleteCreatives(wsId, [creativeId]);
    return NextResponse.json({ deletedCount });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete social post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
