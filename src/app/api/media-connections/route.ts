import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { probeMediaApiConnection } from "@/lib/ai/universal-media-provider";
import {
  deleteMediaApiConnection,
  listMediaApiConnections,
  resolveActiveMediaCredentials,
  updateMediaApiConnection,
  upsertMediaApiConnection,
} from "@/lib/db/repository";
import type {
  GeminiConnectionScope,
  MediaApiCapability,
  MediaProviderPreset,
} from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;

    const body = (await req.json()) as {
      action: "connect" | "probe";
      connectionId?: string;
      scope?: GeminiConnectionScope;
      capability?: MediaApiCapability;
      providerPreset?: MediaProviderPreset;
      label?: string;
      endpointUrl?: string;
      modelId?: string;
      accountId?: string;
      authHeaderName?: string;
      authPrefix?: string;
      apiKey?: string;
    };

    if (body.action === "probe") {
      if (body.connectionId) {
        const creds = resolveActiveMediaCredentials(
          wsId,
          userId,
          "image",
          body.connectionId
        );
        if (!creds) {
          return NextResponse.json(
            { error: "Media API connection not found or unreadable." },
            { status: 404 }
          );
        }
        const probe = await probeMediaApiConnection({
          providerPreset: creds.providerPreset,
          endpointUrl: creds.endpointUrl,
          modelId: creds.modelId,
          accountId: creds.accountId,
          authHeaderName: creds.authHeaderName,
          authPrefix: creds.authPrefix,
          apiKey: creds.apiKey,
        });
        return NextResponse.json({ probe });
      }

      if (!body.apiKey || !body.endpointUrl || !body.modelId || !body.providerPreset) {
        return NextResponse.json(
          { error: "Missing connection parameters to probe." },
          { status: 400 }
        );
      }

      const probe = await probeMediaApiConnection({
        providerPreset: body.providerPreset,
        endpointUrl: body.endpointUrl,
        modelId: body.modelId,
        accountId: body.accountId,
        authHeaderName: body.authHeaderName,
        authPrefix: body.authPrefix,
        apiKey: body.apiKey,
      });
      return NextResponse.json({ probe });
    }

    if (!body.apiKey || body.apiKey.trim().length < 8) {
      return NextResponse.json(
        { error: "Provide a valid API key (at least 8 characters)." },
        { status: 400 }
      );
    }
    if (!body.endpointUrl?.trim() || !body.modelId?.trim() || !body.providerPreset) {
      return NextResponse.json(
        { error: "Provider preset, endpoint URL, and model ID are required." },
        { status: 400 }
      );
    }

    const probe = await probeMediaApiConnection({
      providerPreset: body.providerPreset,
      endpointUrl: body.endpointUrl.trim(),
      modelId: body.modelId.trim(),
      accountId: body.accountId,
      authHeaderName: body.authHeaderName,
      authPrefix: body.authPrefix,
      apiKey: body.apiKey.trim(),
    });

    if (!probe.ok && probe.message.includes("Blocked URL")) {
      return NextResponse.json({ error: probe.message }, { status: 400 });
    }

    const connection = upsertMediaApiConnection({
      workspaceId: wsId,
      userId,
      scope: body.scope ?? "user",
      capability: body.capability ?? "both",
      providerPreset: body.providerPreset,
      label:
        body.label?.trim() ||
        `${body.providerPreset} (${body.capability ?? "both"})`,
      endpointUrl: body.endpointUrl.trim(),
      modelId: body.modelId.trim(),
      accountId: body.accountId,
      authHeaderName: body.authHeaderName,
      authPrefix: body.authPrefix,
      apiKey: body.apiKey.trim(),
    });

    return NextResponse.json({
      connection,
      probe,
      mediaConnections: listMediaApiConnections(wsId, userId),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to configure media API connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const body = (await req.json()) as {
      connectionId: string;
      label?: string;
      endpointUrl?: string;
      modelId?: string;
      capability?: MediaApiCapability;
      accountId?: string;
      authHeaderName?: string;
      authPrefix?: string;
      isActive?: boolean;
    };

    const connection = updateMediaApiConnection({
      connectionId: body.connectionId,
      userId: session.user.id,
      workspaceId: session.activeWorkspace.id,
      label: body.label,
      endpointUrl: body.endpointUrl,
      modelId: body.modelId,
      capability: body.capability,
      accountId: body.accountId,
      authHeaderName: body.authHeaderName,
      authPrefix: body.authPrefix,
      isActive: body.isActive,
    });

    return NextResponse.json({ connection });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update media API connection.";
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

    deleteMediaApiConnection(
      connectionId,
      session.user.id,
      session.activeWorkspace.id
    );
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to remove media API connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
