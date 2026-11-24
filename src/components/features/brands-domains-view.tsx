"use client";

import * as React from "react";
import { Globe, RefreshCw, ArrowRight, Upload, Trash2 } from "lucide-react";
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

interface BrandsDomainsViewProps {
  snapshot: WorkspaceSnapshot;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function BrandsDomainsView({
  snapshot,
  selectedBrandId,
  onSelectBrand,
  onNavigate,
  apiRequest,
  announce,
}: BrandsDomainsViewProps) {
  const [name, setName] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [logoDataUrl, setLogoDataUrl] = React.useState<string | null>(null);
  const [logoFileName, setLogoFileName] = React.useState<string>("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Logo file exceeds the 5 MB limit. Choose a smaller PNG, JPEG, WebP, or SVG.");
      return;
    }
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoDataUrl(reader.result);
        setFormError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlBlur = () => {
    const trimmed = websiteUrl.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (!websiteUrl.startsWith("http")) {
        setWebsiteUrl(parsed.toString());
      }
      if (!domain.trim()) {
        const cleanHost = parsed.hostname.replace(/^www\./, "");
        setDomain(cleanHost);
        if (!name.trim()) {
          const base = cleanHost.split(".")[0]?.replace(/[-_]/g, " ") ?? "";
          if (base) {
            setName(base.charAt(0).toUpperCase() + base.slice(1));
          }
        }
      }
      setFormError(null);
    } catch {
      setFormError("Enter a valid website URL starting with https:// or http://.");
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) {
      setFormError("Enter a website URL to analyze.");
      return;
    }

    let resolvedUrl = websiteUrl.trim();
    let resolvedDomain = domain.trim();
    try {
      const parsed = new URL(
        resolvedUrl.startsWith("http") ? resolvedUrl : `https://${resolvedUrl}`
      );
      resolvedUrl = parsed.toString();
      if (!resolvedDomain) {
        resolvedDomain = parsed.hostname.replace(/^www\./, "");
      }
    } catch {
      setFormError("Enter a valid website URL (e.g. https://example.com).");
      return;
    }

    const resolvedName =
      name.trim() ||
      resolvedDomain.split(".")[0]?.replace(/[-_]/g, " ") ||
      "Brand";

    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await apiRequest<{ brand: Brand; brandKit: BrandKit }>("/api/brands", {
        method: "POST",
        taskLabel: `Analyzing ${resolvedUrl} for colors, fonts, topic, and domain images...`,
        body: JSON.stringify({
          name: resolvedName,
          domain: resolvedDomain,
          websiteUrl: resolvedUrl,
          logoDataUrl,
        }),
      });
      onSelectBrand(res.brand.id);
      announce(`Extracted brand kit and images for ${res.brand.name}.`);
      setName("");
      setDomain("");
      setWebsiteUrl("");
      setLogoDataUrl(null);
      setLogoFileName("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to extract brand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReExtract = async (brand: Brand) => {
    try {
      await apiRequest("/api/brands", {
        method: "PATCH",
        taskLabel: `Re-analyzing ${brand.websiteUrl} for brand styles and domain images...`,
        body: JSON.stringify({
          brandId: brand.id,
          reExtract: true,
        }),
      });
      announce(`Re-extracted brand styles and domain images for ${brand.name}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Re-extraction failed.");
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!window.confirm(`Delete brand "${brand.name}" and its associated campaigns?`)) {
      return;
    }
    await apiRequest(`/api/brands?brandId=${encodeURIComponent(brand.id)}`, {
      method: "DELETE",
      taskLabel: `Removing ${brand.name}...`,
    });
    announce(`Removed brand ${brand.name}.`);
  };

  const handleReplaceLogo = (brand: Brand, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        await apiRequest("/api/brands", {
          method: "PATCH",
          taskLabel: `Updating logo for ${brand.name}...`,
          body: JSON.stringify({
            brandId: brand.id,
            logoDataUrl: reader.result,
          }),
        });
        announce(`Updated logo for ${brand.name}.`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">Brands & Websites</h1>
          <p className="text-sm text-text-secondary">
            Enter a website URL to automatically extract its brand colors, fonts, topic, and website images.
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("studio")}>
          <span>Open Creative Studio</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg"
        >
          {formError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Add a New Brand */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Add a Website Domain</CardTitle>
            <CardDescription>
              Paste any website URL. We extract its brand colors, fonts, topic, and page images automatically.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAddBrand}>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-url-input">Website URL</Label>
                <Input
                  id="brand-url-input"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-name-input">Brand Name</Label>
                <Input
                  id="brand-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-filled from URL if left blank"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-domain-input">Domain</Label>
                <Input
                  id="brand-domain-input"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-logo-upload">Brand Logo (Optional)</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="brand-logo-upload"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>{logoFileName || "Upload Logo Image"}</span>
                  </label>
                  <input
                    id="brand-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="sr-only"
                  />
                  {logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt="Uploaded brand logo preview"
                      className="h-11 w-11 rounded-sm border border-border-subtle bg-surface-tertiary object-contain p-1"
                    />
                  ) : null}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>Extract Brand & Website Images</span>
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Saved Brands List */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Your Saved Brands ({snapshot.brands.length})</CardTitle>
            <CardDescription>
              Select a saved brand to create social posts using its extracted identity and website images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.brands.length === 0 ? (
              <div className="rounded-md bg-surface-secondary p-6 text-sm text-text-secondary">
                No brands saved yet. Enter a website URL on the left to extract your first brand identity and domain images.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {snapshot.brands.map((brand) => {
                  const isSelected = brand.id === selectedBrandId;
                  const kits = snapshot.brandKits.filter((k) => k.brandId === brand.id);
                  const activeKit =
                    kits.find((k) => k.id === brand.activeKitId) ?? kits[0];
                  const extractedImgs = activeKit?.extractionMeta.extractedImages ?? [];
                  const detectedTopic =
                    activeKit?.extractionMeta.detectedTopic?.replace("_", " ") ??
                    "general";

                  return (
                    <div
                      key={brand.id}
                      className={`flex flex-col gap-4 rounded-md border p-5 ${
                        isSelected
                          ? "border-focus-ring bg-surface-secondary"
                          : "border-border-subtle bg-surface-secondary"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="flex items-start gap-3">
                          {brand.logoDataUrl ? (
                            <img
                              src={brand.logoDataUrl}
                              alt={`${brand.name} logo`}
                              className="h-12 w-12 shrink-0 rounded-md border border-border-subtle bg-surface-primary object-contain p-1"
                            />
                          ) : (
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                              style={{
                                backgroundColor: activeKit?.colors.primary ?? "#0F172A",
                                color: activeKit?.colors.textOnDark ?? "#FFFFFF",
                              }}
                            >
                              {brand.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-text-primary">
                                {brand.name}
                              </h3>
                              {isSelected ? (
                                <Badge variant="success">Selected</Badge>
                              ) : null}
                              <Badge variant="info">Topic: {detectedTopic}</Badge>
                              <Badge variant="neutral">
                                {extractedImgs.length} Website Image(s)
                              </Badge>
                            </div>
                            <span className="text-xs text-text-secondary">
                              {brand.websiteUrl}
                            </span>
                          </div>
                        </div>

                        {activeKit ? (
                          <div className="flex items-center gap-1.5" aria-label="Extracted brand colors">
                            {[
                              activeKit.colors.primary,
                              activeKit.colors.accent,
                              ...activeKit.colors.secondary.slice(0, 2),
                            ].map((hex, i) => (
                              <span
                                key={`${brand.id}-swatch-${i}`}
                                className="inline-block h-6 w-6 rounded-sm border border-border-strong"
                                style={{ backgroundColor: hex }}
                                title={hex}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Extracted Domain Reference Images Preview Strip */}
                      {extractedImgs.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-text-secondary">
                            Extracted Reference Images (Used by Gemini as visual reference only):
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {extractedImgs.slice(0, 5).map((imgUrl, idx) => (
                              <img
                                key={`${brand.id}-ext-img-${idx}`}
                                src={imgUrl}
                                alt={`${brand.name} extracted domain visual ${idx + 1}`}
                                className="h-14 w-20 shrink-0 rounded-sm border border-border-subtle bg-surface-tertiary object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onSelectBrand(brand.id);
                              onNavigate("studio");
                            }}
                          >
                            Create Post for {brand.name}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              onSelectBrand(brand.id);
                              onNavigate("video-generation");
                            }}
                          >
                            Video Studio
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onSelectBrand(brand.id);
                              onNavigate("brand-kits");
                            }}
                          >
                            Colors & Fonts
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReExtract(brand)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Re-extract</span>
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`replace-logo-${brand.id}`}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Logo</span>
                            <input
                              id={`replace-logo-${brand.id}`}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              onChange={(e) => handleReplaceLogo(brand, e)}
                              className="sr-only"
                            />
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete brand ${brand.name}`}
                            title="Delete brand"
                            onClick={() => handleDeleteBrand(brand)}
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
    </div>
  );
}
