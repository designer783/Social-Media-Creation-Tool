import { describe, it, expect, beforeEach } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBlogProject,
  createBrand,
  createWorkspaceWithDefaults,
  listBlogDimensionPresets,
  updateBlogProject,
  upsertBlogDimensionPreset,
} from "@/lib/db/repository";
import {
  SEO_VOLUME_DISCLAIMER,
  detectInputIntelligenceMode,
  enrichTopicAndKeywords,
  generateBlogResearchAndOutline,
  generateFullBlogArticle,
  regenerateSingleOutlineSection,
  suggestBlogIdeasForBrand,
  transformArticleSectionContent,
  formatHumaneMetaDescription,
  formatHumaneSeoTitle,
  formatHumaneSlug,
} from "@/lib/ai/blog-engine";

describe("Blog Studio Module (PRD Section 4.1 - 4.7)", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("seeds the 4 configurable Featured Image Dimension presets and supports custom dimension presets (Section 4.2)", () => {
    const ws = createWorkspaceWithDefaults({
      name: "Blog Dimensions Workspace",
      ownerId: "user-blog-1",
    });

    const presets = listBlogDimensionPresets(ws.id);
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => `${p.formatName}:${p.width}x${p.height}`)).toEqual([
      "Square:1080x1080",
      "Landscape:1200x675",
      "Portrait:1080x1350",
      "Rectangle:1200x628",
    ]);

    const customPreset = upsertBlogDimensionPreset(ws.id, {
      formatName: "Ultrawide Header",
      width: 1600,
      height: 720,
      usageDescription: "Custom hero article banner",
    });
    expect(customPreset.width).toBe(1600);
    expect(customPreset.height).toBe(720);
    expect(listBlogDimensionPresets(ws.id)).toHaveLength(5);
  });

  it("handles Input Intelligence for topic+keywords, topic-only, keywords-only, and neither (Section 4.3)", async () => {
    const ws = createWorkspaceWithDefaults({
      name: "Blog Intelligence Workspace",
      ownerId: "user-blog-2",
    });
    const brand = createBrand(ws.id, {
      name: "VehicleHistory EU",
      domain: "vehiclehistory.eu",
      websiteUrl: "https://vehiclehistory.eu",
    });

    // 1. Neither -> suggests relevant blog ideas based on the brand
    expect(
      detectInputIntelligenceMode({
        topic: "",
        keywords: { primaryKeyword: "", secondaryKeywords: [], supportingKeywords: [] },
      })
    ).toBe("neither");
    const ideas = await suggestBlogIdeasForBrand({ brand, industry: "Automotive" });
    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas[0]?.topic.length).toBeGreaterThan(10);

    // 2. Topic only -> researches and suggests relevant keywords
    const topicOnly = enrichTopicAndKeywords({
      topic: "How to Verify Used Car Mileage Across European Borders",
      keywords: { primaryKeyword: "", secondaryKeywords: [], supportingKeywords: [] },
      brand,
    });
    expect(topicOnly.mode).toBe("topic_only");
    expect(topicOnly.resolvedKeywords.primaryKeyword.length).toBeGreaterThan(2);
    expect(topicOnly.resolvedKeywords.secondaryKeywords.length).toBeGreaterThan(0);

    // 3. Keywords only -> develops a suitable blog topic
    const keywordsOnly = enrichTopicAndKeywords({
      topic: "",
      keywords: {
        primaryKeyword: "VIN history check",
        secondaryKeywords: ["odometer rollback", "damage records"],
        supportingKeywords: ["used car inspection"],
      },
      brand,
    });
    expect(keywordsOnly.mode).toBe("keywords_only");
    expect(keywordsOnly.resolvedTopic).toContain("VIN history check");
  });

  it("enforces outline approval before generating the complete article and preserves source URLs and version history (Sections 4.4 - 4.7)", async () => {
    const ws = createWorkspaceWithDefaults({
      name: "Blog Lifecycle Workspace",
      ownerId: "user-blog-3",
    });
    const brand = createBrand(ws.id, {
      name: "Northstar Analytics",
      domain: "northstar.io",
      websiteUrl: "https://northstar.io",
    });

    let project = createBlogProject(ws.id, {
      brandId: brand.id,
      topic: "Practical Guide to SaaS Revenue Forecasting",
      keywords: {
        primaryKeyword: "SaaS revenue forecasting",
        secondaryKeywords: ["cohort retention analysis", "pipeline predictability"],
        supportingKeywords: ["ARR modeling", "churn mitigation"],
      },
      imageFormatName: "Landscape",
      imageWidth: 1200,
      imageHeight: 675,
      desiredWordCount: 1000,
      competitorUrls: ["https://example.com/saas-forecasting-benchmark"],
    });

    const { research, outline } = await generateBlogResearchAndOutline({
      project,
      brand,
    });

    // Section 4.4: SEO Research & Disclaimer + Preserved external URLs
    expect(research.disclaimer).toBe(SEO_VOLUME_DISCLAIMER);
    expect(
      research.groundedSources.some(
        (s) => s.url === "https://example.com/saas-forecasting-benchmark"
      )
    ).toBe(true);
    expect(outline.approved).toBe(false);
    expect(outline.sections.length).toBeGreaterThanOrEqual(4);

    project = updateBlogProject(ws.id, project.id, {
      research,
      outline,
      status: "outline_ready",
    });

    // Section 4.5: Must NOT generate full article before outline is approved
    await expect(
      generateFullBlogArticle({ project, brand })
    ).rejects.toThrow(/Outline approval is required/);

    // Section 4.5: Regenerate an individual outline section
    const targetOutlineSectionId = outline.sections[0]!.id;
    const regenOutlineSec = await regenerateSingleOutlineSection({
      project,
      sectionId: targetOutlineSectionId,
      customDirection: "Include executive KPI examples",
      brand,
    });
    expect(regenOutlineSec.h2Heading).toContain("Include executive KPI examples");

    // Approve outline
    project = updateBlogProject(ws.id, project.id, {
      outline: {
        ...outline,
        approved: true,
        approvedAt: new Date().toISOString(),
      },
      status: "outline_approved",
    });

    // Section 4.6: Generate complete article after outline approval
    const { article } = await generateFullBlogArticle({ project, brand });
    expect(article.blogTitle).toBeTruthy();
    expect(article.seoTitle.length).toBeLessThanOrEqual(60);
    expect(article.metaDescription.length).toBeGreaterThan(50);
    expect(article.suggestedSlug).toContain("saas-revenue-forecasting");
    expect(article.h1Heading).toBeTruthy();
    expect(article.introduction.length).toBeGreaterThan(80);
    expect(article.sections.length).toBe(outline.sections.length);
    expect(article.internalLinks.length).toBeGreaterThan(0);
    expect(article.externalSources.length).toBeGreaterThan(0);
    expect(article.faqs.length).toBeGreaterThan(0);
    expect(article.conclusion.length).toBeGreaterThan(40);
    expect(article.cta.length).toBeGreaterThan(20);
    expect(article.featuredImageUrl.startsWith("data:image/svg+xml;base64,")).toBe(
      true
    );
    expect(article.featuredImageWidth).toBe(1200);
    expect(article.featuredImageHeight).toBe(675);
    expect(article.imageAltText).toContain("Northstar Analytics");
    expect(article.imageCaption).toContain("Northstar Analytics");
    expect(article.keywordPlacements[0]?.keyword).toBe("SaaS revenue forecasting");
    expect(article.keywordPlacements[0]?.occurrences).toBeGreaterThan(1);

    // Section 4.7: Section transformations (expand, shorten, rewrite, change_tone)
    const firstSec = article.sections[0]!;
    const expandedSec = transformArticleSectionContent({
      section: firstSec,
      transformation: "expand",
      primaryKeyword: "SaaS revenue forecasting",
      brandName: brand.name,
    });
    expect(expandedSec.paragraphs.length).toBeGreaterThan(
      firstSec.paragraphs.length
    );
  });

  it("produces humane, non-truncated meta descriptions and titles without repetitive AI phrasing", () => {
    // Test the exact scenario from the user's issue: "automotive strategies" with "Vehiclehub"
    const metaDesc = formatHumaneMetaDescription({
      mainKw: "automotive strategies",
      secondaryKws: ["workflow optimization", "operational efficiency"],
      brandName: "Vehiclehub",
    });

    expect(metaDesc.length).toBeLessThanOrEqual(158);
    expect(metaDesc.endsWith("Vehiclehub.")).toBe(true);
    // Ensure no repetitive "practical strategies for automotive strategies"
    expect(metaDesc).not.toContain("strategies for automotive strategies");
    expect(metaDesc).toContain("Vehiclehub");
    // Ensure not cut mid-word like "Vehicleh"
    expect(metaDesc).not.toMatch(/Vehicleh\b/);

    const safeTitle = formatHumaneSeoTitle(
      "Comprehensive Checklist for Modern Enterprise Cloud Migration Architecture",
      "EnterpriseCloudHub"
    );
    expect(safeTitle.length).toBeLessThanOrEqual(60);
    expect(safeTitle).not.toMatch(/\s$/);

    const safeSlug = formatHumaneSlug(
      "automotive strategies",
      "How to Streamline Dealer Network Operations in 2026"
    );
    expect(safeSlug.length).toBeLessThanOrEqual(70);
    expect(safeSlug).not.toMatch(/-$/);
  });
});
