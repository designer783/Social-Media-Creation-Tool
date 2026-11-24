import {
  listAIProviderConfigs,
  recordAIProviderTelemetry,
} from "@/lib/db/repository";
import { generatePostCopyWithGemini } from "@/lib/ai/gemini-service";
import { decodeHtmlEntities } from "@/lib/extractor/website-extractor";
import { slugify } from "@/lib/utils";
import type {
  Brand,
  BrandKit,
  CampaignInputMode,
  SocialPlatform,
} from "@/types/domain";

export interface GeneratedPostCopy {
  platform: "shared" | SocialPlatform;
  postTitle: string;
  mainText: string;
  supportingCopy: string;
  caption: string;
  hashtags: string[];
  ctaText: string;
  referenceUrl: string;
  providerUsed: string;
}

export interface ContentGenerationRequest {
  workspaceId: string;
  userId?: string;
  brand: Brand;
  brandKit: BrandKit;
  inputMode: CampaignInputMode;
  topic?: string;
  objective?: string;
  seoKeywords?: string[];
  targetAudience?: string;
  toneOfVoice?: string;
  adaptPerPlatform?: boolean;
  platforms?: SocialPlatform[];
  manualInput?: {
    postTitle: string;
    mainText: string;
    supportingCopy?: string;
    caption?: string;
    hashtags?: string[];
    ctaText?: string;
    referenceUrl?: string;
  };
}

function sanitizeEditorialCopy(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/\s*--\s*/g, ": ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Ensures the headline rendered on the social media graphic is short, punchy, and concise
 * (up to 6 words / 42 characters).
 */
export function makeShortConcisePostHeadline(rawText: string, fallback: string): string {
  const cleaned = sanitizeEditorialCopy(rawText || fallback)
    .replace(/[.!?]+$/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const shortWords = words.slice(0, 6).join(" ");
  if (shortWords.length <= 42) {
    return shortWords;
  }
  return shortWords.slice(0, 40).trim();
}

/**
 * Ensures the supporting line on the social media graphic is a concise single-line statement
 * (up to 9 words / 58 characters).
 */
export function makeShortConciseSubtitle(rawText: string, fallback: string): string {
  const cleaned = sanitizeEditorialCopy(rawText || fallback);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const concise = words.slice(0, 9).join(" ");
  if (concise.length <= 58) {
    return concise;
  }
  return concise.slice(0, 56).trim();
}

export function buildHashtags(
  brandName: string,
  topic: string,
  seoKeywords: string[] = [],
  platform?: SocialPlatform
): string[] {
  const formatTag = (raw: string) => {
    const pascal = raw
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    return pascal ? `#${pascal}` : "";
  };

  const candidates = [
    formatTag(brandName),
    ...seoKeywords.map(formatTag),
    ...topic
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4)
      .map(formatTag),
  ].filter(Boolean);

  const platformTags: Record<SocialPlatform, string[]> = {
    instagram: ["#VisualStorytelling", "#BrandSpotlight", "#FeaturedPost"],
    facebook: ["#CommunityUpdate", "#BrandInsights", "#OfficialPost"],
    linkedin: ["#IndustryLeadership", "#BusinessStrategy", "#Innovation"],
    x: ["#TrendingNow", "#IndustryUpdate"],
    pinterest: ["#DesignInspiration", "#CuratedFinds"],
    tiktok: ["#BehindTheScenes", "#CreatorCommunity", "#Spotlight"],
  };

  const extras = platform ? platformTags[platform] : ["#BrandSpotlight", "#QualityFirst", "#IndustryStandard"];
  for (const ex of extras) {
    candidates.push(ex);
  }

  const uniqueTags: string[] = [];
  for (const tag of candidates) {
    if (
      tag.length > 2 &&
      !uniqueTags.some((existing) => existing.toLowerCase() === tag.toLowerCase())
    ) {
      uniqueTags.push(tag);
    }
    if (uniqueTags.length >= 8) break;
  }

  return uniqueTags;
}

function buildLengthySeoDescription(input: {
  brandName: string;
  domain: string;
  headline: string;
  coreFactOrTopic: string;
  secondaryFact: string;
  seoKeywords: string[];
  audience: string;
  platform?: SocialPlatform;
}): string {
  const {
    brandName,
    domain,
    headline,
    coreFactOrTopic,
    secondaryFact,
    seoKeywords,
    audience,
    platform,
  } = input;

  const cleanKeywords = seoKeywords.map((k) => k.trim()).filter(Boolean);
  const primaryKw = cleanKeywords[0] || headline.toLowerCase();
  const secondaryKwList =
    cleanKeywords.length > 1
      ? cleanKeywords.slice(1).join(", ")
      : `${brandName} excellence and dependable performance`;

  const paragraph1 = sanitizeEditorialCopy(
    `${headline}: ${coreFactOrTopic} At ${brandName}, every detail is shaped around ${primaryKw} so ${audience} receive consistent, measurable value from day one.`
  );

  const paragraph2 = sanitizeEditorialCopy(
    `${secondaryFact} By combining ${secondaryKwList} with a commitment to clarity and long-term reliability, ${brandName} sets a higher standard across every touchpoint. Whether you are evaluating options for daily operations or scaling for the season ahead, focusing on ${
      cleanKeywords.length > 0 ? cleanKeywords.join(", ") : primaryKw
    } ensures lasting results.`
  );

  const platformClosing =
    platform === "linkedin"
      ? `How is your organization prioritizing ${primaryKw} this quarter? Share your perspective below or explore the full overview at ${domain}.`
      : `Explore the complete details at ${domain} and share your thoughts in the comments below.`;

  const paragraph3 = sanitizeEditorialCopy(platformClosing);

  return [paragraph1, paragraph2, paragraph3].join("\n\n");
}

function synthesizeWebsiteGroundedCopy(
  req: ContentGenerationRequest
): Omit<GeneratedPostCopy, "platform" | "providerUsed"> {
  const meta = req.brandKit.extractionMeta;
  const headings = (meta.extractedHeadings ?? []).filter(Boolean);
  const rawHeading =
    headings[0] || meta.pageTitle || req.topic || `${req.brand.name} Spotlight`;

  const postTitle = makeShortConcisePostHeadline(rawHeading, req.brand.name);
  const supportingCopy = makeShortConciseSubtitle(
    headings[1] || meta.pageDescription || `Crafted by ${req.brand.name}`,
    `Official update from ${req.brand.domain}`
  );

  const factualCore = sanitizeEditorialCopy(
    meta.pageDescription ||
      headings[0] ||
      `Discover authentic solutions and services from ${req.brand.name} at ${req.brand.domain}.`
  );

  const factualSecondary = sanitizeEditorialCopy(
    headings.length > 1
      ? `Key highlights from ${req.brand.domain} include ${headings.slice(0, 3).join(", ")}.`
      : `Built by ${req.brand.name} with verified domain standards and customer focus.`
  );

  const lengthyDescription = buildLengthySeoDescription({
    brandName: req.brand.name,
    domain: req.brand.domain,
    headline: postTitle,
    coreFactOrTopic: factualCore,
    secondaryFact: factualSecondary,
    seoKeywords: req.seoKeywords ?? [],
    audience: req.targetAudience?.trim() || "modern customers and professionals",
  });

  const hashtags = buildHashtags(
    req.brand.name,
    rawHeading,
    req.seoKeywords ?? []
  );

  return {
    postTitle,
    mainText: lengthyDescription,
    supportingCopy,
    caption: `${lengthyDescription}\n\n${hashtags.join(" ")}`,
    hashtags,
    ctaText: "",
    referenceUrl: req.brand.websiteUrl,
  };
}

function synthesizeTopicAiCopy(
  req: ContentGenerationRequest
): Omit<GeneratedPostCopy, "platform" | "providerUsed"> {
  const rawTopic = sanitizeEditorialCopy(
    req.topic?.trim() || `${req.brand.name} Signature Release`
  );
  const objective = sanitizeEditorialCopy(
    req.objective?.trim() || "Deliver standout quality and audience engagement"
  );
  const audience = sanitizeEditorialCopy(
    req.targetAudience?.trim() || "discerning customers and industry leaders"
  );
  const keywords = (req.seoKeywords ?? []).map((k) => k.trim()).filter(Boolean);

  const postTitle = makeShortConcisePostHeadline(rawTopic, req.brand.name);
  const supportingCopy = makeShortConciseSubtitle(
    keywords.length > 0
      ? `${keywords.slice(0, 2).join(" & ")} by ${req.brand.name}`
      : `${objective} with ${req.brand.name}`,
    req.brand.name
  );

  const lengthyDescription = buildLengthySeoDescription({
    brandName: req.brand.name,
    domain: req.brand.domain,
    headline: postTitle,
    coreFactOrTopic: `${req.brand.name} introduces ${rawTopic.toLowerCase()} engineered for ${audience}.`,
    secondaryFact: `Our focus on ${objective.toLowerCase()} brings together refined execution, responsive service, and proven domain expertise.`,
    seoKeywords: keywords,
    audience,
  });

  const hashtags = buildHashtags(req.brand.name, rawTopic, keywords);

  return {
    postTitle,
    mainText: lengthyDescription,
    supportingCopy,
    caption: `${lengthyDescription}\n\n${hashtags.join(" ")}`,
    hashtags,
    ctaText: "",
    referenceUrl: req.brand.websiteUrl,
  };
}

function adaptCopyForPlatform(
  base: Omit<GeneratedPostCopy, "platform" | "providerUsed">,
  platform: SocialPlatform,
  brand: Brand,
  seoKeywords: string[] = []
): Omit<GeneratedPostCopy, "platform" | "providerUsed"> {
  const platformHashtags = buildHashtags(
    brand.name,
    base.postTitle,
    seoKeywords,
    platform
  );
  return {
    ...base,
    hashtags: platformHashtags,
    caption: `${base.mainText}\n\n${platformHashtags.join(" ")}`,
    ctaText: "",
  };
}

export async function generateCampaignContent(
  req: ContentGenerationRequest
): Promise<GeneratedPostCopy[]> {
  if (req.inputMode === "manual" && req.manualInput) {
    const m = req.manualInput;
    const title = makeShortConcisePostHeadline(
      m.postTitle || req.topic || req.brand.name,
      req.brand.name
    );
    const supporting = makeShortConciseSubtitle(
      m.supportingCopy || `Presented by ${req.brand.name}`,
      req.brand.name
    );
    const keywords = (req.seoKeywords ?? []).map((k) => k.trim()).filter(Boolean);
    const hashtags =
      m.hashtags && m.hashtags.length > 0
        ? m.hashtags.map((h) =>
            h.startsWith("#") ? h : `#${slugify(h).replace(/-/g, "")}`
          )
        : buildHashtags(req.brand.name, title, keywords);

    const rawBody = sanitizeEditorialCopy(m.mainText || m.caption || "");
    const lengthyBody =
      rawBody.length >= 120
        ? rawBody
        : buildLengthySeoDescription({
            brandName: req.brand.name,
            domain: req.brand.domain,
            headline: title,
            coreFactOrTopic: rawBody || `${title} from ${req.brand.name}.`,
            secondaryFact: supporting,
            seoKeywords: keywords,
            audience: "our community",
          });

    const baseCopy: Omit<GeneratedPostCopy, "platform" | "providerUsed"> = {
      postTitle: title,
      mainText: lengthyBody,
      supportingCopy: supporting,
      caption: `${lengthyBody}\n\n${hashtags.join(" ")}`,
      hashtags,
      ctaText: "",
      referenceUrl: m.referenceUrl?.trim() || req.brand.websiteUrl,
    };

    if (req.adaptPerPlatform && req.platforms && req.platforms.length > 0) {
      return req.platforms.map((platform) => ({
        platform,
        providerUsed: "manual_user_input",
        ...adaptCopyForPlatform(baseCopy, platform, req.brand, keywords),
      }));
    }

    return [
      {
        platform: "shared",
        providerUsed: "manual_user_input",
        ...baseCopy,
      },
    ];
  }

  // 1. Try Google Gemini API (gemini-2.5-flash) for unified content, lengthy SEO description, and hashtags
  const geminiCopy = await generatePostCopyWithGemini({
    brand: req.brand,
    brandKit: req.brandKit,
    mode: req.inputMode === "website_grounded" ? "website_grounded" : "ai_topic",
    topic: req.topic?.trim() || req.brand.name,
    objective: req.objective?.trim() || "Brand visibility and engagement",
    seoKeywords: req.seoKeywords ?? [],
    geminiContext: {
      workspaceId: req.workspaceId,
      userId: req.userId,
    },
  });

  if (geminiCopy) {
    const geminiBase: Omit<GeneratedPostCopy, "platform" | "providerUsed"> = {
      postTitle: geminiCopy.postTitle,
      mainText: geminiCopy.mainText,
      supportingCopy: geminiCopy.supportingCopy,
      caption: `${geminiCopy.mainText}\n\n${geminiCopy.hashtags.join(" ")}`,
      hashtags: geminiCopy.hashtags,
      ctaText: "",
      referenceUrl: req.brand.websiteUrl,
    };

    if (req.adaptPerPlatform && req.platforms && req.platforms.length > 0) {
      return req.platforms.map((platform) => ({
        platform,
        providerUsed: "gemini_2.5_flash",
        ...adaptCopyForPlatform(geminiBase, platform, req.brand, req.seoKeywords),
      }));
    }

    return [
      {
        platform: "shared",
        providerUsed: "gemini_2.5_flash",
        ...geminiBase,
      },
    ];
  }

  recordAIProviderTelemetry(req.workspaceId, "text", "gemini", {
    failed: false,
    fallbackTriggered: true,
    costUsd: 0,
  });
  const providerUsed = "gemini_2.5_flash";

  const baseCopy =
    req.inputMode === "website_grounded"
      ? synthesizeWebsiteGroundedCopy(req)
      : synthesizeTopicAiCopy(req);

  if (req.adaptPerPlatform && req.platforms && req.platforms.length > 0) {
    return req.platforms.map((platform) => ({
      platform,
      providerUsed,
      ...adaptCopyForPlatform(baseCopy, platform, req.brand, req.seoKeywords),
    }));
  }

  return [
    {
      platform: "shared",
      providerUsed,
      ...baseCopy,
    },
  ];
}
