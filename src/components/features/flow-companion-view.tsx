"use client";

import * as React from "react";
import {
  Compass,
  Copy,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  Calendar,
  Zap,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import type { WorkspaceSnapshot, StudioModuleId } from "@/hooks/use-studio-state";
import type {
  VideoProjectBrief,
  Storyboard,
  FlowCreditSnapshot,
  FlowCompanionPackage,
} from "@/types/domain";

interface FlowCompanionViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  announce: (msg: string) => void;
}

export function FlowCompanionView({
  snapshot,
  onNavigate,
  apiRequest,
  announce,
}: FlowCompanionViewProps) {
  const [projects, setProjects] = React.useState<VideoProjectBrief[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [storyboard, setStoryboard] = React.useState<Storyboard | null>(null);
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [creditSnapshot, setCreditSnapshot] = React.useState<FlowCreditSnapshot | null>(null);
  const [companionPkg, setCompanionPkg] = React.useState<FlowCompanionPackage | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);
  const [isEditingCredits, setIsEditingCredits] = React.useState(false);

  // Credit Snapshot State
  const [userBalance, setUserBalance] = React.useState(1000);
  const [costPerGen, setCostPerGen] = React.useState(10);
  const [resetDate, setResetDate] = React.useState("");

  const loadInitialData = React.useCallback(async () => {
    try {
      const pRes = await apiRequest<{ projects: VideoProjectBrief[] }>("/api/video-projects");
      setProjects(pRes.projects || []);
      if (pRes.projects?.length && !selectedProjectId) {
        setSelectedProjectId(pRes.projects[0].id);
      }

      const cRes = await apiRequest<{ creditSnapshot: FlowCreditSnapshot }>("/api/flow-companion");
      if (cRes.creditSnapshot) {
        setCreditSnapshot(cRes.creditSnapshot);
        setUserBalance(cRes.creditSnapshot.userEnteredBalance);
        setCostPerGen(cRes.creditSnapshot.estimatedCostPerGeneration);
        setResetDate(cRes.creditSnapshot.billingResetDate);
      }
    } catch (err) {
      console.error(err);
    }
  }, [apiRequest, selectedProjectId]);

  const loadProjectDetail = React.useCallback(
    async (projId: string, sceneId?: string) => {
      try {
        const url = sceneId
          ? `/api/flow-companion?projectId=${projId}&sceneId=${sceneId}`
          : `/api/video-projects?projectId=${projId}`;

        if (sceneId) {
          const res = await apiRequest<{ companionPackage: FlowCompanionPackage }>("/api/flow-companion?projectId=" + projId + "&sceneId=" + sceneId);
          setCompanionPkg(res.companionPackage);
        } else {
          const res = await apiRequest<{ project: VideoProjectBrief; storyboard: Storyboard }>("/api/video-projects?projectId=" + projId);
          setStoryboard(res.storyboard || null);
          if (res.storyboard?.scenes?.length) {
            setSelectedSceneId(res.storyboard.scenes[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
    [apiRequest]
  );

  React.useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  React.useEffect(() => {
    if (selectedProjectId) {
      void loadProjectDetail(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectDetail]);

  React.useEffect(() => {
    if (selectedProjectId && selectedSceneId) {
      void loadProjectDetail(selectedProjectId, selectedSceneId);
    }
  }, [selectedProjectId, selectedSceneId, loadProjectDetail]);

  const handleCopyPrompt = async () => {
    if (!companionPkg) return;
    try {
      await navigator.clipboard.writeText(companionPkg.composedPrompt);
      setIsCopied(true);
      announce("Scene prompt copied with continuity instructions!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenFlow = () => {
    window.open("https://labs.google/fx/tools/flow", "_blank", "noopener,noreferrer");
    announce("Opening Google Flow in a new tab.");
  };

  const handleSaveCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; creditSnapshot: FlowCreditSnapshot }>("/api/flow-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credits",
          userEnteredBalance: userBalance,
          estimatedCostPerGeneration: costPerGen,
          billingResetDate: resetDate,
        }),
      });
      setCreditSnapshot(res.creditSnapshot);
      setIsEditingCredits(false);
      announce("Flow Credit Planner updated.");
    } catch (err: unknown) {
      announce(`Failed to update credits: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const remainingGenerations = creditSnapshot && creditSnapshot.estimatedCostPerGeneration > 0
    ? Math.floor(creditSnapshot.userEnteredBalance / creditSnapshot.estimatedCostPerGeneration)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Google Flow Companion & Credit Planner
            </h1>
            <Badge variant="info">
              PRD §6.2 & §6.3
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Prepare scene prompts with locked continuity, launch Flow with your Google AI Pro subscription, and import clips.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => onNavigate("video-generation")}>
          Back to Video Generation
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Credit Planner & Project Selection */}
        <div className="flex flex-col gap-6">
          {/* Credit Planner Card (§6.3) */}
          <Card className="border-accent-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-accent-primary" />
                  <span>Flow Credit Planner (§6.3)</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsEditingCredits(!isEditingCredits)}
                >
                  {isEditingCredits ? "Cancel" : "Edit Plan"}
                </Button>
              </div>
              <CardDescription className="text-xs">
                Manually maintained estimate — not verified by Google (§6.3).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditingCredits ? (
                <form onSubmit={handleSaveCredits} className="flex flex-col gap-3 text-xs">
                  <div>
                    <Label className="text-xs">Available Balance</Label>
                    <Input
                      type="number"
                      value={userBalance}
                      onChange={(e) => setUserBalance(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Est. Cost Per Video Generation</Label>
                    <Input
                      type="number"
                      value={costPerGen}
                      onChange={(e) => setCostPerGen(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Billing Reset Date</Label>
                    <Input
                      type="date"
                      value={resetDate}
                      onChange={(e) => setResetDate(e.target.value)}
                    />
                  </div>
                  <Button size="sm" type="submit" className="mt-1">
                    Save Planner Snapshot
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary/50 border border-border-subtle">
                    <div>
                      <span className="text-[11px] text-text-secondary block">Subscription</span>
                      <span className="font-semibold text-xs text-text-primary">
                        {creditSnapshot?.planLabel || "Google AI Pro"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-text-secondary block">Estimated Balance</span>
                      <span className="font-bold text-sm text-accent-primary">
                        {creditSnapshot?.userEnteredBalance ?? 1000} credits
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-surface-primary border border-border-subtle">
                      <span className="text-[10px] text-text-tertiary block">Est. Generations Left</span>
                      <span className="text-sm font-bold text-text-primary">{remainingGenerations} scenes</span>
                    </div>
                    <div className="p-2.5 rounded bg-surface-primary border border-border-subtle">
                      <span className="text-[10px] text-text-tertiary block">Reset Cycle</span>
                      <span className="text-xs font-medium text-text-primary">
                        {creditSnapshot?.billingResetDate || "Monthly"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-text-tertiary italic">
                    Note: Social Media Studio never silently charges APIs if Flow reaches limit.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project & Scene Selectors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Select Project & Scene</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div>
                <Label className="text-xs">Active Project</Label>
                <NativeSelect
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.aspectRatio})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs">Target Scene</Label>
                <div className="flex flex-col gap-1.5 mt-1">
                  {storyboard?.scenes?.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSceneId(s.id)}
                      className={`p-2 rounded text-left border transition-all ${
                        selectedSceneId === s.id
                          ? "border-accent-primary bg-accent-primary/10 text-text-primary"
                          : "border-border-subtle bg-surface-secondary/30 text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      <span className="font-medium">Scene {s.sceneNumber}: {s.title}</span>
                      <span className="text-[10px] text-text-tertiary block">{s.durationSeconds}s • {s.cameraMovement}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 2-Columns: Flow Generation Companion Card */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {companionPkg ? (
            <Card className="border-border-subtle">
              <CardHeader className="border-b border-border-subtle pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">
                      Scene {companionPkg.sceneNumber}: {companionPkg.title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Target Format: {companionPkg.aspectRatio} • Planned Duration: {companionPkg.durationSeconds}s
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1.5"
                    >
                      {isCopied ? <CheckCircle2 className="h-4 w-4 text-status-success-fg" /> : <Copy className="h-4 w-4" />}
                      {isCopied ? "Prompt Copied!" : "Copy Prompt Package"}
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleOpenFlow}
                      className="flex items-center gap-1.5 bg-accent-primary hover:bg-accent-primary/90 text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Google Flow
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-5 flex flex-col gap-5 text-xs">
                {/* 1. Composed Prompt Box */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-text-primary">
                      1. Composed Prompt with Consistency Locks (§9.4)
                    </span>
                    <Badge variant="neutral" className="text-[10px]">
                      Ready for Flow Prompt Field
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-secondary/70 border border-border-subtle font-mono text-[11px] leading-relaxed select-all">
                    {companionPkg.composedPrompt}
                  </div>
                </div>

                {/* 2. Negative Prompt */}
                <div>
                  <span className="font-semibold text-text-primary block mb-1">
                    2. Exclusions & Negative Prompt
                  </span>
                  <div className="p-2 rounded bg-surface-secondary/40 border border-border-subtle font-mono text-[11px] text-text-secondary select-all">
                    {companionPkg.negativePrompt}
                  </div>
                </div>

                {/* 3. Attached Locked Continuity Notes */}
                {companionPkg.attachedReferences?.length > 0 ? (
                  <div>
                    <span className="font-semibold text-text-primary block mb-1">
                      3. Locked References Included in Prompt
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {companionPkg.attachedReferences.map((ref, idx) => (
                        <div key={idx} className="p-2 rounded border border-border-subtle bg-surface-primary text-[11px]">
                          <strong>{ref.name}</strong> ({ref.type}): {ref.rules}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 4. Import Back Zone (§6.2 step 7) */}
                <div className="p-4 rounded-lg border-2 border-dashed border-accent-primary/40 bg-accent-primary/5 text-center mt-2">
                  <UploadCloud className="h-8 w-8 mx-auto text-accent-primary mb-2" />
                  <span className="font-semibold text-text-primary block text-sm">
                    4. Import Generated Clip from Google Flow
                  </span>
                  <p className="text-text-secondary text-[11px] mt-1 max-w-md mx-auto">
                    Once rendered in Flow, drag and drop the downloaded MP4 here or click to associate it with Scene {companionPkg.sceneNumber}.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Select MP4 File to Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 border border-border-subtle rounded-lg bg-surface-secondary/20">
              <Compass className="h-10 w-10 mx-auto text-text-tertiary mb-2" />
              <p className="text-sm font-semibold text-text-primary">Select a project and scene</p>
              <p className="text-xs text-text-secondary mt-1">
                Choose a scene from the left column to prepare its Google Flow generation package.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
