"use client";

import * as React from "react";
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Copy,
  Download,
  History,
  Link2,
  ExternalLink,
  AlertTriangle,
  Wand2,
  Image as ImageIcon,
  FileText,
  ArrowRight,
  Search,
  Eye,
  Edit3,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Share2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  BlogArticleContent,
  BlogFaqItem,
  BlogGroundedSource,
  BlogImageDimensionPreset,
  BlogInternalLinkSuggestion,
  BlogOutline,
  BlogOutlineSection,
  BlogPostProject,
} from "@/types/domain";
import type { BlogTopicSuggestion } from "@/lib/ai/blog-engine";
import type { StudioModuleId, WorkspaceSnapshot } from "@/hooks/use-studio-state";

interface BlogStudioViewProps {
  snapshot: WorkspaceSnapshot;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  onNavigate: (module: StudioModuleId) => void;
  apiRequest: <T>(
    url: string,
    options?: RequestInit & { taskLabel?: string }
  ) => Promise<T>;
  announce: (msg: string) => void;
}

const WORD_COUNT_OPTIONS = [500, 800, 1000, 1500, 2000, 2500] as const;

const WRITING_TONE_OPTIONS = [
  "Professional & Insightful",
  "Conversational & Approachable",
  "Authoritative & Executive",
  "Educational & Step-by-Step",
  "Persuasive & Action-Oriented",
  "Technical & Analytical",
];

const SEARCH_INTENT_OPTIONS = [
  "Informational",
  "Commercial Investigation",
  "Transactional",
  "Navigational",
];

function parseCommaList(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BlogStudioView({
  snapshot,
  selectedBrandId,
  onSelectBrand,
  apiRequest,
  announce,
}: BlogStudioViewProps) {
  const projects = snapshot.blogProjects ?? [];
  const dimensionPresets: BlogImageDimensionPreset[] =
    snapshot.blogDimensionPresets && snapshot.blogDimensionPresets.length > 0
      ? snapshot.blogDimensionPresets
      : [
          {
            id: "preset-square",
            workspaceId: snapshot.activeWorkspace.id,
            formatName: "Square",
            width: 1080,
            height: 1080,
            usageDescription: "Social sharing and square thumbnails",
            isActive: true,
          },
          {
            id: "preset-landscape",
            workspaceId: snapshot.activeWorkspace.id,
            formatName: "Landscape",
            width: 1200,
            height: 675,
            usageDescription: "Blog featured images and article headers",
            isActive: true,
          },
          {
            id: "preset-portrait",
            workspaceId: snapshot.activeWorkspace.id,
            formatName: "Portrait",
            width: 1080,
            height: 1350,
            usageDescription: "Pinterest and portrait-oriented promotion",
            isActive: true,
          },
          {
            id: "preset-rectangle",
            workspaceId: snapshot.activeWorkspace.id,
            formatName: "Rectangle",
            width: 1200,
            height: 628,
            usageDescription: "General website thumbnails and link previews",
            isActive: true,
          },
        ];

  const [activeProjectId, setActiveProjectId] = React.useState<string>(
    projects[0]?.id ?? ""
  );
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? null;

  const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1);

  // Step 1 Inputs (Section 4.2)
  const [brandId, setBrandId] = React.useState<string>(
    selectedBrandId || snapshot.brands[0]?.id || ""
  );
  const [topic, setTopic] = React.useState<string>("");
  const [primaryKeyword, setPrimaryKeyword] = React.useState<string>("");
  const [secondaryKeywordsText, setSecondaryKeywordsText] =
    React.useState<string>("");
  const [supportingKeywordsText, setSupportingKeywordsText] =
    React.useState<string>("");

  // Featured Image Dimensions
  const [imageFormatName, setImageFormatName] =
    React.useState<string>("Landscape");
  const [imageWidth, setImageWidth] = React.useState<number>(1200);
  const [imageHeight, setImageHeight] = React.useState<number>(675);
  const [isCustomDimensions, setIsCustomDimensions] =
    React.useState<boolean>(false);
  const [customPresetName, setCustomPresetName] = React.useState<string>("");

  // Word Count (Section 4.6)
  const [wordCountMode, setWordCountMode] = React.useState<"preset" | "custom">(
    "preset"
  );
  const [desiredWordCount, setDesiredWordCount] = React.useState<number>(1000);

  // Optional Inputs (Section 4.2)
  const [targetAudience, setTargetAudience] = React.useState<string>("");
  const [industry, setIndustry] = React.useState<string>("");
  const [blogCategory, setBlogCategory] = React.useState<string>("");
  const [writingTone, setWritingTone] = React.useState<string>(
    "Professional & Insightful"
  );
  const [targetCountry, setTargetCountry] = React.useState<string>("Global");
  const [language, setLanguage] = React.useState<string>("English");
  const [searchIntent, setSearchIntent] =
    React.useState<string>("Informational");
  const [competitorUrlsText, setCompetitorUrlsText] =
    React.useState<string>("");
  const [specificCta, setSpecificCta] = React.useState<string>("");
  const [additionalInstructions, setAdditionalInstructions] =
    React.useState<string>("");

  // Input Intelligence Ideas (Section 4.3)
  const [suggestedIdeas, setSuggestedIdeas] = React.useState<
    BlogTopicSuggestion[]
  >([]);
  const [inputNotice, setInputNotice] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Step 2 Editable Outline Draft (Section 4.5)
  const [outlineDraft, setOutlineDraft] = React.useState<BlogOutline | null>(
    null
  );

  // Step 3 Editable Article Draft (Section 4.7)
  const [articleDraft, setArticleDraft] =
    React.useState<BlogArticleContent | null>(null);
  const [newSupportingKeyword, setNewSupportingKeyword] =
    React.useState<string>("");

  // Step 3 View Mode & Preview Viewport
  const [viewMode, setViewMode] = React.useState<"editor" | "preview">("editor");
  const [previewViewport, setPreviewViewport] = React.useState<"desktop" | "mobile">("desktop");
  const [openFaqIndices, setOpenFaqIndices] = React.useState<number[]>([0]);

  // AI Prompt Studio for Featured Image (Write / Refine with AI, or User Direct Prompt)
  const [imagePromptText, setImagePromptText] = React.useState<string>("");
  const [imagePromptRefinement, setImagePromptRefinement] = React.useState<string>("");
  const [isGeneratingRealTimeImage, setIsGeneratingRealTimeImage] = React.useState<boolean>(false);
  const [isAssistingPrompt, setIsAssistingPrompt] = React.useState<boolean>(false);

  // Sync local form state when activeProject changes
  React.useEffect(() => {
    if (!activeProject) return;
    setBrandId(activeProject.brandId);
    setTopic(activeProject.topic);
    setPrimaryKeyword(activeProject.keywords.primaryKeyword);
    setSecondaryKeywordsText(
      activeProject.keywords.secondaryKeywords.join(", ")
    );
    setSupportingKeywordsText(
      activeProject.keywords.supportingKeywords.join(", ")
    );
    setImageFormatName(activeProject.imageFormatName);
    setImageWidth(activeProject.imageWidth);
    setImageHeight(activeProject.imageHeight);
    setTargetAudience(activeProject.targetAudience);
    setIndustry(activeProject.industry);
    setBlogCategory(activeProject.blogCategory);
    setDesiredWordCount(activeProject.desiredWordCount);
    setWordCountMode(
      WORD_COUNT_OPTIONS.includes(
        activeProject.desiredWordCount as (typeof WORD_COUNT_OPTIONS)[number]
      )
        ? "preset"
        : "custom"
    );
    setWritingTone(activeProject.writingTone);
    setTargetCountry(activeProject.targetCountry);
    setLanguage(activeProject.language);
    setSearchIntent(activeProject.searchIntent);
    setCompetitorUrlsText(activeProject.competitorUrls.join(", "));
    setSpecificCta(activeProject.specificCta);
    setAdditionalInstructions(activeProject.additionalInstructions);
    setOutlineDraft(activeProject.outline);
    setArticleDraft(activeProject.currentArticle);
    if (activeProject.currentArticle?.featuredImagePrompt) {
      setImagePromptText(activeProject.currentArticle.featuredImagePrompt);
    }

    if (activeProject.currentArticle) {
      setActiveStep(3);
    } else if (activeProject.outline) {
      setActiveStep(2);
    } else {
      setActiveStep(1);
    }
  }, [activeProject?.id, activeProject?.updatedAt]);

  const handleSelectDimensionPreset = (preset: BlogImageDimensionPreset) => {
    setIsCustomDimensions(false);
    setImageFormatName(preset.formatName);
    setImageWidth(preset.width);
    setImageHeight(preset.height);
  };

  const handleSaveCustomDimensionPreset = async () => {
    const name = customPresetName.trim() || `Custom ${imageWidth}×${imageHeight}`;
    const res = await apiRequest<{ preset: BlogImageDimensionPreset }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: `Saving custom dimension preset ${name}...`,
        body: JSON.stringify({
          action: "upsert_dimension_preset",
          formatName: name,
          width: imageWidth,
          height: imageHeight,
          usageDescription: `Custom ${imageWidth} × ${imageHeight} px format`,
        }),
      }
    );
    setImageFormatName(res.preset.formatName);
    setCustomPresetName("");
    setIsCustomDimensions(false);
    announce(`Saved configurable dimension preset: ${res.preset.formatName}.`);
  };

  const handleStartNewBlog = () => {
    setActiveProjectId("");
    setTopic("");
    setPrimaryKeyword("");
    setSecondaryKeywordsText("");
    setSupportingKeywordsText("");
    setOutlineDraft(null);
    setArticleDraft(null);
    setSuggestedIdeas([]);
    setInputNotice(null);
    setErrorMsg(null);
    setActiveStep(1);
  };

  const handleSuggestIdeas = async () => {
    setErrorMsg(null);
    const res = await apiRequest<{
      ideas: BlogTopicSuggestion[];
      brandId: string;
    }>("/api/blog-projects", {
      method: "POST",
      taskLabel: "Analyzing brand identity to suggest SEO blog topics...",
      body: JSON.stringify({
        action: "suggest_ideas",
        brandId,
        industry,
        targetAudience,
      }),
    });
    if (res.brandId && !brandId) {
      setBrandId(res.brandId);
      onSelectBrand(res.brandId);
    }
    setSuggestedIdeas(res.ideas);
    setInputNotice(
      "Select any suggested blog idea below to pre-fill the topic and keywords, or enter your own."
    );
    announce(`Generated ${res.ideas.length} brand-aligned blog topic ideas.`);
  };

  const handleApplySuggestedIdea = (idea: BlogTopicSuggestion) => {
    setTopic(idea.topic);
    setPrimaryKeyword(idea.primaryKeyword);
    setSecondaryKeywordsText(idea.secondaryKeywords.join(", "));
    setSupportingKeywordsText(idea.supportingKeywords.join(", "));
    setSearchIntent(idea.searchIntent);
    setInputNotice(
      `Applied idea: "${idea.topic}". Click "Research SEO & Generate Outline" to continue.`
    );
  };

  const handleGenerateOutline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setInputNotice(null);

    try {
      const res = await apiRequest<{
        project?: BlogPostProject;
        requiresTopicOrIdeaSelection?: boolean;
        message?: string;
        suggestedIdeas?: BlogTopicSuggestion[];
      }>("/api/blog-projects", {
        method: "POST",
        taskLabel:
          "Running Gemini SEO research, keyword analysis & outline generation...",
        body: JSON.stringify({
          action: "generate_outline",
          projectId: activeProjectId || undefined,
          brandId,
          topic,
          keywords: {
            primaryKeyword,
            secondaryKeywords: parseCommaList(secondaryKeywordsText),
            supportingKeywords: parseCommaList(supportingKeywordsText),
          },
          imageFormatName,
          imageWidth,
          imageHeight,
          targetAudience,
          industry,
          blogCategory,
          desiredWordCount,
          writingTone,
          targetCountry,
          language,
          searchIntent,
          competitorUrls: parseCommaList(competitorUrlsText),
          specificCta,
          additionalInstructions,
        }),
      });

      if (res.requiresTopicOrIdeaSelection) {
        setSuggestedIdeas(res.suggestedIdeas ?? []);
        setInputNotice(
          res.message ||
            "Please enter a topic, provide keywords, or pick one of the suggested blog ideas below."
        );
        return;
      }

      if (res.project) {
        setActiveProjectId(res.project.id);
        setOutlineDraft(res.project.outline);
        setActiveStep(2);
        announce(
          "Generated SEO research strategy and proposed blog outline. Review and approve the outline to write the full article."
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate blog outline."
      );
    }
  };

  // Step 2 Outline Manipulation Handlers (Section 4.5)
  const handleSaveOutline = async (approveOutline?: boolean) => {
    if (!activeProject || !outlineDraft) return;
    setErrorMsg(null);
    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: approveOutline
          ? "Approving blog outline..."
          : "Saving blog outline changes...",
        body: JSON.stringify({
          action: "update_outline",
          projectId: activeProject.id,
          outline: outlineDraft,
          approveOutline,
        }),
      }
    );
    setOutlineDraft(res.project.outline);
    announce(
      approveOutline
        ? "Blog outline approved! You can now generate the complete article."
        : "Saved blog outline edits."
    );
  };

  const handleAddOutlineSection = () => {
    if (!outlineDraft) return;
    const nextOrder = outlineDraft.sections.length + 1;
    const newSec: BlogOutlineSection = {
      id: `sec-${Date.now()}`,
      order: nextOrder,
      h2Heading: `New Section ${nextOrder}: Key Considerations`,
      h3Subsections: ["Practical Implementation Steps"],
      talkingPoints: ["Explain the core takeaway clearly for the reader."],
      relevantExamples: ["Real-world application example."],
    };
    setOutlineDraft({
      ...outlineDraft,
      sections: [...outlineDraft.sections, newSec],
    });
  };

  const handleDeleteOutlineSection = (sectionId: string) => {
    if (!outlineDraft) return;
    const filtered = outlineDraft.sections
      .filter((s) => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    setOutlineDraft({
      ...outlineDraft,
      sections: filtered,
    });
  };

  const handleMoveOutlineSection = (index: number, direction: -1 | 1) => {
    if (!outlineDraft) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= outlineDraft.sections.length) return;
    const copy = [...outlineDraft.sections];
    const temp = copy[index]!;
    copy[index] = copy[targetIdx]!;
    copy[targetIdx] = temp;
    setOutlineDraft({
      ...outlineDraft,
      sections: copy.map((s, idx) => ({ ...s, order: idx + 1 })),
    });
  };

  const handleRegenerateOutlineSection = async (sectionId: string) => {
    if (!activeProject) return;
    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: "Regenerating outline section with Gemini...",
        body: JSON.stringify({
          action: "regenerate_outline_section",
          projectId: activeProject.id,
          sectionId,
        }),
      }
    );
    setOutlineDraft(res.project.outline);
    announce("Regenerated outline section.");
  };

  // Step 2 -> Step 3 Full Article Generation (Section 4.6 & 4.7 Overwrite Protection)
  const handleGenerateFullArticle = async () => {
    if (!activeProject || !outlineDraft) return;
    if (!outlineDraft.approved) {
      setErrorMsg(
        "Please approve the proposed outline first before generating the complete blog article."
      );
      return;
    }

    let confirmOverwrite = false;
    if (activeProject.hasApprovedUserEdits) {
      const confirmed = window.confirm(
        "You have saved or approved edits on this article. Generating a new draft will create a new version while keeping your edited version in Generation History. Proceed?"
      );
      if (!confirmed) return;
      confirmOverwrite = true;
    }

    setErrorMsg(null);
    // Save latest outline edits first, then generate full article
    await apiRequest("/api/blog-projects", {
      method: "POST",
      body: JSON.stringify({
        action: "update_outline",
        projectId: activeProject.id,
        outline: outlineDraft,
        approveOutline: true,
      }),
    });

    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: `Generating ${desiredWordCount}-word SEO blog article & ${imageFormatName} (${imageWidth}×${imageHeight}) featured image...`,
        body: JSON.stringify({
          action: "generate_article",
          projectId: activeProject.id,
          confirmOverwrite,
        }),
      }
    );

    setArticleDraft(res.project.currentArticle);
    setActiveStep(3);
    announce("Generated complete blog article and featured image.");
  };

  // Step 3 Article Editing & Section Transformations (Section 4.7)
  const handleSaveArticleEdits = async (
    approveArticle = false,
    customDraft?: BlogArticleContent,
    customKeywords?: BlogPostProject["keywords"],
    revisionLabel?: string
  ) => {
    if (!activeProject) return;
    const draftToSave = customDraft ?? articleDraft;
    if (!draftToSave) return;

    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: approveArticle
          ? "Approving final blog article and recording version..."
          : "Saving article revision to version history...",
        body: JSON.stringify({
          action: "update_article",
          projectId: activeProject.id,
          article: draftToSave,
          keywords: customKeywords,
          approveArticle,
          revisionLabel,
        }),
      }
    );
    setArticleDraft(res.project.currentArticle);
    announce(
      approveArticle
        ? "Final blog article approved and saved to version history!"
        : "Saved article edits to version history."
    );
  };

  const handleTransformSection = async (
    sectionId: string,
    transformation:
      | "rewrite"
      | "expand"
      | "shorten"
      | "regenerate"
      | "change_tone"
  ) => {
    if (!activeProject) return;
    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: `Applying "${transformation}" to article section...`,
        body: JSON.stringify({
          action: "transform_section",
          projectId: activeProject.id,
          sectionId,
          transformation,
          targetTone: writingTone,
        }),
      }
    );
    setArticleDraft(res.project.currentArticle);
    announce(`Section updated (${transformation}) and recorded in version history.`);
  };

  const handleAddSupportingKeywordInEditor = async () => {
    if (!activeProject || !articleDraft || !newSupportingKeyword.trim()) return;
    const kw = newSupportingKeyword.trim();
    const updatedKeywords = {
      ...activeProject.keywords,
      supportingKeywords: Array.from(
        new Set([...activeProject.keywords.supportingKeywords, kw])
      ),
    };
    setNewSupportingKeyword("");
    setSupportingKeywordsText(updatedKeywords.supportingKeywords.join(", "));
    await handleSaveArticleEdits(
      false,
      articleDraft,
      updatedKeywords,
      `Added supporting keyword "${kw}"`
    );
  };

  const handleToggleFaq = (index: number) => {
    setOpenFaqIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleAiPromptAction = async (mode: "write" | "refine") => {
    if (!activeProject) return;
    setIsAssistingPrompt(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{
        prompt: string;
        altText: string;
        caption: string;
        modelUsed: string;
      }>("/api/blog-projects", {
        method: "POST",
        taskLabel:
          mode === "write"
            ? "Authoring editorial image prompt with AI..."
            : "Refining image prompt with AI...",
        body: JSON.stringify({
          action: "ai_image_prompt",
          projectId: activeProject.id,
          mode,
          existingPrompt: imagePromptText,
          customInstruction: imagePromptRefinement,
          blogTitle: articleDraft?.blogTitle || activeProject.topic,
          primaryKeyword: activeProject.keywords.primaryKeyword,
          secondaryKeywords: activeProject.keywords.secondaryKeywords,
          category: activeProject.blogCategory,
        }),
      });

      setImagePromptText(res.prompt);
      if (articleDraft) {
        setArticleDraft({
          ...articleDraft,
          featuredImagePrompt: res.prompt,
          imageAltText: res.altText || articleDraft.imageAltText,
          imageCaption: res.caption || articleDraft.imageCaption,
        });
      }
      announce(
        mode === "write"
          ? "Authored new featured image prompt with AI."
          : "Refined featured image prompt with AI."
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to assist image prompt."
      );
    } finally {
      setIsAssistingPrompt(false);
    }
  };

  const handleGenerateRealTimeImage = async () => {
    if (!activeProject || !articleDraft) return;
    setIsGeneratingRealTimeImage(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{
        project: BlogPostProject;
        imageResult: {
          imageUrl: string;
          promptUsed: string;
          providerUsed: string;
          altText: string;
          caption: string;
        };
      }>("/api/blog-projects", {
        method: "POST",
        taskLabel: `Generating real-time AI featured image (${imageFormatName} ${imageWidth}×${imageHeight} px)...`,
        body: JSON.stringify({
          action: "generate_realtime_image",
          projectId: activeProject.id,
          prompt:
            imagePromptText ||
            articleDraft.featuredImagePrompt ||
            articleDraft.blogTitle,
          imageFormatName,
          imageWidth,
          imageHeight,
          imageAltText: articleDraft.imageAltText,
          imageCaption: articleDraft.imageCaption,
        }),
      });

      setArticleDraft(res.project.currentArticle);
      announce(
        `Generated real-time AI featured image (${imageFormatName} ${imageWidth}×${imageHeight} px).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate real-time image."
      );
    } finally {
      setIsGeneratingRealTimeImage(false);
    }
  };

  const handleRegenerateFeaturedImage = async () => {
    if (!activeProject || !articleDraft) return;
    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: `Rendering featured blog image (${imageFormatName} ${imageWidth}×${imageHeight} px)...`,
        body: JSON.stringify({
          action: "regenerate_featured_image",
          projectId: activeProject.id,
          imageFormatName,
          imageWidth,
          imageHeight,
          imageAltText: articleDraft.imageAltText,
          imageCaption: articleDraft.imageCaption,
        }),
      }
    );
    setArticleDraft(res.project.currentArticle);
    announce(
      `Updated featured blog image (${imageFormatName} ${imageWidth}×${imageHeight} px).`
    );
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!activeProject) return;
    if (
      activeProject.hasApprovedUserEdits &&
      !window.confirm(
        "Restore this version? Your current version will still remain preserved in the generation history list."
      )
    ) {
      return;
    }
    const res = await apiRequest<{ project: BlogPostProject }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: "Restoring selected article version...",
        body: JSON.stringify({
          action: "restore_version",
          projectId: activeProject.id,
          versionId,
        }),
      }
    );
    setArticleDraft(res.project.currentArticle);
    announce("Restored article version from generation history.");
  };

  const handleDeleteProject = async (projectId: string, title: string) => {
    if (!window.confirm(`Delete blog project "${title || "Untitled"}"?`)) return;
    const res = await apiRequest<{ projects: BlogPostProject[] }>(
      "/api/blog-projects",
      {
        method: "POST",
        taskLabel: "Deleting blog project...",
        body: JSON.stringify({
          action: "delete_project",
          projectId,
        }),
      }
    );
    if (res.projects[0]) {
      setActiveProjectId(res.projects[0].id);
    } else {
      handleStartNewBlog();
    }
    announce("Deleted blog project.");
  };

  const handleCopyMarkdown = async () => {
    if (!articleDraft) return;
    const mdLines: string[] = [
      `---`,
      `title: "${articleDraft.blogTitle}"`,
      `seo_title: "${articleDraft.seoTitle}"`,
      `meta_description: "${articleDraft.metaDescription}"`,
      `slug: "/${articleDraft.suggestedSlug}"`,
      `featured_image_alt: "${articleDraft.imageAltText}"`,
      `featured_image_caption: "${articleDraft.imageCaption}"`,
      `---`,
      ``,
      `# ${articleDraft.h1Heading}`,
      ``,
      articleDraft.introduction,
      ``,
    ];

    for (const sec of articleDraft.sections) {
      mdLines.push(`## ${sec.h2Heading}`, ``);
      for (const p of sec.paragraphs) {
        mdLines.push(p, ``);
      }
      for (const sub of sec.h3Subsections) {
        mdLines.push(`### ${sub.heading}`, ``);
        for (const sp of sub.paragraphs) {
          mdLines.push(sp, ``);
        }
      }
      if (sec.bulletPoints.length > 0) {
        for (const b of sec.bulletPoints) {
          mdLines.push(`- ${b}`);
        }
        mdLines.push(``);
      }
      if (sec.examples.length > 0) {
        for (const ex of sec.examples) {
          mdLines.push(`> ${ex}`, ``);
        }
      }
    }

    if (articleDraft.faqs.length > 0) {
      mdLines.push(`## Frequently Asked Questions`, ``);
      for (const faq of articleDraft.faqs) {
        mdLines.push(`### ${faq.question}`, ``, faq.answer, ``);
      }
    }

    mdLines.push(
      `## Conclusion`,
      ``,
      articleDraft.conclusion,
      ``,
      `**${articleDraft.cta}**`
    );

    try {
      await navigator.clipboard.writeText(mdLines.join("\n"));
      announce("Copied complete SEO blog article as Markdown.");
    } catch {
      announce("Markdown ready to copy.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Blog Studio
            </h1>
            <Badge variant="info">Gemini SEO Article &amp; Featured Image</Badge>
            {activeProject ? (
              <Badge
                variant={
                  activeProject.status === "approved"
                    ? "success"
                    : activeProject.outline?.approved
                      ? "info"
                      : "warning"
                }
              >
                {activeProject.status.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-text-secondary">
            Develop complete, SEO-optimized blog articles with Search-grounded research, approval-gated outlines, H1/H2/H3 structure, FAQs, and configurable featured images.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {projects.length > 0 ? (
            <div className="flex items-center gap-2">
              <NativeSelect
                aria-label="Select saved blog article"
                value={activeProjectId}
                onChange={(e) => setActiveProjectId(e.target.value)}
              >
                <option value="">+ New Blog Article</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.topic || "Untitled Blog"} ({p.status.replace(/_/g, " ")})
                  </option>
                ))}
              </NativeSelect>
              {activeProject ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    void handleDeleteProject(
                      activeProject.id,
                      activeProject.topic
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Delete Blog</span>
                </Button>
              ) : null}
            </div>
          ) : null}

          <Button variant="secondary" size="sm" onClick={handleStartNewBlog}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Blog Project</span>
          </Button>
        </div>
      </div>

      {/* 3-Stage Guided Workflow Stepper */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left transition ${
            activeStep === 1
              ? "border-focus-ring bg-surface-primary shadow-sm"
              : "border-border-subtle bg-surface-secondary hover:bg-surface-primary"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-primary">
              Step 1
            </span>
            <span className="text-sm font-bold text-text-primary">
              1. Topic, Keywords &amp; Inputs
            </span>
            <span className="text-xs text-text-secondary">
              Topic, keywords, dimensions &amp; tone
            </span>
          </div>
          <BookOpen className="h-5 w-5 text-accent-primary" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={!outlineDraft}
          onClick={() => outlineDraft && setActiveStep(2)}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
            activeStep === 2
              ? "border-focus-ring bg-surface-primary shadow-sm"
              : outlineDraft
                ? "cursor-pointer border-border-subtle bg-surface-secondary hover:bg-surface-primary"
                : "cursor-not-allowed border-border-subtle bg-surface-secondary/50 opacity-60"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-primary">
              Step 2 {outlineDraft?.approved ? "• Approved" : ""}
            </span>
            <span className="text-sm font-bold text-text-primary">
              2. SEO Research &amp; Outline
            </span>
            <span className="text-xs text-text-secondary">
              Edit H1/H2/H3 sections &amp; approve
            </span>
          </div>
          <Search className="h-5 w-5 text-accent-primary" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={!articleDraft}
          onClick={() => articleDraft && setActiveStep(3)}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
            activeStep === 3
              ? "border-focus-ring bg-surface-primary shadow-sm"
              : articleDraft
                ? "cursor-pointer border-border-subtle bg-surface-secondary hover:bg-surface-primary"
                : "cursor-not-allowed border-border-subtle bg-surface-secondary/50 opacity-60"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-primary">
              Step 3 {activeProject?.status === "approved" ? "• Approved" : ""}
            </span>
            <span className="text-sm font-bold text-text-primary">
              3. Full Article &amp; Featured Image
            </span>
            <span className="text-xs text-text-secondary">
              Edit sections, FAQs, image &amp; versions
            </span>
          </div>
          <FileText className="h-5 w-5 text-accent-primary" aria-hidden="true" />
        </button>
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-2xl border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg"
        >
          {errorMsg}
        </div>
      ) : null}

      {inputNotice ? (
        <div
          role="status"
          className="rounded-2xl border border-status-info-border bg-status-info-bg p-4 text-sm text-status-info-fg"
        >
          {inputNotice}
        </div>
      ) : null}

      {/* =====================================================================
          STEP 1: BLOG CREATION INPUTS & INPUT INTELLIGENCE (Sections 4.2 & 4.3)
         ===================================================================== */}
      {activeStep === 1 ? (
        <form onSubmit={handleGenerateOutline} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>
                    Step 1: Blog Topic, SEO Keywords &amp; Input Intelligence
                  </CardTitle>
                  <CardDescription>
                    Enter a topic, keywords, or both. If you only enter a topic, Gemini researches relevant keywords; if you only enter keywords, Gemini develops a blog topic; or click &quot;Suggest Blog Ideas&quot; if you have neither.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleSuggestIdeas()}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Suggest Blog Ideas for Brand</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
              {/* Brand Suggested Ideas Drawer (Section 4.3 Neither / Idea Assistant) */}
              {suggestedIdeas.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface-secondary p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-primary">
                    Suggested Blog Ideas Based on Your Brand
                  </span>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {suggestedIdeas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-primary p-4"
                      >
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-bold text-text-primary">
                            {idea.topic}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {idea.rationale}
                          </span>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <Badge variant="info">
                              Primary: {idea.primaryKeyword}
                            </Badge>
                            <Badge variant="neutral">{idea.searchIntent}</Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplySuggestedIdea(idea)}
                        >
                          Use This Blog Idea
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Primary Inputs: Brand + Blog Topic */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-brand-select">Brand Profile</Label>
                  <NativeSelect
                    id="blog-brand-select"
                    value={brandId}
                    onChange={(e) => {
                      setBrandId(e.target.value);
                      onSelectBrand(e.target.value);
                    }}
                  >
                    {snapshot.brands.length === 0 ? (
                      <option value="">Auto-create Starter Brand</option>
                    ) : (
                      snapshot.brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.domain})
                        </option>
                      ))
                    )}
                  </NativeSelect>
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="blog-topic-input">
                    Blog Topic or Working Title (Optional if keywords are provided)
                  </Label>
                  <Input
                    id="blog-topic-input"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Complete Guide to Evaluating European Vehicle History Reports Before Buying"
                  />
                </div>
              </div>

              {/* SEO Keywords: Primary, Secondary, Supporting (Section 4.2) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-primary-kw">
                    Primary SEO Keyword (Optional if topic is provided)
                  </Label>
                  <Input
                    id="blog-primary-kw"
                    value={primaryKeyword}
                    onChange={(e) => setPrimaryKeyword(e.target.value)}
                    placeholder="e.g. vehicle history check"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-secondary-kws">
                    Secondary Keywords (Comma-separated)
                  </Label>
                  <Input
                    id="blog-secondary-kws"
                    value={secondaryKeywordsText}
                    onChange={(e) => setSecondaryKeywordsText(e.target.value)}
                    placeholder="e.g. VIN decoder, mileage verification, accident report"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-supporting-kws">
                    Supporting / Related Keywords (Comma-separated)
                  </Label>
                  <Input
                    id="blog-supporting-kws"
                    value={supportingKeywordsText}
                    onChange={(e) => setSupportingKeywordsText(e.target.value)}
                    placeholder="e.g. pre-purchase inspection, ownership records, buyer checklist"
                  />
                </div>
              </div>

              {/* Featured Image Dimensions Selector (Section 4.2 Configurable + Custom) */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text-primary">
                      Featured Image Dimensions (Configurable Presets &amp; Custom)
                    </span>
                    <span className="text-xs text-text-secondary">
                      Select one of the four standard blog formats or configure custom dimensions.
                    </span>
                  </div>
                  <Badge variant="info">
                    Selected: {imageFormatName} ({imageWidth} × {imageHeight} px)
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {dimensionPresets.map((preset) => {
                    const isSelected =
                      !isCustomDimensions &&
                      imageFormatName === preset.formatName &&
                      imageWidth === preset.width &&
                      imageHeight === preset.height;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectDimensionPreset(preset)}
                        className={`flex cursor-pointer flex-col justify-between gap-1.5 rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? "border-focus-ring bg-surface-primary shadow-sm"
                            : "border-border-subtle bg-surface-primary/60 hover:bg-surface-primary"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-primary">
                            {preset.formatName}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-accent-primary">
                            {preset.width}×{preset.height}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-secondary">
                          {preset.usageDescription}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDimensions(true);
                      setImageFormatName("Custom");
                    }}
                    className={`flex cursor-pointer flex-col justify-between gap-1.5 rounded-2xl border p-3.5 text-left transition ${
                      isCustomDimensions
                        ? "border-focus-ring bg-surface-primary shadow-sm"
                        : "border-border-subtle bg-surface-primary/60 hover:bg-surface-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary">
                        Custom Dimensions
                      </span>
                      <Plus className="h-3.5 w-3.5 text-accent-primary" />
                    </div>
                    <span className="text-[11px] text-text-secondary">
                      Enter custom width × height or save a workspace preset
                    </span>
                  </button>
                </div>

                {isCustomDimensions ? (
                  <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="custom-img-width">Width (px)</Label>
                      <Input
                        id="custom-img-width"
                        type="number"
                        min={200}
                        max={4096}
                        value={imageWidth}
                        onChange={(e) =>
                          setImageWidth(Number(e.target.value || 1200))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="custom-img-height">Height (px)</Label>
                      <Input
                        id="custom-img-height"
                        type="number"
                        min={200}
                        max={4096}
                        value={imageHeight}
                        onChange={(e) =>
                          setImageHeight(Number(e.target.value || 675))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="custom-preset-label">
                        Format Label (Optional)
                      </Label>
                      <Input
                        id="custom-preset-label"
                        value={customPresetName}
                        onChange={(e) => setCustomPresetName(e.target.value)}
                        placeholder="e.g. Wide Hero Banner"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => void handleSaveCustomDimensionPreset()}
                      >
                        Save Preset to Workspace
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Word Count Selector (Section 4.6: 500, 800, 1000, 1500, 2000, 2500, Custom) */}
              <div className="flex flex-col gap-2.5">
                <Label>Desired Word Count</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {WORD_COUNT_OPTIONS.map((count) => {
                    const isSelected =
                      wordCountMode === "preset" && desiredWordCount === count;
                    return (
                      <Button
                        key={count}
                        type="button"
                        variant={isSelected ? "primary" : "outline"}
                        size="sm"
                        onClick={() => {
                          setWordCountMode("preset");
                          setDesiredWordCount(count);
                        }}
                      >
                        {count.toLocaleString()} words
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    variant={wordCountMode === "custom" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setWordCountMode("custom")}
                  >
                    Custom word count
                  </Button>
                  {wordCountMode === "custom" ? (
                    <div className="w-36">
                      <Input
                        aria-label="Custom word count"
                        type="number"
                        min={300}
                        max={10000}
                        value={desiredWordCount}
                        onChange={(e) =>
                          setDesiredWordCount(Number(e.target.value || 1000))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Optional Inputs Grid (Section 4.2) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-audience">Target Audience</Label>
                  <Input
                    id="blog-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Used car buyers & dealers"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-industry">Industry</Label>
                  <Input
                    id="blog-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Automotive / SaaS / Retail"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-category">Blog Category</Label>
                  <Input
                    id="blog-category"
                    value={blogCategory}
                    onChange={(e) => setBlogCategory(e.target.value)}
                    placeholder="e.g. Buyer Guides & Tutorials"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-tone">Writing Tone</Label>
                  <NativeSelect
                    id="blog-tone"
                    value={writingTone}
                    onChange={(e) => setWritingTone(e.target.value)}
                  >
                    {WRITING_TONE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-country">Country or Target Market</Label>
                  <Input
                    id="blog-country"
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    placeholder="e.g. United States, EU, Global"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-language">Language</Label>
                  <Input
                    id="blog-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="e.g. English"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-intent">Search Intent</Label>
                  <NativeSelect
                    id="blog-intent"
                    value={searchIntent}
                    onChange={(e) => setSearchIntent(e.target.value)}
                  >
                    {SEARCH_INTENT_OPTIONS.map((intent) => (
                      <option key={intent} value={intent}>
                        {intent}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-cta-input">Specific CTA (Optional)</Label>
                  <Input
                    id="blog-cta-input"
                    value={specificCta}
                    onChange={(e) => setSpecificCta(e.target.value)}
                    placeholder="e.g. Run your instant check today"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-competitor-urls">
                    Competitor / Reference URLs (Comma-separated, preserved with claims)
                  </Label>
                  <Input
                    id="blog-competitor-urls"
                    value={competitorUrlsText}
                    onChange={(e) => setCompetitorUrlsText(e.target.value)}
                    placeholder="https://example.com/guide-1, https://example.org/research"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="blog-instructions">
                    Additional Editorial Instructions (Optional)
                  </Label>
                  <Input
                    id="blog-instructions"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="e.g. Emphasize practical checklists and avoid overly academic jargon"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">
                Next: Gemini develops the SEO research strategy and proposed outline for your approval.
              </span>
              <Button type="submit" variant="primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Research SEO Strategy &amp; Generate Proposed Outline</span>
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}

      {/* =====================================================================
          STEP 2: BLOG RESEARCH, SEO INTELLIGENCE & OUTLINE APPROVAL (4.4 & 4.5)
         ===================================================================== */}
      {activeStep === 2 && activeProject && outlineDraft ? (
        <div className="flex flex-col gap-6">
          {/* Section 4.4: Blog Research and SEO Intelligence Card */}
          {activeProject.research ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      Gemini Blog Research &amp; SEO Intelligence Strategy
                    </CardTitle>
                    <CardDescription>
                      Input Intelligence Mode:{" "}
                      <strong>
                        {activeProject.inputIntelligenceMode.replace(/_/g, " ")}
                      </strong>{" "}
                      • Main Keyword:{" "}
                      <strong>{activeProject.research.mainKeyword}</strong>
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveStep(1)}
                  >
                    Edit Step 1 Inputs
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Required Disclaimer from Section 4.4 */}
                <div className="flex items-start gap-3 rounded-2xl border border-status-warning-border bg-status-warning-bg p-3.5 text-xs text-status-warning-fg">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Important:</strong>{" "}
                    {activeProject.research.disclaimer}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <span className="text-xs font-bold uppercase text-text-secondary">
                      Primary &amp; Secondary Search Intent
                    </span>
                    <p className="mt-1 text-xs font-semibold text-text-primary">
                      Primary: {activeProject.research.primarySearchIntent}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Secondary: {activeProject.research.secondarySearchIntent}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <span className="text-xs font-bold uppercase text-text-secondary">
                      Related &amp; Semantic Keywords
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="info">
                        Main: {activeProject.research.mainKeyword}
                      </Badge>
                      {activeProject.research.relatedKeywords.map((kw) => (
                        <Badge key={kw} variant="neutral">
                          {kw}
                        </Badge>
                      ))}
                      {activeProject.research.semanticVariations.map((sem) => (
                        <Badge key={sem} variant="neutral">
                          {sem}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <span className="text-xs font-bold uppercase text-text-secondary">
                      Audience &amp; Search Competition
                    </span>
                    <p className="mt-1 text-xs font-semibold text-text-primary">
                      {activeProject.research.audienceKnowledgeLevel}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {activeProject.research.searchCompetitionNotes}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <span className="text-xs font-bold uppercase text-text-secondary">
                      Topic Coverage &amp; Suggested Structure
                    </span>
                    <p className="mt-1 text-xs text-text-secondary">
                      {activeProject.research.suggestedStructureSummary}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-text-primary">
                      {activeProject.research.topicCoverage.map((cov, idx) => (
                        <li key={idx}>{cov}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <span className="text-xs font-bold uppercase text-text-secondary">
                      Grounded &amp; Verified Sources ({activeProject.research.groundedSources.length})
                    </span>
                    {activeProject.research.groundedSources.length === 0 ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        No external URLs attached. Add reference URLs in Step 1 or connect Google Search grounding.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-xs">
                        {activeProject.research.groundedSources.map((src, i) => (
                          <li key={i} className="flex flex-col">
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-accent-primary underline"
                            >
                              <span>{src.title}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-[11px] text-text-secondary">
                              Claim context: {src.associatedClaim}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Section 4.5: Interactive Blog Outline Editor & Approval Gate */}
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>
                    Step 2: Proposed Blog Outline (Approval Required Before Full Article)
                  </CardTitle>
                  <CardDescription>
                    Edit headings, add or delete sections, reorder sections, or regenerate individual sections. Approve the outline to unlock full article generation.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleGenerateOutline()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    <span>Regenerate Entire Outline</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleSaveOutline(false)}
                  >
                    Save Outline Edits
                  </Button>
                  <Button
                    type="button"
                    variant={outlineDraft.approved ? "secondary" : "primary"}
                    size="sm"
                    onClick={() =>
                      void handleSaveOutline(!outlineDraft.approved)
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {outlineDraft.approved
                        ? "Outline Approved (Click to Unapprove)"
                        : "Approve Outline"}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="outline-blog-title">
                    Suggested Blog Title
                  </Label>
                  <Input
                    id="outline-blog-title"
                    value={outlineDraft.suggestedBlogTitle}
                    onChange={(e) =>
                      setOutlineDraft({
                        ...outlineDraft,
                        suggestedBlogTitle: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="outline-h1">H1 Heading</Label>
                  <Input
                    id="outline-h1"
                    value={outlineDraft.h1Heading}
                    onChange={(e) =>
                      setOutlineDraft({
                        ...outlineDraft,
                        h1Heading: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="outline-intro-dir">Introduction Direction</Label>
                <Textarea
                  id="outline-intro-dir"
                  rows={2}
                  value={outlineDraft.introductionDirection}
                  onChange={(e) =>
                    setOutlineDraft({
                      ...outlineDraft,
                      introductionDirection: e.target.value,
                    })
                  }
                />
              </div>

              {/* H2 / H3 Sections List with Add, Delete, Reorder, Regenerate */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-primary">
                    Outline Sections ({outlineDraft.sections.length} H2 Sections)
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddOutlineSection}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add H2 Section</span>
                  </Button>
                </div>

                {outlineDraft.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="info">H2 Section {idx + 1}</Badge>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={idx === 0}
                          onClick={() => handleMoveOutlineSection(idx, -1)}
                          aria-label={`Move section ${idx + 1} up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={idx === outlineDraft.sections.length - 1}
                          onClick={() => handleMoveOutlineSection(idx, 1)}
                          aria-label={`Move section ${idx + 1} down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void handleRegenerateOutlineSection(sec.id)
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Regenerate Section</span>
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={outlineDraft.sections.length <= 1}
                          onClick={() => handleDeleteOutlineSection(sec.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>H2 Heading</Label>
                      <Input
                        value={sec.h2Heading}
                        onChange={(e) => {
                          const next = [...outlineDraft.sections];
                          next[idx] = { ...sec, h2Heading: e.target.value };
                          setOutlineDraft({ ...outlineDraft, sections: next });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">
                          H3 Subsections (One per line)
                        </Label>
                        <Textarea
                          rows={3}
                          value={sec.h3Subsections.join("\n")}
                          onChange={(e) => {
                            const next = [...outlineDraft.sections];
                            next[idx] = {
                              ...sec,
                              h3Subsections: e.target.value
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            };
                            setOutlineDraft({ ...outlineDraft, sections: next });
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">
                          Important Talking Points (One per line)
                        </Label>
                        <Textarea
                          rows={3}
                          value={sec.talkingPoints.join("\n")}
                          onChange={(e) => {
                            const next = [...outlineDraft.sections];
                            next[idx] = {
                              ...sec,
                              talkingPoints: e.target.value
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            };
                            setOutlineDraft({ ...outlineDraft, sections: next });
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">
                          Relevant Examples (One per line)
                        </Label>
                        <Textarea
                          rows={3}
                          value={sec.relevantExamples.join("\n")}
                          onChange={(e) => {
                            const next = [...outlineDraft.sections];
                            next[idx] = {
                              ...sec,
                              relevantExamples: e.target.value
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            };
                            setOutlineDraft({ ...outlineDraft, sections: next });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conclusion & CTA Direction */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="outline-conclusion">
                    Conclusion Direction
                  </Label>
                  <Textarea
                    id="outline-conclusion"
                    rows={2}
                    value={outlineDraft.conclusionDirection}
                    onChange={(e) =>
                      setOutlineDraft({
                        ...outlineDraft,
                        conclusionDirection: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="outline-cta">CTA Recommendation</Label>
                  <Textarea
                    id="outline-cta"
                    rows={2}
                    value={outlineDraft.ctaRecommendation}
                    onChange={(e) =>
                      setOutlineDraft({
                        ...outlineDraft,
                        ctaRecommendation: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <div className="flex items-center gap-2">
                {outlineDraft.approved ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Outline Approved — Ready for Full Article Generation</span>
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    Approve the outline above to unlock full article generation
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {!outlineDraft.approved ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSaveOutline(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>1. Approve Outline Now</span>
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="primary"
                  disabled={!outlineDraft.approved}
                  onClick={() => void handleGenerateFullArticle()}
                >
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    2. Generate Complete Article ({desiredWordCount} Words) &amp; Featured Image
                  </span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {/* =====================================================================
          STEP 3: EDITABLE WRITING INTERFACE, FEATURED IMAGE & APPROVAL (4.6 & 4.7)
         ===================================================================== */}
      {activeStep === 3 && activeProject && articleDraft ? (
        <div className="flex flex-col gap-6">
          {/* Top Mode Switcher Bar: Editor Mode vs Live Blog Preview */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-primary p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("editor")}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  viewMode === "editor"
                    ? "bg-[#111827] text-white shadow-xs"
                    : "bg-surface-secondary text-text-secondary hover:text-text-primary"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Editor &amp; AI Tools</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  viewMode === "preview"
                    ? "bg-[#7078F4] text-white shadow-xs"
                    : "bg-surface-secondary text-text-secondary hover:text-text-primary"
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Blog Preview</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  activeProject.status === "approved" ? "success" : "info"
                }
              >
                {activeProject.status === "approved"
                  ? "Final Article Approved"
                  : "Draft in Progress"}
              </Badge>
              <Badge variant="neutral">
                {articleDraft.wordCount.toLocaleString()} Words (Target:{" "}
                {activeProject.desiredWordCount.toLocaleString()})
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveStep(2)}
              >
                Back to Outline
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyMarkdown()}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Markdown</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void handleSaveArticleEdits(true)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Approve Final Article</span>
              </Button>
            </div>
          </div>

          {/* VIEW MODE 1: LIVE BLOG PREVIEW */}
          {viewMode === "preview" ? (
            <div className="flex flex-col gap-6">
              {/* Preview Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-secondary px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary">
                    Preview Viewport:
                  </span>
                  <div className="flex items-center rounded-xl bg-surface-primary p-1 border border-border-subtle">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("desktop")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        previewViewport === "desktop"
                          ? "bg-accent-primary text-white shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("mobile")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        previewViewport === "mobile"
                          ? "bg-accent-primary text-white shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewMode("editor")}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit Article Content</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyMarkdown()}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy HTML/Markdown</span>
                  </Button>
                </div>
              </div>

              {/* Reader Presentation Canvas */}
              <div
                className={`mx-auto w-full transition-all duration-300 ${
                  previewViewport === "mobile" ? "max-w-md" : "max-w-4xl"
                }`}
              >
                <article className="overflow-hidden rounded-3xl border border-border-subtle bg-white shadow-md">
                  {/* Website Nav Simulation */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#7078F4] text-[10px] text-white">
                        B
                      </span>
                      <span>
                        {snapshot.brands.find((b) => b.id === activeProject.brandId)
                          ?.name || "Studio Brand"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                      <span className="hidden sm:inline">Articles</span>
                      <span className="hidden sm:inline">Guides</span>
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 font-medium text-slate-700">
                        {articleDraft.suggestedSlug
                          ? `/${articleDraft.suggestedSlug}`
                          : "/blog-article"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-8 p-6 sm:p-10 md:p-12">
                    {/* Header Metadata */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="info">
                          {activeProject.blogCategory ||
                            activeProject.industry ||
                            "Editorial Guide"}
                        </Badge>
                        <span className="text-slate-400">•</span>
                        <span className="font-medium text-slate-500">
                          {Math.max(1, Math.ceil(articleDraft.wordCount / 200))} min read
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">
                          {articleDraft.wordCount.toLocaleString()} words
                        </span>
                      </div>

                      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl leading-tight">
                        {articleDraft.h1Heading || articleDraft.blogTitle}
                      </h1>

                      <p className="text-base text-slate-600 leading-relaxed">
                        {articleDraft.metaDescription}
                      </p>

                      <div className="flex items-center gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
                        <span>
                          Published by{" "}
                          <strong className="text-slate-800">
                            {snapshot.brands.find((b) => b.id === activeProject.brandId)
                              ?.name || "Editorial Team"}
                          </strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>{new Date().toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                      </div>
                    </div>

                    {/* Featured Image Display */}
                    <div className="flex flex-col gap-2">
                      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-xs">
                        <img
                          src={articleDraft.featuredImageUrl}
                          alt={articleDraft.imageAltText}
                          className="w-full object-cover"
                          style={{
                            aspectRatio: `${articleDraft.featuredImageWidth} / ${articleDraft.featuredImageHeight}`,
                          }}
                        />
                      </div>
                      <p className="text-center text-xs italic text-slate-500 px-2">
                        {articleDraft.imageCaption}
                      </p>
                    </div>

                    {/* Table of Contents */}
                    {articleDraft.sections.length > 1 ? (
                      <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Table of Contents
                        </span>
                        <nav className="mt-3 flex flex-col gap-1.5 text-xs">
                          {articleDraft.sections.map((sec, sIdx) => (
                            <a
                              key={sec.id}
                              href={`#section-${sec.id}`}
                              className="text-slate-600 hover:text-accent-primary hover:underline"
                            >
                              {sIdx + 1}. {sec.h2Heading}
                            </a>
                          ))}
                          {articleDraft.faqs.length > 0 ? (
                            <a
                              href="#section-faqs"
                              className="text-slate-600 hover:text-accent-primary hover:underline"
                            >
                              Frequently Asked Questions
                            </a>
                          ) : null}
                        </nav>
                      </div>
                    ) : null}

                    {/* Introduction */}
                    <div className="border-l-4 border-[#7078F4] pl-4 text-base font-medium leading-relaxed text-slate-800 whitespace-pre-line">
                      {articleDraft.introduction}
                    </div>

                    {/* Body Sections */}
                    <div className="flex flex-col gap-10">
                      {articleDraft.sections.map((sec, idx) => (
                        <section
                          key={sec.id}
                          id={`section-${sec.id}`}
                          className="flex flex-col gap-4"
                        >
                          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            {idx + 1}. {sec.h2Heading}
                          </h2>

                          {sec.paragraphs.map((p, pIdx) => (
                            <p
                              key={pIdx}
                              className="text-sm leading-relaxed text-slate-700 sm:text-base"
                            >
                              {p}
                            </p>
                          ))}

                          {/* H3 Subsections */}
                          {sec.h3Subsections.map((sub, subIdx) => (
                            <div
                              key={subIdx}
                              className="my-2 flex flex-col gap-2 rounded-xl bg-slate-50/70 p-4 border border-slate-100"
                            >
                              <h3 className="text-base font-bold text-slate-900">
                                {sub.heading}
                              </h3>
                              {sub.paragraphs.map((sp, spIdx) => (
                                <p
                                  key={spIdx}
                                  className="text-sm leading-relaxed text-slate-700"
                                >
                                  {sp}
                                </p>
                              ))}
                              {sub.bullets?.length ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                  {sub.bullets.map((b, bIdx) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}

                          {/* Takeaway Bullets */}
                          {sec.bulletPoints.length > 0 ? (
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Key Takeaways
                              </span>
                              <ul className="mt-2 space-y-1.5 pl-4 list-disc text-sm text-slate-700">
                                {sec.bulletPoints.map((b, bIdx) => (
                                  <li key={bIdx}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {/* Example Callouts */}
                          {sec.examples.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {sec.examples.map((ex, exIdx) => (
                                <blockquote
                                  key={exIdx}
                                  className="border-l-4 border-amber-400 bg-amber-50/60 p-4 text-xs italic text-slate-800 rounded-r-xl"
                                >
                                  <strong>Example:</strong> {ex}
                                </blockquote>
                              ))}
                            </div>
                          ) : null}
                        </section>
                      ))}
                    </div>

                    {/* Internal Link Suggestions Highlight */}
                    {articleDraft.internalLinks.length > 0 ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                          <Link2 className="h-4 w-4 text-blue-600" />
                          <span>Recommended Related Reading</span>
                        </span>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {articleDraft.internalLinks.map((link, lIdx) => (
                            <a
                              key={lIdx}
                              href={link.targetTopicOrUrl}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-3.5 py-1 text-xs font-medium text-blue-800 shadow-2xs hover:bg-blue-50"
                            >
                              <span>{link.anchorText}</span>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Interactive FAQ Section with Accordion */}
                    {articleDraft.faqs.length > 0 ? (
                      <section id="section-faqs" className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                          Frequently Asked Questions
                        </h2>
                        <div className="flex flex-col gap-2.5">
                          {articleDraft.faqs.map((faq, fIdx) => {
                            const isOpen = openFaqIndices.includes(fIdx);
                            return (
                              <div
                                key={faq.id}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleFaq(fIdx)}
                                  className="flex w-full cursor-pointer items-center justify-between p-4 text-left font-semibold text-slate-900 text-sm hover:bg-slate-100/60"
                                >
                                  <span>{faq.question}</span>
                                  {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                  )}
                                </button>
                                {isOpen ? (
                                  <div className="border-t border-slate-200/60 bg-white p-4 text-sm leading-relaxed text-slate-700">
                                    {faq.answer}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {/* External Grounded Sources Citations */}
                    {articleDraft.externalSources.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                          Sources &amp; Citations
                        </span>
                        <ul className="mt-2 space-y-1">
                          {articleDraft.externalSources.map((src, sIdx) => (
                            <li key={sIdx} className="flex items-center gap-1.5">
                              <span>•</span>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-accent-primary underline hover:text-blue-700 inline-flex items-center gap-1"
                              >
                                <span>{src.title}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Conclusion & CTA */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col gap-3">
                      <h2 className="text-lg font-bold text-slate-900">
                        Conclusion
                      </h2>
                      <p className="text-sm leading-relaxed text-slate-700">
                        {articleDraft.conclusion}
                      </p>
                    </div>

                    {/* High-Converting CTA Box */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] via-[#1E1B4B] to-[#7078F4] p-8 text-white shadow-lg">
                      <div className="flex flex-col gap-3 max-w-xl">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                          Next Steps
                        </span>
                        <h3 className="text-xl font-extrabold sm:text-2xl text-white">
                          Put These Strategies into Practice
                        </h3>
                        <p className="text-sm text-white/90 leading-relaxed">
                          {articleDraft.cta}
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const brand = snapshot.brands.find(
                                (b) => b.id === activeProject.brandId
                              );
                              if (brand?.websiteUrl) {
                                window.open(brand.websiteUrl, "_blank");
                              }
                            }}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
                          >
                            <span>Visit Official Site</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Social Share Simulation */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500">
                      <span className="font-medium">Share this article:</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyMarkdown()}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span>Copy Link</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          ) : (
            /* VIEW MODE 2: ARTICLE EDITOR & REAL-TIME AI IMAGE PROMPT STUDIO */
            <div className="flex flex-col gap-6">
              {/* Featured Blog Image, AI Prompt Studio & Real-Time Generator */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>
                        Featured Blog Image &amp; Real-Time AI Prompt Studio
                      </CardTitle>
                      <CardDescription>
                        Write your prompt directly or use AI to write or refine it. Generate real-time images at your exact chosen dimensions.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={isGeneratingRealTimeImage}
                        onClick={() => void handleGenerateRealTimeImage()}
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        <span>Generate Real-Time Image</span>
                      </Button>
                      <a
                        href={articleDraft.featuredImageUrl}
                        download={`${articleDraft.suggestedSlug || "blog-featured-image"}.png`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-strong bg-surface-primary px-4 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-secondary"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Download Image</span>
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Left: Image Preview Frame */}
                  <div className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border-subtle bg-surface-secondary p-3 lg:col-span-5">
                    <img
                      src={articleDraft.featuredImageUrl}
                      alt={articleDraft.imageAltText}
                      className="max-h-72 w-auto rounded-xl object-contain shadow-sm"
                    />
                    <Badge variant="neutral">
                      {articleDraft.featuredImageFormatName} ({articleDraft.featuredImageWidth}×{articleDraft.featuredImageHeight} px)
                    </Badge>
                  </div>

                  {/* Right: AI Prompt Studio (Write, Refine with AI, Direct Edit) */}
                  <div className="flex flex-col justify-between gap-4 lg:col-span-7">
                    <div className="flex flex-col gap-3">
                      {/* Direct Prompt Input */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="featured-img-prompt">
                            Featured Image Prompt (Write or edit freely)
                          </Label>
                          <span className="text-[11px] text-text-secondary">
                            Zero text &amp; zero watermarks enforced
                          </span>
                        </div>
                        <Textarea
                          id="featured-img-prompt"
                          rows={3}
                          value={imagePromptText}
                          placeholder="e.g. Commercial editorial photograph of European vehicle inspection paperwork, 50mm lens, natural daylight..."
                          onChange={(e) => setImagePromptText(e.target.value)}
                        />
                      </div>

                      {/* AI Prompt Assistant Controls */}
                      <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface-secondary p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-accent-primary flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>AI Prompt Assistant</span>
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Input
                            placeholder="Optional creative direction: e.g. dramatic lighting, minimalist architectural scene..."
                            value={imagePromptRefinement}
                            onChange={(e) =>
                              setImagePromptRefinement(e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={isAssistingPrompt}
                            onClick={() => void handleAiPromptAction("write")}
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            <span>Write Prompt with AI</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={isAssistingPrompt}
                            onClick={() => void handleAiPromptAction("refine")}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Refine Prompt with AI</span>
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            isLoading={isGeneratingRealTimeImage}
                            onClick={() => void handleGenerateRealTimeImage()}
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Generate Real-Time Image</span>
                          </Button>
                        </div>
                      </div>

                      {/* Alt text and Caption */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="editor-img-alt" className="text-xs">
                            Image Alt Text (SEO Accessibility)
                          </Label>
                          <Input
                            id="editor-img-alt"
                            value={articleDraft.imageAltText}
                            onChange={(e) =>
                              setArticleDraft({
                                ...articleDraft,
                                imageAltText: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label htmlFor="editor-img-caption" className="text-xs">
                            Image Caption
                          </Label>
                          <Input
                            id="editor-img-caption"
                            value={articleDraft.imageCaption}
                            onChange={(e) =>
                              setArticleDraft({
                                ...articleDraft,
                                imageCaption: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Dimensions switch pills */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">
                          Switch Dimensions for Next Generation:
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {dimensionPresets.map((preset) => (
                            <Button
                              key={preset.id}
                              type="button"
                              variant={
                                imageFormatName === preset.formatName &&
                                imageWidth === preset.width &&
                                imageHeight === preset.height
                                  ? "primary"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                setImageFormatName(preset.formatName);
                                setImageWidth(preset.width);
                                setImageHeight(preset.height);
                              }}
                            >
                              {preset.formatName} ({preset.width}×{preset.height})
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SEO Metadata & Keyword Placement Verification Card */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    SEO Metadata, Slug &amp; Relevant Keyword Placement
                  </CardTitle>
                  <CardDescription>
                    Customize your Blog Title, SEO Title, Meta Description, Suggested URL Slug, and add supporting keywords.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-blog-title">Blog Title</Label>
                      <Input
                        id="editor-blog-title"
                        value={articleDraft.blogTitle}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            blogTitle: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-seo-title">
                        SEO Title ({articleDraft.seoTitle.length}/60 chars)
                      </Label>
                      <Input
                        id="editor-seo-title"
                        value={articleDraft.seoTitle}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            seoTitle: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-slug">Suggested URL Slug</Label>
                      <Input
                        id="editor-slug"
                        value={articleDraft.suggestedSlug}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            suggestedSlug: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-h1">H1 Heading</Label>
                      <Input
                        id="editor-h1"
                        value={articleDraft.h1Heading}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            h1Heading: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="editor-meta-desc">
                      Meta Description ({articleDraft.metaDescription.length}/160 chars)
                    </Label>
                    <Textarea
                      id="editor-meta-desc"
                      rows={2}
                      value={articleDraft.metaDescription}
                      onChange={(e) =>
                        setArticleDraft({
                          ...articleDraft,
                          metaDescription: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Relevant Keyword Placement Breakdown + Add Supporting Keywords */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Keyword Placement Tracker
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Add supporting keyword"
                          placeholder="Add supporting keyword..."
                          value={newSupportingKeyword}
                          onChange={(e) =>
                            setNewSupportingKeyword(e.target.value)
                          }
                          className="h-9 w-52"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void handleAddSupportingKeywordInEditor()
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Keyword</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {articleDraft.keywordPlacements.map((kp) => (
                        <div
                          key={`${kp.type}-${kp.keyword}`}
                          className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-primary px-3 py-1 text-xs"
                        >
                          <Badge
                            variant={
                              kp.type === "primary"
                                ? "info"
                                : kp.type === "secondary"
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {kp.type}
                          </Badge>
                          <span className="font-semibold text-text-primary">
                            {kp.keyword}
                          </span>
                          <span className="text-text-secondary">
                            ({kp.occurrences}×{" "}
                            {kp.locations.length > 0
                              ? `in ${kp.locations.join(", ")}`
                              : "not placed yet"}
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editable Article Writing Interface (Section 4.7) */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>
                        Complete Blog Article Editor (H1, Introduction, H2/H3 Sections, Conclusion &amp; CTA)
                      </CardTitle>
                      <CardDescription>
                        Edit any paragraph directly or use the quick AI actions on each section to rewrite, expand, shorten, regenerate, or change tone.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="editor-tone-select" className="text-xs">
                        Target Tone:
                      </Label>
                      <NativeSelect
                        id="editor-tone-select"
                        value={writingTone}
                        onChange={(e) => setWritingTone(e.target.value)}
                      >
                        {WRITING_TONE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  {/* Introduction */}
                  <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                    <Label htmlFor="editor-intro" className="text-sm font-bold">
                      Article Introduction
                    </Label>
                    <Textarea
                      id="editor-intro"
                      rows={5}
                      value={articleDraft.introduction}
                      onChange={(e) =>
                        setArticleDraft({
                          ...articleDraft,
                          introduction: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* H2 & H3 Sections */}
                  {articleDraft.sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-secondary p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                        <Badge variant="info">H2 Section {idx + 1}</Badge>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void handleTransformSection(sec.id, "rewrite")
                            }
                          >
                            Rewrite Paragraphs
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void handleTransformSection(sec.id, "expand")
                            }
                          >
                            Expand
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void handleTransformSection(sec.id, "shorten")
                            }
                          >
                            Shorten
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void handleTransformSection(sec.id, "change_tone")
                            }
                          >
                            Change Tone
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void handleTransformSection(sec.id, "regenerate")
                            }
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Regenerate Section</span>
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>H2 Heading</Label>
                        <Input
                          value={sec.h2Heading}
                          onChange={(e) => {
                            const next = [...articleDraft.sections];
                            next[idx] = { ...sec, h2Heading: e.target.value };
                            setArticleDraft({
                              ...articleDraft,
                              sections: next,
                            });
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>
                          Section Body Paragraphs (Separate paragraphs with a blank line)
                        </Label>
                        <Textarea
                          rows={6}
                          value={sec.paragraphs.join("\n\n")}
                          onChange={(e) => {
                            const next = [...articleDraft.sections];
                            next[idx] = {
                              ...sec,
                              paragraphs: e.target.value
                                .split(/\n\s*\n/)
                                .map((p) => p.trim())
                                .filter(Boolean),
                            };
                            setArticleDraft({
                              ...articleDraft,
                              sections: next,
                            });
                          }}
                        />
                      </div>

                      {/* H3 Subsections */}
                      {sec.h3Subsections.length > 0 ? (
                        <div className="flex flex-col gap-3 pl-3 border-l-2 border-accent-primary/40">
                          <span className="text-xs font-bold uppercase text-text-secondary">
                            H3 Subsections
                          </span>
                          {sec.h3Subsections.map((sub, subIdx) => (
                            <div
                              key={subIdx}
                              className="flex flex-col gap-2 rounded-xl bg-surface-primary p-3.5"
                            >
                              <Input
                                aria-label={`H3 Heading ${subIdx + 1}`}
                                value={sub.heading}
                                onChange={(e) => {
                                  const nextSecs = [...articleDraft.sections];
                                  const nextSubs = [...sec.h3Subsections];
                                  nextSubs[subIdx] = {
                                    ...sub,
                                    heading: e.target.value,
                                  };
                                  nextSecs[idx] = {
                                    ...sec,
                                    h3Subsections: nextSubs,
                                  };
                                  setArticleDraft({
                                    ...articleDraft,
                                    sections: nextSecs,
                                  });
                                }}
                              />
                              <Textarea
                                rows={3}
                                value={sub.paragraphs.join("\n\n")}
                                onChange={(e) => {
                                  const nextSecs = [...articleDraft.sections];
                                  const nextSubs = [...sec.h3Subsections];
                                  nextSubs[subIdx] = {
                                    ...sub,
                                    paragraphs: e.target.value
                                      .split(/\n\s*\n/)
                                      .map((p) => p.trim())
                                      .filter(Boolean),
                                  };
                                  nextSecs[idx] = {
                                    ...sec,
                                    h3Subsections: nextSubs,
                                  };
                                  setArticleDraft({
                                    ...articleDraft,
                                    sections: nextSecs,
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">
                            Key Takeaway Bullet Points (One per line)
                          </Label>
                          <Textarea
                            rows={3}
                            value={sec.bulletPoints.join("\n")}
                            onChange={(e) => {
                              const next = [...articleDraft.sections];
                              next[idx] = {
                                ...sec,
                                bulletPoints: e.target.value
                                  .split("\n")
                                  .map((l) => l.trim())
                                  .filter(Boolean),
                              };
                              setArticleDraft({
                                ...articleDraft,
                                sections: next,
                              });
                            }}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">
                            Practical Examples (One per line)
                          </Label>
                          <Textarea
                            rows={3}
                            value={sec.examples.join("\n")}
                            onChange={(e) => {
                              const next = [...articleDraft.sections];
                              next[idx] = {
                                ...sec,
                                examples: e.target.value
                                  .split("\n")
                                  .map((l) => l.trim())
                                  .filter(Boolean),
                              };
                              setArticleDraft({
                                ...articleDraft,
                                sections: next,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Frequently Asked Questions Editor (Sections 4.1 & 4.7) */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-text-primary">
                        Frequently Asked Questions ({articleDraft.faqs.length})
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const nextFaq: BlogFaqItem = {
                            id: `faq-${Date.now()}`,
                            question: "New Frequently Asked Question?",
                            answer:
                              "Provide a direct, helpful answer for readers.",
                          };
                          setArticleDraft({
                            ...articleDraft,
                            faqs: [...articleDraft.faqs, nextFaq],
                          });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add FAQ</span>
                      </Button>
                    </div>

                    {articleDraft.faqs.map((faq, fIdx) => (
                      <div
                        key={faq.id}
                        className="flex flex-col gap-2 rounded-xl bg-surface-primary p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={faq.question}
                            onChange={(e) => {
                              const next = [...articleDraft.faqs];
                              next[fIdx] = { ...faq, question: e.target.value };
                              setArticleDraft({ ...articleDraft, faqs: next });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setArticleDraft({
                                ...articleDraft,
                                faqs: articleDraft.faqs.filter(
                                  (item) => item.id !== faq.id
                                ),
                              })
                            }
                            aria-label="Delete FAQ"
                          >
                            <Trash2 className="h-4 w-4 text-status-danger-fg" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={faq.answer}
                          onChange={(e) => {
                            const next = [...articleDraft.faqs];
                            next[fIdx] = { ...faq, answer: e.target.value };
                            setArticleDraft({ ...articleDraft, faqs: next });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Internal Linking & External Source Suggestions */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                          <Link2 className="h-4 w-4 text-accent-primary" />
                          <span>
                            Internal Linking Suggestions ({articleDraft.internalLinks.length})
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextLink: BlogInternalLinkSuggestion = {
                              anchorText: "related guide",
                              targetTopicOrUrl: "/resources",
                              placementContext: "Link inside body section",
                            };
                            setArticleDraft({
                              ...articleDraft,
                              internalLinks: [
                                ...articleDraft.internalLinks,
                                nextLink,
                              ],
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Internal Link</span>
                        </Button>
                      </div>

                      {articleDraft.internalLinks.map((lnk, lIdx) => (
                        <div
                          key={lIdx}
                          className="flex flex-col gap-1.5 rounded-xl bg-surface-primary p-3 text-xs"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={lnk.anchorText}
                              placeholder="Anchor text"
                              onChange={(e) => {
                                const next = [...articleDraft.internalLinks];
                                next[lIdx] = {
                                  ...lnk,
                                  anchorText: e.target.value,
                                };
                                setArticleDraft({
                                  ...articleDraft,
                                  internalLinks: next,
                                });
                              }}
                            />
                            <Input
                              value={lnk.targetTopicOrUrl}
                              placeholder="Target URL"
                              onChange={(e) => {
                                const next = [...articleDraft.internalLinks];
                                next[lIdx] = {
                                  ...lnk,
                                  targetTopicOrUrl: e.target.value,
                                };
                                setArticleDraft({
                                  ...articleDraft,
                                  internalLinks: next,
                                });
                              }}
                            />
                          </div>
                          <span className="text-text-secondary">
                            Placement: {lnk.placementContext}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                          <ExternalLink className="h-4 w-4 text-accent-primary" />
                          <span>
                            External Source Suggestions ({articleDraft.externalSources.length})
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextSrc: BlogGroundedSource = {
                              title: "External Reference",
                              url: "https://",
                              associatedClaim: "Supporting context",
                              verifiedFromGrounding: false,
                            };
                            setArticleDraft({
                              ...articleDraft,
                              externalSources: [
                                ...articleDraft.externalSources,
                                nextSrc,
                              ],
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add External Source</span>
                        </Button>
                      </div>

                      {articleDraft.externalSources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex flex-col gap-1.5 rounded-xl bg-surface-primary p-3 text-xs"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={src.title}
                              placeholder="Source Title"
                              onChange={(e) => {
                                const next = [...articleDraft.externalSources];
                                next[sIdx] = {
                                  ...src,
                                  title: e.target.value,
                                };
                                setArticleDraft({
                                  ...articleDraft,
                                  externalSources: next,
                                });
                              }}
                            />
                            <Input
                              value={src.url}
                              placeholder="https://..."
                              onChange={(e) => {
                                const next = [...articleDraft.externalSources];
                                next[sIdx] = { ...src, url: e.target.value };
                                setArticleDraft({
                                  ...articleDraft,
                                  externalSources: next,
                                });
                              }}
                            />
                          </div>
                          <Input
                            value={src.associatedClaim}
                            placeholder="Associated claim in article"
                            onChange={(e) => {
                              const next = [...articleDraft.externalSources];
                              next[sIdx] = {
                                ...src,
                                associatedClaim: e.target.value,
                              };
                              setArticleDraft({
                                ...articleDraft,
                                externalSources: next,
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conclusion & CTA */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-conclusion">
                        Article Conclusion
                      </Label>
                      <Textarea
                        id="editor-conclusion"
                        rows={4}
                        value={articleDraft.conclusion}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            conclusion: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="editor-cta">Call to Action (CTA)</Label>
                      <Textarea
                        id="editor-cta"
                        rows={4}
                        value={articleDraft.cta}
                        onChange={(e) =>
                          setArticleDraft({
                            ...articleDraft,
                            cta: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleGenerateFullArticle()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    <span>Regenerate Full Article (Preserves History)</span>
                  </Button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleSaveArticleEdits(false)}
                    >
                      Save Revision
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void handleSaveArticleEdits(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Approve Final Blog Article</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              {/* Section 4.7: Generation History & Version Restore Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-accent-primary" />
                    <div>
                      <CardTitle>
                        Article Generation &amp; Revision History ({activeProject.versions.length})
                      </CardTitle>
                      <CardDescription>
                        Both original AI drafts and your edited/approved revisions are preserved here.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {activeProject.versions
                    .slice()
                    .reverse()
                    .map((ver) => (
                      <div
                        key={ver.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-secondary px-4 py-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Badge variant={ver.isUserEdited ? "success" : "info"}>
                              v{ver.versionNumber}
                            </Badge>
                            <span className="text-sm font-bold text-text-primary">
                              {ver.label}
                            </span>
                          </div>
                          <span className="text-xs text-text-secondary">
                            {ver.content.wordCount} words • Saved{" "}
                            {new Date(ver.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestoreVersion(ver.id)}
                        >
                          Restore Version
                        </Button>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
