"use client";

import * as React from "react";
import {
  Wand2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  History,
  Upload,
  Globe,
  Car,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Copy,
  Trash2,
  Eye,
  ShieldCheck,
  MessageSquare,
  Send,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Campaign,
  CampaignInputMode,
  Creative,
  CreativeAudit,
  GeminiModelId,
  LogoPlacement,
  SocialPlatform,
  SupportiveGraphicStyle,
} from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface CreativeStudioViewProps {
  studioPrefill?: { topic: string; seoKeywords: string[] } | null;
  onConsumePrefill?: () => void;
  snapshot: WorkspaceSnapshot;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  selectedCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  selectedCreativeId: string;
  onSelectCreative: (creativeId: string) => void;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

const CLEAN_HERO_VISUAL_OPTIONS: Array<{
  id: SupportiveGraphicStyle;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  {
    id: "auto_topic",
    label: "Auto Detect",
    hint: "Gemini matches topic & site reference",
    icon: Sparkles,
  },
  {
    id: "domain_images",
    label: "Site Reference Style",
    hint: "Gemini creates new art from site refs",
    icon: ImageIcon,
  },
  {
    id: "vehicle_showcase",
    label: "Automotive Photography",
    hint: "Real-time DSLR vehicle photography",
    icon: Car,
  },
  {
    id: "product_spotlight",
    label: "Commercial Studio",
    hint: "High-end product & brand photography",
    icon: Layers,
  },
];

const VARIATION_LAYOUT_OPTIONS: Array<{
  index: 1 | 2 | 3;
  title: string;
  description: string;
}> = [
  {
    index: 1,
    title: "Option 1: Magazine Bar",
    description: "Full-bleed image + sleek anchored bottom bar",
  },
  {
    index: 2,
    title: "Option 2: Floating Card",
    description: "Full-bleed image + rounded floating brand deck",
  },
  {
    index: 3,
    title: "Option 3: Framed Poster",
    description: "Accent border frame + centered headline dock",
  },
];

export function CreativeStudioView({
  studioPrefill,
  onConsumePrefill,
  snapshot,
  selectedBrandId,
  onSelectBrand,
  selectedCampaignId,
  onSelectCampaign,
  selectedCreativeId,
  onSelectCreative,
  onNavigate,
  apiRequest,
  announce,
}: CreativeStudioViewProps) {
  const activeBrand =
    snapshot.brands.find((b) => b.id === selectedBrandId) ?? snapshot.brands[0];
  const activeBrandKit =
    snapshot.brandKits.find((k) => k.id === activeBrand?.activeKitId) ??
    snapshot.brandKits.find((k) => k.brandId === activeBrand?.id);

  const domainImages = activeBrandKit?.extractionMeta.extractedImages ?? [];
  const detectedTopicLabel =
    activeBrandKit?.extractionMeta.detectedTopic?.replace("_", " ") ?? "general";

  // Clean form state
  const [campaignName, setCampaignName] = React.useState("");
  const [inputMode, setInputMode] =
    React.useState<CampaignInputMode>("website_grounded");
  const [topic, setTopic] = React.useState("");
  const [seoKeywordsRaw, setSeoKeywordsRaw] = React.useState("");
  const [supportiveGraphicStyle, setSupportiveGraphicStyle] =
    React.useState<SupportiveGraphicStyle>("auto_topic");
  const [includeSupportiveBadges, setIncludeSupportiveBadges] =
    React.useState<boolean>(true);
  const [supportiveBadgeText, setSupportiveBadgeText] = React.useState("");
  const [selectedDomainImageUrl, setSelectedDomainImageUrl] =
    React.useState<string>("");
  const [aiModel] =
    React.useState<GeminiModelId>("gemini_unified");
  const [geminiKeyInput, setGeminiKeyInput] = React.useState("");

  // Power to select visual options between 1 to 3
  const [selectedVariations, setSelectedVariations] = React.useState<
    Array<1 | 2 | 3>
  >([1, 2, 3]);

  // Manual Content Fields
  const [manualTitle, setManualTitle] = React.useState("");
  const [manualSupporting, setManualSupporting] = React.useState("");
  const [manualMainText, setManualMainText] = React.useState("");
  const [manualHashtags, setManualHashtags] = React.useState("");

  // Selected Platform Presets
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!studioPrefill) return;
    setTopic(studioPrefill.topic);
    setSeoKeywordsRaw(studioPrefill.seoKeywords.join(", "));
    onConsumePrefill?.();
  }, [studioPrefill, onConsumePrefill]);

  React.useEffect(() => {
    if (selectedPresetIds.length === 0 && snapshot.presets.length > 0) {
      const igSquare = snapshot.presets.find(
        (p) => p.platform === "instagram" && p.formatName === "Square"
      );
      if (igSquare) {
        setSelectedPresetIds([igSquare.id]);
      }
    }
  }, [snapshot.presets, selectedPresetIds.length]);

  const [platformFilter, setPlatformFilter] = React.useState<
    "all" | SocialPlatform
  >("all");
  const [studioError, setStudioError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Autonomous Gemini AI Image Prompt Architect State
  const [autonomousPrompts, setAutonomousPrompts] = React.useState<
    Partial<
      Record<
        1 | 2 | 3,
        {
          sceneConcept?: string;
          badgeLabel?: string;
          finalPrompt: string;
          directorUsed: string;
        }
      >
    >
  >({});
  const [isDraftingPrompts, setIsDraftingPrompts] = React.useState(false);

  // Multi-select checkboxes for generated posts
  const [checkedPostIds, setCheckedPostIds] = React.useState<string[]>([]);

  const activeCampaign =
    snapshot.campaigns.find((c) => c.id === selectedCampaignId) ??
    snapshot.campaigns[0];

  const campaignCreatives = snapshot.creatives.filter((c) =>
    activeCampaign ? c.campaignId === activeCampaign.id : true
  );
  const filteredCreatives = campaignCreatives.filter((c) =>
    platformFilter === "all" ? true : c.platform === platformFilter
  );

  const activeCreative: Creative | undefined =
    campaignCreatives.find((c) => c.id === selectedCreativeId) ??
    filteredCreatives[0] ??
    campaignCreatives[0];

  // Editor State
  const [editTitle, setEditTitle] = React.useState("");
  const [editSupporting, setEditSupporting] = React.useState("");
  const [editCaption, setEditCaption] = React.useState("");
  const [editHashtags, setEditHashtags] = React.useState("");
  const [editLogoPlacement, setEditLogoPlacement] =
    React.useState<LogoPlacement>("top-left");
  const [editAlignment, setEditAlignment] = React.useState<"left" | "center">(
    "left"
  );
  const [editHeadingScale, setEditHeadingScale] = React.useState("1");
  const [editSurfaceMode, setEditSurfaceMode] = React.useState<
    "dark" | "light" | "primary"
  >("dark");
  const [editAccentOverride, setEditAccentOverride] = React.useState("");
  const [editGraphicStyle, setEditGraphicStyle] =
    React.useState<SupportiveGraphicStyle>("auto_topic");
  const [editBadgeText, setEditBadgeText] = React.useState("");
  const [editShowBadges, setEditShowBadges] = React.useState(true);

  // Interactive Stage, Vision Audit & Gemini Co-Pilot State
  const [stageMode, setStageMode] = React.useState<
    "live_stage" | "instagram" | "linkedin" | "rendered_png"
  >("live_stage");
  const [isAuditingVision, setIsAuditingVision] = React.useState(false);
  const [copilotInput, setCopilotInput] = React.useState("");
  const [isRunningCopilot, setIsRunningCopilot] = React.useState(false);
  const [copilotError, setCopilotError] = React.useState<string | null>(null);
  const [copilotMessagesByCreative, setCopilotMessagesByCreative] =
    React.useState<
      Record<
        string,
        Array<{ role: "user" | "assistant"; text: string; modelUsed?: string }>
      >
    >({});

  const activeBrandForStage = activeCreative
    ? snapshot.brands.find((b) => b.id === activeCreative.brandId)
    : undefined;
  const activeBrandKitForStage = activeCreative
    ? snapshot.brandKits.find((k) => k.id === activeCreative.brandKitId)
    : undefined;
  const activeAudit: CreativeAudit | undefined = activeCreative
    ? snapshot.creativeAudits.find(
        (a) =>
          a.creativeId === activeCreative.id &&
          a.versionId === activeCreative.currentVersionId
      ) ??
      snapshot.creativeAudits.find((a) => a.creativeId === activeCreative.id)
    : undefined;
  const activeCopilotThread = activeCreative
    ? copilotMessagesByCreative[activeCreative.id] ?? []
    : [];

  React.useEffect(() => {
    const ver = activeCreative?.currentVersion;
    if (!ver) return;
    setEditTitle(ver.textOverrides.postTitle);
    setEditSupporting(ver.textOverrides.supportingCopy);
    setEditCaption(ver.textOverrides.caption);
    setEditHashtags(ver.textOverrides.hashtags.join(" "));
    setEditLogoPlacement(ver.layoutOverrides.logoPlacement);
    setEditAlignment(ver.layoutOverrides.textAlignment);
    setEditHeadingScale(String(ver.layoutOverrides.headingScaleMultiplier));
    setEditSurfaceMode(ver.layoutOverrides.surfaceMode);
    setEditAccentOverride(ver.layoutOverrides.accentColorOverride ?? "");
    setEditGraphicStyle(ver.layoutOverrides.supportiveGraphicStyle ?? "auto_topic");
    setEditBadgeText(ver.layoutOverrides.supportiveBadgeText ?? "");
    setEditShowBadges(ver.layoutOverrides.showSupportiveElements !== false);
  }, [activeCreative]);

  const handleRunVisionAudit = async () => {
    if (!activeCreative) return;
    setCopilotError(null);
    setIsAuditingVision(true);
    try {
      const res = await apiRequest<{ audit: CreativeAudit }>("/api/copilot", {
        method: "POST",
        taskLabel: "Auditing creative post with Gemini Multimodal Vision...",
        body: JSON.stringify({
          action: "audit",
          creativeId: activeCreative.id,
        }),
      });
      announce(
        `Gemini Vision audit complete: ${res.audit.overallScore}/100 overall readiness.`
      );
    } catch (err) {
      setCopilotError(
        err instanceof Error ? err.message : "Vision audit failed."
      );
    } finally {
      setIsAuditingVision(false);
    }
  };

  const handleRunCopilot = async (rawInstruction: string) => {
    if (!activeCreative) return;
    const instruction = rawInstruction.trim();
    if (!instruction) return;
    setCopilotError(null);
    setIsRunningCopilot(true);
    const targetId = activeCreative.id;
    setCopilotMessagesByCreative((prev) => ({
      ...prev,
      [targetId]: [
        ...(prev[targetId] ?? []),
        { role: "user", text: instruction },
      ],
    }));
    setCopilotInput("");
    try {
      const res = await apiRequest<{
        copilot: { reply: string; modelUsed: string };
      }>("/api/copilot", {
        method: "POST",
        taskLabel: "Gemini Co-Pilot applying creative updates...",
        body: JSON.stringify({
          action: "chat",
          creativeId: targetId,
          instruction,
          applyChanges: true,
        }),
      });
      setCopilotMessagesByCreative((prev) => ({
        ...prev,
        [targetId]: [
          ...(prev[targetId] ?? []),
          {
            role: "assistant",
            text: res.copilot.reply,
            modelUsed: res.copilot.modelUsed,
          },
        ],
      }));
      announce(`Gemini Co-Pilot: ${res.copilot.reply}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gemini Co-Pilot update failed.";
      setCopilotError(msg);
      setCopilotMessagesByCreative((prev) => ({
        ...prev,
        [targetId]: [
          ...(prev[targetId] ?? []),
          { role: "assistant", text: `Unable to apply edit: ${msg}` },
        ],
      }));
    } finally {
      setIsRunningCopilot(false);
    }
  };

  const togglePreset = (presetId: string) => {
    setSelectedPresetIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId]
    );
  };

  const toggleAllPresets = () => {
    if (selectedPresetIds.length === snapshot.presets.length) {
      const firstId = snapshot.presets[0]?.id;
      setSelectedPresetIds(firstId ? [firstId] : []);
    } else {
      setSelectedPresetIds(snapshot.presets.map((p) => p.id));
    }
  };

  const toggleVariationOption = (idx: 1 | 2 | 3) => {
    setSelectedVariations((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev; // Keep at least 1 selected
        return prev.filter((v) => v !== idx);
      }
      return [...prev, idx].sort() as Array<1 | 2 | 3>;
    });
  };

  const togglePostCheckbox = (id: string) => {
    setCheckedPostIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPosts = () => {
    if (
      filteredCreatives.length > 0 &&
      checkedPostIds.length === filteredCreatives.length
    ) {
      setCheckedPostIds([]);
    } else {
      setCheckedPostIds(filteredCreatives.map((c) => c.id));
    }
  };

  const handleDeletePosts = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Deleting ${idsToDelete.length} social post(s)...`,
      body: JSON.stringify({
        action: "delete_creatives",
        creativeIds: idsToDelete,
      }),
    });
    setCheckedPostIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
    announce(`Deleted ${idsToDelete.length} social post(s).`);
  };

  const handleBulkApprovePosts = async (idsToApprove: string[]) => {
    if (idsToApprove.length === 0) return;
    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Approving ${idsToApprove.length} social post(s)...`,
      body: JSON.stringify({
        action: "status",
        creativeIds: idsToApprove,
        status: "approved",
      }),
    });
    setCheckedPostIds([]);
    announce(`Approved ${idsToApprove.length} social post(s).`);
  };

  const handleCopyCaption = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      announce("Copied lengthy SEO description and hashtags to clipboard.");
    } catch {
      announce("Description ready to copy.");
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) return;
    await apiRequest("/api/settings", {
      method: "PATCH",
      taskLabel: "Activating Google Gemini API key...",
      body: JSON.stringify({
        target: "gemini_api_key",
        apiKey: geminiKeyInput.trim(),
      }),
    });
    setGeminiKeyInput("");
    announce("Google Gemini API key saved and activated.");
  };

  if (!activeBrand) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start From Scratch: Add Your Website First</CardTitle>
          <CardDescription>
            Your workspace is completely empty. Enter a website URL so we can extract its brand colors, fonts, domain photos, and topic automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => onNavigate("brands")}>
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>Add Website & Extract Brand</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeConnectionSummary = snapshot.geminiConnections.find(
    (c) => c.isActive
  );
  const activeMediaImageConn = snapshot.mediaConnections.find(
    (c) => c.isActive && (c.capability === "image" || c.capability === "both")
  );
  const isImageQuotaBlocked =
    !activeMediaImageConn &&
    Boolean(activeConnectionSummary?.capabilities.lastCheckedAt) &&
    activeConnectionSummary?.capabilities.imageGeneration === false;

  const handleDraftAutonomousPrompts = async (mode: "autowrite" | "refine" = "autowrite") => {
    setIsDraftingPrompts(true);
    setStudioError(null);
    try {
      const firstPreset = snapshot.presets.find((p) =>
        selectedPresetIds.includes(p.id)
      );
      const seoKeywords = seoKeywordsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const promptsToRefine: Partial<Record<1 | 2 | 3, string>> = {};
      for (const vIdx of selectedVariations) {
        if (autonomousPrompts[vIdx]?.finalPrompt?.trim()) {
          promptsToRefine[vIdx] = autonomousPrompts[vIdx].finalPrompt.trim();
        }
      }

      const res = await apiRequest<{
        prompts: Array<{
          variationIndex: 1 | 2 | 3;
          finalPrompt: string;
          artDirectionBadge?: string;
          sceneConcept?: string;
          directorUsed: string;
        }>;
      }>("/api/prompts", {
        method: "POST",
        taskLabel:
          mode === "refine"
            ? "Refining and enhancing your custom prompts with Gemini..."
            : "Gemini Creative Director crafting autonomous image prompts from website & SEO strategy...",
        body: JSON.stringify({
          brandId: activeBrand.id,
          topic: topic.trim() || campaignName.trim() || undefined,
          seoKeywords,
          platform: firstPreset?.platform,
          formatName: firstPreset?.formatName,
          supportiveGraphicStyle: includeSupportiveBadges
            ? supportiveGraphicStyle
            : "minimal_clean",
          selectedDomainImageUrl: selectedDomainImageUrl || undefined,
          selectedVariations,
          promptsToRefine: mode === "refine" ? promptsToRefine : undefined,
          mode,
        }),
      });

      const nextMap: typeof autonomousPrompts = { ...autonomousPrompts };
      for (const item of res.prompts) {
        nextMap[item.variationIndex] = {
          finalPrompt: item.finalPrompt,
          badgeLabel: item.artDirectionBadge,
          sceneConcept: item.sceneConcept,
          directorUsed: item.directorUsed,
        };
      }
      setAutonomousPrompts(nextMap);
      announce(
        mode === "refine"
          ? `Gemini refined and enhanced your prompt(s).`
          : `Gemini autonomously crafted ${res.prompts.length} commercial image prompt(s).`
      );
    } catch (err) {
      setStudioError(
        err instanceof Error
          ? err.message
          : "Unable to process Gemini image prompts."
      );
    } finally {
      setIsDraftingPrompts(false);
    }
  };

  const handleGenerateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPresetIds.length === 0) {
      setStudioError("Select at least one social media platform format.");
      return;
    }

    const resolvedName =
      campaignName.trim() ||
      topic.trim() ||
      manualTitle.trim() ||
      `${activeBrand.name} Post`;

    const seoKeywords = seoKeywordsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const customPromptsByVariation: Partial<Record<1 | 2 | 3, string>> = {};
    for (const vIdx of selectedVariations) {
      const p = autonomousPrompts[vIdx]?.finalPrompt?.trim();
      if (p) customPromptsByVariation[vIdx] = p;
    }

    setIsGenerating(true);
    setStudioError(null);
    try {
      const res = await apiRequest<{ campaign: Campaign; creatives: Creative[] }>(
        "/api/campaigns",
        {
          method: "POST",
          taskLabel: `Rendering ${selectedVariations.length} visual option(s) per platform with autonomous Gemini prompts & SEO descriptions...`,
          body: JSON.stringify({
            brandId: activeBrand.id,
            brandKitId: activeBrandKit?.id,
            campaignName: resolvedName,
            objective: "Deliver high-impact brand visibility",
            inputMode,
            topic: topic.trim() || resolvedName,
            seoKeywords,
            adaptPerPlatform: true,
            presetIds: selectedPresetIds,
            selectedVariations,
            supportiveGraphicStyle: includeSupportiveBadges
              ? supportiveGraphicStyle
              : "minimal_clean",
            supportiveBadgeText: supportiveBadgeText.trim() || undefined,
            selectedDomainImageUrl: selectedDomainImageUrl || undefined,
            showSupportiveElements: includeSupportiveBadges,
            aiModel,
            customPromptsByVariation:
              Object.keys(customPromptsByVariation).length > 0
                ? customPromptsByVariation
                : undefined,
            manualInput:
              inputMode === "manual"
                ? {
                    postTitle: manualTitle.trim() || resolvedName,
                    mainText: manualMainText.trim(),
                    supportingCopy: manualSupporting.trim(),
                    caption: manualMainText.trim(),
                    hashtags: manualHashtags
                      .split(/\s+/)
                      .map((h) => h.trim())
                      .filter(Boolean),
                    ctaText: "",
                  }
                : undefined,
          }),
        }
      );

      onSelectCampaign(res.campaign.id);
      if (res.creatives[0]) {
        onSelectCreative(res.creatives[0].id);
      }
      setCampaignName("");
      announce(
        `Created ${res.creatives.length} full-image social post(s).`
      );
    } catch (err) {
      setStudioError(
        err instanceof Error ? err.message : "Failed to generate social posts."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCreativeEdits = async (regenerateBg = false) => {
    if (!activeCreative) return;
    try {
      const res = await apiRequest<{ creative: Creative }>(
        `/api/creatives/${activeCreative.id}`,
        {
          method: "PATCH",
          taskLabel: regenerateBg
            ? "Regenerating hero visual and supportive graphics..."
            : "Updating social post...",
          body: JSON.stringify({
            action: regenerateBg ? "regenerate_bg" : "edit",
            layoutOverrides: {
              logoPlacement: editLogoPlacement,
              textAlignment: editAlignment,
              headingScaleMultiplier: parseFloat(editHeadingScale) || 1.0,
              surfaceMode: editSurfaceMode,
              accentColorOverride: editAccentOverride || undefined,
              supportiveGraphicStyle: editGraphicStyle,
              supportiveBadgeText: editBadgeText.trim() || undefined,
              showSupportiveElements: editShowBadges,
              aiModel,
            },
            textOverrides: {
              postTitle: editTitle,
              supportingCopy: editSupporting,
              ctaText: "",
              caption: editCaption,
              hashtags: editHashtags
                .split(/\s+/)
                .map((t) => t.trim())
                .filter(Boolean),
            },
          }),
        }
      );
      onSelectCreative(res.creative.id);
      announce(
        `Updated Variation ${res.creative.variationIndex} (Version ${res.creative.currentVersion?.versionNumber ?? 2}).`
      );
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : "Failed to update post.");
    }
  };

  const handleReplaceBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCreative) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        await apiRequest(`/api/creatives/${activeCreative.id}`, {
          method: "PATCH",
          taskLabel: "Applying your uploaded photo with brand overlays...",
          body: JSON.stringify({
            action: "edit",
            customBackgroundDataUrl: reader.result,
          }),
        });
        announce("Updated post with your uploaded photo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!activeCreative) return;
    await apiRequest(`/api/creatives/${activeCreative.id}`, {
      method: "PATCH",
      taskLabel: `Restoring Version ${versionNumber}...`,
      body: JSON.stringify({
        action: "restore_version",
        versionId,
      }),
    });
    announce(`Restored Version ${versionNumber}.`);
  };

  const handleApprovalToggle = async (
    creative: Creative,
    status: "approved" | "rejected"
  ) => {
    await apiRequest(`/api/creatives/${creative.id}`, {
      method: "PATCH",
      taskLabel: `Marking Variation ${creative.variationIndex} as ${status}...`,
      body: JSON.stringify({
        action: "set_approval",
        approvalStatus: status,
      }),
    });
    announce(`Variation ${creative.variationIndex} marked ${status}.`);
  };

  const creativeBrandKit = snapshot.brandKits.find(
    (k) => k.id === activeCreative?.brandKitId
  );
  const approvedAccentChoices = creativeBrandKit
    ? Array.from(
        new Set([
          creativeBrandKit.colors.accent,
          creativeBrandKit.colors.primary,
          ...creativeBrandKit.colors.secondary,
        ])
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Studio Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Social Media Image Post Studio
          </h1>
          <p className="text-sm text-text-secondary">
            Short, concise text on the image graphic (no CTA clutter), paired with a lengthy SEO-optimized post description and hashtags.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => onNavigate("brands")}>
            Manage Brands
          </Button>
          <Button variant="secondary" onClick={() => onNavigate("exports")}>
            Export Approved ZIP
          </Button>
        </div>
      </div>

      {studioError ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg"
        >
          {studioError}
        </div>
      ) : null}

      {/* Clean Post Builder */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Create Social Media Post</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="info">Detected Topic: {detectedTopicLabel}</Badge>
              <Badge variant="neutral">
                {domainImages.length} Domain Image(s)
              </Badge>
            </div>
          </div>
          <CardDescription>
            Configure your post content, pick your hero visual and 1 to 3 layout options, and select target social networks.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleGenerateCampaign}>
          <CardContent className="flex flex-col gap-6">
            {/* Step 1: Brand, Content Mode & Free AI Image/LLM Model */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="studio-brand-select">1. Brand Website</Label>
                <NativeSelect
                  id="studio-brand-select"
                  value={activeBrand.id}
                  onChange={(e) => {
                    onSelectBrand(e.target.value);
                    setSelectedDomainImageUrl("");
                  }}
                >
                  {snapshot.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.domain})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="studio-input-mode">
                  2. Post & SEO Description Source
                </Label>
                <NativeSelect
                  id="studio-input-mode"
                  value={inputMode}
                  onChange={(e) => setInputMode(e.target.value as CampaignInputMode)}
                >
                  <option value="website_grounded">
                    Auto-Generate from Website Facts + SEO Keywords
                  </option>
                  <option value="ai_topic">
                    AI-Generate from Topic + SEO Keywords
                  </option>
                  <option value="manual">
                    Write My Own Short Headline & Description
                  </option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    3. Real-Time AI Engine
                  </span>
                  <Badge
                    variant={
                      activeMediaImageConn
                        ? "success"
                        : !snapshot.geminiConfigured
                          ? "warning"
                          : isImageQuotaBlocked
                            ? "info"
                            : "success"
                    }
                  >
                    {activeMediaImageConn
                      ? "Custom Image API Active"
                      : !snapshot.geminiConfigured
                        ? "Connect Gemini Key"
                        : isImageQuotaBlocked
                          ? "Gemini Prompts + Free AI Images"
                          : "Gemini Real-Time Active"}
                  </Badge>
                </div>
                <div className="flex min-h-11 items-center justify-between rounded-md border border-border-strong bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-primary">
                  <span>
                    {activeMediaImageConn
                      ? `Gemini Prompts + ${activeMediaImageConn.label} (${activeMediaImageConn.modelId})`
                      : `${snapshot.activeGeminiMeta?.textModel || "gemini-flash-latest"} + ${
                          snapshot.activeGeminiMeta?.imageModel === "auto" ||
                          !snapshot.activeGeminiMeta?.imageModel
                            ? "Gemini 2.5 / 3.1 Image Studio"
                            : snapshot.activeGeminiMeta.imageModel
                        }`}
                  </span>
                </div>
              </div>
            </div>

            {isImageQuotaBlocked ? (
              <div
                role="status"
                className="flex flex-col justify-between gap-2 rounded-md border border-status-info-border bg-status-info-bg p-3.5 text-xs text-status-info-fg sm:flex-row sm:items-center"
              >
                <span>
                  Hybrid Free Pipeline Active: Gemini autonomously generates your commercial image prompts, SEO copy, Trend Radar, and Vision Audits, while the built-in free open GPU image backend (AI Horde / FLUX) renders watermark-free photography automatically because your free-tier Gemini key has 0 image quota. You can optionally enable Gemini billing anytime under Settings -&gt; Gemini Vault for native Gemini image generation.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("settings")}
                >
                  Open Gemini Vault
                </Button>
              </div>
            ) : null}

            {!snapshot.geminiConfigured ? (
              <div className="flex flex-col justify-between gap-3 rounded-md border border-status-info-border bg-status-info-bg p-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-status-info-fg">
                    Connect Google Gemini API Key for Autonomous Prompting, Image &amp; SEO Content Generation
                  </span>
                  <span className="text-xs text-status-info-fg">
                    Powers autonomous Gemini commercial prompts, Gemini 2.5 / 3.1 Flash Image generation, Search Grounding, and Multimodal Vision Audit.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    aria-label="Google Gemini API Key"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="Paste GEMINI_API_KEY..."
                    className="sm:w-64"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={geminiKeyInput.trim().length < 12}
                    onClick={handleSaveGeminiKey}
                  >
                    Connect Gemini
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Topic & SEO Keywords */}
            {inputMode === "manual" ? (
              <div className="grid grid-cols-1 gap-4 rounded-md bg-surface-secondary p-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-title">
                    Short Headline on Image (3 to 6 words)
                  </Label>
                  <Input
                    id="manual-title"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Short, concise hook for the graphic"
                    maxLength={48}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-supporting">
                    Short 1-Line Subtitle on Image
                  </Label>
                  <Input
                    id="manual-supporting"
                    value={manualSupporting}
                    onChange={(e) => setManualSupporting(e.target.value)}
                    placeholder="Concise single-line subtitle"
                    maxLength={64}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-seo">
                    SEO Keywords (Used in Lengthy Description & Hashtags)
                  </Label>
                  <Input
                    id="manual-seo"
                    value={seoKeywordsRaw}
                    onChange={(e) => setSeoKeywordsRaw(e.target.value)}
                    placeholder="Comma-separated SEO keywords"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-hashtags">
                    Custom Hashtags (Optional)
                  </Label>
                  <Input
                    id="manual-hashtags"
                    value={manualHashtags}
                    onChange={(e) => setManualHashtags(e.target.value)}
                    placeholder="#Tag1 #Tag2 #Tag3"
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="manual-main">
                    Lengthy Post Description (Expanded with SEO Keywords if Short)
                  </Label>
                  <Textarea
                    id="manual-main"
                    value={manualMainText}
                    onChange={(e) => setManualMainText(e.target.value)}
                    placeholder="Enter your detailed post description..."
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 rounded-md bg-surface-secondary p-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-topic-input">Post Topic or Focus</Label>
                  <Input
                    id="ai-topic-input"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter topic (or leave blank to use website headings)"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-seo-input">
                    SEO Keywords (Woven into Lengthy Description & Hashtags)
                  </Label>
                  <Input
                    id="ai-seo-input"
                    value={seoKeywordsRaw}
                    onChange={(e) => setSeoKeywordsRaw(e.target.value)}
                    placeholder="Comma-separated SEO keywords"
                  />
                </div>
              </div>
            )}

            {/* Step 3.5: Generation Options Selector (1, 2, or 3 Options) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-secondary px-4 py-3">
              <div>
                <span className="text-sm font-semibold text-text-primary">
                  3.5 Number of Visual Options ({selectedVariations.length} Selected)
                </span>
                <p className="text-xs text-text-secondary mt-0.5">
                  Choose 1, 2, or 3 unique visual concepts. All selected platforms below will adapt to these options across their exact dimensions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {([1, 2, 3] as const).map((count) => {
                  const isSelected =
                    selectedVariations.length === count &&
                    (count === 1
                      ? selectedVariations.includes(1)
                      : count === 2
                        ? selectedVariations.includes(1) && selectedVariations.includes(2)
                        : selectedVariations.length === 3);

                  return (
                    <Button
                      key={count}
                      type="button"
                      variant={isSelected ? "primary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (count === 1) setSelectedVariations([1]);
                        else if (count === 2) setSelectedVariations([1, 2]);
                        else setSelectedVariations([1, 2, 3]);
                      }}
                      className="font-medium"
                    >
                      {count} Option{count > 1 ? "s" : ""}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Platform Format Presets with Select All */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  4. Select Social Platforms ({selectedPresetIds.length} Selected)
                </span>
                <Button variant="outline" size="sm" onClick={toggleAllPresets}>
                  {selectedPresetIds.length === snapshot.presets.length
                    ? "Keep Only First Platform"
                    : "Select All Platforms"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {snapshot.presets.map((preset) => {
                  const checked = selectedPresetIds.includes(preset.id);
                  return (
                    <label
                      key={preset.id}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-xs font-medium ${
                        checked
                          ? "border-focus-ring bg-surface-secondary text-text-primary"
                          : "border-border-subtle bg-surface-primary text-text-secondary hover:bg-surface-secondary"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePreset(preset.id)}
                          className="h-4 w-4"
                        />
                        <span className="capitalize">
                          {preset.platform} {preset.formatName}
                        </span>
                      </span>
                      <span className="font-mono text-text-muted">
                        {preset.width}×{preset.height}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {/* Autonomous Gemini Image Prompt Director & Custom Prompt Editor */}
            <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-text-primary">
                    AI Visual Prompt Director & Custom Prompt Studio
                  </span>
                  <span className="text-xs text-text-secondary">
                    Auto-write from website facts, enter your own custom prompts, or use Gemini to refine & elevate your drafts.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isDraftingPrompts}
                    onClick={() => handleDraftAutonomousPrompts("refine")}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
                    <span>Refine Current Prompts</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isLoading={isDraftingPrompts}
                    onClick={() => handleDraftAutonomousPrompts("autowrite")}
                  >
                    <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Auto-Write All Prompts</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {selectedVariations.map((vIdx) => {
                  const entry = autonomousPrompts[vIdx] || {
                    finalPrompt: "",
                    sceneConcept: `Option ${vIdx} Custom Scene`,
                    directorUsed: "user-custom-spec",
                  };
                  return (
                    <div
                      key={vIdx}
                      className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-primary p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-text-primary">
                          Option {vIdx}: {entry.sceneConcept || "Custom Visual Concept"}
                        </span>
                        {entry.badgeLabel ? (
                          <Badge variant="info">{entry.badgeLabel}</Badge>
                        ) : null}
                      </div>
                      <Textarea
                        aria-label={`Custom or autonomous prompt for option ${vIdx}`}
                        placeholder={`Type your custom prompt for Option ${vIdx} (or click Auto-Write / Refine above)...`}
                        value={entry.finalPrompt}
                        onChange={(e) =>
                          setAutonomousPrompts((prev) => ({
                            ...prev,
                            [vIdx]: {
                              ...entry,
                              finalPrompt: e.target.value,
                            },
                          }))
                        }
                        className="min-h-24 text-xs font-mono"
                      />
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Director: {entry.directorUsed || "Custom / Gemini"}</span>
                        {entry.finalPrompt ? (
                          <span className="text-status-success-fg">Active Prompt</span>
                        ) : (
                          <span className="text-text-tertiary">Optional override</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-text-secondary">
              Ready to render {selectedPresetIds.length * selectedVariations.length} social post(s) ({selectedVariations.length} visual option(s) × {selectedPresetIds.length} platform format(s)).
            </span>
            <Button type="submit" variant="primary" isLoading={isGenerating}>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              <span>
                Generate {selectedPresetIds.length * selectedVariations.length} Social Post(s)
              </span>
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Generated Variations Feed Cards with Select All & Delete */}
      {campaignCreatives.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 Columns: Social Feed Post Cards */}
          <Card className="lg:col-span-7">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                  <CardTitle>
                    Generated Social Posts ({filteredCreatives.length})
                  </CardTitle>
                  <CardDescription>
                    Select individual posts or use Select All to approve or delete posts in bulk.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {snapshot.campaigns.length > 1 ? (
                    <NativeSelect
                      aria-label="Switch campaign"
                      value={activeCampaign?.id ?? ""}
                      onChange={(e) => onSelectCampaign(e.target.value)}
                      className="w-auto"
                    >
                      {snapshot.campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}

                  <NativeSelect
                    aria-label="Filter by platform"
                    value={platformFilter}
                    onChange={(e) =>
                      setPlatformFilter(e.target.value as "all" | SocialPlatform)
                    }
                    className="w-auto"
                  >
                    <option value="all">All Platforms</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="x">X</option>
                    <option value="pinterest">Pinterest</option>
                    <option value="tiktok">TikTok</option>
                  </NativeSelect>
                </div>
              </div>

              {/* Select All & Bulk Delete / Approve Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary px-3.5 py-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-text-primary">
                  <input
                    type="checkbox"
                    checked={
                      filteredCreatives.length > 0 &&
                      checkedPostIds.length === filteredCreatives.length
                    }
                    onChange={toggleSelectAllPosts}
                    className="h-4 w-4"
                  />
                  <span>
                    Select All ({checkedPostIds.length}/{filteredCreatives.length})
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={checkedPostIds.length === 0}
                    onClick={() => handleBulkApprovePosts(checkedPostIds)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-status-success-fg" aria-hidden="true" />
                    <span>Approve Selected ({checkedPostIds.length})</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={checkedPostIds.length === 0}
                    onClick={() => handleDeletePosts(checkedPostIds)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Delete Selected ({checkedPostIds.length})</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {filteredCreatives.map((creative) => {
                  const isSelected = creative.id === activeCreative?.id;
                  const isChecked = checkedPostIds.includes(creative.id);
                  const ver = creative.currentVersion;
                  const imgUrl = `/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                    snapshot.activeWorkspace.id
                  )}&versionId=${encodeURIComponent(creative.currentVersionId)}`;

                  return (
                    <div
                      key={creative.id}
                      className={`flex flex-col justify-between gap-4 rounded-lg border p-4 ${
                        isSelected || isChecked
                          ? "border-focus-ring bg-surface-secondary"
                          : "border-border-subtle bg-surface-secondary"
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        {/* Post Card Header with Checkbox */}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold uppercase text-text-primary">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePostCheckbox(creative.id)}
                              className="h-4 w-4"
                            />
                            <span>
                              {creative.platform} {creative.formatName}
                            </span>
                          </label>
                          <Badge
                            variant={
                              creative.approvalStatus === "approved"
                                ? "success"
                                : creative.approvalStatus === "rejected"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            Option {creative.variationIndex}
                          </Badge>
                        </div>

                        {/* Full-Image Social Graphic (Short Text, No CTA) */}
                        <button
                          type="button"
                          onClick={() => onSelectCreative(creative.id)}
                          aria-label={`Select ${creative.platform} option ${creative.variationIndex}`}
                          className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-md bg-surface-tertiary"
                        >
                          <img
                            src={imgUrl}
                            alt={`${creative.platform} option ${creative.variationIndex} preview`}
                            className="h-full w-full object-contain"
                          />
                        </button>

                        {/* Short Image Text Summary */}
                        <div className="flex flex-col gap-0.5 border-b border-border-subtle pb-2">
                          <span className="text-xs font-semibold text-text-muted">
                            Short Text on Graphic:
                          </span>
                          <span className="text-sm font-bold text-text-primary">
                            {ver?.textOverrides.postTitle}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {ver?.textOverrides.supportingCopy}
                          </span>
                        </div>

                        {/* Lengthy SEO Description & Hashtags */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-text-primary">
                              Lengthy SEO Description:
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCopyCaption(ver?.textOverrides.caption ?? "")
                              }
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Copy Text</span>
                            </Button>
                          </div>

                          <p className="max-h-32 overflow-y-auto whitespace-pre-line rounded-md bg-surface-primary p-3 text-xs leading-relaxed text-text-secondary">
                            {ver?.textOverrides.caption}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(ver?.textOverrides.hashtags ?? []).map((tag) => (
                              <Badge key={tag} variant="info">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {ver?.backgroundPrompt ? (
                            <details className="rounded-md border border-border-subtle bg-surface-primary p-2.5 text-xs">
                              <summary className="cursor-pointer font-medium text-text-secondary">
                                AI Image Prompt ({ver.providerUsed})
                              </summary>
                              <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-text-muted">
                                {ver.backgroundPrompt}
                              </p>
                            </details>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                        <Button
                          variant={isSelected ? "primary" : "outline"}
                          size="sm"
                          onClick={() => onSelectCreative(creative.id)}
                        >
                          {isSelected ? "Editing Now" : "Customize"}
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleApprovalToggle(creative, "approved")}
                          >
                            <CheckCircle2 className="h-4 w-4 text-status-success-fg" aria-hidden="true" />
                            <span>Approve</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete post option ${creative.variationIndex}`}
                            title="Delete post"
                            onClick={() => handleDeletePosts([creative.id])}
                          >
                            <Trash2 className="h-4 w-4 text-status-danger-fg" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right 5 Columns: Live Interactive Stage, Gemini Vision Audit, Co-Pilot & Editor */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Interactive Stage & Gemini Co-Pilot</CardTitle>
                {activeCreative ? (
                  <Badge variant="info">
                    Option {activeCreative.variationIndex}
                  </Badge>
                ) : null}
              </div>
              <CardDescription>
                Preview typography, corner logo snaps, and social feeds live before rendering. Use Gemini Vision Audit and Co-Pilot chat to iterate without limits.
              </CardDescription>
            </CardHeader>
            {activeCreative ? (
              <>
                <CardContent className="flex flex-col gap-5">
                  {/* Interactive Stage View Switcher */}
                  <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-3">
                    <div
                      role="tablist"
                      aria-label="Preview stage modes"
                      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                    >
                      {(
                        [
                          { id: "live_stage", label: "Live Interactive Stage" },
                          { id: "instagram", label: "Instagram Mockup" },
                          { id: "linkedin", label: "LinkedIn Mockup" },
                          { id: "rendered_png", label: "High-Res Rendered PNG" },
                        ] as const
                      ).map((tab) => {
                        const isSelected = stageMode === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setStageMode(tab.id)}
                            className={`flex min-h-11 items-center justify-center rounded-md border px-2 py-1.5 text-center text-xs font-medium cursor-pointer ${
                              isSelected
                                ? "border-focus-ring bg-surface-primary text-text-primary font-semibold"
                                : "border-border-subtle bg-surface-secondary text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Stage Viewport */}
                    {(() => {
                      const resolvedAccent =
                        editAccentOverride ||
                        activeBrandKitForStage?.colors.accent ||
                        "#2563EB";
                      const resolvedPrimary =
                        activeBrandKitForStage?.colors.primary || "#1E293B";
                      const isLightSurface = editSurfaceMode === "light";
                      const scrimGradient =
                        editSurfaceMode === "light"
                          ? "linear-gradient(180deg, rgba(248,250,252,0.22) 0%, rgba(248,250,252,0.92) 72%)"
                          : editSurfaceMode === "primary"
                            ? `linear-gradient(180deg, ${resolvedPrimary}40 0%, ${resolvedPrimary}EB 85%)`
                            : "linear-gradient(180deg, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.88) 78%)";
                      const headingScaleNum =
                        Number.parseFloat(editHeadingScale) || 1;
                      const parsedHashtags = editHashtags
                        .split(/[\s,]+/)
                        .map((h) => h.trim())
                        .filter(Boolean)
                        .map((h) => (h.startsWith("#") ? h : `#${h}`));

                      const logoPositionClass =
                        editLogoPlacement === "top-right"
                          ? "top-3 right-3"
                          : editLogoPlacement === "top-center"
                            ? "top-3 left-1/2 -translate-x-1/2"
                            : editLogoPlacement === "bottom-left"
                              ? "bottom-3 left-3"
                              : editLogoPlacement === "bottom-right"
                                ? "bottom-3 right-3"
                                : "top-3 left-3";

                      const oppositeBadgePositionClass =
                        editLogoPlacement === "top-right"
                          ? "top-3 left-3"
                          : "top-3 right-3";

                      const liveCanvasNode = (
                        <div
                          className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-lg border border-border-default bg-surface-primary"
                          style={{
                            aspectRatio: `${activeCreative.width} / ${activeCreative.height}`,
                            maxHeight: "360px",
                          }}
                        >
                          <img
                            src={`/api/creatives/${activeCreative.id}/image?workspaceId=${encodeURIComponent(
                              snapshot.activeWorkspace.id
                            )}&versionId=${encodeURIComponent(
                              activeCreative.currentVersionId
                            )}&layer=background`}
                            alt={`Live preview for ${activeCreative.platform} post`}
                            className="h-full w-full object-cover"
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: scrimGradient }}
                          />

                          {/* Supportive Corner Accents when enabled */}
                          {editShowBadges ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2"
                                style={{ borderColor: resolvedAccent }}
                              />
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2"
                                style={{ borderColor: resolvedAccent }}
                              />
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2"
                                style={{ borderColor: resolvedAccent }}
                              />
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2"
                                style={{ borderColor: resolvedAccent }}
                              />
                              <div
                                className={`absolute z-10 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${oppositeBadgePositionClass}`}
                                style={{
                                  backgroundColor: resolvedAccent,
                                  color: "#FFFFFF",
                                }}
                              >
                                {editBadgeText.trim() || activeCreative.formatName}
                              </div>
                            </>
                          ) : null}

                          {/* Live Snapped Brand Logo */}
                          <div
                            className={`absolute z-10 flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-semibold ${logoPositionClass}`}
                            style={{
                              backgroundColor: isLightSurface
                                ? "rgba(255,255,255,0.9)"
                                : "rgba(15,23,42,0.82)",
                              color: isLightSurface ? "#0F172A" : "#F8FAFC",
                            }}
                          >
                            {activeBrandForStage?.logoDataUrl ? (
                              <img
                                src={activeBrandForStage.logoDataUrl}
                                alt={`${activeBrandForStage.name} logo`}
                                className="h-4 w-4 rounded-sm object-contain"
                              />
                            ) : null}
                            <span>
                              {activeBrandForStage?.name ?? "Brand"}
                            </span>
                          </div>

                          {/* Short Concise Overlay Typography (No CTA on post) */}
                          <div
                            className={`absolute inset-x-4 flex flex-col gap-1 ${
                              editLogoPlacement.startsWith("bottom-")
                                ? "bottom-12"
                                : "bottom-4"
                            } ${
                              editAlignment === "center"
                                ? "items-center text-center"
                                : "items-start text-left"
                            }`}
                          >
                            <div
                              className="font-bold tracking-tight"
                              style={{
                                fontSize: `${Math.round(18 * headingScaleNum)}px`,
                                lineHeight: 1.15,
                                color: isLightSurface
                                  ? activeBrandKitForStage?.colors.textOnLight ??
                                    "#0F172A"
                                  : activeBrandKitForStage?.colors.textOnDark ??
                                    "#FFFFFF",
                              }}
                            >
                              {editTitle || "Short Headline Preview"}
                            </div>
                            <div
                              className="text-xs font-medium leading-snug"
                              style={{
                                color: isLightSurface
                                  ? "#334155"
                                  : "rgba(241,245,249,0.92)",
                              }}
                            >
                              {editSupporting}
                            </div>
                          </div>
                        </div>
                      );

                      if (stageMode === "rendered_png") {
                        return (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-full max-w-[360px] overflow-hidden rounded-lg border border-border-default bg-surface-primary">
                              <img
                                src={`/api/creatives/${activeCreative.id}/image?workspaceId=${encodeURIComponent(
                                  snapshot.activeWorkspace.id
                                )}&versionId=${encodeURIComponent(
                                  activeCreative.currentVersionId
                                )}`}
                                alt={`Rendered output for ${activeCreative.platform}`}
                                className="h-auto w-full object-contain"
                              />
                            </div>
                            <span className="text-[11px] text-text-muted">
                              Final composited server PNG ({activeCreative.width} ×{" "}
                              {activeCreative.height})
                            </span>
                          </div>
                        );
                      }

                      if (stageMode === "instagram") {
                        return (
                          <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3 rounded-lg border border-border-default bg-surface-primary p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-text-primary border border-border-subtle bg-surface-secondary"
                                >
                                  {(activeBrandForStage?.name ?? "B")
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-text-primary">
                                    {activeBrandForStage?.name ?? "Brand Account"}
                                  </span>
                                  <span className="text-[11px] text-text-muted">
                                    {activeBrandForStage?.domain ?? "instagram.com"}
                                  </span>
                                </div>
                              </div>
                              <Badge variant="neutral">Instagram Feed</Badge>
                            </div>
                            {liveCanvasNode}
                            <div className="flex items-center justify-between px-1 text-text-secondary">
                              <div className="flex items-center gap-3">
                                <Heart className="h-4 w-4" aria-hidden="true" />
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                <Share2 className="h-4 w-4" aria-hidden="true" />
                              </div>
                              <Bookmark className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="flex flex-col gap-1.5 text-xs">
                              <p className="max-h-24 overflow-y-auto whitespace-pre-line text-text-secondary">
                                <strong className="mr-1.5 text-text-primary">
                                  {activeBrandForStage?.name ?? "Brand"}
                                </strong>
                                {editCaption}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {parsedHashtags.slice(0, 8).map((tag) => (
                                  <span
                                    key={tag}
                                    className="font-mono text-[11px] text-text-primary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (stageMode === "linkedin") {
                        return (
                          <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3 rounded-lg border border-border-default bg-surface-primary p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface-secondary text-xs font-bold text-text-primary">
                                  {(activeBrandForStage?.name ?? "B")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-text-primary">
                                    {activeBrandForStage?.name ?? "Company Page"}
                                  </span>
                                  <span className="text-[11px] text-text-muted">
                                    {activeBrandForStage?.domain ?? "linkedin.com"} • Promoted Preview
                                  </span>
                                </div>
                              </div>
                              <Badge variant="info">LinkedIn</Badge>
                            </div>
                            <p className="max-h-24 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-text-secondary">
                              {editCaption}
                            </p>
                            {parsedHashtags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {parsedHashtags.slice(0, 8).map((tag) => (
                                  <Badge key={tag} variant="neutral">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {liveCanvasNode}
                            <div className="flex items-center justify-around border-t border-border-subtle pt-2 text-[11px] font-medium text-text-muted">
                              <span>Like</span>
                              <span>Comment</span>
                              <span>Repost</span>
                              <span>Send</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between text-[11px] text-text-muted">
                            <span className="flex items-center gap-1 font-medium text-text-secondary">
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Instant Client-Side Stage (Zero Delay)</span>
                            </span>
                            <span>Click Apply Changes below to bake PNG/WebP</span>
                          </div>
                          {liveCanvasNode}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-medium text-text-secondary">
                              Quick Logo Corner Snap:
                            </span>
                            <div className="grid grid-cols-5 gap-1">
                              {(
                                [
                                  { val: "top-left", label: "Top L" },
                                  { val: "top-center", label: "Top C" },
                                  { val: "top-right", label: "Top R" },
                                  { val: "bottom-left", label: "Bot L" },
                                  { val: "bottom-right", label: "Bot R" },
                                ] as const
                              ).map((pos) => (
                                <button
                                  key={pos.val}
                                  type="button"
                                  onClick={() => setEditLogoPlacement(pos.val)}
                                  className={`min-h-11 rounded border px-1.5 py-1 text-[11px] font-medium cursor-pointer ${
                                    editLogoPlacement === pos.val
                                      ? "border-focus-ring bg-surface-primary text-text-primary font-semibold"
                                      : "border-border-subtle bg-surface-primary/60 text-text-secondary hover:text-text-primary"
                                  }`}
                                >
                                  {pos.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Gemini Vision Quality Audit */}
                  <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck
                          className="h-4 w-4 text-text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-text-primary">
                          Gemini Vision Quality Audit
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={isAuditingVision}
                        onClick={handleRunVisionAudit}
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {activeAudit ? "Re-Audit Graphic" : "Audit with Vision"}
                        </span>
                      </Button>
                    </div>

                    {activeAudit ? (
                      <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { label: "Overall", score: activeAudit.overallScore },
                            { label: "Legibility", score: activeAudit.legibilityScore },
                            {
                              label: "Brand Match",
                              score: activeAudit.brandConsistencyScore,
                            },
                            { label: "Appeal", score: activeAudit.visualAppealScore },
                          ].map((metric) => (
                            <div
                              key={metric.label}
                              className="flex flex-col rounded border border-border-subtle bg-surface-primary p-2 text-center"
                            >
                              <span className="text-[11px] text-text-muted">
                                {metric.label}
                              </span>
                              <span className="text-sm font-bold text-text-primary">
                                {metric.score}/100
                              </span>
                            </div>
                          ))}
                        </div>

                        {activeAudit.strengths.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-status-success-fg">
                              Strengths:
                            </span>
                            <ul className="list-disc pl-4 text-xs text-text-secondary">
                              {activeAudit.strengths.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {activeAudit.recommendations.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-text-primary">
                              Recommendations:
                            </span>
                            <ul className="list-disc pl-4 text-xs text-text-secondary">
                              {activeAudit.recommendations.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {activeAudit.suggestedHeadline ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border-subtle bg-surface-primary p-2">
                            <span className="text-xs text-text-secondary">
                              Suggested Hook:{" "}
                              <strong className="text-text-primary">
                                {activeAudit.suggestedHeadline}
                              </strong>
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditTitle(activeAudit.suggestedHeadline!);
                                announce(
                                  "Applied Gemini Vision suggested headline to live stage."
                                );
                              }}
                            >
                              Use Headline
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">
                        Inspect rendered PNG contrast, layout balance, and brand fidelity using Gemini Multimodal Vision.
                      </p>
                    )}
                  </div>

                  {/* Interactive Gemini Co-Pilot */}
                  <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-secondary p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare
                          className="h-4 w-4 text-text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-text-primary">
                          Interactive Gemini Creative Co-Pilot
                        </span>
                      </div>
                      <Badge variant="info">Conversational Edit</Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          "Make Hook Punchier",
                          "Moody Sunset Lighting",
                          "Expand SEO Depth",
                          "Light Surface Card",
                        ] as const
                      ).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          disabled={isRunningCopilot}
                          onClick={() => handleRunCopilot(chip)}
                          className="min-h-9 rounded-full border border-border-default bg-surface-primary px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface-tertiary disabled:opacity-50 cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {copilotError ? (
                      <div
                        role="alert"
                        className="rounded border border-status-danger-border bg-status-danger-bg p-2 text-xs text-status-danger-fg"
                      >
                        {copilotError}
                      </div>
                    ) : null}

                    {activeCopilotThread.length > 0 ? (
                      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border border-border-subtle bg-surface-primary p-2.5">
                        {activeCopilotThread.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col gap-0.5 rounded px-2.5 py-1.5 text-xs ${
                              msg.role === "user"
                                ? "self-end bg-surface-tertiary text-text-primary"
                                : "self-start border border-border-subtle bg-surface-secondary text-text-secondary"
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase text-text-muted">
                              {msg.role === "user"
                                ? "You"
                                : `Gemini (${msg.modelUsed ?? "Co-Pilot"})`}
                            </span>
                            <span>{msg.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <Input
                        id="copilot-prompt-input"
                        value={copilotInput}
                        onChange={(e) => setCopilotInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleRunCopilot(copilotInput);
                          }
                        }}
                        placeholder="Ask Gemini to rewrite copy, swap theme, or evolve background..."
                        disabled={isRunningCopilot}
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={isRunningCopilot}
                        disabled={!copilotInput.trim()}
                        onClick={() => handleRunCopilot(copilotInput)}
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Apply</span>
                      </Button>
                    </div>
                  </div>

                  {/* Direct Fine-Tune Form Controls */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="editor-title">
                        Short Headline on Image (Concise)
                      </Label>
                      <span className="text-xs text-text-muted">
                        {editTitle.length}/42 chars
                      </span>
                    </div>
                    <Input
                      id="editor-title"
                      value={editTitle}
                      maxLength={48}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="editor-supporting">
                        Short 1-Line Subtitle on Image
                      </Label>
                      <span className="text-xs text-text-muted">
                        {editSupporting.length}/58 chars
                      </span>
                    </div>
                    <Input
                      id="editor-supporting"
                      value={editSupporting}
                      maxLength={64}
                      onChange={(e) => setEditSupporting(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-graphic-style">
                        Hero Visual Style
                      </Label>
                      <NativeSelect
                        id="editor-graphic-style"
                        value={editGraphicStyle}
                        onChange={(e) =>
                          setEditGraphicStyle(
                            e.target.value as SupportiveGraphicStyle
                          )
                        }
                      >
                        <option value="auto_topic">Auto Detect</option>
                        <option value="domain_images">Website Photo</option>
                        <option value="vehicle_showcase">Vehicle Graphic</option>
                        <option value="product_spotlight">Product / Promo</option>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-badge-text">
                        Supportive Badge Text
                      </Label>
                      <Input
                        id="editor-badge-text"
                        value={editBadgeText}
                        onChange={(e) => setEditBadgeText(e.target.value)}
                      />
                    </div>
                  </div>

                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-text-primary">
                    <input
                      type="checkbox"
                      checked={editShowBadges}
                      onChange={(e) => setEditShowBadges(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span>Show Supportive Graphic Badges & Corner Frames</span>
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-logo-pos">Logo Position</Label>
                      <NativeSelect
                        id="editor-logo-pos"
                        value={editLogoPlacement}
                        onChange={(e) =>
                          setEditLogoPlacement(e.target.value as LogoPlacement)
                        }
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-center">Top Center</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-surface">Card Theme</Label>
                      <NativeSelect
                        id="editor-surface"
                        value={editSurfaceMode}
                        onChange={(e) =>
                          setEditSurfaceMode(
                            e.target.value as "dark" | "light" | "primary"
                          )
                        }
                      >
                        <option value="dark">Dark Surface</option>
                        <option value="light">Light Surface</option>
                        <option value="primary">Brand Primary</option>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-scale">Text Scale</Label>
                      <NativeSelect
                        id="editor-scale"
                        value={editHeadingScale}
                        onChange={(e) => setEditHeadingScale(e.target.value)}
                      >
                        <option value="0.9">Compact</option>
                        <option value="1">Standard</option>
                        <option value="1.15">Large</option>
                      </NativeSelect>
                    </div>
                  </div>

                  {approvedAccentChoices.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-text-primary">
                        Brand Accent Color
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {approvedAccentChoices.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setEditAccentOverride(hex)}
                            aria-label={`Select brand color ${hex}`}
                            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-mono cursor-pointer ${
                              (editAccentOverride ||
                                creativeBrandKit?.colors.accent) === hex
                                ? "border-focus-ring bg-surface-tertiary font-semibold"
                                : "border-border-subtle bg-surface-secondary"
                            }`}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-sm border border-border-strong"
                              style={{ backgroundColor: hex }}
                            />
                            <span>{hex}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="editor-caption">
                      Lengthy SEO Post Description
                    </Label>
                    <Textarea
                      id="editor-caption"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="min-h-36"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="editor-hashtags">Hashtags</Label>
                    <Input
                      id="editor-hashtags"
                      value={editHashtags}
                      onChange={(e) => setEditHashtags(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveCreativeEdits(true)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>New Image Scene</span>
                      </Button>

                      <label
                        htmlFor="replace-creative-bg"
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-surface-primary px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-tertiary"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Upload Photo / Vehicle</span>
                        <input
                          id="replace-creative-bg"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleReplaceBackgroundUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/creatives/${activeCreative.id}/image?workspaceId=${encodeURIComponent(
                            snapshot.activeWorkspace.id
                          )}&format=png&download=1`}
                          download
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>PNG</span>
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/creatives/${activeCreative.id}/image?workspaceId=${encodeURIComponent(
                            snapshot.activeWorkspace.id
                          )}&format=webp&download=1`}
                          download
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>WebP</span>
                        </a>
                      </Button>
                    </div>
                  </div>

                  {activeCreative.versions && activeCreative.versions.length > 1 ? (
                    <div className="flex flex-col gap-2 rounded-md bg-surface-secondary p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                        <History className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Version History</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeCreative.versions.map((ver) => {
                          const isCurrent =
                            ver.id === activeCreative.currentVersionId;
                          return (
                            <Button
                              key={ver.id}
                              variant={isCurrent ? "primary" : "outline"}
                              size="sm"
                              onClick={() =>
                                handleRestoreVersion(ver.id, ver.versionNumber)
                              }
                            >
                              v{ver.versionNumber}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="flex justify-between gap-3">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeletePosts([activeCreative.id])}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Delete Post</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleSaveCreativeEdits(false)}
                  >
                    Apply Changes
                  </Button>
                </CardFooter>
              </>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
