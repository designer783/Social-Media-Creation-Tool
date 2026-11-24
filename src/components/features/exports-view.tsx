"use client";

import * as React from "react";
import { Download, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExportJob } from "@/types/domain";
import type { WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface ExportsViewProps {
  snapshot: WorkspaceSnapshot;
  selectedCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function ExportsView({
  snapshot,
  selectedCampaignId,
  onSelectCampaign,
  apiRequest,
  announce,
}: ExportsViewProps) {
  const activeCampaign =
    snapshot.campaigns.find((c) => c.id === selectedCampaignId) ??
    snapshot.campaigns[0];

  const [exportFormat, setExportFormat] = React.useState<"both" | "png" | "webp">(
    snapshot.activeWorkspace.settings.defaultExportFormat ?? "both"
  );
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const approvedCreatives = snapshot.creatives.filter(
    (c) =>
      (activeCampaign ? c.campaignId === activeCampaign.id : true) &&
      c.approvalStatus === "approved"
  );

  const handleGenerateZip = async () => {
    if (!activeCampaign) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await apiRequest<{ exportJob: ExportJob }>("/api/exports", {
        method: "POST",
        taskLabel: `Packaging approved creatives into Brand/Campaign/Platform ZIP archive...`,
        body: JSON.stringify({
          campaignId: activeCampaign.id,
          format: exportFormat,
        }),
      });
      announce(
        `Created campaign ZIP export with ${res.exportJob.fileCount} files.`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Exported Creatives & Campaign Packages
          </h1>
          <p className="text-sm text-text-secondary">
            Download individual approved creatives in PNG or WebP, or package the complete campaign as a structured ZIP archive.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={!activeCampaign || approvedCreatives.length === 0}
          isLoading={isExporting}
          onClick={handleGenerateZip}
        >
          <FolderArchive className="h-4 w-4" aria-hidden="true" />
          <span>Build Campaign ZIP ({approvedCreatives.length} Approved)</span>
        </Button>
      </div>

      {exportError ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg"
        >
          {exportError}
        </div>
      ) : null}

      {/* Campaign & Format Selector */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-campaign-select">Select Campaign</Label>
            <NativeSelect
              id="export-campaign-select"
              value={activeCampaign?.id ?? ""}
              onChange={(e) => onSelectCampaign(e.target.value)}
            >
              {snapshot.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-format-select">Bulk ZIP Image Format</Label>
            <NativeSelect
              id="export-format-select"
              value={exportFormat}
              onChange={(e) =>
                setExportFormat(e.target.value as "both" | "png" | "webp")
              }
            >
              <option value="both">Both PNG and WebP + Copy Manifest</option>
              <option value="png">PNG Only + Copy Manifest</option>
              <option value="webp">WebP Only + Copy Manifest</option>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {/* Approved Creatives Individual Download Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            Approved Creatives Ready for Export ({approvedCreatives.length})
          </CardTitle>
          <CardDescription>
            Only creatives that have passed the approval gate appear in this export package.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedCreatives.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No creatives are currently approved for this campaign. Approve variations in the Approvals tab or Creative Studio first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {approvedCreatives.map((creative) => {
                const brand = snapshot.brands.find((b) => b.id === creative.brandId);
                const imgUrl = `/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                  snapshot.activeWorkspace.id
                )}&versionId=${encodeURIComponent(creative.currentVersionId)}`;

                return (
                  <div
                    key={creative.id}
                    className="flex flex-col justify-between gap-3 rounded-md bg-surface-secondary p-4"
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase text-text-secondary">
                          {creative.platform} {creative.formatName}
                        </span>
                        <Badge variant="success">
                          {creative.width}×{creative.height}
                        </Badge>
                      </div>

                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-surface-tertiary">
                        <img
                          src={imgUrl}
                          alt={`${brand?.name ?? "Brand"} approved ${creative.platform} variation ${creative.variationIndex}`}
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <span className="text-sm font-semibold text-text-primary">
                        Variation {creative.variationIndex} (v
                        {creative.currentVersion?.versionNumber ?? 1})
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                            snapshot.activeWorkspace.id
                          )}&format=png&download=1`}
                          download
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Download PNG</span>
                        </a>
                      </Button>
                      <Button asChild variant="secondary" size="sm">
                        <a
                          href={`/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                            snapshot.activeWorkspace.id
                          )}&format=webp&download=1`}
                          download
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Download WebP</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated ZIP Packages & Folder Hierarchy Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Campaign ZIP Packages</CardTitle>
          <CardDescription>
            Archives are structured automatically by Brand Name / Campaign Name / Platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.exportJobs.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No bulk ZIP archives generated yet. Click &ldquo;Build Campaign ZIP&rdquo; above to package your approved creatives.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {snapshot.exportJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 rounded-md bg-surface-secondary p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-text-primary">
                        {job.brandName} / {job.campaignName}
                      </span>
                      <span className="text-xs text-text-secondary">
                        Format: {job.format.toUpperCase()} | {job.fileCount} files packaged |{" "}
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <Button asChild variant="primary" size="sm">
                      <a
                        href={`/api/exports?workspaceId=${encodeURIComponent(
                          snapshot.activeWorkspace.id
                        )}&exportId=${encodeURIComponent(job.id)}`}
                        download
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Download Campaign ZIP</span>
                      </a>
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-sm bg-surface-tertiary p-3 font-mono text-xs text-text-secondary">
                    {job.manifestPaths.map((entry) => (
                      <div key={entry}>{entry}</div>
                    ))}
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
