"use client";

import * as React from "react";
import { Save, CopyPlus, ArrowRight } from "lucide-react";
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
import { getContrastRatio, pickAccessibleTextColor } from "@/lib/utils";
import type {
  BrandKit,
  CtaShape,
  CtaTreatment,
  DesignCharacteristic,
  LogoPlacement,
} from "@/types/domain";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface BrandKitsViewProps {
  snapshot: WorkspaceSnapshot;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(url: string, options?: RequestInit & { taskLabel?: string }) => Promise<T>;
  announce: (msg: string) => void;
}

export function BrandKitsView({
  snapshot,
  selectedBrandId,
  onSelectBrand,
  onNavigate,
  apiRequest,
  announce,
}: BrandKitsViewProps) {
  const activeBrand =
    snapshot.brands.find((b) => b.id === selectedBrandId) ?? snapshot.brands[0];
  const brandKits = snapshot.brandKits.filter((k) => k.brandId === activeBrand?.id);
  const [selectedKitId, setSelectedKitId] = React.useState<string>("");

  React.useEffect(() => {
    if (activeBrand) {
      setSelectedKitId(activeBrand.activeKitId ?? brandKits[0]?.id ?? "");
    }
  }, [activeBrand, brandKits]);

  const activeKit: BrandKit | undefined =
    brandKits.find((k) => k.id === selectedKitId) ?? brandKits[0];

  const [kitName, setKitName] = React.useState("");
  const [primaryColor, setPrimaryColor] = React.useState("#0F172A");
  const [secondaryA, setSecondaryA] = React.useState("#334155");
  const [secondaryB, setSecondaryB] = React.useState("#CBD5E1");
  const [accentColor, setAccentColor] = React.useState("#2563EB");
  const [bgLight, setBgLight] = React.useState("#F8FAFC");
  const [bgDark, setBgDark] = React.useState("#0F172A");
  const [headingFont, setHeadingFont] = React.useState("Inter, sans-serif");
  const [bodyFont, setBodyFont] = React.useState("Inter, sans-serif");
  const [scaleRatio, setScaleRatio] = React.useState("1.25");
  const [characteristic, setCharacteristic] =
    React.useState<DesignCharacteristic>("modern");
  const [ctaShape, setCtaShape] = React.useState<CtaShape>("rounded");
  const [ctaTreatment, setCtaTreatment] = React.useState<CtaTreatment>("solid");
  const [borderRadiusPx, setBorderRadiusPx] = React.useState(8);
  const [logoPlacement, setLogoPlacement] = React.useState<LogoPlacement>("top-left");

  React.useEffect(() => {
    if (!activeKit) return;
    setKitName(activeKit.name);
    setPrimaryColor(activeKit.colors.primary);
    setSecondaryA(activeKit.colors.secondary[0] ?? "#334155");
    setSecondaryB(activeKit.colors.secondary[1] ?? "#CBD5E1");
    setAccentColor(activeKit.colors.accent);
    setBgLight(activeKit.colors.backgroundLight);
    setBgDark(activeKit.colors.backgroundDark);
    setHeadingFont(activeKit.typography.headingFont);
    setBodyFont(activeKit.typography.bodyFont);
    setScaleRatio(String(activeKit.typography.scaleRatio));
    setCharacteristic(activeKit.visualStyle.characteristic);
    setCtaShape(activeKit.visualStyle.ctaStyle.shape);
    setCtaTreatment(activeKit.visualStyle.ctaStyle.treatment);
    setBorderRadiusPx(activeKit.visualStyle.borderRadiusPx);
    setLogoPlacement(activeKit.visualStyle.logoPlacementDefault);
  }, [activeKit]);

  if (!activeBrand || !activeKit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Brand Kit Available</CardTitle>
          <CardDescription>
            Add a brand domain first to extract or configure its Brand Kit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => onNavigate("brands")}>
            Go to Brands & Domains
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSaveKit = async (createNewVersion: boolean) => {
    const updatedColors = {
      primary: primaryColor,
      secondary: [secondaryA, secondaryB],
      accent: accentColor,
      backgroundLight: bgLight,
      backgroundDark: bgDark,
      textOnLight: pickAccessibleTextColor(bgLight),
      textOnDark: pickAccessibleTextColor(bgDark),
    };

    const updatedTypography = {
      headingFont,
      bodyFont,
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      scaleRatio: parseFloat(scaleRatio) || 1.25,
    };

    const updatedVisualStyle = {
      characteristic,
      borderRadiusPx: Number(borderRadiusPx) || 8,
      spacingUnitPx: 8,
      logoPlacementDefault: logoPlacement,
      ctaStyle: {
        shape: ctaShape,
        treatment: ctaTreatment,
        backgroundColor: accentColor,
        textColor: pickAccessibleTextColor(accentColor),
      },
      commonPatterns: activeKit.visualStyle.commonPatterns,
    };

    const res = await apiRequest<{ brandKit: BrandKit }>("/api/brand-kits", {
      method: "PATCH",
      taskLabel: createNewVersion
        ? "Saving new Brand Kit version..."
        : "Updating active Brand Kit...",
      body: JSON.stringify({
        kitId: activeKit.id,
        name: kitName,
        status: "approved",
        colors: updatedColors,
        typography: updatedTypography,
        visualStyle: updatedVisualStyle,
        createNewVersion,
      }),
    });

    setSelectedKitId(res.brandKit.id);
    announce(
      createNewVersion
        ? `Saved Brand Kit Version ${res.brandKit.version}.`
        : `Updated and approved ${res.brandKit.name}.`
    );
  };

  const lightContrast = getContrastRatio(bgLight, pickAccessibleTextColor(bgLight));
  const darkContrast = getContrastRatio(bgDark, pickAccessibleTextColor(bgDark));
  const ctaContrast = getContrastRatio(accentColor, pickAccessibleTextColor(accentColor));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text-primary">
            Brand Identity Kits
          </h1>
          <p className="text-sm text-text-secondary">
            Review extracted brand tokens, adjust colors and typography manually, and manage saved Brand Kit versions.
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("studio")}>
          <span>Use Approved Kit in Studio</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Brand & Version Selector Bar */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kit-brand-select">Brand Domain</Label>
            <NativeSelect
              id="kit-brand-select"
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
            <Label htmlFor="kit-version-select">Saved Brand Kit Version</Label>
            <NativeSelect
              id="kit-version-select"
              value={activeKit.id}
              onChange={(e) => setSelectedKitId(e.target.value)}
            >
              {brandKits.map((k) => (
                <option key={k.id} value={k.id}>
                  Version {k.version}: {k.name} ({k.status})
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {activeKit.extractionMeta.fallbackUsed ? (
        <div
          role="status"
          className="rounded-md border border-status-warning-border bg-status-warning-bg p-4 text-sm text-status-warning-fg"
        >
          <strong>Manual Fallback Active:</strong> {activeKit.extractionMeta.fallbackReason} You can customize every brand property below and save your approved kit.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Color Palette, Typography & Visual Style Editor */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Extracted Identity Parameters</CardTitle>
              <Badge variant="success">Version {activeKit.version} Approved</Badge>
            </div>
            <CardDescription>
              All creatives generated for {activeBrand.name} strictly enforce these tokens through the Brand Consistency Engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kit-name-input">Kit Profile Name</Label>
              <Input
                id="kit-name-input"
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
              />
            </div>

            {/* Color Palette Grid */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Brand Color Palette
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {[
                  { id: "c-primary", label: "Primary Color", val: primaryColor, set: setPrimaryColor },
                  { id: "c-accent", label: "Accent / CTA Color", val: accentColor, set: setAccentColor },
                  { id: "c-sec-a", label: "Secondary Color 1", val: secondaryA, set: setSecondaryA },
                  { id: "c-sec-b", label: "Secondary Color 2", val: secondaryB, set: setSecondaryB },
                  { id: "c-bg-light", label: "Light Surface", val: bgLight, set: setBgLight },
                  { id: "c-bg-dark", label: "Dark Surface", val: bgDark, set: setBgDark },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-md bg-surface-secondary p-3"
                  >
                    <Label htmlFor={item.id} className="text-xs">
                      {item.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`${item.id}-picker`}
                        type="color"
                        aria-label={`${item.label} color picker`}
                        value={item.val}
                        onChange={(e) => item.set(e.target.value.toUpperCase())}
                        className="h-11 w-11 shrink-0 cursor-pointer rounded-sm border border-border-strong bg-surface-primary p-0.5"
                      />
                      <Input
                        id={item.id}
                        value={item.val}
                        onChange={(e) => item.set(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography Hierarchy */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-heading-font">Heading Font Family (H1–H6)</Label>
                <Input
                  id="kit-heading-font"
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-body-font">Body Font Family</Label>
                <Input
                  id="kit-body-font"
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-scale-ratio">Typography Scale Ratio</Label>
                <NativeSelect
                  id="kit-scale-ratio"
                  value={scaleRatio}
                  onChange={(e) => setScaleRatio(e.target.value)}
                >
                  <option value="1.2">1.200 (Minor Third)</option>
                  <option value="1.25">1.250 (Major Third)</option>
                  <option value="1.333">1.333 (Perfect Fourth)</option>
                </NativeSelect>
              </div>
            </div>

            {/* Design Characteristics & CTA Button Rules */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-characteristic">Design Characteristic</Label>
                <NativeSelect
                  id="kit-characteristic"
                  value={characteristic}
                  onChange={(e) =>
                    setCharacteristic(e.target.value as DesignCharacteristic)
                  }
                >
                  <option value="minimal">Minimal</option>
                  <option value="modern">Modern</option>
                  <option value="premium">Premium</option>
                  <option value="bold">Bold</option>
                  <option value="corporate">Corporate</option>
                  <option value="editorial">Editorial</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-cta-shape">CTA Button Shape</Label>
                <NativeSelect
                  id="kit-cta-shape"
                  value={ctaShape}
                  onChange={(e) => setCtaShape(e.target.value as CtaShape)}
                >
                  <option value="sharp">Sharp (2px)</option>
                  <option value="rounded">Rounded (10px)</option>
                  <option value="pill">Pill (Full Radius)</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-cta-treatment">CTA Treatment</Label>
                <NativeSelect
                  id="kit-cta-treatment"
                  value={ctaTreatment}
                  onChange={(e) => setCtaTreatment(e.target.value as CtaTreatment)}
                >
                  <option value="solid">Solid Fill</option>
                  <option value="outline">Framed Outline</option>
                  <option value="soft">Soft Tonal</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kit-logo-placement">Default Logo Placement</Label>
                <NativeSelect
                  id="kit-logo-placement"
                  value={logoPlacement}
                  onChange={(e) =>
                    setLogoPlacement(e.target.value as LogoPlacement)
                  }
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-center">Top Center</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </NativeSelect>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => handleSaveKit(true)}
            >
              <CopyPlus className="h-4 w-4" aria-hidden="true" />
              <span>Save as New Kit Version</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSaveKit(false)}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save & Approve Active Kit</span>
            </Button>
          </CardFooter>
        </Card>

        {/* Right Column: Live Brand System Preview & WCAG Verification */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Live Brand System Preview</CardTitle>
            <CardDescription>
              Real-time specimen showing how the deterministic renderer applies your Brand Kit tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Dark Surface Preview */}
            <div
              className="flex flex-col gap-3 rounded-md p-5"
              style={{
                backgroundColor: bgDark,
                color: pickAccessibleTextColor(bgDark),
                borderRadius: `${borderRadiusPx}px`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase opacity-80">
                  Dark Surface Specimen ({darkContrast}:1 Contrast)
                </span>
                <span
                  className="inline-block h-2 w-10 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <h4
                className="text-xl font-bold"
                style={{ fontFamily: headingFont }}
              >
                {activeBrand.name}: Signature Brand Identity
              </h4>
              <p
                className="text-sm opacity-90"
                style={{ fontFamily: bodyFont }}
              >
                Deterministic typography, approved color contrast, and calibrated CTA geometry.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: accentColor,
                    color: pickAccessibleTextColor(accentColor),
                    borderRadius:
                      ctaShape === "pill" ? "999px" : ctaShape === "sharp" ? "2px" : "8px",
                  }}
                >
                  Explore {activeBrand.domain} ({ctaContrast}:1)
                </span>
              </div>
            </div>

            {/* Light Surface Preview */}
            <div
              className="flex flex-col gap-3 border border-border-subtle p-5"
              style={{
                backgroundColor: bgLight,
                color: pickAccessibleTextColor(bgLight),
                borderRadius: `${borderRadiusPx}px`,
              }}
            >
              <span className="text-xs font-semibold uppercase opacity-75">
                Light Surface Specimen ({lightContrast}:1 Contrast)
              </span>
              <h4
                className="text-lg font-bold"
                style={{ fontFamily: headingFont }}
              >
                Consistent Multi-Platform Hierarchy
              </h4>
              <p
                className="text-sm opacity-85"
                style={{ fontFamily: bodyFont }}
              >
                Weights: Regular (400), Medium (500), Semibold (600), Bold (700).
              </p>
            </div>

            {/* Extracted Website Facts Summary */}
            <div className="flex flex-col gap-2 rounded-md bg-surface-secondary p-4">
              <span className="text-xs font-semibold text-text-primary">
                Website Extraction Metadata
              </span>
              <span className="text-xs text-text-secondary">
                Source: {activeKit.extractionMeta.sourceUrl}
              </span>
              {activeKit.extractionMeta.pageTitle ? (
                <span className="text-xs text-text-secondary">
                  Detected Title: {activeKit.extractionMeta.pageTitle}
                </span>
              ) : null}
              {activeKit.extractionMeta.extractedHeadings?.length ? (
                <span className="text-xs text-text-muted">
                  Key Headings: {activeKit.extractionMeta.extractedHeadings.join(" | ")}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
