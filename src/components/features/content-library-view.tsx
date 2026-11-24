"use client";

import * as React from "react";
import { Copy, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface ContentLibraryViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (module: StudioModuleId) => void;
  onSelectCampaign: (campaignId: string) => void;
  apiRequest?: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function ContentLibraryView({
  snapshot,
  onNavigate,
  onSelectCampaign,
  apiRequest,
  announce,
}: ContentLibraryViewProps) {
  const [selectedContentIds, setSelectedContentIds] = React.useState<string[]>([]);

  const toggleItem = (id: string) => {
    setSelectedContentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (
      snapshot.contentItems.length > 0 &&
      selectedContentIds.length === snapshot.contentItems.length
    ) {
      setSelectedContentIds([]);
    } else {
      setSelectedContentIds(snapshot.contentItems.map((c) => c.id));
    }
  };

  const handleDeleteSelected = async (idsToDelete: string[]) => {
    if (!apiRequest || idsToDelete.length === 0) return;
    await apiRequest("/api/approvals", {
      method: "POST",
      taskLabel: `Deleting ${idsToDelete.length} description item(s)...`,
      body: JSON.stringify({
        action: "delete_content",
        contentIds: idsToDelete,
      }),
    });
    setSelectedContentIds((prev) =>
      prev.filter((id) => !idsToDelete.includes(id))
    );
    announce(`Deleted ${idsToDelete.length} description item(s).`);
  };

  const handleCopyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      announce(`Copied ${label} to clipboard.`);
    } catch {
      announce(`Ready to copy ${label}.`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            SEO Post Descriptions & Hashtags
          </h1>
          <p className="text-sm text-text-secondary">
            Every post pairs a short, concise image headline with a lengthy, SEO-enriched post description and hashtags.
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("studio")}>
          <span>Create New Social Post</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <CardTitle>
                Generated Post Descriptions ({snapshot.contentItems.length})
              </CardTitle>
              <CardDescription>
                Copy your full SEO description and hashtags or select items to delete.
              </CardDescription>
            </div>
          </div>

          {snapshot.contentItems.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary px-3.5 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-text-primary">
                <input
                  type="checkbox"
                  checked={
                    snapshot.contentItems.length > 0 &&
                    selectedContentIds.length === snapshot.contentItems.length
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4"
                />
                <span>
                  Select All ({selectedContentIds.length}/
                  {snapshot.contentItems.length})
                </span>
              </label>

              <Button
                variant="danger"
                size="sm"
                disabled={selectedContentIds.length === 0}
                onClick={() => handleDeleteSelected(selectedContentIds)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Delete Selected ({selectedContentIds.length})</span>
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {snapshot.contentItems.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No post descriptions generated yet. Create a social post in the Post Studio to see your lengthy SEO descriptions and hashtags here.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {snapshot.contentItems.map((item) => {
                const isChecked = selectedContentIds.includes(item.id);
                const campaign = snapshot.campaigns.find(
                  (c) => c.id === item.campaignId
                );
                const brand = snapshot.brands.find(
                  (b) => b.id === campaign?.brandId
                );

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-3 rounded-md border p-5 ${
                      isChecked
                        ? "border-focus-ring bg-surface-secondary"
                        : "border-border-subtle bg-surface-secondary"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(item.id)}
                          className="h-4 w-4"
                        />
                        <span className="text-base font-bold text-text-primary">
                          Short Image Headline: {item.postTitle}
                        </span>
                        <Badge variant="info">{item.platform}</Badge>
                        {brand ? <Badge variant="neutral">{brand.name}</Badge> : null}
                      </label>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopyText(
                              "SEO description and hashtags",
                              item.caption
                            )
                          }
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copy Full Description & Hashtags</span>
                        </Button>
                        {campaign ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              onSelectCampaign(campaign.id);
                              onNavigate("studio");
                            }}
                          >
                            Open in Studio
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete description ${item.postTitle}`}
                          title="Delete description"
                          onClick={() => handleDeleteSelected([item.id])}
                        >
                          <Trash2 className="h-4 w-4 text-status-danger-fg" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-text-muted">
                      <strong>Short Image Subtitle:</strong> {item.supportingCopy}
                    </p>

                    <div className="whitespace-pre-line rounded-md bg-surface-primary p-4 text-sm leading-relaxed text-text-primary">
                      {item.mainText}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <div className="flex flex-wrap gap-1.5">
                        {item.hashtags.map((tag) => (
                          <Badge key={tag} variant="info">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {campaign?.seoKeywords?.length ? (
                        <span className="text-xs text-text-secondary">
                          SEO Keywords Used:{" "}
                          <strong>{campaign.seoKeywords.join(", ")}</strong>
                        </span>
                      ) : null}
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
