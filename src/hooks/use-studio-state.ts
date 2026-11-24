"use client";

import * as React from "react";
import type {
  AIProviderConfig,
  ApprovalLog,
  BlogImageDimensionPreset,
  BlogPostProject,
  Brand,
  BrandKit,
  Campaign,
  ContentItem,
  Creative,
  CreativeAudit,
  DashboardMetrics,
  ExportJob,
  GeminiConnectionSummary,
  McpConnectionSummary,
  MediaApiConnectionSummary,
  PlatformPreset,
  SocialPostTracker,
  TrendSignal,
  User,
  VideoGeneration,
  Workspace,
} from "@/types/domain";

export type StudioModuleId =
  | "dashboard"
  | "brands"
  | "brand-kits"
  | "studio"
  | "video-generation"
  | "blog-studio"
  | "radar"
  | "tracker"
  | "content"
  | "approvals"
  | "exports"
  | "settings";

export interface ActiveGeminiMeta {
  configured: boolean;
  sourceScope: "user" | "workspace" | "env" | "none";
  keyLast4: string;
  textModel: string;
  imageModel: string;
}

export interface WorkspaceSnapshot {
  user: User;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  metrics: DashboardMetrics;
  brands: Brand[];
  brandKits: BrandKit[];
  presets: PlatformPreset[];
  blogDimensionPresets?: BlogImageDimensionPreset[];
  blogProjects?: BlogPostProject[];
  campaigns: Campaign[];
  contentItems: ContentItem[];
  creatives: Creative[];
  approvalLogs: ApprovalLog[];
  exportJobs: ExportJob[];
  aiProviders: AIProviderConfig[];
  geminiConnections: GeminiConnectionSummary[];
  activeGeminiMeta: ActiveGeminiMeta;
  geminiConfigured?: boolean;
  mediaConnections: MediaApiConnectionSummary[];
  mcpConnections?: McpConnectionSummary[];
  videoGenerations: VideoGeneration[];
  radarSignals: TrendSignal[];
  creativeAudits: CreativeAudit[];
  socialTrackers: SocialPostTracker[];
}

export interface BackgroundTaskState {
  isRunning: boolean;
  label: string;
  progressPercent: number;
}

export function useStudioState() {
  const [activeModule, setActiveModule] = React.useState<StudioModuleId>("dashboard");
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string>("");
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string>("");
  const [selectedCreativeId, setSelectedCreativeId] = React.useState<string>("");
  const [studioPrefill, setStudioPrefill] = React.useState<{
    topic: string;
    seoKeywords: string[];
  } | null>(null);
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState<string>("");
  const [backgroundTask, setBackgroundTask] = React.useState<BackgroundTaskState>({
    isRunning: false,
    label: "",
    progressPercent: 0,
  });

  const announce = React.useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const fetchSnapshot = React.useCallback(
    async (workspaceOverrideId?: string) => {
      const targetWs = workspaceOverrideId ?? activeWorkspaceId;
      try {
        const headers: Record<string, string> = {};
        if (targetWs) {
          headers["x-workspace-id"] = targetWs;
        }
        const res = await fetch("/api/state", { headers, cache: "no-store" });
        if (res.status === 401) {
          setSnapshot(null);
          setError(null);
          return null;
        }
        const data = await res.json();
        if (data.authenticated === false) {
          setSnapshot(null);
          setError(null);
          return null;
        }
        if (!res.ok) {
          throw new Error(data.error || "Unable to load studio workspace.");
        }
        const snap = data as WorkspaceSnapshot;
        setSnapshot(snap);
        setActiveWorkspaceId(snap.activeWorkspace.id);
        setSelectedBrandId((prev) =>
          snap.brands.some((b) => b.id === prev) ? prev : (snap.brands[0]?.id ?? "")
        );
        setSelectedCampaignId((prev) =>
          snap.campaigns.some((c) => c.id === prev) ? prev : (snap.campaigns[0]?.id ?? "")
        );
        setError(null);
        return snap;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load workspace.";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [activeWorkspaceId]
  );

  React.useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const switchWorkspace = React.useCallback(
    async (workspaceId: string) => {
      setIsLoading(true);
      setActiveWorkspaceId(workspaceId);
      const snap = await fetchSnapshot(workspaceId);
      if (snap) {
        announce(`Switched to workspace ${snap.activeWorkspace.name}.`);
      }
    },
    [fetchSnapshot, announce]
  );

  const apiRequest = React.useCallback(
    async <T,>(
      url: string,
      options: RequestInit & { taskLabel?: string } = {}
    ): Promise<T> => {
      const { taskLabel, headers: customHeaders, ...rest } = options;
      const isMutation = (rest.method ?? "GET").toUpperCase() !== "GET";
      const effectiveLabel =
        taskLabel ||
        (isMutation
          ? "Processing and saving workspace data..."
          : "Loading data from server...");

      setBackgroundTask({ isRunning: true, label: effectiveLabel, progressPercent: 35 });
      try {
        const res = await fetch(url, {
          ...rest,
          headers: {
            "Content-Type": "application/json",
            ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
            ...(customHeaders as Record<string, string> | undefined),
          },
        });
        setBackgroundTask({ isRunning: true, label: effectiveLabel, progressPercent: 80 });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Request failed.");
        }
        const method = (rest.method ?? "GET").toUpperCase();
        if (method !== "GET") {
          await fetchSnapshot(activeWorkspaceId);
        }
        return payload as T;
      } finally {
        setBackgroundTask({ isRunning: false, label: "", progressPercent: 100 });
      }
    },
    [activeWorkspaceId, fetchSnapshot]
  );

  return {
    activeModule,
    setActiveModule,
    activeWorkspaceId,
    switchWorkspace,
    selectedBrandId,
    setSelectedBrandId,
    selectedCampaignId,
    setSelectedCampaignId,
    selectedCreativeId,
    setSelectedCreativeId,
    studioPrefill,
    setStudioPrefill,
    snapshot,
    isLoading,
    error,
    setError,
    announcement,
    announce,
    backgroundTask,
    refresh: () => fetchSnapshot(activeWorkspaceId),
    apiRequest,
  };
}
