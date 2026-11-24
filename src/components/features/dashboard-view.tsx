"use client";

import * as React from "react";
import {
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Globe,
  Trash2,
  Upload,
  Car,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Brand, BrandKit } from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface DashboardViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  onSelectBrand: (brandId: string) => void;
  onOpenCreativeInStudio: (creativeId: string, campaignId: string) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function DashboardView({
  snapshot,
  onNavigate,
  onSelectBrand,
  onOpenCreativeInStudio,
  apiRequest,
  announce,
}: DashboardViewProps) {
  const { metrics, campaigns, creatives, brands, activeWorkspace } = snapshot;
  const recentCreatives = creatives.slice(0, 6);
  const recentCampaigns = campaigns.slice(0, 5);

  const [quickBrandName, setQuickBrandName] = React.useState("");
  const [quickUrl, setQuickUrl] = React.useState("");
  const [quickLogoDataUrl, setQuickLogoDataUrl] = React.useState<string | null>(
    null
  );
  const [quickLogoName, setQuickLogoName] = React.useState("");
  const [quickError, setQuickError] = React.useState<string | null>(null);
  const [isExtracting, setIsExtracting] = React.useState(false);

  // Select / Select All checkboxes for posts on Dashboard
  const [selectedPostIds, setSelectedPostIds] = React.useState<string[]>([]);

  const togglePostSelection = (id: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPosts = () => {
    if (
      recentCreatives.length > 0 &&
      selectedPostIds.length === recentCreatives.length
    ) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(recentCreatives.map((c) => c.id));
    }
  };

  const handleDeletePosts = async (ids: string[]) => {
    if (ids.length === 0) return;
    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Deleting ${ids.length} post(s)...`,
      body: JSON.stringify({
        action: "delete_creatives",
        creativeIds: ids,
      }),
    });
    setSelectedPostIds((prev) => prev.filter((id) => !ids.includes(id)));
    announce(`Deleted ${ids.length} social post(s).`);
  };

  const handleClearAllWorkspaceData = async () => {
    if (!window.confirm("Are you sure you want to clear all brands, campaigns, and generated posts in this workspace?")) {
      return;
    }
    await apiRequest("/api/workspaces", {
      method: "POST",
      taskLabel: "Clearing all workspace data...",
      body: JSON.stringify({
        action: "clear_workspace",
      }),
    });
    setSelectedPostIds([]);
    announce("Cleared all workspace data. Starting from scratch.");
  };

  const handleQuickLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQuickLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setQuickLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = quickUrl.trim();
    if (!rawUrl) {
      setQuickError("Enter your website URL to get started.");
      return;
    }

    let formattedUrl = rawUrl;
    let extractedDomain = rawUrl;
    try {
      const parsed = new URL(
        rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
      );
      formattedUrl = parsed.toString();
      extractedDomain = parsed.hostname.replace(/^www\./, "");
    } catch {
      setQuickError(
        "Please enter a valid website address (for example: https://yourbrand.com)."
      );
      return;
    }

    const resolvedName =
      quickBrandName.trim() ||
      extractedDomain.split(".")[0]?.replace(/[-_]/g, " ") ||
      "Brand";

    setIsExtracting(true);
    setQuickError(null);
    try {
      const res = await apiRequest<{ brand: Brand; brandKit: BrandKit }>(
        "/api/brands",
        {
          method: "POST",
          taskLabel: `Analyzing ${formattedUrl} for brand colors, fonts, topic, and website images...`,
          body: JSON.stringify({
            name:
              resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1),
            domain: extractedDomain,
            websiteUrl: formattedUrl,
            logoDataUrl: quickLogoDataUrl,
          }),
        }
      );
      onSelectBrand(res.brand.id);
      announce(
        `Extracted brand identity for ${res.brand.name}. Opening Post Studio.`
      );
      onNavigate("studio");
    } catch (err) {
      setQuickError(
        err instanceof Error ? err.message : "Could not analyze website."
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string, name: string) => {
    await apiRequest(`/api/campaigns?campaignId=${encodeURIComponent(campaignId)}`, {
      method: "DELETE",
      taskLabel: `Removing campaign ${name}...`,
    });
    announce(`Removed campaign ${name}.`);
  };

  const userFirstName = (snapshot.user?.name || "Creator").split(" ")[0];
  const approvalRate =
    metrics.totalCreatives > 0
      ? Math.round((metrics.approvedCreatives / metrics.totalCreatives) * 100)
      : 0;

  // Weekly studio activity capsule bars (Mon - Sun) inspired by reference video
  const platformCounts = React.useMemo(() => {
    const counts = [
      { day: "Mon", label: "IG", value: 45 },
      { day: "Tue", label: "FB", value: 62 },
      { day: "Wed", label: "LI", value: 78 },
      { day: "Thu", label: "TT", value: 92 },
      { day: "Fri", label: "X", value: 55 },
      { day: "Sat", label: "Pin", value: 40 },
      { day: "Sun", label: "Vid", value: 70 },
    ];
    if (creatives.length > 0) {
      const byPlat: Record<string, number> = {};
      for (const c of creatives) {
        byPlat[c.platform] = (byPlat[c.platform] ?? 0) + 1;
      }
      const maxVal = Math.max(1, ...Object.values(byPlat));
      const keys = ["instagram", "facebook", "linkedin", "tiktok", "x", "pinterest"];
      keys.forEach((k, idx) => {
        if (counts[idx] && byPlat[k]) {
          counts[idx].value = Math.max(30, Math.round((byPlat[k] / maxVal) * 100));
        }
      });
    }
    return counts;
  }, [creatives]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Pillio-Style Greeting Header */}
      <div className="flex flex-col justify-between gap-4 pb-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Good morning, {userFirstName}
          </h1>
          <p className="text-sm text-text-secondary">
            Extract your website identity and domain photos, generate full-image social posts with concise image text, and get lengthy SEO descriptions with hashtags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {brands.length > 0 || campaigns.length > 0 ? (
            <Button variant="danger" size="sm" onClick={handleClearAllWorkspaceData}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear All Data</span>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onNavigate("brands")}>
            Manage Websites
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate("video-generation")}>
            <span>Video Studio</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate("blog-studio")}>
            <span>Blog Studio</span>
          </Button>
          <Button variant="primary" onClick={() => onNavigate("studio")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Social Post</span>
          </Button>
        </div>
      </div>

      {/* Signature Pillio Hero Bento Grid (Periwinkle Gradient Card + Weekly Capsule Chart + Quick Pipeline) */}
      <section
        aria-label="Studio overview widgets"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12"
      >
        {/* Left Periwinkle-Violet Gradient Progress Card */}
        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 text-white shadow-[0_16px_36px_-8px_rgba(104,112,238,0.42)] lg:col-span-5"
          style={{
            background:
              "linear-gradient(135deg, #8E96FA 0%, #7B83F6 52%, #6870EE 100%)",
          }}
        >
          {/* Decorative soft diagonal glass stripes */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Today&apos;s Creative Pipeline
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {activeWorkspace.name}
              </h2>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="relative z-10 my-6 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {metrics.approvedCreatives}/{Math.max(metrics.totalCreatives, 1)}
                </span>
                <span className="text-sm font-medium text-white/85">
                  Posts Approved
                </span>
              </div>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                {approvalRate}% Ready
              </span>
            </div>

            {/* Pillio White Capsule Progress Bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25 p-0.5">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${Math.max(12, approvalRate)}%` }}
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs text-white/90">
            <span>
              {metrics.totalBrands} Brand(s) • {metrics.totalCampaigns} Campaign(s)
            </span>
            <button
              type="button"
              onClick={() => onNavigate("studio")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#111827] shadow-sm transition hover:bg-white/90"
            >
              <span>Open Post Studio</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Center Weekly Studio Activity Vertical Capsule Chart Card */}
        <Card className="flex flex-col justify-between lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Weekly Studio Activity</CardTitle>
              <span className="rounded-full bg-[#EEF0FF] px-2.5 py-1 text-[11px] font-semibold text-[#5B63E8]">
                7-Day Pulse
              </span>
            </div>
            <CardDescription className="text-xs">
              Multi-platform creative output & storyboard readiness
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex h-36 items-end justify-between gap-2.5 px-1 pt-4">
              {platformCounts.map((bar, idx) => {
                const isHighlight = idx === 3 || idx === 6;
                return (
                  <div
                    key={bar.day}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="relative flex h-24 w-full max-w-[28px] items-end overflow-hidden rounded-full bg-[#EEF0F7] p-0.5">
                      <div
                        className="w-full rounded-full transition-all duration-500"
                        style={{
                          height: `${bar.value}%`,
                          background: isHighlight
                            ? "linear-gradient(180deg, #8E96FA 0%, #6870EE 100%)"
                            : "#C7CCF8",
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-text-secondary">
                      {bar.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Quick Studio Actions & Schedule Card */}
        <Card className="flex flex-col justify-between lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Quick Studio Flows</CardTitle>
              <span className="inline-flex h-2 w-2 rounded-full bg-[#16A34A]" />
            </div>
            <CardDescription className="text-xs">
              Jump directly to any production stage
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate("studio")}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-subtle bg-surface-secondary px-3.5 py-2.5 text-left transition hover:border-border-strong hover:bg-surface-primary"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">
                  1. Post Studio
                </span>
                <span className="text-[11px] text-text-secondary">
                  Full-image social posts + SEO copy
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("video-generation")}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-subtle bg-surface-secondary px-3.5 py-2.5 text-left transition hover:border-border-strong hover:bg-surface-primary"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">
                  2. Video Studio
                </span>
                <span className="text-[11px] text-text-secondary">
                  AI instructions → Storyboard → Video
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("approvals")}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-subtle bg-surface-secondary px-3.5 py-2.5 text-left transition hover:border-border-strong hover:bg-surface-primary"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">
                  3. Review & Export
                </span>
                <span className="text-[11px] text-text-secondary">
                  {metrics.pendingApprovals} pending review
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
            </button>
          </CardContent>
        </Card>
      </section>

      {/* Interactive Launchpad when Workspace is Empty */}
      {brands.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Start From Scratch: Enter Your Website URL</CardTitle>
            <CardDescription>
              Your workspace is completely clean. Paste a website URL below to extract its colors, fonts, domain photos, and topic automatically.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleQuickStartSubmit}>
            <CardContent className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3 rounded-md bg-surface-secondary p-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-action-primary-bg text-action-primary-fg">
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text-primary">
                      Domain Image Extraction
                    </span>
                    <span className="text-xs text-text-secondary">
                      Automatically detects hero photos, product visuals, and brand colors from your website.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md bg-surface-secondary p-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-action-primary-bg text-action-primary-fg">
                    <Car className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text-primary">
                      Topic & Vehicle Graphics
                    </span>
                    <span className="text-xs text-text-secondary">
                      Detects your topic and adds supportive graphics, including vehicle showroom scenes when needed.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md bg-surface-secondary p-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-action-primary-bg text-action-primary-fg">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text-primary">
                      Concise Graphic + Lengthy SEO Copy
                    </span>
                    <span className="text-xs text-text-secondary">
                      Short, clean text on the post image (zero CTA clutter) paired with a detailed SEO description and hashtags.
                    </span>
                  </div>
                </div>
              </div>

              {quickError ? (
                <div
                  role="alert"
                  className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-sm text-status-danger-fg"
                >
                  {quickError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quick-url">Website URL</Label>
                  <Input
                    id="quick-url"
                    value={quickUrl}
                    onChange={(e) => setQuickUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quick-brand-name">Brand Name (Optional)</Label>
                  <Input
                    id="quick-brand-name"
                    value={quickBrandName}
                    onChange={(e) => setQuickBrandName(e.target.value)}
                    placeholder="Auto-detected from domain"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quick-logo">Brand Logo (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="quick-logo"
                      className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      <span className="truncate">
                        {quickLogoName || "Upload Logo"}
                      </span>
                    </label>
                    <input
                      id="quick-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleQuickLogoUpload}
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={isExtracting}>
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>Analyze Website & Open Post Studio</span>
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      {/* 4 Summary Counters */}
      <section
        aria-label="Workspace summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Saved Websites
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-text-primary">
                {metrics.totalBrands}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("brands")}>
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Campaigns
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-text-primary">
                {metrics.totalCampaigns}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("studio")}>
                Open Studio
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Generated Posts
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-text-primary">
                {metrics.totalCreatives}
              </span>
              <Badge variant="success">{metrics.approvedCreatives} Approved</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Pending Approval
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-text-primary">
                {metrics.pendingApprovals}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("approvals")}
              >
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recently Generated Creatives with Select All & Delete */}
      {recentCreatives.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <CardTitle>Recent Full-Image Social Posts</CardTitle>
                <CardDescription>
                  Select individual posts or Select All to delete or customize them.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("approvals")}
              >
                <span>Review All Posts</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary px-3.5 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-text-primary">
                <input
                  type="checkbox"
                  checked={
                    recentCreatives.length > 0 &&
                    selectedPostIds.length === recentCreatives.length
                  }
                  onChange={toggleSelectAllPosts}
                  className="h-4 w-4"
                />
                <span>
                  Select All ({selectedPostIds.length}/{recentCreatives.length})
                </span>
              </label>

              <Button
                variant="danger"
                size="sm"
                disabled={selectedPostIds.length === 0}
                onClick={() => handleDeletePosts(selectedPostIds)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Delete Selected ({selectedPostIds.length})</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentCreatives.map((creative) => {
                const brand = brands.find((b) => b.id === creative.brandId);
                const ver = creative.currentVersion;
                const isChecked = selectedPostIds.includes(creative.id);
                const imgUrl = `/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                  activeWorkspace.id
                )}&versionId=${encodeURIComponent(creative.currentVersionId)}`;

                return (
                  <div
                    key={creative.id}
                    className={`flex flex-col justify-between gap-3.5 rounded-2xl border p-5 transition-all ${
                      isChecked
                        ? "border-focus-ring bg-[#EEF0FF]/40 shadow-sm"
                        : "border-border-subtle bg-surface-primary shadow-[0_2px_12px_rgba(15,23,42,0.03)] hover:border-border-strong"
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-primary">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePostSelection(creative.id)}
                            className="h-4 w-4 accent-[#7078F4]"
                          />
                          <span>
                            {creative.platform} ({creative.width}×{creative.height})
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
                          {creative.approvalStatus === "approved" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>Option {creative.variationIndex}</span>
                        </Badge>
                      </div>

                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-surface-secondary">
                        <img
                          src={imgUrl}
                          alt={`${brand?.name ?? "Brand"} ${creative.platform} option ${creative.variationIndex}`}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </div>

                      {/* Pillio Progress Strip */}
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-medium text-text-secondary">
                          <span>Readiness</span>
                          <span className="font-semibold text-text-primary">
                            {creative.approvalStatus === "approved" ? "100% Approved" : "75% Pending Review"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F7]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: creative.approvalStatus === "approved" ? "100%" : "75%",
                              backgroundColor:
                                creative.approvalStatus === "approved"
                                  ? "#16A34A"
                                  : "#7B83F6",
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-text-primary">
                          {ver?.textOverrides.postTitle ?? "Social Post"}
                        </span>
                        <p className="line-clamp-3 text-xs text-text-secondary">
                          {ver?.textOverrides.caption}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(ver?.textOverrides.hashtags ?? [])
                            .slice(0, 4)
                            .map((tag) => (
                              <Badge key={tag} variant="info">
                                {tag}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenCreativeInStudio(creative.id, creative.campaignId)
                        }
                      >
                        Customize Post
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Saved Campaigns List */}
      {recentCampaigns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Campaigns</CardTitle>
            <CardDescription>
              Open any campaign in the Post Studio or delete old campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {recentCampaigns.map((camp) => {
                const brand = brands.find((b) => b.id === camp.brandId);
                const campCreatives = creatives.filter(
                  (c) => c.campaignId === camp.id
                );
                return (
                  <div
                    key={camp.id}
                    className="flex flex-col justify-between gap-3 rounded-md bg-surface-secondary p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-text-primary">
                        {camp.name}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {brand?.name ?? "Brand"} | {campCreatives.length} post(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const first = campCreatives[0];
                          if (first) {
                            onOpenCreativeInStudio(first.id, camp.id);
                          } else {
                            onNavigate("studio");
                          }
                        }}
                      >
                        Open in Studio
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete campaign ${camp.name}`}
                        title="Delete campaign"
                        onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                      >
                        <Trash2 className="h-4 w-4 text-status-danger-fg" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
