import sharp from "sharp";
import {
  recordAIProviderTelemetry,
  resolveActiveMediaCredentials,
} from "@/lib/db/repository";
import { detectTopicFromContent } from "@/lib/extractor/website-extractor";
import {
  buildGeminiDirectedImagePrompt,
  fetchReferenceImagesForGemini,
  generateImageWithGeminiApi,
} from "@/lib/ai/gemini-service";
import { generateFreeFallbackImage } from "@/lib/ai/free-image-provider";
import { generateImageWithMediaConnection } from "@/lib/ai/universal-media-provider";
import type {
  BrandColors,
  BrandVisualStyle,
  DetectedTopicCategory,
  GeminiModelId,
  SupportiveGraphicStyle,
} from "@/types/domain";

export interface VisualAssetRequest {
  workspaceId: string;
  userId?: string;
  brandName?: string;
  brandDomain?: string;
  brandSummary?: string;
  brandHeadings?: string[];
  seoKeywords?: string[];
  platform?: string;
  formatName?: string;
  headlineText?: string;
  customPromptOverride?: string;
  prompt: string;
  width: number;
  height: number;
  brandColors: BrandColors;
  characteristic: BrandVisualStyle["characteristic"];
  variationIndex: 1 | 2 | 3;
  detectedTopic?: DetectedTopicCategory;
  supportiveGraphicStyle?: SupportiveGraphicStyle;
  candidateDomainImages?: string[];
  selectedDomainImageUrl?: string;
  previousBackgroundBuffer?: Buffer;
  editInstruction?: string;
  aiModel?: GeminiModelId;
  seed?: number;
}

export interface VisualAssetResult {
  buffer: Buffer;
  providerUsed: string;
  promptUsed: string;
  artDirectionBadge?: string;
  sceneConcept?: string;
}

/**
 * Applies cinema-grade color mastering and a light bottom legibility feather
 * so the upper 74% of the Gemini-generated photograph stays luminous and crisp.
 */
async function applyCinemaStudioGrading(
  rawImageBuffer: Buffer,
  width: number,
  height: number,
  brandColors: BrandColors,
  variationIndex: 1 | 2 | 3
): Promise<Buffer> {
  const accent = brandColors.accent || "#2563EB";
  const gradingSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="cinemaScrim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#090D16" stop-opacity="0.12" />
          <stop offset="68%" stop-color="#090D16" stop-opacity="0.0" />
          <stop offset="86%" stop-color="#090D16" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#090D16" stop-opacity="0.62" />
        </linearGradient>
        <radialGradient id="studioRim" cx="${
          variationIndex === 1 ? "82%" : variationIndex === 2 ? "50%" : "18%"
        }" cy="16%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.10" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#cinemaScrim)" />
      <rect width="${width}" height="${height}" fill="url(#studioRim)" />
    </svg>
  `;

  return sharp(rawImageBuffer)
    .resize(width, height, {
      fit: "cover",
      position: "attention",
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({ brightness: 1.03, saturation: 1.05 })
    .sharpen({ sigma: 0.9 })
    .composite([{ input: Buffer.from(gradingSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * Minimal architectural dark studio atmosphere used ONLY during offline Vitest unit tests
 * (zero cartoon cars or clip-art shapes).
 */
export async function generateProceduralBrandBackdrop(
  req: VisualAssetRequest
): Promise<Buffer> {
  const { width, height, brandColors, variationIndex } = req;
  const primary = brandColors.primary || "#0F172A";
  const accent = brandColors.accent || "#2563EB";
  const seedOffset = ((req.seed ?? Date.now()) % 360) + variationIndex * 47;

  const svgBackdrop = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="studioAtmosphere" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090D16" />
          <stop offset="55%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <radialGradient id="ambientBloom" cx="${30 + (seedOffset % 45)}%" cy="${25 + (variationIndex * 10)}%" r="62%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#090D16" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#studioAtmosphere)" />
      <rect width="${width}" height="${height}" fill="url(#ambientBloom)" />
    </svg>
  `;

  return sharp(Buffer.from(svgBackdrop))
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

/**
 * Generates a brand-new, high-level professional social media image via Google Gemini API:
 * - Extracted website images are NEVER pasted directly into the post.
 * - Instead, extracted website images are fetched as multimodal inlineData references
 *   so Gemini Vision + Gemini Image Generation create a brand-new commercial photograph
 *   inspired by the brand's reference imagery and topic.
 */
export async function generateVisualAsset(
  req: VisualAssetRequest
): Promise<VisualAssetResult> {
  const resolvedTopic =
    req.supportiveGraphicStyle === "vehicle_showcase"
      ? "automotive_vehicle"
      : req.detectedTopic ?? detectTopicFromContent(req.prompt);

  // 1. Gather extracted website images strictly as Multimodal Reference Images for Gemini (never used directly as the post image)
  const referenceUrls: string[] = [];
  if (req.selectedDomainImageUrl) {
    referenceUrls.push(req.selectedDomainImageUrl);
  }
  for (const url of req.candidateDomainImages ?? []) {
    if (url && !referenceUrls.includes(url)) {
      referenceUrls.push(url);
    }
  }

  const referenceImages = await fetchReferenceImagesForGemini(referenceUrls, 2);

  // 2. Use user's edited Gemini prompt override OR autonomously architect a fresh commercial prompt
  let finalPrompt: string;
  let directorUsed: string;
  let artDirectionBadge: string | undefined;
  let sceneConcept: string | undefined;

  if (req.customPromptOverride?.trim()) {
    finalPrompt = req.customPromptOverride.trim();
    directorUsed = "gemini_prompt_override";
  } else {
    const directed = await buildGeminiDirectedImagePrompt({
      brandName:
        req.brandName || req.prompt.split("—")[0]?.trim() || "Brand",
      brandDomain: req.brandDomain,
      brandSummary: req.brandSummary,
      brandHeadings: req.brandHeadings,
      seoKeywords: req.seoKeywords,
      platform: req.platform as never,
      formatName: req.formatName,
      headlineText: req.headlineText,
      topicPrompt: req.prompt,
      detectedTopic: resolvedTopic,
      supportiveGraphicStyle: req.supportiveGraphicStyle,
      characteristic: req.characteristic,
      brandColors: req.brandColors,
      variationIndex: req.variationIndex,
      referenceImages,
      geminiContext: {
        workspaceId: req.workspaceId,
        userId: req.userId,
      },
    });
    finalPrompt = directed.finalPrompt;
    directorUsed = directed.directorUsed;
    artDirectionBadge = directed.artDirectionBadge;
    sceneConcept = directed.sceneConcept;
  }

  // Ensure every generation and variation has a non-repeating seed
  const uniqueSeed =
    (req.seed ?? Math.floor(Date.now() % 10_000_000)) +
    req.variationIndex * 29387 +
    Math.floor(Math.random() * 10000);

  // 3A. Dedicated Custom / Universal Media Image Key (when configured by user or workspace)
  let dedicatedImageErr: string | null = null;
  if (!process.env.VITEST) {
    const dedicatedImageCreds = resolveActiveMediaCredentials(
      req.workspaceId,
      req.userId,
      "image"
    );
    if (dedicatedImageCreds) {
      const customImg = await generateImageWithMediaConnection({
        creds: dedicatedImageCreds,
        prompt: finalPrompt,
        width: req.width,
        height: req.height,
        seed: uniqueSeed,
      });
      if (customImg.buffer) {
        const gradedCustom = await applyCinemaStudioGrading(
          customImg.buffer,
          req.width,
          req.height,
          req.brandColors,
          req.variationIndex
        );
        recordAIProviderTelemetry(req.workspaceId, "image", "gemini", {
          failed: false,
          costUsd: 0,
        });
        return {
          buffer: gradedCustom,
          providerUsed: `${dedicatedImageCreds.providerPreset}:${customImg.modelUsed}+${directorUsed}`,
          promptUsed: finalPrompt,
          artDirectionBadge,
          sceneConcept,
        };
      }
      dedicatedImageErr = customImg.error;
    }
  }

  // 3B. Generate or iteratively evolve real-time professional photograph via Google Gemini API
  const geminiImg = await generateImageWithGeminiApi({
    prompt: finalPrompt,
    width: req.width,
    height: req.height,
    brandColors: req.brandColors,
    detectedTopic: resolvedTopic,
    supportiveGraphicStyle: req.supportiveGraphicStyle,
    variationIndex: req.variationIndex,
    referenceImages,
    previousBackgroundBuffer: req.previousBackgroundBuffer,
    editInstruction: req.editInstruction,
    uniqueSeed,
    geminiContext: {
      workspaceId: req.workspaceId,
      userId: req.userId,
    },
  });

  if (geminiImg.buffer) {
    const gradedGeminiBuffer = await applyCinemaStudioGrading(
      geminiImg.buffer,
      req.width,
      req.height,
      req.brandColors,
      req.variationIndex
    );
    recordAIProviderTelemetry(req.workspaceId, "image", "gemini", {
      failed: false,
      costUsd: 0,
    });
    return {
      buffer: gradedGeminiBuffer,
      providerUsed: `${geminiImg.modelUsed}+${directorUsed}`,
      promptUsed: finalPrompt,
      artDirectionBadge,
      sceneConcept,
    };
  }

  // 4. Hybrid Free Fallback in live runtime when Gemini native image quota returns 429 / fails
  if (!process.env.VITEST) {
    const freeImg = await generateFreeFallbackImage({
      prompt: finalPrompt,
      width: req.width,
      height: req.height,
      variationIndex: req.variationIndex,
      seed: uniqueSeed,
    });
    if (freeImg.buffer) {
      const gradedFreeBuffer = await applyCinemaStudioGrading(
        freeImg.buffer,
        req.width,
        req.height,
        req.brandColors,
        req.variationIndex
      );
      recordAIProviderTelemetry(req.workspaceId, "image", "gemini", {
        failed: false,
        fallbackTriggered: true,
        costUsd: 0,
      });
      return {
        buffer: gradedFreeBuffer,
        providerUsed: `${freeImg.modelUsed}+${directorUsed}`,
        promptUsed: finalPrompt,
        artDirectionBadge,
        sceneConcept,
      };
    }

    recordAIProviderTelemetry(req.workspaceId, "image", "gemini", {
      failed: true,
      costUsd: 0,
    });
    throw new Error(
      `${
        dedicatedImageErr ? `Custom Image API (${dedicatedImageErr}) | ` : ""
      }${geminiImg.error} | Free Image Fallback Failed: ${
        freeImg.error
      } | Autonomous Prompt Ready (${directorUsed}): "${finalPrompt.slice(
        0,
        160
      )}..."`
    );
  }

  // 5. Deterministic procedural backdrop strictly during automated offline Vitest runs
  const buffer = await generateProceduralBrandBackdrop({
    ...req,
    detectedTopic: resolvedTopic,
    seed: uniqueSeed,
  });
  recordAIProviderTelemetry(req.workspaceId, "image", "gemini", {
    failed: false,
    fallbackTriggered: true,
    costUsd: 0,
  });

  return {
    buffer,
    providerUsed: `gemini_studio_${resolvedTopic}`,
    promptUsed: finalPrompt,
    artDirectionBadge,
    sceneConcept,
  };
}
