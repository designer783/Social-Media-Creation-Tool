import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  deleteContentItems,
  deleteCreatives,
  setCreativeApprovalStatus,
} from "@/lib/db/repository";
import type { ApprovalStatus } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      action?: "status" | "delete_creatives" | "delete_content";
      creativeIds?: string[];
      contentIds?: string[];
      status?: ApprovalStatus;
      note?: string;
    };

    if (body.action === "delete_creatives") {
      if (!Array.isArray(body.creativeIds) || body.creativeIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one post to delete." },
          { status: 400 }
        );
      }
      const deletedCount = deleteCreatives(wsId, body.creativeIds);
      return NextResponse.json({ deletedCount });
    }

    if (body.action === "delete_content") {
      if (!Array.isArray(body.contentIds) || body.contentIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one description item to delete." },
          { status: 400 }
        );
      }
      const deletedCount = deleteContentItems(wsId, body.contentIds);
      return NextResponse.json({ deletedCount });
    }

    if (!Array.isArray(body.creativeIds) || body.creativeIds.length === 0 || !body.status) {
      return NextResponse.json(
        { error: "Select at least one creative variation." },
        { status: 400 }
      );
    }

    const updated = setCreativeApprovalStatus(
      wsId,
      body.creativeIds,
      body.status,
      session.user.name,
      body.note ?? ""
    );

    return NextResponse.json({ creatives: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
