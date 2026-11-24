"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ArrowRight, Trash2 } from "lucide-react";
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
import type { ApprovalStatus, SocialPlatform } from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface ApprovalsViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  onOpenCreativeInStudio: (creativeId: string, campaignId: string) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function ApprovalsView({
  snapshot,
  onNavigate,
  onOpenCreativeInStudio,
  apiRequest,
  announce,
}: ApprovalsViewProps) {
  const [platformFilter, setPlatformFilter] = React.useState<"all" | SocialPlatform>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ApprovalStatus>("all");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const filteredCreatives = snapshot.creatives.filter((c) => {
    if (platformFilter !== "all" && c.platform !== platformFilter) return false;
    if (statusFilter !== "all" && c.approvalStatus !== statusFilter) return false;
    return true;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    if (
      filteredCreatives.length > 0 &&
      selectedIds.length === filteredCreatives.length
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCreatives.map((c) => c.id));
    }
  };

  const handleBulkStatus = async (status: ApprovalStatus, targetIds?: string[]) => {
    const ids = targetIds ?? selectedIds;
    if (ids.length === 0) return;

    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Updating approval status for ${ids.length} post(s)...`,
      body: JSON.stringify({
        action: "status",
        creativeIds: ids,
        status,
        note: `Marked ${status} in Approvals review queue`,
      }),
    });
    setSelectedIds([]);
    announce(`Marked ${ids.length} post(s) as ${status}.`);
  };

  const handleDeletePosts = async (targetIds?: string[]) => {
    const ids = targetIds ?? selectedIds;
    if (ids.length === 0) return;

    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Deleting ${ids.length} post(s)...`,
      body: JSON.stringify({
        action: "delete_creatives",
        creativeIds: ids,
      }),
    });
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    announce(`Deleted ${ids.length} post(s).`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Review, Approve & Manage Posts
          </h1>
          <p className="text-sm text-text-secondary">
            Select individual posts or Select All to approve, reject, or delete generated variations.
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("exports")}>
          <span>Proceed to Approved Exports</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Filter & Bulk Action Toolbar */}
      <Card>
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="approvals-platform-filter">Platform</Label>
              <NativeSelect
                id="approvals-platform-filter"
                value={platformFilter}
                onChange={(e) =>
                  setPlatformFilter(e.target.value as "all" | SocialPlatform)
                }
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="approvals-status-filter">Approval Status</Label>
              <NativeSelect
                id="approvals-status-filter"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | ApprovalStatus)
                }
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved Only</option>
                <option value="rejected">Rejected Only</option>
              </NativeSelect>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface-secondary px-3.5 py-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={
                  filteredCreatives.length > 0 &&
                  selectedIds.length === filteredCreatives.length
                }
                onChange={selectAllVisible}
                className="h-4 w-4"
              />
              <span>
                Select All ({selectedIds.length}/{filteredCreatives.length})
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => handleBulkStatus("approved")}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Approve Selected ({selectedIds.length})</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => handleBulkStatus("rejected")}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              <span>Reject Selected</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => handleDeletePosts()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Delete Selected ({selectedIds.length})</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Variations Review Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Posts Queue ({filteredCreatives.length})</CardTitle>
          <CardDescription>
            Check the box on any post to include it in bulk actions, or use the quick action buttons on each card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCreatives.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No social posts match the current filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreatives.map((creative) => {
                const isChecked = selectedIds.includes(creative.id);
                const brand = snapshot.brands.find((b) => b.id === creative.brandId);
                const campaign = snapshot.campaigns.find(
                  (c) => c.id === creative.campaignId
                );
                const ver = creative.currentVersion;
                const imgUrl = `/api/creatives/${creative.id}/image?workspaceId=${encodeURIComponent(
                  snapshot.activeWorkspace.id
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
                            onChange={() => toggleSelection(creative.id)}
                            className="h-4 w-4 accent-[#7078F4]"
                          />
                          <span>
                            {creative.platform} {creative.formatName} ({creative.width}×
                            {creative.height})
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
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                          <span>{creative.approvalStatus}</span>
                        </Badge>
                      </div>

                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-surface-secondary">
                        <img
                          src={imgUrl}
                          alt={`${brand?.name ?? "Brand"} ${creative.platform} option ${creative.variationIndex}`}
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-text-primary">
                          Option {creative.variationIndex}:{" "}
                          {ver?.textOverrides.postTitle}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {brand?.name} | {campaign?.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenCreativeInStudio(creative.id, creative.campaignId)
                        }
                      >
                        Customize
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant={
                            creative.approvalStatus === "approved"
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          onClick={() => handleBulkStatus("approved", [creative.id])}
                        >
                          Approve
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
