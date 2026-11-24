"use client";

import * as React from "react";
import { CalendarClock, TrendingUp, Save, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SocialPostTracker } from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface TrackerViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  onOpenCreativeInStudio: (creativeId: string, campaignId: string) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function TrackerView({
  snapshot,
  onNavigate,
  onOpenCreativeInStudio,
  apiRequest,
  announce,
}: TrackerViewProps) {
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | SocialPostTracker["trackingStatus"]
  >("all");
  const [aiInsight, setAiInsight] = React.useState<{
    summary: string;
    nextMoves: string[];
    modelUsed: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  // Local editable drafts keyed by creativeId
  const [drafts, setDrafts] = React.useState<
    Record<
      string,
      {
        trackingStatus: SocialPostTracker["trackingStatus"];
        scheduledFor: string;
        publishedUrl: string;
        utmTag: string;
        impressions: string;
        clicks: string;
        engagements: string;
        notes: string;
      }
    >
  >({});

  React.useEffect(() => {
    const nextDrafts: typeof drafts = {};
    for (const creative of snapshot.creatives) {
      const existing = snapshot.socialTrackers.find(
        (t) => t.creativeId === creative.id
      );
      nextDrafts[creative.id] = {
        trackingStatus: existing?.trackingStatus ?? "planned",
        scheduledFor:
          existing?.scheduledFor ?? new Date().toISOString().slice(0, 16),
        publishedUrl: existing?.publishedUrl ?? "",
        utmTag:
          existing?.utmTag ??
          `utm_source=${creative.platform}&utm_medium=social&utm_campaign=${creative.campaignId.slice(0, 8)}`,
        impressions: String(existing?.impressions ?? 0),
        clicks: String(existing?.clicks ?? 0),
        engagements: String(existing?.engagements ?? 0),
        notes: existing?.notes ?? "",
      };
    }
    setDrafts(nextDrafts);
  }, [snapshot.creatives, snapshot.socialTrackers]);

  const updateDraft = (
    creativeId: string,
    patch: Partial<(typeof drafts)[string]>
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [creativeId]: {
        ...prev[creativeId],
        ...patch,
      },
    }));
  };

  const handleSaveTracker = async (creativeId: string) => {
    const d = drafts[creativeId];
    if (!d) return;
    await apiRequest("/api/tracker", {
      method: "POST",
      taskLabel: "Saving social post schedule and performance metrics...",
      body: JSON.stringify({
        action: "upsert",
        creativeId,
        trackingStatus: d.trackingStatus,
        scheduledFor: d.scheduledFor,
        publishedUrl: d.publishedUrl,
        utmTag: d.utmTag,
        impressions: parseInt(d.impressions, 10) || 0,
        clicks: parseInt(d.clicks, 10) || 0,
        engagements: parseInt(d.engagements, 10) || 0,
        notes: d.notes,
      }),
    });
    announce("Updated post tracking schedule and metrics.");
  };

  const handleAnalyzePerformance = async () => {
    setIsAnalyzing(true);
    try {
      const res = await apiRequest<{
        insight: { summary: string; nextMoves: string[]; modelUsed: string };
      }>("/api/tracker", {
        method: "POST",
        taskLabel: "Analyzing tracked social performance with Gemini...",
        body: JSON.stringify({ action: "analyze" }),
      });
      setAiInsight(res.insight);
      announce("Completed Gemini social performance analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalImpressions = snapshot.socialTrackers.reduce(
    (acc, t) => acc + t.impressions,
    0
  );
  const totalClicks = snapshot.socialTrackers.reduce(
    (acc, t) => acc + t.clicks,
    0
  );
  const totalEngagements = snapshot.socialTrackers.reduce(
    (acc, t) => acc + t.engagements,
    0
  );
  const publishedCount = snapshot.socialTrackers.filter(
    (t) => t.trackingStatus === "published"
  ).length;

  const visibleCreatives = snapshot.creatives.filter((c) => {
    const status = drafts[c.id]?.trackingStatus ?? "planned";
    return statusFilter === "all" ? true : status === statusFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Social Media Post Tracker & Calendar
          </h1>
          <p className="text-sm text-text-secondary">
            Track every post across Planned, Scheduled, and Published stages with UTM tags, live URLs, and engagement analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => onNavigate("studio")}>
            Create New Post
          </Button>
          <Button
            variant="primary"
            isLoading={isAnalyzing}
            onClick={handleAnalyzePerformance}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Analyze Performance with Gemini</span>
          </Button>
        </div>
      </div>

      {/* Performance Summary Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Published Posts
            </span>
            <span className="text-3xl font-bold text-text-primary">
              {publishedCount}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Total Impressions
            </span>
            <span className="text-3xl font-bold text-text-primary">
              {totalImpressions.toLocaleString()}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Tracked Link Clicks
            </span>
            <span className="text-3xl font-bold text-text-primary">
              {totalClicks.toLocaleString()}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-text-secondary">
              Total Engagements
            </span>
            <span className="text-3xl font-bold text-text-primary">
              {totalEngagements.toLocaleString()}
            </span>
          </CardContent>
        </Card>
      </section>

      {/* Gemini Closed-Loop Strategy Insight */}
      {aiInsight ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Gemini Closed-Loop Performance Insights</CardTitle>
              <Badge variant="info">{aiInsight.modelUsed}</Badge>
            </div>
            <CardDescription>{aiInsight.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-text-secondary">
                Recommended Next Moves:
              </span>
              {aiInsight.nextMoves.map((move, i) => (
                <div
                  key={`move-${i}`}
                  className="flex items-center gap-2 rounded-md bg-surface-secondary p-3 text-sm text-text-primary"
                >
                  <TrendingUp className="h-4 w-4 shrink-0 text-status-success-fg" aria-hidden="true" />
                  <span>{move}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Tracker Table / Cards */}
      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <CardTitle>Post Pipeline & Analytics ({visibleCreatives.length})</CardTitle>
            <CardDescription>
              Schedule posts, attach UTM tags and live post URLs, and log engagement metrics.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="tracker-status-filter" className="sr-only">
              Filter by tracking stage
            </Label>
            <NativeSelect
              id="tracker-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | SocialPostTracker["trackingStatus"]
                )
              }
            >
              <option value="all">All Stages</option>
              <option value="planned">Planned</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent>
          {visibleCreatives.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No social posts to track yet. Generate a post in Post Studio first.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleCreatives.map((creative) => {
                const brand = snapshot.brands.find((b) => b.id === creative.brandId);
                const d = drafts[creative.id];
                if (!d) return null;

                const imgUrl = `/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                  snapshot.activeWorkspace.id
                )}&versionId=${encodeURIComponent(creative.currentVersionId)}`;

                return (
                  <div
                    key={creative.id}
                    className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-secondary p-4 lg:flex-row"
                  >
                    <div className="flex shrink-0 items-start gap-3 lg:w-64">
                      <img
                        src={imgUrl}
                        alt={`${creative.platform} post preview`}
                        className="h-24 w-24 shrink-0 rounded-sm bg-surface-tertiary object-contain"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase text-text-secondary">
                          {creative.platform} {creative.formatName}
                        </span>
                        <span className="text-sm font-semibold text-text-primary">
                          {creative.currentVersion?.textOverrides.postTitle}
                        </span>
                        <span className="text-xs text-text-muted">
                          {brand?.name} | {creative.approvalStatus}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onOpenCreativeInStudio(creative.id, creative.campaignId)
                          }
                        >
                          Edit Creative
                        </Button>
                      </div>
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`status-${creative.id}`} className="text-xs">
                          Pipeline Stage
                        </Label>
                        <NativeSelect
                          id={`status-${creative.id}`}
                          value={d.trackingStatus}
                          onChange={(e) =>
                            updateDraft(creative.id, {
                              trackingStatus: e.target
                                .value as SocialPostTracker["trackingStatus"],
                            })
                          }
                        >
                          <option value="planned">Planned</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="published">Published</option>
                          <option value="archived">Archived</option>
                        </NativeSelect>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`sched-${creative.id}`} className="text-xs">
                          <CalendarClock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          Schedule Date/Time
                        </Label>
                        <Input
                          id={`sched-${creative.id}`}
                          type="datetime-local"
                          value={d.scheduledFor}
                          onChange={(e) =>
                            updateDraft(creative.id, {
                              scheduledFor: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`url-${creative.id}`} className="text-xs">
                          Published Post URL
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            id={`url-${creative.id}`}
                            value={d.publishedUrl}
                            onChange={(e) =>
                              updateDraft(creative.id, {
                                publishedUrl: e.target.value,
                              })
                            }
                            placeholder="https://instagram.com/p/..."
                          />
                          {d.publishedUrl.startsWith("http") ? (
                            <Button asChild variant="outline" size="icon">
                              <a
                                href={d.publishedUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Open published URL"
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`utm-${creative.id}`} className="text-xs">
                          UTM Tracking Tag
                        </Label>
                        <Input
                          id={`utm-${creative.id}`}
                          value={d.utmTag}
                          onChange={(e) =>
                            updateDraft(creative.id, { utmTag: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`impr-${creative.id}`} className="text-xs">
                          Impressions
                        </Label>
                        <Input
                          id={`impr-${creative.id}`}
                          type="number"
                          min={0}
                          value={d.impressions}
                          onChange={(e) =>
                            updateDraft(creative.id, {
                              impressions: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`clicks-${creative.id}`} className="text-xs">
                          Clicks
                        </Label>
                        <Input
                          id={`clicks-${creative.id}`}
                          type="number"
                          min={0}
                          value={d.clicks}
                          onChange={(e) =>
                            updateDraft(creative.id, { clicks: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`eng-${creative.id}`} className="text-xs">
                          Engagements
                        </Label>
                        <Input
                          id={`eng-${creative.id}`}
                          type="number"
                          min={0}
                          value={d.engagements}
                          onChange={(e) =>
                            updateDraft(creative.id, {
                              engagements: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-end justify-end">
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => handleSaveTracker(creative.id)}
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          <span>Save Tracking</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
