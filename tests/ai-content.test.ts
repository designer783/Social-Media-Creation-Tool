import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBrand,
  createBrandKit,
  ensureSeedData,
  listBrands,
  listCampaigns,
} from "@/lib/db/repository";
import { generateCampaignContent } from "@/lib/ai/content-engine";
import { generateVisualAsset } from "@/lib/ai/visual-provider";
import { buildGeminiDirectedImagePrompt } from "@/lib/ai/gemini-service";

function createTestBrandAndKit(workspaceId: string) {
  const brand = createBrand(workspaceId, {
    name: "Apex Electric Motors",
    domain: "apexmotors.com",
    websiteUrl: "https://apexmotors.com",
  });

  const kit = createBrandKit(workspaceId, {
    brandId: brand.id,
    colors: {
      primary: "#0F172A",
      secondary: ["#1E293B", "#94A3B8"],
      accent: "#2563EB",
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
      characteristic: "modern",
      borderRadiusPx: 10,
      spacingUnitPx: 8,
      logoPlacementDefault: "top-left",
      ctaStyle: {
        shape: "pill",
        treatment: "solid",
        backgroundColor: "#2563EB",
        textColor: "#FFFFFF",
      },
      commonPatterns: ["Vehicle showcase"],
    },
    extractionMeta: {
      sourceUrl: "https://apexmotors.com",
      extractedAt: new Date().toISOString(),
      fallbackUsed: false,
      pageTitle: "Apex Electric Motors — 2026 Performance EV Fleet",
      pageDescription: "All-wheel drive electric vehicles engineered for 550km range.",
      extractedHeadings: [
        "2026 Performance EV Lineup",
        "Zero-Emission Luxury SUVs",
      ],
      extractedImages: ["https://apexmotors.com/images/ev-hero.jpg"],
      detectedTopic: "automotive_vehicle",
      detectedColorsCount: 4,
      detectedFontsCount: 1,
    },
  });

  return { brand, kit };
}

describe("Clean Workspace Start, Short Image Text + Lengthy SEO Description & Vehicle Visuals", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("starts with zero pre-fed brands and zero pre-existing campaigns in a workspace", () => {
    const { workspace } = ensureSeedData();
    expect(listBrands(workspace.id)).toHaveLength(0);
    expect(listCampaigns(workspace.id)).toHaveLength(0);
  });

  it("keeps post image text short and concise with no CTA while generating a lengthy description with hashtags", async () => {
    const { workspace } = ensureSeedData();
    const { brand, kit } = createTestBrandAndKit(workspace.id);

    const results = await generateCampaignContent({
      workspaceId: workspace.id,
      brand,
      brandKit: kit,
      inputMode: "ai_topic",
      topic: "2026 All-Electric GT Coupe Test Drive Experience",
      objective: "Showcase showroom luxury and range performance",
    });

    expect(results).toHaveLength(1);
    const post = results[0]!;
    // Short and concise on-image text
    expect(post.postTitle.length).toBeLessThanOrEqual(42);
    expect(post.supportingCopy.length).toBeLessThanOrEqual(58);
    // No CTA on social media post
    expect(post.ctaText).toBe("");
    // Lengthy multi-paragraph description + hashtags
    expect(post.mainText.length).toBeGreaterThanOrEqual(220);
    expect(post.hashtags.length).toBeGreaterThanOrEqual(4);
  });

  it("weaves provided SEO keywords into the lengthy description and hashtags without inventing claims", async () => {
    const { workspace } = ensureSeedData();
    const { brand, kit } = createTestBrandAndKit(workspace.id);

    const results = await generateCampaignContent({
      workspaceId: workspace.id,
      brand,
      brandKit: kit,
      inputMode: "website_grounded",
      seoKeywords: ["ElectricSUV", "ZeroEmissionFleet", "ApexMotors"],
      adaptPerPlatform: true,
      platforms: ["instagram", "linkedin", "x"],
    });

    expect(results).toHaveLength(3);
    const igCopy = results.find((r) => r.platform === "instagram")!;
    expect(igCopy.postTitle).toBe("2026 Performance EV Lineup");
    expect(igCopy.ctaText).toBe("");
    expect(igCopy.mainText.length).toBeGreaterThanOrEqual(220);
    expect(igCopy.mainText).toContain("ElectricSUV");
    expect(igCopy.mainText).toContain("ZeroEmissionFleet");
    expect(igCopy.hashtags).toContain("#ElectricSUV");
    expect(igCopy.hashtags).toContain("#ZeroEmissionFleet");
  });

  it("produces high-resolution vehicle showcase and supportive graphic scenes for all 3 variations", async () => {
    const { workspace } = ensureSeedData();
    const { kit } = createTestBrandAndKit(workspace.id);

    for (const variationIndex of [1, 2, 3] as const) {
      const asset = await generateVisualAsset({
        workspaceId: workspace.id,
        prompt: "Luxury electric SUV showroom launch",
        width: 1080,
        height: 1080,
        brandColors: kit.colors,
        characteristic: kit.visualStyle.characteristic,
        variationIndex,
        supportiveGraphicStyle: "vehicle_showcase",
      });

      const meta = await sharp(asset.buffer).metadata();
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1080);
      expect(meta.format).toBe("png");
      expect(asset.providerUsed).toContain("automotive_vehicle");
    }
  });

  it("constructs commercial photography prompts via Gemini Art Director with strict no-text directives", async () => {
    const { workspace } = ensureSeedData();
    const { kit } = createTestBrandAndKit(workspace.id);

    const directed = await buildGeminiDirectedImagePrompt({
      brandName: "Apex Electric Motors",
      topicPrompt: "2026 Electric GT Coupe",
      detectedTopic: "automotive_vehicle",
      supportiveGraphicStyle: "vehicle_showcase",
      characteristic: "modern",
      brandColors: kit.colors,
      variationIndex: 1,
    });

    expect(directed.finalPrompt).toContain("commercial automotive photography");
    expect(directed.finalPrompt).toContain("no cartoon");
    expect(directed.finalPrompt).toContain("no text");
    expect(directed.finalPrompt).toContain("no watermark");
  });

  it("decodes HTML entities inside website-grounded SEO copy and honors customPromptOverride", async () => {
    const { workspace } = ensureSeedData();
    const { brand, kit } = createTestBrandAndKit(workspace.id);
    kit.extractionMeta.pageDescription =
      "Vehicle history report information &amp; specifications for modern fleets.";

    const copy = await generateCampaignContent({
      workspaceId: workspace.id,
      brand,
      brandKit: kit,
      inputMode: "website_grounded",
      seoKeywords: ["Fleet&Audit"],
    });
    expect(copy[0]!.mainText).not.toContain("&amp;");
    expect(copy[0]!.mainText).toContain("information & specifications");

    const customPrompt =
      "Bespoke 85mm studio photograph of silver coupe on rain-slicked European cobblestones at twilight, no text";
    const asset = await generateVisualAsset({
      workspaceId: workspace.id,
      brandName: brand.name,
      prompt: "Ignored fallback prompt",
      customPromptOverride: customPrompt,
      width: 1080,
      height: 1080,
      brandColors: kit.colors,
      characteristic: kit.visualStyle.characteristic,
      variationIndex: 1,
    });
    expect(asset.promptUsed).toBe(customPrompt);
  });
});
