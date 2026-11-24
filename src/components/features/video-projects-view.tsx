"use client";

import * as React from "react";
import {
  Clapperboard,
  Plus,
  Play,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Film,
  Image as ImageIcon,
  Wand2,
  Edit3,
  Video,
  Monitor,
  Smartphone,
  Loader2,
  Trash2,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";
import type { WorkspaceSnapshot, StudioModuleId } from "@/hooks/use-studio-state";
import type {
  VideoProjectBrief,
  Storyboard,
  StoryboardScene,
  ReferenceEntity,
} from "@/types/domain";

interface VideoProjectsViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  announce: (msg: string) => void;
}

export function VideoProjectsView({
  snapshot,
  onNavigate,
  apiRequest,
  announce,
}: VideoProjectsViewProps) {
  const [projects, setProjects] = React.useState<VideoProjectBrief[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [storyboard, setStoryboard] = React.useState<Storyboard | null>(null);
  const [references, setReferences] = React.useState<ReferenceEntity[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isRenderingAll, setIsRenderingAll] = React.useState(false);

  // Quick Creator / Configuration state
  const [selectedBrandId, setSelectedBrandId] = React.useState(snapshot.brands[0]?.id || "");
  const [topicInput, setTopicInput] = React.useState("");
  const [keywordsInput, setKeywordsInput] = React.useState("");
  const [instructionsInput, setInstructionsInput] = React.useState("");
  const [aspectRatio, setAspectRatio] = React.useState<"9:16" | "16:9" | "1:1">("16:9");
  const [durationSeconds, setDurationSeconds] = React.useState(30);
  const [isAssistingInstructions, setIsAssistingInstructions] = React.useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);

  // Scene Editing & Refinement state
  const [editingScene, setEditingScene] = React.useState<StoryboardScene | null>(null);
  const [refineInstruction, setRefineInstruction] = React.useState("");
  const [isRefining, setIsRefining] = React.useState(false);
  const [isGeneratingSceneImg, setIsGeneratingSceneImg] = React.useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = React.useState<string | null>(null);
  const [renderedVideos, setRenderedVideos] = React.useState<Record<string, string>>({});
  const [activePreviewSceneId, setActivePreviewSceneId] = React.useState<string | null>(null);
  const [isSequencingFullVideo, setIsSequencingFullVideo] = React.useState(false);
  const [fullVideoPlayingIndex, setFullVideoPlayingIndex] = React.useState<number | null>(null);

  // Consistency Lock
  const [isAddingRef, setIsAddingRef] = React.useState(false);
  const [refName, setRefName] = React.useState("");
  const [refType, setRefType] = React.useState<import("@/types/domain").ReferenceEntityType>("vehicle");
  const [refDesc, setRefDesc] = React.useState("");
  const [refRules, setRefRules] = React.useState("");

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const selectedBrand = snapshot.brands.find((b) => b.id === (activeProject?.brandId || selectedBrandId));
  const videoGenerationsRef = React.useRef(snapshot.videoGenerations);
  React.useEffect(() => {
    videoGenerationsRef.current = snapshot.videoGenerations;
  }, [snapshot.videoGenerations]);

  // Load Projects
  const loadProjects = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest<{ projects: VideoProjectBrief[]; references: ReferenceEntity[] }>("/api/video-projects");
      setProjects(res.projects || []);
      setReferences(res.references || []);
      if (res.projects?.length) {
        setSelectedProjectId((prev) => prev || res.projects[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiRequest]);

  // Load Project Detail
  const loadProjectDetail = React.useCallback(
    async (projId: string) => {
      try {
        setIsLoading(true);
        const res = await apiRequest<{ project: VideoProjectBrief; storyboard: Storyboard; references: ReferenceEntity[] }>(
          `/api/video-projects?projectId=${projId}`
        );
        setStoryboard(res.storyboard || null);
        setReferences(res.references || []);
        if (res.storyboard?.scenes && res.storyboard.scenes.length > 0) {
          const map: Record<string, string> = {};
          const completedVids = videoGenerationsRef.current.filter((vg) => vg.status === "completed");
          res.storyboard.scenes.forEach((s, idx) => {
            const directMatch = completedVids.find((vg) => vg.creativeId === s.id);
            if (directMatch) {
              map[s.id] = `/api/videos/${directMatch.id}/file`;
            } else if (
              s.status === "generated" ||
              (res.storyboard.status === "approved" && s.status === "ready")
            ) {
              if (completedVids[idx]) {
                map[s.id] = `/api/videos/${completedVids[idx].id}/file`;
              } else if (completedVids[0]) {
                map[s.id] = `/api/videos/${completedVids[0].id}/file`;
              }
            }
          });
          setRenderedVideos(map);
          setActivePreviewSceneId(res.storyboard.scenes[0].id);
        } else {
          setRenderedVideos({});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [apiRequest]
  );

  React.useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  React.useEffect(() => {
    if (selectedProjectId) {
      void loadProjectDetail(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectDetail]);

  // Sync inputs with active project if switched
  React.useEffect(() => {
    if (activeProject) {
      setTopicInput(activeProject.productOrService || "");
      setAspectRatio(activeProject.aspectRatio as "9:16" | "16:9" | "1:1");
      setDurationSeconds(activeProject.desiredDurationSeconds || 30);
      setInstructionsInput(activeProject.creativeDirection || "");
    }
  }, [activeProject]);

  // 1. AI Assist: Write or Refine Instructions
  const handleAIAssistInstructions = async (mode: "write" | "refine") => {
    try {
      setIsAssistingInstructions(true);
      announce(mode === "refine" ? "AI is refining your instructions..." : "AI is drafting creative video instructions...");
      const res = await apiRequest<{ success: boolean; instructions: string }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assist_instructions",
          brandId: selectedBrandId,
          topic: topicInput.trim() || undefined,
          keywords: keywordsInput.trim() || undefined,
          currentInstructions: instructionsInput.trim() || undefined,
          mode,
        }),
      });

      if (res.instructions) {
        setInstructionsInput(res.instructions);
        announce("AI instructions generated and added!");
      }
    } catch (err: unknown) {
      announce(`AI assist failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAssistingInstructions(false);
    }
  };

  // 2. Generate Storyboard with Concept Images (Step 1 -> Step 2)
  const handleGenerateStoryboardFlow = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsGenerating(true);
      setRenderedVideos({});
      announce("Creating project & generating cinematic storyboard with concept imagery...");

      // Step A: Create or update project
      let currentProjId = selectedProjectId;
      if (!currentProjId || (selectedBrandId && activeProject?.brandId !== selectedBrandId)) {
        const createRes = await apiRequest<{ project: VideoProjectBrief; storyboard: Storyboard }>("/api/video-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_project",
            brandId: selectedBrandId || undefined,
            name: topicInput.trim() ? `${topicInput.trim()} Video` : `${selectedBrand?.name || "Brand"} Video Storyboard`,
            campaignObjective: keywordsInput.trim() ? `Highlight: ${keywordsInput.trim()}` : "Drive awareness and engagement",
            productOrService: topicInput.trim() || selectedBrand?.name || "Featured Product",
            targetAudience: "Social & Digital Audience",
            platform: aspectRatio === "16:9" ? "youtube" : "instagram",
            desiredDurationSeconds: durationSeconds,
            aspectRatio,
            visualStyle: "Cinematic Commercial",
            creativeDirection: instructionsInput.trim() || "Dynamic commercial narrative with sleek camera movements",
            voiceoverPreference: "Engaging commercial narrator",
            callToAction: "Discover more today",
          }),
        });
        currentProjId = createRes.project.id;
        setSelectedProjectId(currentProjId);
        await loadProjects();
      }

      // Step B: Generate the storyboard scenes
      const sbRes = await apiRequest<{ success: boolean; storyboard: Storyboard }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_storyboard",
          projectId: currentProjId,
          promptOverride: instructionsInput.trim() || undefined,
        }),
      });

      setStoryboard(sbRes.storyboard);
      announce("Storyboard created! Now generating visual concept stills for scenes...");

      // Step C: Automatically generate concept stills for initial scenes
      if (sbRes.storyboard?.scenes?.length) {
        for (const scene of sbRes.storyboard.scenes.slice(0, 3)) {
          try {
            await handleGenerateSceneImage(scene.id, undefined, currentProjId);
          } catch {
            // continue
          }
        }
      }
      announce("Storyboard & concept images ready! Review and edit scenes below.");
    } catch (err: unknown) {
      announce(`Storyboard generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Generate Scene Concept Image
  const handleGenerateSceneImage = async (sceneId: string, promptOverride?: string, projIdOverride?: string) => {
    const projId = projIdOverride || selectedProjectId;
    if (!projId) return;
    try {
      setIsGeneratingSceneImg(sceneId);
      const res = await apiRequest<{ success: boolean; scene: StoryboardScene; imageUrl: string }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_scene_image",
          projectId: projId,
          sceneId,
          promptOverride,
        }),
      });

      if (res.scene) {
        setStoryboard((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            scenes: prev.scenes.map((s) => (s.id === sceneId ? res.scene : s)),
          };
        });
        if (editingScene?.id === sceneId) {
          setEditingScene(res.scene);
        }
      }
      announce("Scene concept image generated!");
    } catch (err: unknown) {
      announce(`Image generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingSceneImg(null);
    }
  };

  // 4. Refine Scene via prompt
  const handleRefineScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScene || !selectedProjectId || !refineInstruction.trim()) return;

    try {
      setIsRefining(true);
      announce("Refining scene details...");
      const res = await apiRequest<{ success: boolean; scene: StoryboardScene }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine_scene",
          projectId: selectedProjectId,
          sceneId: editingScene.id,
          userInstruction: refineInstruction.trim(),
        }),
      });

      if (res.scene && storyboard) {
        setStoryboard({
          ...storyboard,
          scenes: storyboard.scenes.map((s) => (s.id === res.scene.id ? res.scene : s)),
        });
        setEditingScene(res.scene);
        setRefineInstruction("");
        announce("Scene refined! You can now regenerate the image still if needed.");
      }
    } catch (err: unknown) {
      announce(`Refinement failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRefining(false);
    }
  };

  // 4b. Save Manual Scene Field Edits
  const handleSaveSceneEdits = async () => {
    if (!editingScene || !selectedProjectId) return;
    try {
      const res = await apiRequest<{ success: boolean; scene: StoryboardScene }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_scene",
          projectId: selectedProjectId,
          sceneId: editingScene.id,
          updates: {
            title: editingScene.title,
            durationSeconds: editingScene.durationSeconds,
            visualDescription: editingScene.visualDescription,
            cameraMovement: editingScene.cameraMovement,
            lighting: editingScene.lighting,
            voiceover: editingScene.voiceover,
            imagePrompt: editingScene.imagePrompt,
            videoPrompt: editingScene.videoPrompt,
          },
        }),
      });
      if (res.scene && storyboard) {
        setStoryboard({
          ...storyboard,
          scenes: storyboard.scenes.map((s) => (s.id === res.scene.id ? res.scene : s)),
        });
      }
      setEditingScene(null);
      announce("Scene edits saved!");
    } catch (err: unknown) {
      announce(`Failed to save scene edits: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 4c. Delete Video Project
  const handleDeleteProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this video project and its storyboard?")) return;
    try {
      await apiRequest("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_project",
          projectId: projId,
        }),
      });
      const remaining = projects.filter((p) => p.id !== projId);
      setProjects(remaining);
      if (selectedProjectId === projId) {
        setSelectedProjectId(remaining[0]?.id ?? null);
        if (!remaining[0]) {
          setStoryboard(null);
          setRenderedVideos({});
        }
      }
      announce("Video project deleted.");
    } catch (err: unknown) {
      announce(`Failed to delete project: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 5. Approve Storyboard (Gate)
  const handleApproveStoryboard = async () => {
    if (!storyboard) return;
    try {
      const res = await apiRequest<{ success: boolean; storyboard: Storyboard }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_storyboard",
          storyboardId: storyboard.id,
        }),
      });
      setStoryboard(res.storyboard);
      announce("Storyboard approved! You can now render the scene videos.");
    } catch (err: unknown) {
      announce(`Approval failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 6. Generate Single Scene Video
  const handleGenerateSceneVideo = async (sceneId: string) => {
    if (!selectedProjectId) return;
    try {
      setIsRenderingVideo(sceneId);
      announce("Rendering video for this scene using AI video engine...");
      const res = await apiRequest<{ success: boolean; scene: StoryboardScene; videoUrl: string }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_scene_video",
          projectId: selectedProjectId,
          sceneId,
        }),
      });

      setRenderedVideos((prev) => ({ ...prev, [sceneId]: res.videoUrl }));
      setActivePreviewSceneId(sceneId);
      announce("Scene video rendered successfully! Preview available below.");
    } catch (err: unknown) {
      announce(`Video render failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRenderingVideo(null);
    }
  };

  // 7. Render All Scene Videos (Batch Action)
  const handleRenderAllSceneVideos = async () => {
    if (!storyboard?.scenes?.length || !selectedProjectId) return;
    try {
      setIsRenderingAll(true);
      announce("Rendering all scene videos in sequence...");
      for (const scene of storyboard.scenes) {
        if (!renderedVideos[scene.id]) {
          await handleGenerateSceneVideo(scene.id);
        }
      }
      announce("All scene videos rendered! You can now watch the full video.");
      setIsSequencingFullVideo(true);
      setFullVideoPlayingIndex(0);
    } catch (err: unknown) {
      announce(`Batch rendering stopped: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRenderingAll(false);
    }
  };

  // 8. Delete Handlers
  const handleDeleteSceneVideo = async (sceneId: string) => {
    if (!selectedProjectId) return;
    try {
      await apiRequest("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_scene_video",
          projectId: selectedProjectId,
          sceneId,
        }),
      });

      setRenderedVideos((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });

      if (storyboard) {
        setStoryboard({
          ...storyboard,
          scenes: storyboard.scenes.map((s) => (s.id === sceneId ? { ...s, status: "draft" } : s)),
        });
      }
      announce("Scene video deleted.");
    } catch (err: unknown) {
      announce(`Failed to delete scene video: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteStoryboard = async () => {
    if (!storyboard || !selectedProjectId) return;
    if (!window.confirm("Are you sure you want to delete this storyboard and all its scenes?")) return;
    try {
      await apiRequest("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_storyboard",
          storyboardId: storyboard.id,
          projectId: selectedProjectId,
        }),
      });
      setStoryboard(null);
      setRenderedVideos({});
      announce("Storyboard deleted successfully.");
    } catch (err: unknown) {
      announce(`Failed to delete storyboard: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!storyboard || !selectedProjectId) return;
    try {
      const res = await apiRequest<{ success: boolean; storyboard: Storyboard | null }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_scene",
          sceneId,
          projectId: selectedProjectId,
        }),
      });

      if (res.storyboard) {
        setStoryboard(res.storyboard);
      } else {
        setStoryboard({
          ...storyboard,
          scenes: storyboard.scenes.filter((s) => s.id !== sceneId),
        });
      }

      setRenderedVideos((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
      announce("Scene removed from storyboard.");
    } catch (err: unknown) {
      announce(`Failed to delete scene: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName.trim() || !refDesc.trim()) return;

    try {
      const res = await apiRequest<{ success: boolean; reference: ReferenceEntity }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_reference",
          projectId: selectedProjectId,
          name: refName,
          type: refType,
          userApprovedDescription: refDesc,
          distinguishingAttributes: [refDesc],
          continuityRules: refRules || "Preserve identical appearance and finish across every scene.",
        }),
      });

      setReferences((prev) => [res.reference, ...prev]);
      setIsAddingRef(false);
      setRefName("");
      setRefDesc("");
      setRefRules("");
      announce(`Consistency Lock created for ${res.reference.name}`);
    } catch (err: unknown) {
      announce(`Failed to create reference: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteReference = async (referenceId: string) => {
    try {
      await apiRequest("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_reference",
          referenceId,
        }),
      });
      setReferences((prev) => prev.filter((r) => r.id !== referenceId));
      announce("Consistency lock reference deleted.");
    } catch (err: unknown) {
      announce(`Failed to delete reference: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const isStoryboardApproved = storyboard?.status === "approved";
  const renderedCount = Object.keys(renderedVideos).length;
  const totalScenes = storyboard?.scenes?.length || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <Film className="h-6 w-6 text-accent-primary" />
              Video Studio
            </h1>
            <Badge variant="info">AI Storyboard & Video Production</Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Enter your topic and keywords, refine instructions with AI, generate an editable scene storyboard, and produce your final video.
          </p>
        </div>

        {/* Step Guide Indicator */}
        <div className="flex items-center gap-2 text-xs bg-surface-secondary/70 px-3 py-1.5 rounded-lg border border-border-subtle">
          <span className={`flex items-center gap-1 font-medium ${!storyboard ? "text-accent-primary font-bold" : "text-text-secondary"}`}>
            <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-[10px]">1</span>
            Topic & Instructions
          </span>
          <ArrowRight className="h-3 w-3 text-text-tertiary" />
          <span className={`flex items-center gap-1 font-medium ${storyboard && !isStoryboardApproved ? "text-accent-primary font-bold" : "text-text-secondary"}`}>
            <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-[10px]">2</span>
            Edit Storyboard & Stills
          </span>
          <ArrowRight className="h-3 w-3 text-text-tertiary" />
          <span className={`flex items-center gap-1 font-medium ${isStoryboardApproved ? "text-status-success-fg font-bold" : "text-text-secondary"}`}>
            <span className="w-5 h-5 rounded-full bg-status-success-bg text-status-success-fg flex items-center justify-center text-[10px]">3</span>
            Render Videos
          </span>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (4 cols): Step 1 - Topic, Keywords & AI Instructions Panel  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* STEP 1: Video Brief Configuration */}
          <Card className="border-accent-primary/30 shadow-sm">
            <CardHeader className="pb-3 border-b border-border-subtle bg-surface-secondary/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-accent-primary text-white flex items-center justify-center text-[11px] font-bold">1</span>
                  <span>Video Brief & Instructions</span>
                </CardTitle>
                <Badge variant="neutral" className="text-[10px]">Step 1</Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Tell AI what you want to create. Leave blank to auto-review your brand domain.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleGenerateStoryboardFlow} className="flex flex-col gap-4">
                {/* Brand Selector */}
                <div>
                  <Label htmlFor="brand-select" className="text-xs font-medium">Brand / Workspace</Label>
                  <NativeSelect
                    id="brand-select"
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="mt-1 text-xs"
                  >
                    {snapshot.brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.domain || "No domain"})
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {/* Topic */}
                <div>
                  <Label htmlFor="topic-input" className="text-xs font-medium flex items-center justify-between">
                    <span>Topic or Product Name</span>
                    <span className="text-[10px] text-text-tertiary">Required</span>
                  </Label>
                  <Input
                    id="topic-input"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g. Electric Hypercar Reveal, Winter Sneaker Drop..."
                    className="mt-1 text-xs"
                    required
                  />
                </div>

                {/* Keywords */}
                <div>
                  <Label htmlFor="keywords-input" className="text-xs font-medium">
                    Keywords / Key Themes (Comma-separated)
                  </Label>
                  <Input
                    id="keywords-input"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="e.g. 0-60 in 1.9s, aerofoil carbon, luxury sunset, midnight blue"
                    className="mt-1 text-xs"
                  />
                </div>

                {/* Instructions with AI Assistant Actions */}
                <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-accent-primary/30 bg-accent-primary/5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instructions-input" className="text-xs font-semibold text-accent-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Director Instructions (Creative Direction)
                    </Label>
                  </div>
                  
                  <Textarea
                    id="instructions-input"
                    value={instructionsInput}
                    onChange={(e) => setInstructionsInput(e.target.value)}
                    placeholder="Add specific instructions (e.g. high-energy camera cuts, ambient electronic score, futuristic tone) or use the AI buttons below..."
                    className="text-xs min-h-[75px] bg-surface-primary"
                  />

                  {/* AI Assistance CTAs */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2.5 flex items-center gap-1 bg-surface-primary hover:bg-accent-primary/10 hover:text-accent-primary"
                      disabled={isAssistingInstructions}
                      onClick={() => handleAIAssistInstructions("write")}
                    >
                      {isAssistingInstructions ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3 text-accent-primary" />
                      )}
                      <span>Write Instructions with AI</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2.5 flex items-center gap-1 bg-surface-primary hover:bg-accent-primary/10 hover:text-accent-primary"
                      disabled={isAssistingInstructions || !instructionsInput.trim()}
                      onClick={() => handleAIAssistInstructions("refine")}
                    >
                      {isAssistingInstructions ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 text-accent-primary" />
                      )}
                      <span>Refine with AI</span>
                    </Button>
                  </div>
                </div>

                {/* Collapsible Format & Duration Settings */}
                <div className="border-t border-border-subtle pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center justify-between w-full text-xs text-text-secondary hover:text-text-primary py-1"
                  >
                    <span className="font-medium">Video Format & Duration</span>
                    {showAdvancedSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showAdvancedSettings && (
                    <div className="flex flex-col gap-3 pt-2">
                      {/* Orientation */}
                      <div>
                        <Label className="text-xs">Aspect Ratio</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setAspectRatio("16:9")}
                            className={`flex items-center justify-center gap-1.5 p-2 rounded border text-xs font-medium transition-all ${
                              aspectRatio === "16:9"
                                ? "border-accent-primary bg-accent-primary/10 text-text-primary"
                                : "border-border-subtle bg-surface-secondary/40 text-text-secondary"
                            }`}
                          >
                            <Monitor className="h-3.5 w-3.5 text-accent-primary" />
                            Landscape (16:9)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAspectRatio("9:16")}
                            className={`flex items-center justify-center gap-1.5 p-2 rounded border text-xs font-medium transition-all ${
                              aspectRatio === "9:16"
                                ? "border-accent-primary bg-accent-primary/10 text-text-primary"
                                : "border-border-subtle bg-surface-secondary/40 text-text-secondary"
                            }`}
                          >
                            <Smartphone className="h-3.5 w-3.5 text-accent-primary" />
                            Portrait (9:16)
                          </button>
                        </div>
                      </div>

                      {/* Duration */}
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {[15, 30, 60, 90].map((sec) => (
                            <Button
                              key={sec}
                              type="button"
                              variant={durationSeconds === sec ? "primary" : "outline"}
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => setDurationSeconds(sec)}
                            >
                              {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary CTA: Generate Storyboard */}
                <Button
                  type="submit"
                  size="md"
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold py-2.5 shadow"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Directing & Generating Storyboard...</span>
                    </>
                  ) : (
                    <>
                      <Clapperboard className="h-4 w-4" />
                      <span>Generate Storyboard & Images</span>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Past Video Campaigns (Picker) */}
          {projects.length > 0 && (
            <Card>
              <CardHeader className="py-2.5 px-4 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Your Video Projects</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setSelectedProjectId(null);
                        setStoryboard(null);
                        setRenderedVideos({});
                        setTopicInput("");
                        setKeywordsInput("");
                        setInstructionsInput("");
                      }}
                    >
                      <Plus className="h-2.5 w-2.5 mr-1" /> New
                    </Button>
                    <Badge variant="neutral" className="text-[10px]">{projects.length}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`flex items-center justify-between p-2 rounded text-left transition-all text-xs cursor-pointer ${
                      selectedProjectId === p.id
                        ? "bg-accent-primary/10 text-text-primary font-semibold border border-accent-primary/40"
                        : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary border border-transparent"
                    }`}
                  >
                    <span className="line-clamp-1 flex-1">{p.name}</span>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <span className="text-[10px] text-text-tertiary uppercase">
                        {p.aspectRatio} • {p.desiredDurationSeconds}s
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        title="Delete video project"
                        aria-label={`Delete project ${p.name}`}
                        className="p-1 rounded text-text-tertiary hover:text-status-error-fg hover:bg-status-error-bg/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Consistency Lock Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-text-primary">
                  <Lock className="h-3.5 w-3.5 text-accent-primary" />
                  <span>Consistency Lock</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setIsAddingRef(!isAddingRef)}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" /> Add
                </Button>
              </div>
              <CardDescription className="text-[11px]">
                Lock key vehicles or subjects across every cut.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {isAddingRef && (
                <form onSubmit={handleCreateReference} className="flex flex-col gap-2 p-2.5 rounded border border-border-subtle bg-surface-secondary/40 text-xs">
                  <Input
                    value={refName}
                    onChange={(e) => setRefName(e.target.value)}
                    placeholder="Entity Name (e.g. Nordic EV Blue)"
                    className="text-xs h-7"
                    required
                  />
                  <Input
                    value={refDesc}
                    onChange={(e) => setRefDesc(e.target.value)}
                    placeholder="Visual description (color, rims, shape)"
                    className="text-xs h-7"
                    required
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button variant="ghost" size="sm" type="button" className="h-6 text-xs" onClick={() => setIsAddingRef(false)}>Cancel</Button>
                    <Button size="sm" type="submit" className="h-6 text-xs">Lock</Button>
                  </div>
                </form>
              )}

              {references.map((r) => (
                <div key={r.id} className="p-2 rounded border border-border-subtle bg-surface-secondary/30 text-xs flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold text-[11px] text-text-primary">{r.name}</span>
                    <span className="text-[10px] text-text-secondary line-clamp-1">{r.userApprovedDescription}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-text-tertiary hover:text-status-error-fg"
                    onClick={() => handleDeleteReference(r.id)}
                    title="Delete reference"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (8 cols): Step 2 & 3 - Interactive Storyboard & Video Player */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {storyboard?.scenes && storyboard.scenes.length > 0 ? (
            <>
              {/* STEP 2: Storyboard Review & Approval Bar */}
              <Card className="border-border-subtle">
                <CardHeader className="pb-3 border-b border-border-subtle bg-surface-secondary/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent-primary text-white flex items-center justify-center text-[11px] font-bold">2</span>
                        <CardTitle className="text-base font-bold">
                          {activeProject?.name || "Video Storyboard"} ({storyboard.scenes.length} Scenes)
                        </CardTitle>
                        {isStoryboardApproved ? (
                          <Badge variant="success" className="text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Approved for Video
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">
                            Draft Storyboard
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Review scene prompts, edit narration, or click <strong>Regen Image</strong>. When you are satisfied, click <strong>Approve Storyboard</strong> to unlock video rendering.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Approve Storyboard CTA */}
                      {!isStoryboardApproved ? (
                        <Button
                          size="sm"
                          onClick={handleApproveStoryboard}
                          className="flex items-center gap-1.5 bg-status-success-fg hover:bg-status-success-fg/90 text-white font-semibold text-xs shadow"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Approve Storyboard</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleRenderAllSceneVideos}
                          disabled={isRenderingAll}
                          className="flex items-center gap-1.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold text-xs shadow"
                        >
                          {isRenderingAll ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-current" />
                          )}
                          <span>Render All Videos ({renderedCount}/{totalScenes})</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteStoryboard}
                        className="text-status-error-fg hover:bg-status-error-bg/20 hover:text-status-error-fg border-status-error-border/60 text-xs h-8"
                        title="Delete entire storyboard"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5">
                  {/* Approval Warning Banner */}
                  {!isStoryboardApproved && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-status-warning-border bg-status-warning-bg/20 text-status-warning-fg mb-5 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-xs">Step 2: Review and Approve Storyboard</span>
                        <p className="mt-0.5 text-text-secondary text-[11px]">
                          Each scene below contains a concept still, camera movements, and voiceover. You can edit any scene or regenerate stills. Click <strong>Approve Storyboard</strong> when ready to render the final video parts.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Storyboard Scenes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {storyboard.scenes.map((scene) => (
                      <Card
                        key={scene.id}
                        className="border-border-subtle overflow-hidden flex flex-col justify-between group hover:border-accent-primary/60 transition-all bg-surface-primary"
                      >
                        <div>
                          {/* Concept Image Preview */}
                          <div className="relative aspect-video bg-surface-secondary flex items-center justify-center overflow-hidden border-b border-border-subtle">
                            {scene.referenceImageUrl ? (
                              <img
                                src={scene.referenceImageUrl}
                                alt={`Scene ${scene.sceneNumber} concept still`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                                <ImageIcon className="h-6 w-6 text-text-tertiary" />
                                <span className="text-[10px] text-text-secondary">No concept image</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  disabled={isGeneratingSceneImg === scene.id}
                                  onClick={() => handleGenerateSceneImage(scene.id)}
                                >
                                  {isGeneratingSceneImg === scene.id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="h-3 w-3 mr-1" />
                                      Generate Still
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}

                            {/* Badge overlay */}
                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              <Badge variant="neutral" className="bg-surface-primary/90 backdrop-blur-sm text-[10px] shadow-sm">
                                Scene {scene.sceneNumber} • {scene.durationSeconds}s
                              </Badge>
                            </div>

                            {/* Regenerate Image Button */}
                            {scene.referenceImageUrl && (
                              <div className="absolute bottom-2 right-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 bg-surface-primary/90 backdrop-blur-sm hover:bg-surface-primary"
                                  disabled={isGeneratingSceneImg === scene.id}
                                  onClick={() => handleGenerateSceneImage(scene.id)}
                                  title="Regenerate this concept image"
                                >
                                  <RotateCcw className="h-2.5 w-2.5 mr-1" />
                                  Regen Image
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Scene Details */}
                          <div className="p-3 flex flex-col gap-2">
                            <span className="font-semibold text-xs text-text-primary line-clamp-1">
                              {scene.title}
                            </span>
                            <p className="text-text-secondary text-[11px] line-clamp-2">
                              {scene.visualDescription}
                            </p>

                            <div className="bg-surface-secondary/40 p-2 rounded text-[10px] text-text-secondary flex flex-col gap-1">
                              <div><strong className="text-text-primary">Camera:</strong> {scene.cameraMovement} ({scene.cameraFraming})</div>
                              <div><strong className="text-text-primary">Lighting:</strong> {scene.lighting}</div>
                            </div>

                            {scene.voiceover && (
                              <p className="text-text-primary italic text-[10px] line-clamp-2 border-l-2 border-accent-primary/50 pl-2">
                                "{scene.voiceover}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Scene Actions */}
                        <div className="p-2.5 pt-0 border-t border-border-subtle bg-surface-primary flex items-center justify-between mt-1 gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs flex items-center gap-1 text-text-primary flex-1"
                            onClick={() => {
                              setEditingScene(scene);
                              setRefineInstruction("");
                            }}
                          >
                            <Edit3 className="h-3 w-3 text-accent-primary" />
                            Edit Scene
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-text-tertiary hover:text-status-error-fg"
                            title="Delete scene from storyboard"
                            onClick={() => handleDeleteScene(scene.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          {renderedVideos[scene.id] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-status-warning-fg hover:text-status-error-fg"
                              title="Delete rendered video only"
                              onClick={() => handleDeleteSceneVideo(scene.id)}
                            >
                              <Video className="h-3.5 w-3.5 line-through opacity-75" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant={renderedVideos[scene.id] ? "primary" : isStoryboardApproved ? "primary" : "outline"}
                            className="h-7 text-xs flex items-center gap-1 flex-1"
                            disabled={isRenderingVideo === scene.id || (!isStoryboardApproved && !renderedVideos[scene.id])}
                            title={!isStoryboardApproved ? "Approve Storyboard above first to render video" : undefined}
                            onClick={() => handleGenerateSceneVideo(scene.id)}
                          >
                            {isRenderingVideo === scene.id ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Rendering...
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 fill-current" />
                                {renderedVideos[scene.id] ? "Re-Render" : "Render Video"}
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* ========================================================================= */}
              {/* STEP 3: Rendered Videos Section (Full Continuous Sequencer + Parts)       */}
              {/* ========================================================================= */}
              {renderedCount > 0 && (
                <Card className="border-status-success-border bg-surface-secondary/20">
                  <CardHeader className="pb-3 border-b border-border-subtle">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-status-success-fg text-white flex items-center justify-center text-[11px] font-bold">3</span>
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Video className="h-4 w-4 text-status-success-fg" />
                            <span>Rendered Videos ({renderedCount} of {totalScenes} Ready)</span>
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          Watch the full video played in sequential parts, or inspect individual scene clips below.
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isSequencingFullVideo ? "outline" : "primary"}
                          onClick={() => {
                            setIsSequencingFullVideo(!isSequencingFullVideo);
                            setFullVideoPlayingIndex(0);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          {isSequencingFullVideo ? "Hide Full Video" : "Play Full Video Together"}
                        </Button>
                        <Badge variant="success" className="text-xs">
                          {renderedCount === totalScenes ? "Full Video Completed" : "Rendering Ready"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 flex flex-col gap-6">
                    {/* Full Video Continuous Sequencer */}
                    {isSequencingFullVideo && (
                      <div className="p-4 rounded-xl border border-accent-primary/40 bg-surface-primary/95 flex flex-col items-center shadow-md">
                        <div className="w-full flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="info" className="text-xs">Continuous Playback</Badge>
                            <span className="text-xs font-semibold text-text-primary">
                              Part {(fullVideoPlayingIndex ?? 0) + 1} of {storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id])).length}: {storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id]))[fullVideoPlayingIndex ?? 0]?.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-text-secondary">Autoplays all parts in continuous sequence</span>
                        </div>

                        <div className="max-w-md w-full aspect-video rounded-lg overflow-hidden bg-black border border-border-strong relative shadow-lg">
                          {storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id]))[fullVideoPlayingIndex ?? 0] ? (
                            <video
                              key={storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id]))[fullVideoPlayingIndex ?? 0]?.id}
                              src={renderedVideos[storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id]))[fullVideoPlayingIndex ?? 0]?.id]}
                              controls
                              autoPlay
                              playsInline
                              onEnded={() => {
                                const renderedList = storyboard.scenes.filter((s) => Boolean(renderedVideos[s.id]));
                                setFullVideoPlayingIndex((prev) => ((prev ?? 0) + 1) % renderedList.length);
                              }}
                              className="w-full h-full object-contain"
                            />
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          {storyboard.scenes
                            .filter((s) => Boolean(renderedVideos[s.id]))
                            .map((s, idx) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setFullVideoPlayingIndex(idx)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                                  (fullVideoPlayingIndex ?? 0) === idx
                                    ? "bg-accent-primary text-white"
                                    : "bg-surface-secondary text-text-secondary hover:text-text-primary border border-border-subtle"
                                }`}
                              >
                                Part {idx + 1}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Side-by-Side Scene Videos Grid */}
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-3">
                        Individual Scene Parts (Side-by-Side)
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {storyboard.scenes
                          .filter((scene) => Boolean(renderedVideos[scene.id]))
                          .map((scene) => (
                            <div
                              key={scene.id}
                              className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${
                                activePreviewSceneId === scene.id
                                  ? "border-accent-primary bg-surface-primary shadow-sm"
                                  : "border-border-subtle bg-surface-primary/70"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="line-clamp-1 text-text-primary">
                                  Scene {scene.sceneNumber}: {scene.title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="neutral" className="text-[10px]">
                                    {scene.durationSeconds}s
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-text-tertiary hover:text-status-error-fg"
                                    title="Delete video"
                                    onClick={() => handleDeleteSceneVideo(scene.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="relative aspect-video rounded-md overflow-hidden bg-black border border-border-subtle">
                                <video
                                  src={renderedVideos[scene.id]}
                                  controls
                                  playsInline
                                  loop
                                  onPlay={() => setActivePreviewSceneId(scene.id)}
                                  className="w-full h-full object-contain"
                                />
                              </div>

                              <p className="text-[11px] text-text-secondary line-clamp-1">
                                {scene.cameraMovement} • {scene.lighting}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Empty State Guide */
            <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-subtle rounded-xl bg-surface-secondary/20 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-4">
                <Clapperboard className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-text-primary">Ready to Create Your Video Storyboard</h3>
              <p className="text-xs text-text-secondary max-w-md mt-1 mb-6">
                Fill in your topic and keywords in <strong>Step 1</strong> on the left, use the AI assistant to write or polish your creative instructions, and click <strong>Generate Storyboard & Images</strong>.
              </p>
              <div className="flex items-center gap-3 text-xs text-text-tertiary">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-primary" /> AI Domain Review
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-primary" /> Concept Stills
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-primary" /> Full Video Sequencer
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit & Refine Scene Modal */}
      {editingScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-xl w-full bg-surface-primary border-border-strong shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="border-b border-border-subtle pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-accent-primary" />
                  Edit Scene {editingScene.sceneNumber}: {editingScene.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditingScene(null)}
                >
                  ✕
                </Button>
              </div>
              <CardDescription className="text-xs">
                Edit scene details directly or prompt AI to refine camera motion, visual style, or narration.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Concept Image Preview */}
              {editingScene.referenceImageUrl && (
                <div className="relative aspect-video rounded border border-border-subtle overflow-hidden">
                  <img
                    src={editingScene.referenceImageUrl}
                    alt="Scene concept still"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-surface-primary/90"
                      disabled={isGeneratingSceneImg === editingScene.id}
                      onClick={() => handleGenerateSceneImage(editingScene.id)}
                    >
                      Regenerate Image
                    </Button>
                  </div>
                </div>
              )}

              {/* Prompt Refinement Bar */}
              <form onSubmit={handleRefineScene} className="flex flex-col gap-2 p-3 rounded-lg border border-accent-primary/30 bg-accent-primary/5">
                <Label className="text-xs font-semibold text-accent-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tweak Scene Through Prompting
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={refineInstruction}
                    onChange={(e) => setRefineInstruction(e.target.value)}
                    placeholder="e.g. Change camera to high-angle crane shot with sunset reflections..."
                    className="text-xs"
                    required
                  />
                  <Button size="sm" type="submit" disabled={isRefining} className="shrink-0 text-xs">
                    {isRefining ? "Applying..." : "Refine Scene"}
                  </Button>
                </div>
              </form>

              {/* Direct Field Overrides */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <Label className="text-xs">Scene Title</Label>
                  <Input
                    value={editingScene.title}
                    onChange={(e) => setEditingScene({ ...editingScene, title: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={editingScene.durationSeconds}
                    onChange={(e) => setEditingScene({ ...editingScene, durationSeconds: Number(e.target.value) })}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Visual Description</Label>
                  <Input
                    value={editingScene.visualDescription}
                    onChange={(e) => setEditingScene({ ...editingScene, visualDescription: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Camera Movement</Label>
                  <Input
                    value={editingScene.cameraMovement}
                    onChange={(e) => setEditingScene({ ...editingScene, cameraMovement: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Lighting & Atmosphere</Label>
                  <Input
                    value={editingScene.lighting}
                    onChange={(e) => setEditingScene({ ...editingScene, lighting: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Voiceover Narration</Label>
                  <Input
                    value={editingScene.voiceover}
                    onChange={(e) => setEditingScene({ ...editingScene, voiceover: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Image Still Prompt</Label>
                  <Input
                    value={editingScene.imagePrompt}
                    onChange={(e) => setEditingScene({ ...editingScene, imagePrompt: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Video Motion Prompt</Label>
                  <Input
                    value={editingScene.videoPrompt}
                    onChange={(e) => setEditingScene({ ...editingScene, videoPrompt: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-border-subtle">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={isGeneratingSceneImg === editingScene.id}
                  onClick={() => handleGenerateSceneImage(editingScene.id, editingScene.imagePrompt)}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  {isGeneratingSceneImg === editingScene.id ? "Rendering Still..." : "Generate Concept Still"}
                </Button>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingScene(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveSceneEdits}>
                    Save Scene Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
