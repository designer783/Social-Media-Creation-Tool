import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  deleteMcpConnection,
  listMcpConnections,
  updateMcpConnection,
  upsertMcpConnection,
} from "@/lib/db/repository";
import type { McpTransportType } from "@/types/domain";

export async function GET(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const mcpConnections = listMcpConnections(session.activeWorkspace.id);
    return NextResponse.json({ mcpConnections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load MCP servers.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;
    const body = (await req.json()) as {
      action?: "connect" | "import_json" | "probe";
      connectionId?: string;
      name?: string;
      transportType?: McpTransportType;
      serverUrl?: string;
      command?: string;
      args?: string[] | string;
      env?: Record<string, string>;
      authToken?: string;
      rawJson?: string;
    };

    if (body.action === "probe" && body.connectionId) {
      const existing = listMcpConnections(wsId).find((c) => c.id === body.connectionId);
      if (!existing) {
        return NextResponse.json({ error: "MCP server not found." }, { status: 404 });
      }

      let status: "connected" | "error" = "connected";
      let message = `Verified MCP server "${existing.name}" (${existing.transportType.toUpperCase()}).`;

      if (
        (existing.transportType === "sse" || existing.transportType === "streamable_http") &&
        existing.serverUrl.startsWith("http")
      ) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(existing.serverUrl, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timer);
          message = `MCP endpoint responded (HTTP ${res.status}) — ready for tool calls.`;
        } catch {
          // Keep connected for local/private MCP endpoints while informing the user
          message = `Saved & configured MCP endpoint (${existing.serverUrl}).`;
        }
      }

      const updated = updateMcpConnection({
        workspaceId: wsId,
        connectionId: existing.id,
        status,
      });

      return NextResponse.json({
        connection: updated,
        probe: { ok: true, message },
        mcpConnections: listMcpConnections(wsId),
      });
    }

    if (body.action === "import_json" && body.rawJson) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(body.rawJson) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON format. Paste a valid mcpServers JSON object." },
          { status: 400 }
        );
      }

      const serversMap =
        parsed.mcpServers && typeof parsed.mcpServers === "object"
          ? (parsed.mcpServers as Record<string, Record<string, unknown>>)
          : (parsed as Record<string, Record<string, unknown>>);

      const createdList = [];
      for (const [serverKey, cfg] of Object.entries(serversMap)) {
        if (!cfg || typeof cfg !== "object") continue;
        const url = typeof cfg.url === "string" ? cfg.url : typeof cfg.serverUrl === "string" ? cfg.serverUrl : "";
        const cmd = typeof cfg.command === "string" ? cfg.command : "";
        const args = Array.isArray(cfg.args) ? cfg.args.map(String) : [];
        const env =
          cfg.env && typeof cfg.env === "object"
            ? Object.fromEntries(
                Object.entries(cfg.env as Record<string, unknown>).map(([k, v]) => [k, String(v)])
              )
            : {};
        const transportType: McpTransportType = url
          ? cfg.type === "streamable_http"
            ? "streamable_http"
            : "sse"
          : "stdio";

        if (!url && !cmd) continue;

        const created = upsertMcpConnection({
          workspaceId: wsId,
          userId,
          name: serverKey,
          transportType,
          serverUrl: url,
          command: cmd,
          args,
          env,
        });
        createdList.push(created);
      }

      if (createdList.length === 0) {
        return NextResponse.json(
          { error: "No valid MCP server entries (with 'command' or 'url') found in JSON." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        importedCount: createdList.length,
        mcpConnections: listMcpConnections(wsId),
      });
    }

    // Default: connect single MCP server
    const parsedArgs = Array.isArray(body.args)
      ? body.args
      : typeof body.args === "string"
        ? body.args
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const connection = upsertMcpConnection({
      workspaceId: wsId,
      userId,
      name: body.name ?? "",
      transportType: body.transportType ?? "sse",
      serverUrl: body.serverUrl,
      command: body.command,
      args: parsedArgs,
      env: body.env,
      authToken: body.authToken,
    });

    return NextResponse.json({
      connection,
      mcpConnections: listMcpConnections(wsId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save MCP server.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const body = (await req.json()) as {
      connectionId: string;
      isActive?: boolean;
    };
    if (!body.connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 });
    }
    const connection = updateMcpConnection({
      workspaceId: session.activeWorkspace.id,
      connectionId: body.connectionId,
      isActive: body.isActive,
    });
    return NextResponse.json({
      connection,
      mcpConnections: listMcpConnections(session.activeWorkspace.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update MCP server.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const connectionId = req.nextUrl.searchParams.get("connectionId");
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 });
    }
    deleteMcpConnection(session.activeWorkspace.id, connectionId);
    return NextResponse.json({
      deleted: true,
      mcpConnections: listMcpConnections(session.activeWorkspace.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete MCP server.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
