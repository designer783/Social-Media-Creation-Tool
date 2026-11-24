import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { probeGeminiConnection } from "@/lib/ai/gemini-service";
import {
  deleteGeminiConnection,
  listGeminiConnections,
  resolveActiveGeminiCredentials,
  updateGeminiConnectionModelsAndCapabilities,
  upsertGeminiConnection,
} from "@/lib/db/repository";
import type { GeminiConnectionMode, GeminiConnectionScope } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;

    const body = (await req.json()) as {
      action: "connect" | "probe";
      connectionId?: string;
      scope?: GeminiConnectionScope;
      label?: string;
      connectionMode?: GeminiConnectionMode;
      endpointBaseUrl?: string;
      textModel?: string;
      imageModel?: string;
      apiKey?: string;
    };

    if (body.action === "probe") {
      const creds = resolveActiveGeminiCredentials(wsId, userId);
      const targetKey = body.apiKey?.trim() || creds.apiKey;
      const targetUrl = body.endpointBaseUrl?.trim() || creds.endpointBaseUrl;

      if (!targetKey) {
        return NextResponse.json(
          { error: "No active Gemini API key found to probe." },
          { status: 400 }
        );
      }

      const probe = await probeGeminiConnection({
        apiKey: targetKey,
        endpointBaseUrl: targetUrl,
      });

      if (body.connectionId && probe.ok) {
        const updated = updateGeminiConnectionModelsAndCapabilities({
          connectionId: body.connectionId,
          userId,
          workspaceId: wsId,
          capabilities: probe.capabilities,
        });
        return NextResponse.json({ probe, connection: updated });
      }

      return NextResponse.json({ probe });
    }

    if (!body.apiKey || body.apiKey.trim().length < 12) {
      return NextResponse.json(
        { error: "Provide a valid Gemini API key (at least 12 characters)." },
        { status: 400 }
      );
    }

    const probe = await probeGeminiConnection({
      apiKey: body.apiKey.trim(),
      endpointBaseUrl: body.endpointBaseUrl,
    });

    const connection = upsertGeminiConnection({
      workspaceId: wsId,
      userId,
      scope: body.scope ?? "user",
      label:
        body.label?.trim() ||
        (body.scope === "workspace"
          ? `${session.activeWorkspace.name} Shared Key`
          : `${session.user.name} Personal Key`),
      connectionMode: body.connectionMode ?? "google_ai_studio",
      endpointBaseUrl: body.endpointBaseUrl,
      textModel: body.textModel,
      imageModel: body.imageModel,
      apiKey: body.apiKey.trim(),
      capabilities: probe.ok ? probe.capabilities : undefined,
    });

    return NextResponse.json({
      connection,
      probe,
      connections: listGeminiConnections(wsId, userId),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to configure Gemini connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const body = (await req.json()) as {
      connectionId: string;
      textModel?: string;
      imageModel?: string;
      isActive?: boolean;
    };

    const updated = updateGeminiConnectionModelsAndCapabilities({
      connectionId: body.connectionId,
      userId: session.user.id,
      workspaceId: session.activeWorkspace.id,
      textModel: body.textModel,
      imageModel: body.imageModel,
      isActive: body.isActive,
    });

    return NextResponse.json({ connection: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update Gemini connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const connectionId = req.nextUrl.searchParams.get("connectionId");
    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required." },
        { status: 400 }
      );
    }

    deleteGeminiConnection(
      connectionId,
      session.user.id,
      session.activeWorkspace.id
    );
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to remove Gemini connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
