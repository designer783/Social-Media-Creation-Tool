import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  computeArticleMetrics,
  detectInputIntelligenceMode,
  generateBlogResearchAndOutline,
  generateFullBlogArticle,
  generateRealTimeBlogImage,
  regenerateSingleOutlineSection,
  renderBlogFeaturedImageDataUrl,
  suggestBlogIdeasForBrand,
  transformArticleSectionContent,
  writeOrRefineBlogImagePrompt,
} from "@/lib/ai/blog-engine";
import {
  createBlogProject,
  createBrand,
  createBrandKit,
  deleteBlogProject,
  getBlogProjectById,
  getBrandById,
  getBrandKitById,
  listBlogDimensionPresets,
  listBlogProjects,
  listBrands,
  updateBlogProject,
  upsertBlogDimensionPreset,
} from "@/lib/db/repository";
import type {
  BlogArticleContent,
  BlogArticleVersion,
  BlogOutline,
  BlogSeoKeywords,
  Brand,
} from "@/types/domain";

function ensureWorkspaceBrand(workspaceId: string, preferredBrandId?: string): Brand {
  if (preferredBrandId) {
    const existing = getBrandById(workspaceId, preferredBrandId);
    if (existing) return existing;
  }
  const allBrands = listBrands(workspaceId);
  if (allBrands[0]) return allBrands[0];

  const createdBrand = createBrand(workspaceId, {
    name: "Studio Brand",
    domain: "studiobrand.com",
    websiteUrl: "https://studiobrand.com",
  });
  createBrandKit(workspaceId, {
    brandId: createdBrand.id,
    name: "Studio Brand Default Kit",
    colors: {
      primary: "#1E1B4B",
      secondary: ["#4338CA"],
      accent: "#7078F4",
      backgroundLight: "#F5F6FA",
      backgroundDark: "#111827",
      textOnLight: "#111827",
      textOnDark: "#FFFFFF",
    },
    typography: {
      headingFont: "Inter, sans-serif",
      bodyFont: "Inter, sans-serif",
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      scaleRatio: 1.25,
    },
    visualStyle: {
      characteristic: "editorial",
      borderRadiusPx: 16,
      spacingUnitPx: 8,
      logoPlacementDefault: "top-left",
      ctaStyle: {
        shape: "pill",
        treatment: "solid",
        backgroundColor: "#7078F4",
        textColor: "#FFFFFF",
      },
      commonPatterns: ["Editorial grid"],
    },
    extractionMeta: {
      sourceUrl: "https://studiobrand.com",
      extractedAt: new Date().toISOString(),
      fallbackUsed: false,
      detectedColorsCount: 3,
      detectedFontsCount: 1,
    },
  });
  return getBrandById(workspaceId, createdBrand.id)!;
}

export async function GET(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const projectId = req.nextUrl.searchParams.get("projectId");
    const dimensionPresets = listBlogDimensionPresets(wsId);

    if (projectId) {
      const project = getBlogProjectById(wsId, projectId);
      if (!project) {
        return NextResponse.json(
          { error: "Blog project not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ project, dimensionPresets });
    }

    return NextResponse.json({
      projects: listBlogProjects(wsId),
      dimensionPresets,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load Blog Studio." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "");

    // Section 4.3: Input Intelligence — Suggest Blog Ideas when neither Topic nor Keywords are entered
    if (action === "suggest_ideas") {
      const brand = ensureWorkspaceBrand(wsId, body.brandId ? String(body.brandId) : undefined);
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;
      const ideas = await suggestBlogIdeasForBrand({
        brand,
        brandKit,
        industry: body.industry ? String(body.industry) : undefined,
        targetAudience: body.targetAudience ? String(body.targetAudience) : undefined,
        geminiContext: { workspaceId: wsId, userId },
      });
      return NextResponse.json({ ideas, brandId: brand.id });
    }

    // Section 4.2: Configurable Featured Image Dimension Presets
    if (action === "upsert_dimension_preset") {
      const preset = upsertBlogDimensionPreset(wsId, {
        id: body.id ? String(body.id) : undefined,
        formatName: String(body.formatName || "Custom"),
        width: Number(body.width || 1200),
        height: Number(body.height || 675),
        usageDescription: body.usageDescription
          ? String(body.usageDescription)
          : undefined,
      });
      return NextResponse.json({
        preset,
        dimensionPresets: listBlogDimensionPresets(wsId),
      });
    }

    // Section 4.3, 4.4 & 4.5: Create/Update Project + Run SEO Research + Generate Proposed Outline
    if (action === "generate_outline") {
      const brand = ensureWorkspaceBrand(
        wsId,
        body.brandId ? String(body.brandId) : undefined
      );
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;

      const rawTopic = String(body.topic || "").trim();
      const rawKeywords = (body.keywords ?? {}) as Partial<BlogSeoKeywords>;
      const keywords: BlogSeoKeywords = {
        primaryKeyword: String(rawKeywords.primaryKeyword || "").trim(),
        secondaryKeywords: Array.isArray(rawKeywords.secondaryKeywords)
          ? rawKeywords.secondaryKeywords.map((k) => String(k).trim()).filter(Boolean)
          : [],
        supportingKeywords: Array.isArray(rawKeywords.supportingKeywords)
          ? rawKeywords.supportingKeywords.map((k) => String(k).trim()).filter(Boolean)
          : [],
      };

      const mode = detectInputIntelligenceMode({ topic: rawTopic, keywords });
      if (mode === "neither") {
        const ideas = await suggestBlogIdeasForBrand({
          brand,
          brandKit,
          industry: body.industry ? String(body.industry) : undefined,
          targetAudience: body.targetAudience ? String(body.targetAudience) : undefined,
          geminiContext: { workspaceId: wsId, userId },
        });
        return NextResponse.json(
          {
            requiresTopicOrIdeaSelection: true,
            inputIntelligenceMode: "neither",
            message:
              "Please enter a blog topic, add SEO keywords, or select one of the suggested blog ideas for your brand below.",
            suggestedIdeas: ideas,
          },
          { status: 200 }
        );
      }

      const existingProjectId = body.projectId ? String(body.projectId) : "";
      let project = existingProjectId
        ? getBlogProjectById(wsId, existingProjectId)
        : null;

      if (!project) {
        project = createBlogProject(wsId, {
          brandId: brand.id,
          topic: rawTopic,
          keywords,
          imageFormatName: String(body.imageFormatName || "Landscape"),
          imageWidth: Number(body.imageWidth || 1200),
          imageHeight: Number(body.imageHeight || 675),
          targetAudience: String(body.targetAudience || ""),
          industry: String(body.industry || ""),
          blogCategory: String(body.blogCategory || ""),
          desiredWordCount: Number(body.desiredWordCount || 1000),
          writingTone: String(body.writingTone || "Professional & Insightful"),
          targetCountry: String(body.targetCountry || "Global"),
          language: String(body.language || "English"),
          searchIntent: String(body.searchIntent || "Informational"),
          competitorUrls: Array.isArray(body.competitorUrls)
            ? body.competitorUrls.map((u) => String(u))
            : [],
          specificCta: String(body.specificCta || ""),
          additionalInstructions: String(body.additionalInstructions || ""),
          inputIntelligenceMode: mode,
        });
      } else {
        project = updateBlogProject(wsId, project.id, {
          brandId: brand.id,
          topic: rawTopic,
          keywords,
          imageFormatName: String(body.imageFormatName || project.imageFormatName),
          imageWidth: Number(body.imageWidth || project.imageWidth),
          imageHeight: Number(body.imageHeight || project.imageHeight),
          targetAudience:
            body.targetAudience !== undefined
              ? String(body.targetAudience)
              : project.targetAudience,
          industry:
            body.industry !== undefined ? String(body.industry) : project.industry,
          blogCategory:
            body.blogCategory !== undefined
              ? String(body.blogCategory)
              : project.blogCategory,
          desiredWordCount: Number(
            body.desiredWordCount || project.desiredWordCount
          ),
          writingTone:
            body.writingTone !== undefined
              ? String(body.writingTone)
              : project.writingTone,
          targetCountry:
            body.targetCountry !== undefined
              ? String(body.targetCountry)
              : project.targetCountry,
          language:
            body.language !== undefined ? String(body.language) : project.language,
          searchIntent:
            body.searchIntent !== undefined
              ? String(body.searchIntent)
              : project.searchIntent,
          competitorUrls: Array.isArray(body.competitorUrls)
            ? body.competitorUrls.map((u) => String(u))
            : project.competitorUrls,
          specificCta:
            body.specificCta !== undefined
              ? String(body.specificCta)
              : project.specificCta,
          additionalInstructions:
            body.additionalInstructions !== undefined
              ? String(body.additionalInstructions)
              : project.additionalInstructions,
          inputIntelligenceMode: mode,
        });
      }

      const generated = await generateBlogResearchAndOutline({
        project,
        brand,
        brandKit,
        geminiContext: { workspaceId: wsId, userId },
      });

      const updated = updateBlogProject(wsId, project.id, {
        topic: generated.topic,
        keywords: generated.keywords,
        inputIntelligenceMode: generated.inputIntelligenceMode,
        research: generated.research,
        outline: generated.outline,
        status: "outline_ready",
      });

      return NextResponse.json({
        project: updated,
        modelUsed: generated.modelUsed,
      });
    }

    // Section 4.5: Edit / Add / Delete / Reorder / Approve Outline
    if (action === "update_outline") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.outline) {
        return NextResponse.json(
          { error: "Blog project or outline not found." },
          { status: 404 }
        );
      }

      const incomingOutline = (body.outline ?? {}) as Partial<BlogOutline>;
      const approveOutline =
        body.approveOutline !== undefined
          ? Boolean(body.approveOutline)
          : incomingOutline.approved ?? project.outline.approved;

      const nextOutline: BlogOutline = {
        suggestedBlogTitle:
          incomingOutline.suggestedBlogTitle ?? project.outline.suggestedBlogTitle,
        introductionDirection:
          incomingOutline.introductionDirection ??
          project.outline.introductionDirection,
        h1Heading: incomingOutline.h1Heading ?? project.outline.h1Heading,
        sections: Array.isArray(incomingOutline.sections)
          ? incomingOutline.sections.map((s, idx) => ({
              id: s.id || crypto.randomUUID(),
              order: idx + 1,
              h2Heading: s.h2Heading || `Section ${idx + 1}`,
              h3Subsections: Array.isArray(s.h3Subsections)
                ? s.h3Subsections
                : [],
              talkingPoints: Array.isArray(s.talkingPoints) ? s.talkingPoints : [],
              relevantExamples: Array.isArray(s.relevantExamples)
                ? s.relevantExamples
                : [],
            }))
          : project.outline.sections,
        faqSuggestions: Array.isArray(incomingOutline.faqSuggestions)
          ? incomingOutline.faqSuggestions
          : project.outline.faqSuggestions,
        conclusionDirection:
          incomingOutline.conclusionDirection ?? project.outline.conclusionDirection,
        ctaRecommendation:
          incomingOutline.ctaRecommendation ?? project.outline.ctaRecommendation,
        approved: approveOutline,
        approvedAt: approveOutline
          ? project.outline.approvedAt || new Date().toISOString()
          : null,
      };

      const nextStatus = approveOutline
        ? project.currentArticle
          ? project.status
          : "outline_approved"
        : "outline_ready";

      const updated = updateBlogProject(wsId, projectId, {
        topic: nextOutline.suggestedBlogTitle || project.topic,
        outline: nextOutline,
        status: nextStatus,
      });

      return NextResponse.json({ project: updated });
    }

    // Section 4.5: Regenerate an individual outline section
    if (action === "regenerate_outline_section") {
      const projectId = String(body.projectId || "");
      const sectionId = String(body.sectionId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.outline) {
        return NextResponse.json(
          { error: "Blog project or outline not found." },
          { status: 404 }
        );
      }

      const brand = ensureWorkspaceBrand(wsId, project.brandId);
      const regeneratedSection = await regenerateSingleOutlineSection({
        project,
        sectionId,
        customDirection: body.customDirection
          ? String(body.customDirection)
          : undefined,
        brand,
        geminiContext: { workspaceId: wsId, userId },
      });

      const nextOutline: BlogOutline = {
        ...project.outline,
        sections: project.outline.sections.map((s) =>
          s.id === sectionId ? regeneratedSection : s
        ),
      };

      const updated = updateBlogProject(wsId, projectId, {
        outline: nextOutline,
      });
      return NextResponse.json({ project: updated, section: regeneratedSection });
    }

    // Section 4.6: Generate Complete Blog Article (Enforces Outline Approval + Never Overwrites Approved Edits Without Confirmation)
    if (action === "generate_article") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project) {
        return NextResponse.json(
          { error: "Blog project not found." },
          { status: 404 }
        );
      }

      if (!project.outline || !project.outline.approved) {
        return NextResponse.json(
          {
            error:
              "Do not generate the complete article until the outline has been approved. Please approve the outline first.",
          },
          { status: 400 }
        );
      }

      const confirmOverwrite = Boolean(body.confirmOverwrite);
      if (project.hasApprovedUserEdits && !confirmOverwrite) {
        return NextResponse.json(
          {
            error:
              "This article has approved user edits. Pass confirmOverwrite=true to confirm generating a new draft (your previous version will still be preserved in version history).",
            requiresOverwriteConfirmation: true,
          },
          { status: 409 }
        );
      }

      const brand = ensureWorkspaceBrand(wsId, project.brandId);
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;

      const { article, modelUsed } = await generateFullBlogArticle({
        project,
        brand,
        brandKit,
        geminiContext: { workspaceId: wsId, userId },
      });

      const nextVersionNum = (project.versions.length || 0) + 1;
      const newVersion: BlogArticleVersion = {
        id: crypto.randomUUID(),
        versionNumber: nextVersionNum,
        label:
          nextVersionNum === 1
            ? "Initial Generated Article"
            : `Regenerated Full Article (v${nextVersionNum})`,
        createdAt: new Date().toISOString(),
        isUserEdited: false,
        content: article,
      };

      const updated = updateBlogProject(wsId, projectId, {
        currentArticle: article,
        versions: [...project.versions, newVersion],
        status: "article_ready",
        hasApprovedUserEdits: false,
      });

      return NextResponse.json({ project: updated, modelUsed });
    }

    // Section 4.7: Edit & Approve Blog Content (Maintains Original & Revised Versions in History)
    if (action === "update_article") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.currentArticle) {
        return NextResponse.json(
          { error: "Blog article not found." },
          { status: 404 }
        );
      }

      const incomingArticle = (body.article ?? {}) as Partial<BlogArticleContent>;
      const nextKeywords: BlogSeoKeywords = body.keywords
        ? (body.keywords as BlogSeoKeywords)
        : project.keywords;

      const mergedBase: Omit<BlogArticleContent, "wordCount" | "keywordPlacements"> = {
        ...project.currentArticle,
        ...incomingArticle,
      };
      const metrics = computeArticleMetrics(mergedBase, nextKeywords);
      const nextArticle: BlogArticleContent = {
        ...mergedBase,
        ...metrics,
      };

      const approveArticle = Boolean(body.approveArticle);
      const revisionLabel = String(
        body.revisionLabel ||
          (approveArticle ? "Approved Final Article" : "User Edited Revision")
      );

      const nextVersionNum = (project.versions.length || 0) + 1;
      const newVersion: BlogArticleVersion = {
        id: crypto.randomUUID(),
        versionNumber: nextVersionNum,
        label: revisionLabel,
        createdAt: new Date().toISOString(),
        isUserEdited: true,
        content: nextArticle,
      };

      const updated = updateBlogProject(wsId, projectId, {
        topic: nextArticle.blogTitle || project.topic,
        keywords: nextKeywords,
        currentArticle: nextArticle,
        versions: [...project.versions, newVersion],
        status: approveArticle ? "approved" : project.status,
        hasApprovedUserEdits: true,
      });

      return NextResponse.json({ project: updated });
    }

    // Section 4.7: Section-Level AI Transformations (Rewrite, Expand, Shorten, Regenerate, Change Tone)
    if (action === "transform_section") {
      const projectId = String(body.projectId || "");
      const sectionId = String(body.sectionId || "");
      const transformation = String(body.transformation || "rewrite") as
        | "rewrite"
        | "expand"
        | "shorten"
        | "regenerate"
        | "change_tone";
      const targetTone = body.targetTone ? String(body.targetTone) : undefined;

      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.currentArticle) {
        return NextResponse.json(
          { error: "Blog article not found." },
          { status: 404 }
        );
      }

      const brand = ensureWorkspaceBrand(wsId, project.brandId);
      const targetSec = project.currentArticle.sections.find(
        (s) => s.id === sectionId
      );
      if (!targetSec) {
        return NextResponse.json(
          { error: "Article section not found." },
          { status: 404 }
        );
      }

      const transformedSec = transformArticleSectionContent({
        section: targetSec,
        transformation,
        targetTone,
        primaryKeyword: project.keywords.primaryKeyword || project.topic,
        brandName: brand.name,
      });

      const mergedBase: Omit<BlogArticleContent, "wordCount" | "keywordPlacements"> = {
        ...project.currentArticle,
        sections: project.currentArticle.sections.map((s) =>
          s.id === sectionId ? transformedSec : s
        ),
      };
      const metrics = computeArticleMetrics(mergedBase, project.keywords);
      const nextArticle: BlogArticleContent = {
        ...mergedBase,
        ...metrics,
      };

      const nextVersionNum = (project.versions.length || 0) + 1;
      const newVersion: BlogArticleVersion = {
        id: crypto.randomUUID(),
        versionNumber: nextVersionNum,
        label: `Section "${targetSec.h2Heading.slice(0, 28)}" (${transformation})`,
        createdAt: new Date().toISOString(),
        isUserEdited: true,
        content: nextArticle,
      };

      const updated = updateBlogProject(wsId, projectId, {
        writingTone: targetTone || project.writingTone,
        currentArticle: nextArticle,
        versions: [...project.versions, newVersion],
        hasApprovedUserEdits: true,
      });

      return NextResponse.json({ project: updated });
    }

    // AI Image Prompt Assistant (Write or Refine Prompt with AI)
    if (action === "ai_image_prompt") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      const brand = ensureWorkspaceBrand(
        wsId,
        project ? project.brandId : body.brandId ? String(body.brandId) : undefined
      );
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;

      const blogTitle =
        String(body.blogTitle || project?.currentArticle?.blogTitle || project?.topic || "").trim();
      const primaryKeyword =
        String(body.primaryKeyword || project?.keywords?.primaryKeyword || "").trim();
      const secondaryKeywords =
        Array.isArray(body.secondaryKeywords)
          ? body.secondaryKeywords.map(String)
          : project?.keywords?.secondaryKeywords ?? [];
      const mode = (body.mode === "refine" ? "refine" : "write") as "write" | "refine";
      const existingPrompt = body.existingPrompt ? String(body.existingPrompt) : "";
      const customInstruction = body.customInstruction ? String(body.customInstruction) : "";

      const res = await writeOrRefineBlogImagePrompt({
        action: mode,
        blogTitle,
        primaryKeyword,
        secondaryKeywords,
        category: body.category ? String(body.category) : project?.blogCategory,
        brand,
        brandKit,
        existingPrompt,
        customInstruction,
        geminiContext: { workspaceId: wsId, userId },
      });

      return NextResponse.json(res);
    }

    // Real-Time AI Featured Image Generation
    if (action === "generate_realtime_image") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.currentArticle) {
        return NextResponse.json(
          { error: "Blog article not found." },
          { status: 404 }
        );
      }

      const brand = ensureWorkspaceBrand(wsId, project.brandId);
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;

      const formatName = String(
        body.imageFormatName || project.imageFormatName || "Landscape"
      );
      const width = Number(body.imageWidth || project.imageWidth || 1200);
      const height = Number(body.imageHeight || project.imageHeight || 675);
      const prompt =
        String(
          body.prompt ||
            project.currentArticle.featuredImagePrompt ||
            project.currentArticle.blogTitle
        ).trim();

      const imageResult = await generateRealTimeBlogImage({
        prompt,
        width,
        height,
        formatName,
        blogTitle: project.currentArticle.blogTitle,
        primaryKeyword: project.keywords.primaryKeyword || project.topic,
        brand,
        brandKit,
        workspaceId: wsId,
        userId,
      });

      const nextArticle: BlogArticleContent = {
        ...project.currentArticle,
        featuredImageUrl: imageResult.imageUrl,
        featuredImagePrompt: imageResult.promptUsed,
        featuredImageFormatName: formatName,
        featuredImageWidth: width,
        featuredImageHeight: height,
        imageAltText: body.imageAltText
          ? String(body.imageAltText)
          : imageResult.altText,
        imageCaption: body.imageCaption
          ? String(body.imageCaption)
          : imageResult.caption,
      };

      const nextVersionNum = (project.versions.length || 0) + 1;
      const newVersion: BlogArticleVersion = {
        id: crypto.randomUUID(),
        versionNumber: nextVersionNum,
        label: `Real-time Featured Image (${formatName} ${width}×${height})`,
        createdAt: new Date().toISOString(),
        isUserEdited: true,
        content: nextArticle,
      };

      const updated = updateBlogProject(wsId, projectId, {
        imageFormatName: formatName,
        imageWidth: width,
        imageHeight: height,
        currentArticle: nextArticle,
        versions: [...project.versions, newVersion],
        hasApprovedUserEdits: true,
      });

      return NextResponse.json({
        project: updated,
        imageResult,
      });
    }

    // Section 4.1 & 4.2: Regenerate or Resize Featured Blog Image
    if (action === "regenerate_featured_image") {
      const projectId = String(body.projectId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project || !project.currentArticle) {
        return NextResponse.json(
          { error: "Blog article not found." },
          { status: 404 }
        );
      }

      const brand = ensureWorkspaceBrand(wsId, project.brandId);
      const brandKit = brand.activeKitId
        ? getBrandKitById(wsId, brand.activeKitId)
        : null;

      const formatName = String(
        body.imageFormatName || project.imageFormatName || "Landscape"
      );
      const width = Number(body.imageWidth || project.imageWidth || 1200);
      const height = Number(body.imageHeight || project.imageHeight || 675);

      const visual = renderBlogFeaturedImageDataUrl({
        title: project.currentArticle.blogTitle,
        category: project.blogCategory || project.industry || "Editorial Guide",
        primaryKeyword: project.keywords.primaryKeyword || project.topic,
        brand,
        brandKit,
        width,
        height,
        formatName,
      });

      const nextArticle: BlogArticleContent = {
        ...project.currentArticle,
        featuredImageUrl: visual.dataUrl,
        featuredImagePrompt: visual.prompt,
        featuredImageFormatName: formatName,
        featuredImageWidth: width,
        featuredImageHeight: height,
        imageAltText: body.imageAltText
          ? String(body.imageAltText)
          : visual.altText,
        imageCaption: body.imageCaption
          ? String(body.imageCaption)
          : visual.caption,
      };

      const updated = updateBlogProject(wsId, projectId, {
        imageFormatName: formatName,
        imageWidth: width,
        imageHeight: height,
        currentArticle: nextArticle,
      });

      return NextResponse.json({ project: updated });
    }

    // Section 4.7: Restore a Version from Generation History
    if (action === "restore_version") {
      const projectId = String(body.projectId || "");
      const versionId = String(body.versionId || "");
      const project = getBlogProjectById(wsId, projectId);
      if (!project) {
        return NextResponse.json(
          { error: "Blog project not found." },
          { status: 404 }
        );
      }

      const targetVersion = project.versions.find((v) => v.id === versionId);
      if (!targetVersion) {
        return NextResponse.json(
          { error: "Requested article version not found." },
          { status: 404 }
        );
      }

      const nextVersionNum = (project.versions.length || 0) + 1;
      const restoredVersion: BlogArticleVersion = {
        id: crypto.randomUUID(),
        versionNumber: nextVersionNum,
        label: `Restored from v${targetVersion.versionNumber} (${targetVersion.label})`,
        createdAt: new Date().toISOString(),
        isUserEdited: true,
        content: targetVersion.content,
      };

      const updated = updateBlogProject(wsId, projectId, {
        currentArticle: targetVersion.content,
        versions: [...project.versions, restoredVersion],
      });

      return NextResponse.json({ project: updated });
    }

    // Delete a Blog Project
    if (action === "delete_project") {
      const projectId = String(body.projectId || "");
      deleteBlogProject(wsId, projectId);
      return NextResponse.json({
        deleted: true,
        projects: listBlogProjects(wsId),
      });
    }

    return NextResponse.json(
      { error: `Unsupported Blog Studio action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Blog Studio operation failed.",
      },
      { status: 400 }
    );
  }
}
