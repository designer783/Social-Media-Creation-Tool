import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { updateBrandKit } from "@/lib/db/repository";
import type { BrandColors, BrandTypography, BrandVisualStyle } from "@/types/domain";

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      kitId: string;
      name?: string;
      status?: "draft" | "approved" | "archived";
      colors?: BrandColors;
      typography?: BrandTypography;
      visualStyle?: BrandVisualStyle;
      createNewVersion?: boolean;
    };

    if (!body.kitId) {
      return NextResponse.json({ error: "Brand Kit ID is required." }, { status: 400 });
    }

    const updated = updateBrandKit(wsId, body.kitId, {
      name: body.name,
      status: body.status,
      colors: body.colors,
      typography: body.typography,
      visualStyle: body.visualStyle,
      createNewVersion: body.createNewVersion,
    });

    return NextResponse.json({ brandKit: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update Brand Kit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
