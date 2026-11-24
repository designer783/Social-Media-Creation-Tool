"use client";

import * as React from "react";
import { Activity, Film, KeyRound, Plus, RefreshCw, Save, Trash2, Server, ShieldCheck, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MEDIA_PROVIDER_DEFAULTS } from "@/lib/ai/media-provider-presets";
import type {
  GeminiConnectionMode,
  GeminiConnectionScope,
  McpTransportType,
  MediaApiCapability,
  MediaProviderPreset,
  SocialPlatform,
} from "@/types/domain";
import type { WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface SettingsViewProps {
  snapshot: WorkspaceSnapshot;
  onDeleteWorkspace?: (workspaceId: string) => Promise<void>;
  onAuthenticate?: (input: {
    email: string;
    name: string;
    password: string;
    workspaceName: string;
  }) => Promise<void>;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function SettingsView({
  snapshot,
  onDeleteWorkspace,
  onAuthenticate,
  apiRequest,
  announce,
}: SettingsViewProps) {
  const [wsName, setWsName] = React.useState(snapshot.activeWorkspace.name);
  const [defaultFormat, setDefaultFormat] = React.useState<"png" | "webp" | "both">(
    snapshot.activeWorkspace.settings.defaultExportFormat
  );

  // New Configurable Platform Preset State
  const [newPlatform, setNewPlatform] = React.useState<SocialPlatform>("instagram");
  const [newFormatName, setNewFormatName] = React.useState("");
  const [newWidth, setNewWidth] = React.useState("1080");
  const [newHeight, setNewHeight] = React.useState("1920");

  // Multi-User Gemini Connection Vault State
  const [connScope, setConnScope] = React.useState<GeminiConnectionScope>("user");
  const [connMode, setConnMode] =
    React.useState<GeminiConnectionMode>("google_ai_studio");
  const [connEndpointUrl, setConnEndpointUrl] = React.useState("");
  const [connLabel, setConnLabel] = React.useState("");
  const [connTextModel, setConnTextModel] = React.useState("gemini-flash-latest");
  const [connImageModel, setConnImageModel] = React.useState("auto");
  const [geminiApiKey, setGeminiApiKey] = React.useState("");
  const [geminiNotice, setGeminiNotice] = React.useState<string | null>(null);
  const [geminiError, setGeminiError] = React.useState<string | null>(null);
  const [isConnectingGemini, setIsConnectingGemini] = React.useState(false);

  // Universal Image & Video API Vault State
  const [mediaCapability, setMediaCapability] =
    React.useState<MediaApiCapability>("both");
  const [mediaPreset, setMediaPreset] =
    React.useState<MediaProviderPreset>("openai_compatible");
  const [mediaScope, setMediaScope] =
    React.useState<GeminiConnectionScope>("user");
  const [mediaLabel, setMediaLabel] = React.useState("");
  const [mediaEndpointUrl, setMediaEndpointUrl] = React.useState(
    MEDIA_PROVIDER_DEFAULTS.openai_compatible.defaultEndpointUrl
  );
  const [mediaModelId, setMediaModelId] = React.useState(
    MEDIA_PROVIDER_DEFAULTS.openai_compatible.defaultImageModel
  );
  const [mediaAccountId, setMediaAccountId] = React.useState("");
  const [mediaAuthHeader, setMediaAuthHeader] = React.useState(
    MEDIA_PROVIDER_DEFAULTS.openai_compatible.defaultAuthHeader
  );
  const [mediaAuthPrefix, setMediaAuthPrefix] = React.useState(
    MEDIA_PROVIDER_DEFAULTS.openai_compatible.defaultAuthPrefix
  );
  const [mediaApiKey, setMediaApiKey] = React.useState("");
  const [mediaNotice, setMediaNotice] = React.useState<string | null>(null);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [isConnectingMedia, setIsConnectingMedia] = React.useState(false);
  const [mediaModelDrafts, setMediaModelDrafts] = React.useState<
    Record<string, string>
  >({});

  // Model Context Protocol (MCP) Servers State
  const [mcpMode, setMcpMode] = React.useState<"form" | "json">("form");
  const [mcpName, setMcpName] = React.useState("");
  const [mcpTransport, setMcpTransport] = React.useState<McpTransportType>("sse");
  const [mcpUrl, setMcpUrl] = React.useState("");
  const [mcpCommand, setMcpCommand] = React.useState("npx");
  const [mcpArgs, setMcpArgs] = React.useState("-y @modelcontextprotocol/server-filesystem");
  const [mcpToken, setMcpToken] = React.useState("");
  const [mcpJsonRaw, setMcpJsonRaw] = React.useState("");
  const [mcpNotice, setMcpNotice] = React.useState<string | null>(null);
  const [mcpError, setMcpError] = React.useState<string | null>(null);
  const [isSavingMcp, setIsSavingMcp] = React.useState(false);

  const handleSaveMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMcpError(null);
    setMcpNotice(null);
    setIsSavingMcp(true);
    try {
      if (mcpMode === "json") {
        const res = await apiRequest<{ importedCount: number }>("/api/mcp", {
          method: "POST",
          taskLabel: "Importing MCP server configuration from JSON...",
          body: JSON.stringify({
            action: "import_json",
            rawJson: mcpJsonRaw.trim(),
          }),
        });
        setMcpJsonRaw("");
        const msg = `Imported ${res.importedCount} MCP server(s) into workspace.`;
        setMcpNotice(msg);
        announce(msg);
      } else {
        await apiRequest("/api/mcp", {
          method: "POST",
          taskLabel: `Connecting MCP server ${mcpName.trim()}...`,
          body: JSON.stringify({
            action: "connect",
            name: mcpName.trim(),
            transportType: mcpTransport,
            serverUrl: mcpUrl.trim(),
            command: mcpCommand.trim(),
            args: mcpArgs.trim(),
            authToken: mcpToken.trim() || undefined,
          }),
        });
        setMcpName("");
        setMcpUrl("");
        setMcpToken("");
        const msg = `Connected MCP server "${mcpName.trim()}" (${mcpTransport.toUpperCase()}).`;
        setMcpNotice(msg);
        announce(msg);
      }
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Failed to add MCP server.");
    } finally {
      setIsSavingMcp(false);
    }
  };

  const handleProbeMcp = async (connectionId: string, name: string) => {
    setMcpError(null);
    setMcpNotice(null);
    try {
      const res = await apiRequest<{ probe: { ok: boolean; message: string } }>("/api/mcp", {
        method: "POST",
        taskLabel: `Testing MCP server ${name}...`,
        body: JSON.stringify({ action: "probe", connectionId }),
      });
      setMcpNotice(res.probe.message);
      announce(res.probe.message);
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "MCP probe failed.");
    }
  };

  const handleToggleMcp = async (connectionId: string, isActive: boolean) => {
    setMcpError(null);
    await apiRequest("/api/mcp", {
      method: "PATCH",
      taskLabel: "Updating MCP server status...",
      body: JSON.stringify({ connectionId, isActive }),
    });
    announce(`MCP server ${isActive ? "activated" : "paused"}.`);
  };

  const handleDeleteMcp = async (connectionId: string, name: string) => {
    setMcpError(null);
    setMcpNotice(null);
    await apiRequest(`/api/mcp?connectionId=${encodeURIComponent(connectionId)}`, {
      method: "DELETE",
      taskLabel: `Removing MCP server ${name}...`,
    });
    announce(`Removed MCP server ${name}.`);
  };

  const applyMediaPresetDefaults = (
    preset: MediaProviderPreset,
    capability: MediaApiCapability
  ) => {
    const meta = MEDIA_PROVIDER_DEFAULTS[preset];
    setMediaEndpointUrl(meta.defaultEndpointUrl);
    setMediaModelId(
      capability === "video" ? meta.defaultVideoModel : meta.defaultImageModel
    );
    setMediaAuthHeader(meta.defaultAuthHeader);
    setMediaAuthPrefix(meta.defaultAuthPrefix);
  };

  const handleSaveMediaKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaApiKey.trim().length < 8) return;
    setMediaError(null);
    setMediaNotice(null);
    setIsConnectingMedia(true);
    try {
      const res = await apiRequest<{
        probe?: { ok: boolean; message: string };
      }>("/api/media-connections", {
        method: "POST",
        taskLabel: "Verifying & encrypting universal AI media API key...",
        body: JSON.stringify({
          action: "connect",
          scope: mediaScope,
          capability: mediaCapability,
          providerPreset: mediaPreset,
          label: mediaLabel.trim() || undefined,
          endpointUrl: mediaEndpointUrl.trim(),
          modelId: mediaModelId.trim(),
          accountId: mediaAccountId.trim(),
          authHeaderName: mediaAuthHeader.trim() || "Authorization",
          authPrefix: mediaAuthPrefix,
          apiKey: mediaApiKey.trim(),
        }),
      });
      setMediaApiKey("");
      setMediaLabel("");
      const msg = res.probe?.message || "Media API key encrypted and saved.";
      if (res.probe?.ok === false) {
        setMediaError(msg);
      } else {
        setMediaNotice(msg);
      }
      announce(msg);
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : "Failed to save media API key."
      );
    } finally {
      setIsConnectingMedia(false);
    }
  };

  const handleUpdateMediaConn = async (
    connectionId: string,
    updates: { modelId?: string; isActive?: boolean }
  ) => {
    setMediaError(null);
    await apiRequest("/api/media-connections", {
      method: "PATCH",
      taskLabel: "Updating media API connection...",
      body: JSON.stringify({ connectionId, ...updates }),
    });
    announce("Updated universal media API connection.");
  };

  const handleProbeMediaConn = async (connectionId: string, label: string) => {
    setMediaError(null);
    setMediaNotice(null);
    try {
      const res = await apiRequest<{
        probe: { ok: boolean; message: string };
      }>("/api/media-connections", {
        method: "POST",
        taskLabel: `Testing ${label}...`,
        body: JSON.stringify({ action: "probe", connectionId }),
      });
      if (res.probe.ok) {
        setMediaNotice(res.probe.message);
      } else {
        setMediaError(res.probe.message);
      }
      announce(res.probe.message);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Probe failed.");
    }
  };

  const handleDeleteMediaConn = async (connectionId: string, label: string) => {
    setMediaError(null);
    setMediaNotice(null);
    await apiRequest(
      `/api/media-connections?connectionId=${encodeURIComponent(connectionId)}`,
      {
        method: "DELETE",
        taskLabel: `Removing ${label}...`,
      }
    );
    announce(`Removed media API connection ${label}.`);
  };

  const handleSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiApiKey.trim().length < 12) return;
    setGeminiError(null);
    setGeminiNotice(null);
    setIsConnectingGemini(true);
    try {
      const res = await apiRequest<{
        probe?: {
          ok: boolean;
          error?: string;
          warning?: string;
          capabilities?: { discoveredModels?: string[]; imageGeneration?: boolean };
        };
      }>("/api/gemini", {
        method: "POST",
        taskLabel: "Verifying & encrypting Google Gemini API connection...",
        body: JSON.stringify({
          action: "connect",
          scope: connScope,
          label: connLabel.trim() || undefined,
          connectionMode: connMode,
          endpointBaseUrl:
            connMode === "custom_endpoint" ? connEndpointUrl.trim() : undefined,
          textModel: connTextModel,
          imageModel: connImageModel,
          apiKey: geminiApiKey.trim(),
        }),
      });
      setGeminiApiKey("");
      setConnLabel("");
      const count = res.probe?.capabilities?.discoveredModels?.length ?? 0;
      const probeSummary = res.probe?.ok
        ? `Connected & verified (${count} Gemini models discovered).`
        : `Saved to vault (probe notice: ${res.probe?.error ?? "verification deferred"}).`;
      setGeminiNotice(probeSummary);
      if (res.probe?.warning) {
        setGeminiError(res.probe.warning);
      }
      announce(probeSummary);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect Gemini API.";
      setGeminiError(msg);
    } finally {
      setIsConnectingGemini(false);
    }
  };

  const handleUpdateConnection = async (
    connectionId: string,
    updates: { textModel?: string; imageModel?: string; isActive?: boolean }
  ) => {
    setGeminiError(null);
    await apiRequest("/api/gemini", {
      method: "PATCH",
      taskLabel: "Updating Gemini connection models...",
      body: JSON.stringify({
        connectionId,
        ...updates,
      }),
    });
    announce("Updated Gemini connection configuration.");
  };

  const handleProbeConnection = async (connectionId: string, label: string) => {
    setGeminiError(null);
    setGeminiNotice(null);
    try {
      const res = await apiRequest<{
        probe: {
          ok: boolean;
          error?: string;
          warning?: string;
          capabilities?: { discoveredModels?: string[]; imageGeneration?: boolean };
        };
      }>("/api/gemini", {
        method: "POST",
        taskLabel: `Probing Gemini capabilities for ${label}...`,
        body: JSON.stringify({
          action: "probe",
          connectionId,
        }),
      });
      if (res.probe.ok) {
        const count = res.probe.capabilities?.discoveredModels?.length ?? 0;
        const msg = `${label} live probe succeeded (${count} models cataloged).`;
        setGeminiNotice(msg);
        if (res.probe.warning) {
          setGeminiError(res.probe.warning);
        }
        announce(msg);
      } else {
        setGeminiError(res.probe.error || "Gemini probe returned an error.");
      }
    } catch (err) {
      setGeminiError(
        err instanceof Error ? err.message : "Gemini capability probe failed."
      );
    }
  };

  const handleDeleteConnection = async (connectionId: string, label: string) => {
    setGeminiError(null);
    setGeminiNotice(null);
    await apiRequest(`/api/gemini?connectionId=${encodeURIComponent(connectionId)}`, {
      method: "DELETE",
      taskLabel: `Removing ${label}...`,
    });
    announce(`Removed Gemini connection ${label}.`);
  };

  React.useEffect(() => {
    setWsName(snapshot.activeWorkspace.name);
    setDefaultFormat(snapshot.activeWorkspace.settings.defaultExportFormat);
  }, [snapshot.activeWorkspace]);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest("/api/workspaces", {
      method: "POST",
      taskLabel: "Saving workspace configuration...",
      body: JSON.stringify({
        action: "update_workspace",
        name: wsName,
        settings: {
          defaultExportFormat: defaultFormat,
          requireApprovalBeforeExport: true,
        },
      }),
    });
    announce("Updated workspace settings.");
  };

  const handleAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormatName.trim()) return;
    await apiRequest("/api/settings", {
      method: "PATCH",
      taskLabel: "Adding configurable platform format preset...",
      body: JSON.stringify({
        target: "preset",
        platform: newPlatform,
        formatName: newFormatName.trim(),
        width: parseInt(newWidth, 10) || 1080,
        height: parseInt(newHeight, 10) || 1080,
        safeMarginPx: 72,
        isActive: true,
      }),
    });
    setNewFormatName("");
    announce(`Added ${newPlatform} ${newFormatName} format preset.`);
  };

  const handleSetPrimaryProvider = async (configId: string, displayName: string) => {
    await apiRequest("/api/settings", {
      method: "PATCH",
      taskLabel: `Setting ${displayName} as primary AI provider...`,
      body: JSON.stringify({
        target: "ai_provider",
        configId,
        isEnabled: true,
        isPrimary: true,
      }),
    });
    announce(`${displayName} is now the primary provider.`);
  };

  const handleClearWorkspace = async () => {
    if (!window.confirm("Are you sure you want to reset all brands, campaigns, and creatives in this workspace?")) {
      return;
    }
    await apiRequest("/api/workspaces", {
      method: "POST",
      taskLabel: "Clearing all brands and campaigns in this workspace...",
      body: JSON.stringify({
        action: "clear_workspace",
      }),
    });
    announce("Cleared all brands and campaigns from this workspace.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Workspace, Platform Presets & AI Provider Settings
          </h1>
          <p className="text-sm text-text-secondary">
            Manage isolated workspace preferences, customize platform export dimensions, and configure provider-independent AI adapters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="danger" onClick={handleClearWorkspace}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Reset Workspace Data</span>
          </Button>
          <Button variant="primary" onClick={handleSaveWorkspace}>
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>Save Workspace Settings</span>
          </Button>
        </div>
      </div>

      {/* Multi-User Google Gemini API Vault */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-text-primary" aria-hidden="true" />
              <CardTitle>Google Gemini Multi-User Connection Vault</CardTitle>
            </div>
            <Badge
              variant={snapshot.activeGeminiMeta?.configured ? "success" : "warning"}
            >
              {snapshot.activeGeminiMeta?.configured
                ? `Active: ${
                    snapshot.activeGeminiMeta.sourceScope === "user"
                      ? "Personal User Key"
                      : snapshot.activeGeminiMeta.sourceScope === "workspace"
                        ? "Workspace Shared Key"
                        : "Server Env Key"
                  }${
                    snapshot.activeGeminiMeta.keyLast4
                      ? ` (••••${snapshot.activeGeminiMeta.keyLast4})`
                      : ""
                  }`
                : "Not Configured Yet"}
            </Badge>
          </div>
          <CardDescription>
            Connect personal user API keys (private to this workspace only, never visible to other workspaces) or workspace shared keys (team access). Powers Search Grounding, Multimodal Vision Audit, Co-Pilot Chat, and Imagen 3 / Flash Image generation.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {geminiNotice ? (
            <div
              role="status"
              className="rounded-md border border-status-success-border bg-status-success-bg p-3 text-xs font-medium text-status-success-fg"
            >
              {geminiNotice}
            </div>
          ) : null}

          {geminiError ? (
            <div
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs font-medium text-status-danger-fg"
            >
              {geminiError}
            </div>
          ) : null}

          {/* Add / Update Connection Form */}
          <form
            onSubmit={handleSaveGeminiKey}
            className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-secondary p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-gemini-scope">Connection Scope</Label>
                <NativeSelect
                  id="settings-gemini-scope"
                  value={connScope}
                  onChange={(e) =>
                    setConnScope(e.target.value as GeminiConnectionScope)
                  }
                >
                  <option value="user">Personal User Key (Private to this Workspace)</option>
                  <option value="workspace">Workspace Shared Key (Team Access)</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-gemini-mode">Endpoint Provider</Label>
                <NativeSelect
                  id="settings-gemini-mode"
                  value={connMode}
                  onChange={(e) =>
                    setConnMode(e.target.value as GeminiConnectionMode)
                  }
                >
                  <option value="google_ai_studio">Google AI Studio (Official)</option>
                  <option value="custom_endpoint">Custom Gemini Endpoint</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-gemini-text-model">Default Reasoning Model</Label>
                <NativeSelect
                  id="settings-gemini-text-model"
                  value={connTextModel}
                  onChange={(e) => setConnTextModel(e.target.value)}
                >
                  <option value="gemini-flash-latest">Gemini Flash Latest (Auto Active)</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-gemini-image-model">Default Image Model</Label>
                <NativeSelect
                  id="settings-gemini-image-model"
                  value={connImageModel}
                  onChange={(e) => setConnImageModel(e.target.value)}
                >
                  <option value="auto">Auto Best Available (2.5 / 3.1 / 3 Pro Image)</option>
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                  <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option>
                  <option value="gemini-3-pro-image">Gemini 3 Pro Image Studio</option>
                  <option value="gemini-nano-banana-2.1">Gemini Nano Banana 2.1</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-gemini-label">Connection Label</Label>
                <Input
                  id="settings-gemini-label"
                  value={connLabel}
                  onChange={(e) => setConnLabel(e.target.value)}
                  placeholder="e.g. Agency Production Key"
                />
              </div>

              {connMode === "custom_endpoint" ? (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="settings-gemini-endpoint">Custom Endpoint Base URL</Label>
                  <Input
                    id="settings-gemini-endpoint"
                    type="url"
                    value={connEndpointUrl}
                    onChange={(e) => setConnEndpointUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com/v1beta/models"
                    required
                  />
                </div>
              ) : null}

              <div
                className={`flex flex-col gap-1.5 ${
                  connMode === "custom_endpoint" ? "sm:col-span-2" : "sm:col-span-2"
                }`}
              >
                <Label htmlFor="settings-gemini-key">
                  Google Gemini API Key (Encrypted with AES-256-GCM at rest)
                </Label>
                <Input
                  id="settings-gemini-key"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Paste AIza... key from Google AI Studio"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={isConnectingGemini}
                disabled={geminiApiKey.trim().length < 12}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Verify Capabilities & Save to Vault</span>
              </Button>
            </div>
          </form>

          {/* Saved Multi-User & Workspace Connections */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Saved Connections for {snapshot.user.name} & {snapshot.activeWorkspace.name}
            </h2>

            {snapshot.geminiConnections.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-default bg-surface-secondary p-4 text-xs text-text-secondary">
                No encrypted vault keys stored yet for this user or workspace. Add a Personal User Key or Workspace Shared Key above to unlock live Gemini grounding, Vision audit, Co-Pilot edits, and image synthesis.
              </div>
            ) : (
              snapshot.geminiConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-secondary p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {conn.label}
                        </span>
                        <Badge variant={conn.scope === "user" ? "info" : "neutral"}>
                          {conn.scope === "user"
                            ? "Personal User"
                            : "Workspace Shared"}
                        </Badge>
                        <Badge variant={conn.isActive ? "success" : "warning"}>
                          {conn.isActive ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="neutral">••••{conn.keyLast4}</Badge>
                      </div>
                      <span className="font-mono text-xs text-text-secondary">
                        Endpoint: {conn.endpointBaseUrl}
                        {conn.capabilities.lastCheckedAt
                          ? ` | Last checked: ${new Date(
                              conn.capabilities.lastCheckedAt
                            ).toLocaleString()}`
                          : ""}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleProbeConnection(conn.id, conn.label)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Probe / Test Connection</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          handleUpdateConnection(conn.id, {
                            isActive: !conn.isActive,
                          })
                        }
                      >
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{conn.isActive ? "Pause" : "Activate"}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteConnection(conn.id, conn.label)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </div>

                  {/* Per-connection Model Selectors */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`conn-text-${conn.id}`}>Reasoning & Copy Model</Label>
                      <NativeSelect
                        id={`conn-text-${conn.id}`}
                        value={conn.textModel}
                        onChange={(e) =>
                          handleUpdateConnection(conn.id, {
                            textModel: e.target.value,
                          })
                        }
                      >
                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Legacy)</option>
                        {conn.capabilities.discoveredModels
                          .filter(
                            (m) =>
                              m.includes("gemini") &&
                              ![
                                "gemini-flash-latest",
                                "gemini-3-flash-preview",
                                "gemini-3.5-flash",
                                "gemini-3.1-pro-preview",
                                "gemini-3.1-flash-lite",
                                "gemini-2.5-flash",
                              ].includes(m) &&
                              !m.includes("embedding") &&
                              !m.includes("image") &&
                              !m.includes("tts") &&
                              !m.includes("audio")
                          )
                          .slice(0, 10)
                          .map((modelName) => (
                            <option key={modelName} value={modelName}>
                              {modelName}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`conn-image-${conn.id}`}>Image Generation Model</Label>
                      <NativeSelect
                        id={`conn-image-${conn.id}`}
                        value={conn.imageModel}
                        onChange={(e) =>
                          handleUpdateConnection(conn.id, {
                            imageModel: e.target.value,
                          })
                        }
                      >
                        <option value="auto">
                          Auto Best Available (2.5 / 3.1 / 3 Pro Image)
                        </option>
                        <option value="gemini-2.5-flash-image">
                          Gemini 2.5 Flash Image
                        </option>
                        <option value="gemini-3.1-flash-image">
                          Gemini 3.1 Flash Image
                        </option>
                        <option value="gemini-3-pro-image">
                          Gemini 3 Pro Image
                        </option>
                        <option value="gemini-nano-banana-2.1">
                          Gemini Nano Banana 2.1
                        </option>
                        {conn.capabilities.discoveredModels
                          .filter(
                            (m) =>
                              (m.includes("imagen") ||
                                m.includes("image") ||
                                m.includes("nano-banana")) &&
                              ![
                                "gemini-2.5-flash-image",
                                "gemini-3.1-flash-image",
                                "gemini-3-pro-image",
                                "gemini-nano-banana-2.1",
                              ].includes(m)
                          )
                          .slice(0, 8)
                          .map((modelName) => (
                            <option key={modelName} value={modelName}>
                              {modelName}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                  </div>

                  {/* Capability Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={conn.capabilities.searchGrounding ? "success" : "neutral"}
                    >
                      Search Grounding:{" "}
                      {conn.capabilities.searchGrounding ? "Ready" : "Unverified"}
                    </Badge>
                    <Badge
                      variant={conn.capabilities.visionAudit ? "success" : "neutral"}
                    >
                      Vision Audit:{" "}
                      {conn.capabilities.visionAudit ? "Ready" : "Unverified"}
                    </Badge>
                    <Badge
                      variant={
                        conn.capabilities.imageGeneration
                          ? "success"
                          : conn.capabilities.lastCheckedAt
                            ? "info"
                            : "neutral"
                      }
                    >
                      Image Generation:{" "}
                      {conn.capabilities.imageGeneration
                        ? "Ready"
                        : conn.capabilities.lastCheckedAt
                          ? "Free Fallback Active (Gemini Billing Optional)"
                          : "Unverified"}
                    </Badge>
                    <Badge
                      variant={conn.capabilities.videoGeneration ? "success" : "neutral"}
                    >
                      Video: {conn.capabilities.videoGeneration ? "Detected" : "None"}
                    </Badge>
                    <Badge
                      variant={conn.capabilities.embeddings ? "success" : "neutral"}
                    >
                      Embeddings: {conn.capabilities.embeddings ? "Ready" : "None"}
                    </Badge>
                  </div>

                  {/* Discovered Models List */}
                  {conn.capabilities.discoveredModels.length > 0 ? (
                    <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                      <span className="text-xs font-medium text-text-secondary">
                        Discovered Models ({conn.capabilities.discoveredModels.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {conn.capabilities.discoveredModels.map((modelId) => (
                          <span
                            key={modelId}
                            className="rounded border border-border-subtle bg-surface-primary px-2 py-0.5 font-mono text-[11px] text-text-secondary"
                          >
                            {modelId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Universal Image & Video API Vault (Any Provider / Any AI Model) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-text-primary" aria-hidden="true" />
              <CardTitle>
                Universal Image &amp; Video API Vault (Any Provider / Any AI Model)
              </CardTitle>
            </div>
            <Badge
              variant={
                snapshot.mediaConnections.some((c) => c.isActive)
                  ? "success"
                  : "neutral"
              }
            >
              {snapshot.mediaConnections.filter((c) => c.isActive).length} Active Key(s)
            </Badge>
          </div>
          <CardDescription>
            Connect any API key for any AI Image or Video model (OpenAI / Sora / GPT Image, fal.ai FLUX / Kling, Replicate, separate Gemini / Veo, Cloudflare Workers AI, Hugging Face, Pollinations, or Custom HTTP Gateway). Personal user keys override workspace shared keys.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {mediaNotice ? (
            <div
              role="status"
              className="rounded-md border border-status-success-border bg-status-success-bg p-3 text-xs font-medium text-status-success-fg"
            >
              {mediaNotice}
            </div>
          ) : null}

          {mediaError ? (
            <div
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs font-medium text-status-danger-fg"
            >
              {mediaError}
            </div>
          ) : null}

          <form
            onSubmit={handleSaveMediaKey}
            className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-secondary p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-conn-capability">Media Capability</Label>
                <NativeSelect
                  id="media-conn-capability"
                  value={mediaCapability}
                  onChange={(e) => {
                    const nextCap = e.target.value as MediaApiCapability;
                    setMediaCapability(nextCap);
                    const meta = MEDIA_PROVIDER_DEFAULTS[mediaPreset];
                    setMediaModelId(
                      nextCap === "video"
                        ? meta.defaultVideoModel
                        : meta.defaultImageModel
                    );
                  }}
                >
                  <option value="both">Both Image &amp; Video</option>
                  <option value="image">Image Generation Only</option>
                  <option value="video">Video Generation Only</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-conn-preset">AI Provider Preset</Label>
                <NativeSelect
                  id="media-conn-preset"
                  value={mediaPreset}
                  onChange={(e) => {
                    const nextPreset = e.target.value as MediaProviderPreset;
                    setMediaPreset(nextPreset);
                    applyMediaPresetDefaults(nextPreset, mediaCapability);
                  }}
                >
                  <option value="openai_compatible">
                    OpenAI / OpenAI-Compatible (GPT Image / Sora / Together)
                  </option>
                  <option value="fal_ai">fal.ai (FLUX / Kling / Luma / Runway)</option>
                  <option value="replicate">Replicate (Any Model Slug)</option>
                  <option value="gemini">Google Gemini / Veo (Separate Media Key)</option>
                  <option value="cloudflare_ai">Cloudflare Workers AI (Free Daily Tier)</option>
                  <option value="huggingface">Hugging Face Inference Providers</option>
                  <option value="pollinations">Pollinations Unified API (sk_... Key)</option>
                  <option value="custom_http">Custom HTTP Endpoint (Any Model)</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-conn-scope">Key Scope</Label>
                <NativeSelect
                  id="media-conn-scope"
                  value={mediaScope}
                  onChange={(e) =>
                    setMediaScope(e.target.value as GeminiConnectionScope)
                  }
                >
                  <option value="user">Personal User Key (Private to this Workspace)</option>
                  <option value="workspace">Workspace Shared Key (Team Access)</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-conn-label">Connection Label</Label>
                <Input
                  id="media-conn-label"
                  value={mediaLabel}
                  onChange={(e) => setMediaLabel(e.target.value)}
                  placeholder="e.g. fal.ai Kling Video"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-conn-model">AI Model ID (Any Model Name or Slug)</Label>
                <Input
                  id="media-conn-model"
                  value={mediaModelId}
                  onChange={(e) => setMediaModelId(e.target.value)}
                  placeholder="e.g. gpt-image-1, fal-ai/flux/schnell, veo-2.0-generate-001"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <Label htmlFor="media-conn-endpoint">API Endpoint URL</Label>
                <Input
                  id="media-conn-endpoint"
                  type="url"
                  value={mediaEndpointUrl}
                  onChange={(e) => setMediaEndpointUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MEDIA_PROVIDER_DEFAULTS[mediaPreset].requiresAccountId ||
              mediaPreset === "custom_http" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="media-conn-account">
                    Account ID {MEDIA_PROVIDER_DEFAULTS[mediaPreset].requiresAccountId ? "(Required for Cloudflare)" : "(Optional)"}
                  </Label>
                  <Input
                    id="media-conn-account"
                    value={mediaAccountId}
                    onChange={(e) => setMediaAccountId(e.target.value)}
                    placeholder="Cloudflare Account ID"
                  />
                </div>
              ) : null}

              <div
                className={`flex flex-col gap-1.5 ${
                  MEDIA_PROVIDER_DEFAULTS[mediaPreset].requiresAccountId ||
                  mediaPreset === "custom_http"
                    ? "sm:col-span-2"
                    : "sm:col-span-3"
                }`}
              >
                <Label htmlFor="media-conn-key">
                  API Key (Encrypted with AES-256-GCM at rest)
                </Label>
                <Input
                  id="media-conn-key"
                  type="password"
                  value={mediaApiKey}
                  onChange={(e) => setMediaApiKey(e.target.value)}
                  placeholder="Paste API key or access token..."
                />
              </div>
            </div>

            <details className="rounded border border-border-subtle bg-surface-primary p-3 text-xs">
              <summary className="cursor-pointer font-medium text-text-secondary">
                Custom Auth Header &amp; Token Prefix (Advanced)
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="media-conn-header">Auth Header Name</Label>
                  <Input
                    id="media-conn-header"
                    value={mediaAuthHeader}
                    onChange={(e) => setMediaAuthHeader(e.target.value)}
                    placeholder="Authorization"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="media-conn-prefix">Token Prefix (include trailing space if needed)</Label>
                  <Input
                    id="media-conn-prefix"
                    value={mediaAuthPrefix}
                    onChange={(e) => setMediaAuthPrefix(e.target.value)}
                    placeholder="Bearer "
                  />
                </div>
              </div>
            </details>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={isConnectingMedia}
                disabled={mediaApiKey.trim().length < 8}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Verify &amp; Save Media API Key</span>
              </Button>
            </div>
          </form>

          {/* Saved Universal Media Connections */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Saved Universal Image &amp; Video Connections
            </h2>

            {snapshot.mediaConnections.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-default bg-surface-secondary p-4 text-xs text-text-secondary">
                No dedicated image or video API keys stored yet. Image posts automatically use Gemini Prompts + free fallback until you add an Image API key here; add any Video API key here to enable AI Reels &amp; Video generation in Post Studio.
              </div>
            ) : (
              snapshot.mediaConnections.map((conn) => {
                const draftModel = mediaModelDrafts[conn.id] ?? conn.modelId;
                return (
                  <div
                    key={conn.id}
                    className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {conn.label}
                          </span>
                          <Badge variant="info">
                            {conn.capability === "both"
                              ? "IMAGE + VIDEO"
                              : conn.capability.toUpperCase()}
                          </Badge>
                          <Badge variant="neutral">{conn.providerPreset}</Badge>
                          <Badge variant={conn.scope === "user" ? "info" : "neutral"}>
                            {conn.scope === "user"
                              ? "Personal User"
                              : "Workspace Shared"}
                          </Badge>
                          <Badge variant={conn.isActive ? "success" : "warning"}>
                            {conn.isActive ? "Active" : "Paused"}
                          </Badge>
                          <Badge variant="neutral">••••{conn.keyLast4}</Badge>
                        </div>
                        <span className="font-mono text-xs text-text-secondary">
                          Endpoint: {conn.endpointUrl}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleProbeMediaConn(conn.id, conn.label)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Test Connection</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleUpdateMediaConn(conn.id, {
                              isActive: !conn.isActive,
                            })
                          }
                        >
                          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{conn.isActive ? "Pause" : "Activate"}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteMediaConn(conn.id, conn.label)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex flex-1 flex-col gap-1">
                        <Label htmlFor={`media-edit-model-${conn.id}`}>
                          Active Model ID
                        </Label>
                        <Input
                          id={`media-edit-model-${conn.id}`}
                          value={draftModel}
                          onChange={(e) =>
                            setMediaModelDrafts((prev) => ({
                              ...prev,
                              [conn.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!draftModel.trim() || draftModel.trim() === conn.modelId}
                        onClick={() =>
                          handleUpdateMediaConn(conn.id, {
                            modelId: draftModel.trim(),
                          })
                        }
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Save Model</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Context Protocol (MCP) Servers Registry */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-text-primary" aria-hidden="true" />
              <CardTitle>
                Model Context Protocol (MCP) Servers
              </CardTitle>
            </div>
            <Badge
              variant={
                (snapshot.mcpConnections ?? []).some((c) => c.isActive)
                  ? "success"
                  : "neutral"
              }
            >
              {(snapshot.mcpConnections ?? []).filter((c) => c.isActive).length} Active MCP Server(s)
            </Badge>
          </div>
          <CardDescription>
            Connect external MCP servers via HTTP/SSE, Streamable HTTP, or local Stdio commands (`npx` / `uvx`), or paste your `mcpServers` JSON config to extend the studio with custom tools and context providers.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {mcpNotice ? (
            <div
              role="status"
              className="rounded-md border border-status-success-border bg-status-success-bg p-3 text-xs font-medium text-status-success-fg"
            >
              {mcpNotice}
            </div>
          ) : null}

          {mcpError ? (
            <div
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs font-medium text-status-danger-fg"
            >
              {mcpError}
            </div>
          ) : null}

          <form
            onSubmit={handleSaveMcpServer}
            className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-secondary p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <span className="text-xs font-semibold text-text-primary">
                Add New MCP Server Connection
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={mcpMode === "form" ? "primary" : "outline"}
                  onClick={() => setMcpMode("form")}
                >
                  <Server className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Form Configuration</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mcpMode === "json" ? "primary" : "outline"}
                  onClick={() => setMcpMode("json")}
                >
                  <Code className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Paste mcpServers JSON</span>
                </Button>
              </div>
            </div>

            {mcpMode === "json" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="mcp-json-input">
                  Paste `mcpServers` JSON Configuration
                </Label>
                <Textarea
                  id="mcp-json-input"
                  value={mcpJsonRaw}
                  onChange={(e) => setMcpJsonRaw(e.target.value)}
                  placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./storage"]\n    },\n    "remote-brand-mcp": {\n      "url": "https://mcp.yourbrand.com/sse"\n    }\n  }\n}`}
                  className="font-mono text-xs min-h-[140px]"
                  required
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mcp-server-name">MCP Server Name</Label>
                    <Input
                      id="mcp-server-name"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                      placeholder="e.g. Figma MCP, GitHub MCP, Filesystem"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mcp-transport-type">Transport Protocol</Label>
                    <NativeSelect
                      id="mcp-transport-type"
                      value={mcpTransport}
                      onChange={(e) => setMcpTransport(e.target.value as McpTransportType)}
                    >
                      <option value="sse">SSE (Server-Sent Events / HTTP)</option>
                      <option value="streamable_http">Streamable HTTP Endpoint</option>
                      <option value="stdio">Stdio Command (npx / uvx / binary)</option>
                    </NativeSelect>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mcp-auth-token">
                      Auth / Bearer Token (Optional, AES-256-GCM Encrypted)
                    </Label>
                    <Input
                      id="mcp-auth-token"
                      type="password"
                      value={mcpToken}
                      onChange={(e) => setMcpToken(e.target.value)}
                      placeholder="Optional API key or token..."
                    />
                  </div>
                </div>

                {mcpTransport === "stdio" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="mcp-command">Command Executable</Label>
                      <Input
                        id="mcp-command"
                        value={mcpCommand}
                        onChange={(e) => setMcpCommand(e.target.value)}
                        placeholder="npx, uvx, node, python..."
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="mcp-args">Command Arguments</Label>
                      <Input
                        id="mcp-args"
                        value={mcpArgs}
                        onChange={(e) => setMcpArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-filesystem ./storage"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mcp-server-url">MCP Server Endpoint URL</Label>
                    <Input
                      id="mcp-server-url"
                      type="url"
                      value={mcpUrl}
                      onChange={(e) => setMcpUrl(e.target.value)}
                      placeholder="http://localhost:3001/sse or https://mcp.example.com/mcp"
                      required
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={isSavingMcp}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {mcpMode === "json" ? "Import MCP JSON Config" : "Add MCP Server"}
                </span>
              </Button>
            </div>
          </form>

          {/* Saved MCP Connections List */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Configured MCP Servers ({(snapshot.mcpConnections ?? []).length})
            </h2>

            {(snapshot.mcpConnections ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-border-default bg-surface-secondary p-4 text-xs text-text-secondary">
                No MCP servers registered in this workspace yet. Add an SSE/HTTP endpoint, a local `npx`/`uvx` command, or paste an `mcpServers` JSON block above.
              </div>
            ) : (
              (snapshot.mcpConnections ?? []).map((mcp) => (
                <div
                  key={mcp.id}
                  className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {mcp.name}
                        </span>
                        <Badge variant="info">
                          {mcp.transportType.toUpperCase()}
                        </Badge>
                        <Badge variant={mcp.isActive ? "success" : "warning"}>
                          {mcp.isActive ? "Active" : "Paused"}
                        </Badge>
                        {mcp.hasAuthToken ? (
                          <Badge variant="neutral">Token ••••{mcp.tokenLast4}</Badge>
                        ) : null}
                      </div>
                      <span className="font-mono text-xs text-text-secondary">
                        {mcp.transportType === "stdio"
                          ? `Command: ${mcp.command} ${mcp.args.join(" ")}`
                          : `Endpoint: ${mcp.serverUrl}`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleProbeMcp(mcp.id, mcp.name)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Test Server</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleToggleMcp(mcp.id, !mcp.isActive)}
                      >
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{mcp.isActive ? "Pause" : "Activate"}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDeleteMcp(mcp.id, mcp.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Settings & Admin Workspace Deletion */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Workspace Isolation, Admin Control &amp; Export Policy</CardTitle>
              <CardDescription>
                Workspace ID: {snapshot.activeWorkspace.id} (Slug: {snapshot.activeWorkspace.slug})
              </CardDescription>
            </div>
            <Badge variant={snapshot.user.isAdmin ? "success" : "neutral"}>
              {snapshot.user.isAdmin
                ? `Signed in as Admin (${snapshot.user.email})`
                : `Member Account (${snapshot.user.email})`}
            </Badge>
          </div>
        </CardHeader>
        <form onSubmit={handleSaveWorkspace}>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-ws-name">Workspace Display Name</Label>
                <Input
                  id="settings-ws-name"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-export-format">Default Export Package Format</Label>
                <NativeSelect
                  id="settings-export-format"
                  value={defaultFormat}
                  onChange={(e) =>
                    setDefaultFormat(e.target.value as "png" | "webp" | "both")
                  }
                >
                  <option value="both">PNG + WebP Dual Package</option>
                  <option value="png">PNG Only</option>
                  <option value="webp">WebP Only</option>
                </NativeSelect>
              </div>
            </div>

            {/* Admin Workspace Deletion Panel */}
            <div className="flex flex-col justify-between gap-3 rounded-md border border-status-danger-border/60 bg-status-danger-bg/30 p-4 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-status-danger-fg" aria-hidden="true" />
                  <span>Delete Entire Workspace (Admin Permission Required)</span>
                </span>
                <span className="text-xs text-text-secondary">
                  {snapshot.user.isAdmin
                    ? `You are signed in as Studio Admin. You can permanently delete "${snapshot.activeWorkspace.name}" (${snapshot.workspaces.length} total workspaces available).`
                    : "Only the Admin account (Email: admin@socialstudio.local | Password: admin123) can delete a workspace."}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!snapshot.user.isAdmin && onAuthenticate ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      void onAuthenticate({
                        email: "admin@socialstudio.local",
                        name: "Studio Admin",
                        password: "admin123",
                        workspaceName: "",
                      })
                    }
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Switch to Admin Account</span>
                  </Button>
                ) : null}

                {onDeleteWorkspace ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={!snapshot.user.isAdmin || snapshot.workspaces.length <= 1}
                    title={
                      !snapshot.user.isAdmin
                        ? "Switch to the Admin account first to delete workspaces"
                        : snapshot.workspaces.length <= 1
                          ? "Create another workspace before deleting the last remaining workspace"
                          : `Permanently delete ${snapshot.activeWorkspace.name}`
                    }
                    onClick={async () => {
                      if (!window.confirm(`Permanently delete workspace "${snapshot.activeWorkspace.name}" and all its data?`)) {
                        return;
                      }
                      await onDeleteWorkspace(snapshot.activeWorkspace.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Delete Workspace</span>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* Configurable Platform Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>Configurable Social Media Platform Dimensions</CardTitle>
          <CardDescription>
            Platform dimensions are stored per workspace and never hardcoded. Add multiple formats for any social network.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs font-semibold uppercase text-text-secondary">
                  <th className="py-2.5 pr-4">Platform</th>
                  <th className="py-2.5 pr-4">Format Name</th>
                  <th className="py-2.5 pr-4">Dimensions (px)</th>
                  <th className="py-2.5 pr-4">Safe Margin</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.presets.map((preset) => (
                  <tr key={preset.id} className="border-b border-border-subtle">
                    <td className="py-3 pr-4 font-medium capitalize text-text-primary">
                      {preset.platform}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">{preset.formatName}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-text-primary">
                      {preset.width} × {preset.height}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-text-muted">
                      {preset.safeMarginPx}px
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={handleAddPreset}
            className="grid grid-cols-1 gap-3 rounded-md bg-surface-secondary p-4 sm:grid-cols-5"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-preset-platform">Platform</Label>
              <NativeSelect
                id="new-preset-platform"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as SocialPlatform)}
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
                <option value="pinterest">Pinterest</option>
                <option value="tiktok">TikTok</option>
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="new-preset-format">Format Name</Label>
              <Input
                id="new-preset-format"
                value={newFormatName}
                onChange={(e) => setNewFormatName(e.target.value)}
                placeholder="e.g. Story or Carousel"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="new-preset-width">Width (px)</Label>
              <Input
                id="new-preset-width"
                type="number"
                min={320}
                max={4096}
                value={newWidth}
                onChange={(e) => setNewWidth(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="new-preset-height">Height (px)</Label>
              <Input
                id="new-preset-height"
                type="number"
                min={320}
                max={4096}
                value={newHeight}
                onChange={(e) => setNewHeight(e.target.value)}
                required
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Format</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Gemini AI Telemetry & Adapter Status */}
      <Card>
        <CardHeader>
          <CardTitle>Google Gemini Adapter Registry & Telemetry</CardTitle>
          <CardDescription>
            Tracks request volume, failure resilience, and capability usage across Google Gemini reasoning, grounding, vision audit, and image generation endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {snapshot.aiProviders.map((prov) => (
            <div
              key={prov.id}
              className="flex flex-col justify-between gap-4 rounded-md bg-surface-secondary p-4 sm:flex-row sm:items-center"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {prov.displayName}
                  </span>
                  <Badge variant="info">{prov.providerType.toUpperCase()}</Badge>
                  {prov.isPrimary ? (
                    <Badge variant="success">Primary Adapter</Badge>
                  ) : (
                    <Badge variant="neutral">Fallback / Secondary</Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-text-secondary">
                  Model: {prov.modelId} | Endpoint: {prov.endpointUrl}
                </span>
                <span className="text-xs text-text-muted">
                  Requests: {prov.stats.totalRequests} | Failures:{" "}
                  {prov.stats.failedRequests} | Fallbacks:{" "}
                  {prov.stats.fallbackCount} | Est. Cost: $
                  {prov.stats.estimatedCostUsd.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!prov.isPrimary ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleSetPrimaryProvider(prov.id, prov.displayName)
                    }
                  >
                    Set as Primary
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <span className="text-xs text-text-muted">
            API keys are encrypted server-side using AES-256-GCM in the Multi-User Gemini Vault and never exposed back to client state.
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
