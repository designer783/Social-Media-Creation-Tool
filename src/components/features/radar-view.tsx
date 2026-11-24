"use client";

import * as React from "react";
import { Radar, Sparkles, ArrowRight, Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { TrendSignal } from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface RadarViewProps {
  snapshot: WorkspaceSnapshot;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  onLaunchSignalInStudio: (signal: TrendSignal) => void;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function RadarView({
  snapshot,
  selectedBrandId,
  onSelectBrand,
  onLaunchSignalInStudio,
  onNavigate,
  apiRequest,
  announce,
}: RadarViewProps) {
  const activeBrand =
    snapshot.brands.find((b) => b.id === selectedBrandId) ?? snapshot.brands[0];

  const [competitorsRaw, setCompetitorsRaw] = React.useState("");
  const [focusQuery, setFocusQuery] = React.useState("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [radarError, setRadarError] = React.useState<string | null>(null);

  if (!activeBrand) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add a Brand Website to Activate Trend & Brand Radar</CardTitle>
          <CardDescription>
            Connect a website domain first so Gemini Search Grounding can monitor trends, competitor gaps, and content opportunities.
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

  const brandSignals = snapshot.radarSignals.filter(
    (s) => s.brandId === activeBrand.id && s.status !== "dismissed"
  );

  const handleScanRadar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setRadarError(null);
    try {
      const competitorDomains = competitorsRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await apiRequest<{ signals: TrendSignal[] }>("/api/radar", {
        method: "POST",
        taskLabel: `Running Gemini Search Grounding radar for ${activeBrand.name}...`,
        body: JSON.stringify({
          brandId: activeBrand.id,
          competitorDomains,
          focusQuery: focusQuery.trim() || undefined,
        }),
      });
      announce(`Detected ${res.signals.length} new radar signals for ${activeBrand.name}.`);
    } catch (err) {
      setRadarError(err instanceof Error ? err.message : "Radar scan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDismissSignal = async (signalId: string) => {
    await apiRequest("/api/radar", {
      method: "PATCH",
      taskLabel: "Dismissing signal...",
      body: JSON.stringify({ signalId, status: "dismissed" }),
    });
    announce("Dismissed radar signal.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Social Media Trend & Brand Radar
          </h1>
          <p className="text-sm text-text-secondary">
            Detect real-time industry trends, competitor content gaps, and website shifts using Gemini Search Grounding, then launch posts in one click.
          </p>
        </div>
        <Button variant="outline" onClick={() => onNavigate("studio")}>
          <span>Open Post Studio</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {radarError ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg"
        >
          {radarError}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Configure Brand & Competitor Scan</CardTitle>
            <Badge variant={snapshot.activeGeminiMeta.configured ? "success" : "info"}>
              {snapshot.activeGeminiMeta.configured
                ? `Gemini Search Grounding Ready (${snapshot.activeGeminiMeta.textModel})`
                : "Connect Gemini Key for Live Google Search Grounding"}
            </Badge>
          </div>
          <CardDescription>
            Gemini inspects live search signals for your brand domain, industry news, and optional competitor URLs.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleScanRadar}>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radar-brand">Brand Domain to Monitor</Label>
              <NativeSelect
                id="radar-brand"
                value={activeBrand.id}
                onChange={(e) => onSelectBrand(e.target.value)}
              >
                {snapshot.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.domain})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radar-competitors">
                Competitor Domains (Optional, Comma-Separated)
              </Label>
              <Input
                id="radar-competitors"
                value={competitorsRaw}
                onChange={(e) => setCompetitorsRaw(e.target.value)}
                placeholder="e.g. carvertical.com, autodna.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radar-focus">
                Trend Focus / Topic Angle (Optional)
              </Label>
              <Input
                id="radar-focus"
                value={focusQuery}
                onChange={(e) => setFocusQuery(e.target.value)}
                placeholder="e.g. Electric SUV market, seasonal offers"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" variant="primary" isLoading={isScanning}>
              <Radar className="h-4 w-4" aria-hidden="true" />
              <span>Scan Live Trends & Opportunities</span>
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Detected Signals for {activeBrand.name} ({brandSignals.length})
          </CardTitle>
          <CardDescription>
            Click &ldquo;Launch Post from Signal&rdquo; on any card to pre-fill Post Studio with the detected hook and SEO keywords.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brandSignals.length === 0 ? (
            <div className="rounded-md bg-surface-secondary p-6 text-sm text-text-secondary">
              No radar signals scanned yet for {activeBrand.name}. Click &ldquo;Scan Live Trends & Opportunities&rdquo; above to detect trending angles.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {brandSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="flex flex-col justify-between gap-4 rounded-md border border-border-subtle bg-surface-secondary p-5"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">
                          {sig.signalType.replace("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="success">
                          {sig.relevanceScore}% Relevance
                        </Badge>
                        {sig.status === "launched" ? (
                          <Badge variant="neutral">Used in Studio</Badge>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Dismiss signal"
                        onClick={() => handleDismissSignal(sig.id)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold text-text-primary">
                        {sig.title}
                      </h3>
                      <p className="text-sm text-text-secondary">{sig.summary}</p>
                    </div>

                    <div className="rounded-md bg-surface-primary p-3">
                      <span className="text-xs font-medium text-text-muted">
                        Suggested Graphic Headline:
                      </span>
                      <div className="text-sm font-bold text-text-primary">
                        {sig.suggestedHeadline}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sig.seoKeywords.map((kw) => (
                        <Badge key={kw} variant="neutral">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                    <span className="truncate text-xs text-text-muted">
                      {sig.sourceUrls[0] ?? activeBrand.websiteUrl}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onLaunchSignalInStudio(sig)}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Launch Post from Signal</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
