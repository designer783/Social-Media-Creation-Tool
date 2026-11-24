"use client";

import * as React from "react";
import { useStudioState } from "@/hooks/use-studio-state";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DashboardView } from "@/components/features/dashboard-view";
import { BrandsDomainsView } from "@/components/features/brands-domains-view";
import { BrandKitsView } from "@/components/features/brand-kits-view";
import { CreativeStudioView } from "@/components/features/creative-studio-view";
import { ContentLibraryView } from "@/components/features/content-library-view";
import { ApprovalsView } from "@/components/features/approvals-view";
import { ExportsView } from "@/components/features/exports-view";
import { SettingsView } from "@/components/features/settings-view";
import { RadarView } from "@/components/features/radar-view";
import { TrackerView } from "@/components/features/tracker-view";
import { VideoProjectsView } from "@/components/features/video-projects-view";
import { BlogStudioView } from "@/components/features/blog-studio-view";
import { LoginGateView } from "@/components/features/login-gate-view";
import { Button } from "@/components/ui/button";
import type {
  GeminiConnectionScope,
  TrendSignal,
  User,
  Workspace,
} from "@/types/domain";

export default function StudioHomePage() {
  const {
    activeModule,
    setActiveModule,
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
    announcement,
    announce,
    backgroundTask,
    refresh,
    apiRequest,
  } = useStudioState();

  const handleCreateWorkspace = async (name: string) => {
    const res = await apiRequest<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      taskLabel: "Initializing isolated workspace...",
      body: JSON.stringify({
        action: "create_workspace",
        name,
      }),
    });
    await switchWorkspace(res.workspace.id);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const res = await apiRequest<{
      deleted: boolean;
      workspaces: Workspace[];
      nextWorkspaceId: string;
    }>("/api/workspaces", {
      method: "POST",
      taskLabel: "Deleting workspace...",
      body: JSON.stringify({
        action: "delete_workspace",
        workspaceId,
      }),
    });
    if (res.nextWorkspaceId) {
      await switchWorkspace(res.nextWorkspaceId);
    }
    announce("Workspace deleted by Admin.");
  };

  const handleAuthenticate = async (input: {
    email: string;
    name: string;
    password: string;
    workspaceName: string;
  }) => {
    const res = await apiRequest<{ user: User; workspaces: Workspace[] }>(
      "/api/workspaces",
      {
        method: "POST",
        taskLabel: "Authenticating studio account...",
        body: JSON.stringify({
          action: "auth",
          ...input,
        }),
      }
    );
    if (res.workspaces[0]) {
      await switchWorkspace(res.workspaces[0].id);
    }
    announce(`Signed in as ${res.user.name}.`);
  };

  const handleLogout = async () => {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    if (!res.ok) {
      throw new Error("Failed to reset studio session.");
    }
    await switchWorkspace("");
    announce("Reset to default studio session.");
  };

  const handleConnectGemini = async (input: {
    scope: GeminiConnectionScope;
    label: string;
    apiKey: string;
    textModel: string;
    imageModel: string;
  }) => {
    const res = await apiRequest<{
      probe?: { ok: boolean; error?: string; models?: string[] };
    }>("/api/gemini", {
      method: "POST",
      taskLabel: "Verifying & encrypting Google Gemini connection...",
      body: JSON.stringify({
        action: "connect",
        ...input,
      }),
    });
    announce(
      res.probe?.ok
        ? `Gemini API connected (${res.probe.models?.length ?? 0} models verified).`
        : "Gemini API key encrypted and saved to vault."
    );
  };

  const handleLaunchSignalInStudio = async (signal: TrendSignal) => {
    setSelectedBrandId(signal.brandId);
    setStudioPrefill({
      topic: signal.suggestedHeadline || signal.title,
      seoKeywords: signal.seoKeywords,
    });
    await apiRequest("/api/radar", {
      method: "PATCH",
      taskLabel: "Launching trend signal in Creative Studio...",
      body: JSON.stringify({
        signalId: signal.id,
        status: "launched",
      }),
    });
    setActiveModule("studio");
    announce(`Pre-filled Creative Studio with signal: ${signal.title}.`);
  };

  const handleOpenCreativeInStudio = (creativeId: string, campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedCreativeId(creativeId);
    setActiveModule("studio");
  };

  if (!snapshot) {
    if (isLoading) {
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <span className="relative inline-flex h-8 w-8 items-center justify-center animate-spin">
              <span className="h-4 w-4 rotate-45 rounded-[4px] bg-action-primary-bg" />
            </span>
            <p className="text-xs font-semibold text-text-secondary">Loading studio workspace...</p>
          </div>
        </div>
      );
    }
    return (
      <LoginGateView
        onAuthenticate={handleAuthenticate}
        externalError={error}
      />
    );
  }

  return (
    <AppShell
      activeModule={activeModule}
      onSelectModule={setActiveModule}
      snapshot={snapshot}
      onSwitchWorkspace={switchWorkspace}
      onCreateWorkspace={handleCreateWorkspace}
      onDeleteWorkspace={handleDeleteWorkspace}
      onAuthenticate={handleAuthenticate}
      onLogout={handleLogout}
      onConnectGemini={handleConnectGemini}
      announcement={announcement}
      backgroundTask={backgroundTask}
    >
      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-status-danger-border bg-status-danger-bg p-6 text-status-danger-fg"
        >
          <h2 className="text-base font-semibold">Workspace Connection Error</h2>
          <p className="text-sm">{error}</p>
          <div>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Retry Loading Workspace
            </Button>
          </div>
        </div>
      ) : null}

      <ErrorBoundary fallbackTitle="Module failed to render">
          {activeModule === "dashboard" ? (
            <DashboardView
              snapshot={snapshot}
              onNavigate={setActiveModule}
              onSelectBrand={setSelectedBrandId}
              onOpenCreativeInStudio={handleOpenCreativeInStudio}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "brands" ? (
            <BrandsDomainsView
              snapshot={snapshot}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "brand-kits" ? (
            <BrandKitsView
              snapshot={snapshot}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "studio" ? (
            <CreativeStudioView
              studioPrefill={studioPrefill}
              onConsumePrefill={() => setStudioPrefill(null)}
              snapshot={snapshot}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
              selectedCreativeId={selectedCreativeId}
              onSelectCreative={setSelectedCreativeId}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "video-generation" ? (
            <VideoProjectsView
              snapshot={snapshot}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "blog-studio" ? (
            <BlogStudioView
              snapshot={snapshot}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "radar" ? (
            <RadarView
              snapshot={snapshot}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              onLaunchSignalInStudio={handleLaunchSignalInStudio}
              onNavigate={setActiveModule}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "tracker" ? (
            <TrackerView
              snapshot={snapshot}
              onNavigate={setActiveModule}
              onOpenCreativeInStudio={handleOpenCreativeInStudio}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "content" ? (
            <ContentLibraryView
              snapshot={snapshot}
              onNavigate={setActiveModule}
              onSelectCampaign={setSelectedCampaignId}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "approvals" ? (
            <ApprovalsView
              snapshot={snapshot}
              onNavigate={setActiveModule}
              onOpenCreativeInStudio={handleOpenCreativeInStudio}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "exports" ? (
            <ExportsView
              snapshot={snapshot}
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}

          {activeModule === "settings" ? (
            <SettingsView
              snapshot={snapshot}
              onDeleteWorkspace={handleDeleteWorkspace}
              onAuthenticate={handleAuthenticate}
              apiRequest={apiRequest}
              announce={announce}
            />
          ) : null}
        </ErrorBoundary>
    </AppShell>
  );
}
