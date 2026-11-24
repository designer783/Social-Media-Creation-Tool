import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import sharp from "sharp";
import JSZip from "jszip";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBrand,
  createBrandKit,
  deleteCreatives,
  ensureSeedData,
  listCreatives,
  listPlatformPresets,
  setCreativeApprovalStatus,
} from "@/lib/db/repository";
import {
  editOrRegenerateCreative,
  generateFullCampaignCreatives,
} from "@/lib/services/creative-service";
import { exportApprovedCampaignZip } from "@/lib/exporter/campaign-zip";

function setupUserBrand(workspaceId: string) {
  const brand = createBrand(workspaceId, {
    name: "Velocity Auto Group",
    domain: "velocityauto.com",
    websiteUrl: "https://velocityauto.com",
  });

  const kit = createBrandKit(workspaceId, {
    brandId: brand.id,
    colors: {
      primary: "#0F172A",
      secondary: ["#1E293B", "#CBD5E1"],
      accent: "#E11D48",
      backgroundLight: "#F8FAFC",
      backgroundDark: "#0F172A",
      textOnLight: "#0F172A",
      textOnDark: "#FFFFFF",
    },
    typography: {
      headingFont: "Inter, sans-serif",
      bodyFont: "Inter, sans-serif",
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      scaleRatio: 1.25,
    },
    visualStyle: {
      characteristic: "bold",
      borderRadiusPx: 12,
      spacingUnitPx: 8,
      logoPlacementDefault: "top-left",
      ctaStyle: {
        shape: "pill",
        treatment: "solid",
        backgroundColor: "#E11D48",
        textColor: "#FFFFFF",
      },
      commonPatterns: ["Automotive showcase"],
    },
    extractionMeta: {
      sourceUrl: "https://velocityauto.com",
      extractedAt: new Date().toISOString(),
      fallbackUsed: false,
      pageTitle: "Velocity Auto Group — Performance Vehicles & Leasing",
      pageDescription: "Explore certified sports cars, electric SUVs, and executive fleet vehicles.",
      extractedHeadings: ["Certified Performance Vehicles", "Executive SUV Leasing"],
      extractedImages: [],
      detectedTopic: "automotive_vehicle",
      detectedColorsCount: 4,
      detectedFontsCount: 1,
    },
  });

  return { brand, kit };
}

describe("Full-Image Social Post Renderer, Supportive Graphics & Campaign ZIP Exporter", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("generates 3 full-image variations with supportive graphics per selected platform preset in PNG and WebP", async () => {
    const { workspace } = ensureSeedData();
    const { brand } = setupUserBrand(workspace.id);
    const presets = listPlatformPresets(workspace.id);

    const igSquare = presets.find(
      (p) => p.platform === "instagram" && p.formatName === "Square"
    )!;
    const liLandscape = presets.find(
      (p) => p.platform === "linkedin" && p.formatName === "Landscape"
    )!;

    const { campaign, creatives } = await generateFullCampaignCreatives({
      workspaceId: workspace.id,
      brandId: brand.id,
      campaignName: "2026 GT Vehicle Launch",
      objective: "Book showroom test drives",
      inputMode: "ai_topic",
      topic: "New 2026 Electric Sports Vehicle",
      supportiveGraphicStyle: "vehicle_showcase",
      supportiveBadgeText: "FEATURED VEHICLE",
      presetIds: [igSquare.id, liLandscape.id],
    });

    expect(campaign.name).toBe("2026 GT Vehicle Launch");
    expect(creatives).toHaveLength(6);

    const igCreatives = creatives.filter((c) => c.platform === "instagram");
    expect(igCreatives.map((c) => c.variationIndex)).toEqual([1, 2, 3]);

    for (const c of igCreatives) {
      const ver = c.currentVersion!;
      expect(ver.layoutOverrides.supportiveGraphicStyle).toBe("vehicle_showcase");
      expect(ver.layoutOverrides.supportiveBadgeText).toBe("FEATURED VEHICLE");
      expect(fs.existsSync(ver.renderedPngPath)).toBe(true);
      expect(fs.existsSync(ver.renderedWebpPath)).toBe(true);

      const pngMeta = await sharp(ver.renderedPngPath).metadata();
      expect(pngMeta.width).toBe(1080);
      expect(pngMeta.height).toBe(1080);
      expect(pngMeta.format).toBe("png");
    }

    const liCreative = creatives.find((c) => c.platform === "linkedin")!;
    const liMeta = await sharp(liCreative.currentVersion!.renderedPngPath).metadata();
    expect(liMeta.width).toBe(1200);
    expect(liMeta.height).toBe(627);
  });

  it("retains previous versions when editing text or supportive graphics, enforces approval before export, and structures ZIP by Brand/Campaign/Platform", async () => {
    const { workspace } = ensureSeedData();
    const { brand } = setupUserBrand(workspace.id);
    const presets = listPlatformPresets(workspace.id);
    const igSquare = presets.find(
      (p) => p.platform === "instagram" && p.formatName === "Square"
    )!;

    const { campaign, creatives } = await generateFullCampaignCreatives({
      workspaceId: workspace.id,
      brandId: brand.id,
      campaignName: "Executive Fleet Showcase",
      objective: "Direct fleet inquiries",
      inputMode: "website_grounded",
      presetIds: [igSquare.id],
    });

    const targetCreative = creatives[0]!;
    expect(targetCreative.versions).toHaveLength(1);

    const edited = await editOrRegenerateCreative({
      workspaceId: workspace.id,
      creativeId: targetCreative.id,
      layoutOverrides: {
        logoPlacement: "top-right",
        supportiveGraphicStyle: "vehicle_showcase",
        supportiveBadgeText: "2026 FLEET SPECIAL",
      },
      textOverrides: {
        postTitle: "Certified Performance Vehicles Ready Today",
        ctaText: "Reserve Your Vehicle",
      },
    });

    expect(edited.versions).toHaveLength(2);
    expect(edited.currentVersion?.versionNumber).toBe(2);
    expect(edited.currentVersion?.layoutOverrides.supportiveBadgeText).toBe(
      "2026 FLEET SPECIAL"
    );

    // Exporting before approval must fail
    await expect(
      exportApprovedCampaignZip({
        workspaceId: workspace.id,
        campaignId: campaign.id,
      })
    ).rejects.toThrow(/Approval required/);

    setCreativeApprovalStatus(
      workspace.id,
      [edited.id, creatives[1]!.id],
      "approved",
      "Studio Creator",
      "Approved for Instagram feed"
    );

    const { exportJob, zipBuffer } = await exportApprovedCampaignZip({
      workspaceId: workspace.id,
      campaignId: campaign.id,
      format: "both",
    });

    expect(exportJob.fileCount).toBe(6);

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const zipEntries = Object.keys(loadedZip.files);

    expect(
      zipEntries.some(
        (entry) =>
          entry.startsWith("Velocity Auto Group/Executive Fleet Showcase/Instagram/") &&
          entry.endsWith(".png")
      )
    ).toBe(true);
  });

  it("allows selecting specific visual options between 1 to 3 and bulk-deleting posts", async () => {
    const { workspace } = ensureSeedData();
    const { brand } = setupUserBrand(workspace.id);
    const presets = listPlatformPresets(workspace.id);
    const igSquare = presets.find(
      (p) => p.platform === "instagram" && p.formatName === "Square"
    )!;

    // Request only Visual Options 1 and 3 (2 options total)
    const { creatives } = await generateFullCampaignCreatives({
      workspaceId: workspace.id,
      brandId: brand.id,
      campaignName: "Selective Options Campaign",
      objective: "Brand visibility",
      inputMode: "ai_topic",
      topic: "Electric Sedan Showcase",
      selectedVariations: [1, 3],
      presetIds: [igSquare.id],
    });

    expect(creatives).toHaveLength(2);
    expect(creatives.map((c) => c.variationIndex)).toEqual([1, 3]);

    // Bulk delete the first post, verify 1 remains
    const deletedCount = deleteCreatives(workspace.id, [creatives[0]!.id]);
    expect(deletedCount).toBe(1);
    expect(listCreatives(workspace.id)).toHaveLength(1);
    expect(listCreatives(workspace.id)[0]?.variationIndex).toBe(3);
  });
});
