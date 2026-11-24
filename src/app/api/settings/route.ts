import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  isGeminiApiConfigured,
  probeGeminiConnection,
} from "@/lib/ai/gemini-service";
import {
  updateAIProviderConfig,
  upsertGeminiConnection,
  upsertPlatformPreset,
} from "@/lib/db/repository";
import type { SocialPlatform } from "@/types/domain";

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;

    const body = (await req.json()) as
      | {
          target: "preset";
          id?: string;
          platform: SocialPlatform;
          formatName: string;
          width: number;
          height: number;
          safeMarginPx?: number;
          isActive?: boolean;
        }
      | {
          target: "ai_provider";
          configId: string;
          endpointUrl?: string;
          modelId?: string;
          isEnabled?: boolean;
          isPrimary?: boolean;
        }
      | {
          target: "gemini_api_key";
          apiKey: string;
          scope?: "user" | "workspace";
          label?: string;
        };

    if (body.target === "gemini_api_key") {
      const cleanedKey = body.apiKey?.trim() ?? "";
      if (cleanedKey.length < 12) {
        return NextResponse.json(
          { error: "Provide a valid Google Gemini API key." },
          { status: 400 }
        );
      }

      const probe = await probeGeminiConnection({ apiKey: cleanedKey });
      const connection = upsertGeminiConnection({
        workspaceId: wsId,
        userId,
        scope: body.scope ?? "user",
        label:
          body.label?.trim() ||
          (body.scope === "workspace"
            ? `${session.activeWorkspace.name} Workspace Key`
            : `${session.user.name} Personal Key`),
        apiKey: cleanedKey,
        capabilities: probe.ok ? probe.capabilities : undefined,
      });

      return NextResponse.json({
        connection,
        probe,
        geminiConfigured: isGeminiApiConfigured({ workspaceId: wsId, userId }),
      });
    }

    if (body.target === "preset") {
      const preset = upsertPlatformPreset(wsId, body);
      return NextResponse.json({ preset });
    }

    if (body.target === "ai_provider") {
      const provider = updateAIProviderConfig(wsId, body.configId, body);
      return NextResponse.json({ provider });
    }

    return NextResponse.json(
      { error: "Unsupported settings update target." },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
