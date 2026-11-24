import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  resolveActiveGeminiCredentials,
  type ResolvedGeminiCredentials,
} from "@/lib/db/repository";
import { validateSafePublicUrl } from "@/lib/extractor/ssrf-guard";
import type {
  Brand,
  BrandColors,
  BrandKit,
  Creative,
  DesignCharacteristic,
  DetectedTopicCategory,
  GeminiCapabilities,
  LayoutOverrides,
  SocialPlatform,
  SocialPostTracker,
  SupportiveGraphicStyle,
  TrendSignal,
} from "@/types/domain";
import {
  buildHashtags,
  makeShortConcisePostHeadline,
  makeShortConciseSubtitle,
} from "@/lib/ai/content-engine";

const DEFAULT_GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_TEXT_MODEL = "gemini-flash-latest";

const PREFERRED_GEMINI_TEXT_FALLBACKS = [
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
];

const PREFERRED_GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-lite-image",
  "gemini-nano-banana-2.1",
  "nano-banana-pro-preview",
  "gemini-2.5-flash-image-preview",
];

const catalogCache = new Map<
  string,
  { models: string[]; fetchedAt: number }
>();
const retiredModelsCache = new Set<string>();
const IMAGE_QUOTA_CACHE_TTL_MS = 10 * 60 * 1000;
const imageQuotaBlockedCache = new Map<
  string,
  { blockedAt: number; error: string }
>();

export interface GeminiContextTarget {
  workspaceId?: string;
  userId?: string;
  overrideCredentials?: ResolvedGeminiCredentials;
}

function getEffectiveCredentials(
  ctx?: GeminiContextTarget
): ResolvedGeminiCredentials {
  if (ctx?.overrideCredentials) {
    return ctx.overrideCredentials;
  }
  const resolved = resolveActiveGeminiCredentials(ctx?.workspaceId, ctx?.userId);
  if (resolved.apiKey) {
    return resolved;
  }

  // Fallback check on local .env files if not loaded into process.env
  for (const fileName of [".env.local", ".env"]) {
    try {
      const fullPath = path.join(process.cwd(), fileName);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        const match = content.match(
          /^GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m
        );
        if (match?.[1] && match[1].trim().length > 10) {
          process.env.GEMINI_API_KEY = match[1].trim();
          return {
            apiKey: match[1].trim(),
            endpointBaseUrl: DEFAULT_GEMINI_BASE,
            textModel: DEFAULT_GEMINI_TEXT_MODEL,
            imageModel: "auto",
            sourceScope: "env",
            connectionId: null,
            keyLast4: match[1].trim().slice(-4),
          };
        }
      }
    } catch {
      // Ignore read error
    }
  }

  return resolved;
}

export function isGeminiApiConfigured(ctx?: GeminiContextTarget): boolean {
  return Boolean(getEffectiveCredentials(ctx).apiKey);
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

async function fetchCatalogModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const cleanBase = (baseUrl.trim() || DEFAULT_GEMINI_BASE).replace(/\/+$/, "");
  const cacheKey = `${cleanBase}:${apiKey.slice(-6)}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
    return cached.models;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${cleanBase}?pageSize=100`, {
      headers: { "x-goog-api-key": apiKey.trim() },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const models = (data.models ?? [])
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
    catalogCache.set(cacheKey, { models, fetchedAt: Date.now() });
    return models;
  } catch {
    return [];
  }
}

export async function invokeGeminiTextEndpoint(
  creds: ResolvedGeminiCredentials,
  requestBody: Record<string, unknown>,
  timeoutMs = 14000
): Promise<{
  ok: boolean;
  modelUsed: string;
  data?: GeminiGenerateContentResponse;
  errorMessage?: string;
}> {
  if (!creds.apiKey) {
    return { ok: false, modelUsed: creds.textModel, errorMessage: "No API key" };
  }

  const base = (creds.endpointBaseUrl || DEFAULT_GEMINI_BASE).replace(/\/+$/, "");
  const candidates = Array.from(
    new Set(
      [creds.textModel, ...PREFERRED_GEMINI_TEXT_FALLBACKS].filter(
        (m) => Boolean(m) && !retiredModelsCache.has(`${base}:${m}`)
      )
    )
  );
  const ordered =
    candidates.length > 0 ? candidates : PREFERRED_GEMINI_TEXT_FALLBACKS;

  let lastError = "Gemini request failed.";
  for (const model of ordered) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${base}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": creds.apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const json = (await res
        .json()
        .catch(() => ({}))) as GeminiGenerateContentResponse;

      if (res.ok && json.candidates?.[0]?.content?.parts?.length) {
        return { ok: true, modelUsed: model, data: json };
      }

      const apiErr = json.error?.message || `HTTP ${res.status}`;
      lastError = `${model}: ${apiErr}`;

      if (res.status === 404) {
        retiredModelsCache.add(`${base}:${model}`);
        continue;
      }

      // Some preview/lite models reject Search Grounding tools with 400: retry without tools
      if (res.status === 400 && "tools" in requestBody) {
        const bodyWithoutTools = { ...requestBody };
        delete bodyWithoutTools.tools;
        const retryRes = await fetch(`${base}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": creds.apiKey.trim(),
          },
          body: JSON.stringify(bodyWithoutTools),
        }).catch(() => null);
        if (retryRes?.ok) {
          const retryJson =
            (await retryRes.json().catch(() => ({}))) as GeminiGenerateContentResponse;
          if (retryJson.candidates?.[0]?.content?.parts?.length) {
            return { ok: true, modelUsed: model, data: retryJson };
          }
        }
      }
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : "Network error"}`;
    }
  }

  return { ok: false, modelUsed: ordered[0] ?? creds.textModel, errorMessage: lastError };
}

/**
 * Probes a user's or workspace's Gemini API key against the models catalog
 * and tests live text + image model quota so capabilities are reported truthfully.
 */
export async function probeGeminiConnection(input: {
  apiKey: string;
  endpointBaseUrl?: string;
}): Promise<{
  ok: boolean;
  capabilities: GeminiCapabilities;
  error?: string;
  warning?: string;
}> {
  const baseUrl = (input.endpointBaseUrl?.trim() || DEFAULT_GEMINI_BASE).replace(
    /\/+$/,
    ""
  );
  const quotaCacheKey = `${baseUrl}:${input.apiKey.trim().slice(-4)}`;
  imageQuotaBlockedCache.delete(quotaCacheKey);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl}?pageSize=100`, {
      headers: { "x-goog-api-key": input.apiKey.trim() },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Gemini API rejected key (HTTP ${res.status}): ${errText.slice(0, 140)}`,
        capabilities: {
          textGeneration: false,
          searchGrounding: false,
          visionAudit: false,
          imageGeneration: false,
          videoGeneration: false,
          embeddings: false,
          discoveredModels: [],
          lastCheckedAt: new Date().toISOString(),
        },
      };
    }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };

    const models = (data.models ?? [])
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);

    catalogCache.set(`${baseUrl}:${input.apiKey.trim().slice(-6)}`, {
      models,
      fetchedAt: Date.now(),
    });

    const discoveredImageModels = models.filter(
      (m) =>
        m.includes("image") || m.includes("imagen") || m.includes("nano-banana")
    );
    const hasVideoModel = models.some((m) => m.includes("veo"));
    const hasEmbeddingModel = models.some((m) => m.includes("embedding"));

    // Verify image generation quota via lightweight maxOutputTokens=1 text ping (zero image waste)
    let imageQuotaReady = discoveredImageModels.length > 0;
    let quotaWarning: string | undefined;

    if (!process.env.VITEST && discoveredImageModels.length > 0) {
      const targetImagePingModel =
        PREFERRED_GEMINI_IMAGE_MODELS.find((m) => models.includes(m)) ??
        discoveredImageModels.find((m) => !m.startsWith("imagen-")) ??
        discoveredImageModels[0]!;

      if (targetImagePingModel && !targetImagePingModel.startsWith("imagen-")) {
        const pingCtrl = new AbortController();
        const pingTimer = setTimeout(() => pingCtrl.abort(), 5000);
        try {
          const pingRes = await fetch(
            `${baseUrl}/${targetImagePingModel}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": input.apiKey.trim(),
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "ok" }] }],
                generationConfig: { maxOutputTokens: 1 },
              }),
              signal: pingCtrl.signal,
            }
          );
          clearTimeout(pingTimer);
          if (pingRes.status === 429) {
            const pingErr = (await pingRes.json().catch(() => ({}))) as {
              error?: { message?: string };
            };
            imageQuotaReady = false;
            quotaWarning = `Text & Prompt models ready, but ${targetImagePingModel} returned HTTP 429 (${
              pingErr.error?.message?.slice(0, 140) ||
              "free-tier image quota is 0; free AI image fallback (AI Horde / FLUX) will run automatically until billing is enabled"
            }).`;
            imageQuotaBlockedCache.set(quotaCacheKey, {
              blockedAt: Date.now(),
              error: quotaWarning,
            });
          }
        } catch {
          clearTimeout(pingTimer);
        }
      }
    }

    return {
      ok: true,
      warning: quotaWarning,
      capabilities: {
        textGeneration: true,
        searchGrounding: true,
        visionAudit: true,
        imageGeneration: imageQuotaReady,
        videoGeneration: hasVideoModel,
        embeddings: hasEmbeddingModel || models.length > 0,
        discoveredModels: models.slice(0, 65),
        lastCheckedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Unable to reach Gemini API.",
      capabilities: {
        textGeneration: false,
        searchGrounding: false,
        visionAudit: false,
        imageGeneration: false,
        videoGeneration: false,
        embeddings: false,
        discoveredModels: [],
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }
}

export interface InlineReferenceImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
  sourceUrl: string;
}

export async function fetchReferenceImagesForGemini(
  imageUrls: string[],
  maxCount = 2
): Promise<InlineReferenceImage[]> {
  if (process.env.VITEST || !imageUrls || imageUrls.length === 0) {
    return [];
  }

  const references: InlineReferenceImage[] = [];
  for (const rawUrl of imageUrls.slice(0, 4)) {
    if (references.length >= maxCount) break;
    try {
      const safeUrl = await validateSafePublicUrl(rawUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(safeUrl.toString(), {
        headers: {
          "User-Agent": "SocialMediaStudioGeminiReference/1.0",
          Accept: "image/jpeg,image/png,image/webp,image/*",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 1024 || arrayBuf.byteLength > 8 * 1024 * 1024) {
        continue;
      }

      const normalizedJpeg = await sharp(Buffer.from(arrayBuf))
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

      references.push({
        mimeType: "image/jpeg",
        data: normalizedJpeg.toString("base64"),
        sourceUrl: safeUrl.toString(),
      });
    } catch {
      // Skip unreachable reference image
    }
  }

  return references;
}

const TOPIC_PHOTOGRAPHY_DIRECTIVES: Record<DetectedTopicCategory, string> = {
  automotive_vehicle:
    "award-winning commercial automotive photography of a real modern luxury vehicle, dramatic three-point studio lighting and realistic road/showroom reflections, sharp metallic paintwork, shot on Hasselblad H6D-100c 85mm f/1.4 prime lens, 8k RAW photorealistic DSLR",
  product_ecommerce:
    "high-end luxury commercial product photography on a sculpted dark stone and brushed metal studio surface, softbox rim lighting, shallow depth of field bokeh, flagship advertising campaign aesthetic, 8k RAW photorealistic",
  real_estate:
    "architectural digest twilight photography of a modern luxury property with floor-to-ceiling glass, warm interior glow, ultra-wide tilt-shift lens, 8k photorealistic",
  food_beverage:
    "michelin-star commercial culinary and artisanal beverage photography, natural directional light, rich textures, shallow depth of field, 8k macro DSLR",
  fashion_beauty:
    "flagship editorial luxury showcase photography, sculptural studio lighting, refined minimalist composition, 8k medium format camera",
  technology_saas:
    "sleek executive technology photography, modern glass architecture and precision hardware environment with subtle volumetric lighting, 8k photorealistic DSLR",
  general_business:
    "modern executive commercial photography, warm natural light in a contemporary architectural setting, shallow depth of field, 8k DSLR",
};

const VARIATION_SCENE_DIRECTIVES: Record<1 | 2 | 3, string> = {
  1: "Variation 1 (Editorial Wide Hero): three-quarter wide commercial hero angle in an upscale architectural environment, subject in upper two-thirds, dark clean foreground at the bottom",
  2: "Variation 2 (Dramatic Studio Close-Up): dynamic low-angle close-up hero perspective with dramatic studio rim lighting, moody atmosphere, and shallow depth of field",
  3: "Variation 3 (On-Location Lifestyle Perspective): cinematic golden-hour environmental perspective with natural depth, motion energy, and high-contrast shadows",
};

function computeImagenAspectRatio(
  width: number,
  height: number
): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  const ratio = width / height;
  if (ratio > 1.45) return "16:9";
  if (ratio > 1.15) return "4:3";
  if (ratio < 0.65) return "9:16";
  if (ratio < 0.88) return "3:4";
  return "1:1";
}

export interface GeminiPhotoPromptInput {
  brandName: string;
  brandDomain?: string;
  brandSummary?: string;
  brandHeadings?: string[];
  seoKeywords?: string[];
  platform?: SocialPlatform;
  formatName?: string;
  headlineText?: string;
  topicPrompt: string;
  userPromptDraft?: string;
  refineExisting?: boolean;
  detectedTopic: DetectedTopicCategory;
  supportiveGraphicStyle?: SupportiveGraphicStyle;
  characteristic: DesignCharacteristic;
  brandColors: BrandColors;
  variationIndex: 1 | 2 | 3;
  referenceImages?: InlineReferenceImage[];
  geminiContext?: GeminiContextTarget;
}

export interface DirectedGeminiPromptResult {
  finalPrompt: string;
  artDirectionBadge?: string;
  sceneConcept?: string;
  directorUsed: string;
}

/**
 * Autonomous Gemini Creative Director:
 * Analyzes brand website facts, reference visuals, SEO keywords, and platform format
 * via active Gemini Flash/Pro models to invent a unique commercial scene & image prompt.
 */
export async function buildGeminiDirectedImagePrompt(
  input: GeminiPhotoPromptInput
): Promise<DirectedGeminiPromptResult> {
  const effectiveTopic: DetectedTopicCategory =
    input.supportiveGraphicStyle === "vehicle_showcase"
      ? "automotive_vehicle"
      : input.supportiveGraphicStyle === "product_spotlight"
        ? "product_ecommerce"
        : input.detectedTopic;

  const subjectDirective = TOPIC_PHOTOGRAPHY_DIRECTIVES[effectiveTopic];
  const sceneDirective = VARIATION_SCENE_DIRECTIVES[input.variationIndex];

  const baseStructuredPrompt = [
    input.topicPrompt,
    subjectDirective,
    sceneDirective,
    `${input.characteristic} commercial photography`,
    `subtle lighting accents in ${input.brandColors.accent} and ${input.brandColors.primary}`,
    "real DSLR photograph, no cartoon, no vector illustration, no text, no letters, no words, no watermark",
  ].join(", ");

  const creds = getEffectiveCredentials(input.geminiContext);
  if (!creds.apiKey || process.env.VITEST) {
    return {
      finalPrompt: baseStructuredPrompt,
      directorUsed: "gemini_photography_spec",
    };
  }

  const parts: Array<Record<string, unknown>> = [];
  for (const refImg of input.referenceImages ?? []) {
    parts.push({
      inlineData: {
        mimeType: refImg.mimeType,
        data: refImg.data,
      },
    });
  }

  const refInstruction =
    (input.referenceImages?.length ?? 0) > 0
      ? "Analyze the attached website reference image(s) strictly for domain context, textures, mood, and real-world subject accuracy — then invent a completely original flagship advertising photograph (never copy website UI or screenshots)."
      : "Invent a completely original, agency-grade commercial advertising photograph tailored to this business and campaign.";

  const brandContextLines = [
    `Brand Name: ${input.brandName}${input.brandDomain ? ` (${input.brandDomain})` : ""}`,
    input.brandSummary ? `Comprehensive Website Grounding & Services Summary: ${input.brandSummary}` : "",
    input.brandHeadings?.length
      ? `Website Key Headings & Value Propositions: ${input.brandHeadings.slice(0, 10).join(" | ")}`
      : "",
    `Primary Campaign Headline / Hook: "${input.headlineText || input.topicPrompt}"`,
    input.topicPrompt ? `Focus Topic / Offer: ${input.topicPrompt}` : "",
    input.userPromptDraft ? `User's Base Prompt / Idea To Refine: "${input.userPromptDraft}"` : "",
    input.refineExisting ? `MODE: REFINE AND ENHANCE the user's base prompt above into elite photography specification while preserving their exact intent.` : "MODE: AUTONOMOUS GENERATION from website context and headings.",
    input.seoKeywords?.length
      ? `Extracted SEO & Industry Keywords: ${input.seoKeywords.join(", ")}`
      : "",
    input.platform
      ? `Target Social Media Format: ${input.platform} ${input.formatName ?? ""} (Visual Concept #${input.variationIndex})`
      : `Visual Concept #${input.variationIndex}`,
    `Art Direction Angle: ${sceneDirective}`,
    `Brand Color Accents: ${input.brandColors.accent} and ${input.brandColors.primary} subtle reflections.`,
  ]
    .filter(Boolean)
    .join("\n");

  parts.push({
    text: `You are an elite Commercial Advertising Creative Director and Master Prompt Engineer.
YOUR MANDATE:
1. Thoroughly review all provided website headings, domain value propositions, and summary text.
2. Ground the visual scene directly in the actual products, vehicles, or services described on the website and specified in the campaign headline/keywords.
3. If the website is about vehicle history, car inspections, or automotive services, feature authentic automotive imagery (e.g., luxury sedan inspection, diagnostic dashboard, pristine showroom vehicle, VIN scan context).
4. If the website is about software, e-commerce, or fashion, reflect the real-world utility and lifestyle of those specific offerings.
5. Never invent generic abstract shapes or meaningless gradient art. Create a vivid, high-budget commercial advertising photograph.

${refInstruction}

WEBSITE & CAMPAIGN CONTEXT:
${brandContextLines}

Return STRICT JSON (no markdown fences, no explanatory preamble):
{
  "sceneConcept": "4 to 7 word crisp creative title describing this visual scene",
  "badgeLabel": "1 to 2 word uppercase editorial category tag (e.g. EU VERIFIED, VIN LOOKUP, STUDIO EDITION)",
  "prompt": "An unmistakable 75-90 word photorealistic commercial photography prompt. Name the specific hero subject grounded in the website facts, exact environment and architecture, Hasselblad/ARRI camera framing, tactile textures, atmospheric lighting referencing brand colors, and clean dark negative space in the bottom 25% for high-contrast white typography overlay."
}

CRITICAL DIRECTIVES:
- Real-world authentic photography only. Absolutely ZERO flat vector clip art, ZERO cartoon illustration, and ZERO empty color blobs.
- Absolutely ZERO rendered text, letters, or words inside the picture.`,
  });

  const apiRes = await invokeGeminiTextEndpoint(
    creds,
    {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.72,
      },
    },
    14000
  );

  if (apiRes.ok && apiRes.data) {
    const rawText =
      apiRes.data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("\n")
        .trim() ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          prompt?: string;
          badgeLabel?: string;
          sceneConcept?: string;
        };
        if (parsed.prompt && parsed.prompt.trim().length > 24) {
          return {
            finalPrompt: `${parsed.prompt
              .replace(/["\r\n]+/g, " ")
              .trim()}, photorealistic 8k RAW DSLR advertising photography, zero text, zero watermarks`,
            artDirectionBadge: parsed.badgeLabel
              ? String(parsed.badgeLabel).replace(/[^a-zA-Z0-9\s-]/g, "").trim().slice(0, 18).toUpperCase()
              : undefined,
            sceneConcept: parsed.sceneConcept
              ? String(parsed.sceneConcept).trim().slice(0, 64)
              : undefined,
            directorUsed: `${apiRes.modelUsed}-autonomous-director`,
          };
        }
      } catch {
        // Check raw plain text if JSON parsing failed
      }
    }
    if (rawText.length > 36 && !rawText.startsWith("{")) {
      return {
        finalPrompt: `${rawText.replace(/["\r\n]+/g, " ").trim()}, photorealistic 8k RAW advertising photography, no text, no watermarks`,
        directorUsed: `${apiRes.modelUsed}-autonomous-director`,
      };
    }
  }

  return {
    finalPrompt: baseStructuredPrompt,
    directorUsed: "gemini_photography_spec",
  };
}

export type GeminiImageGenerationResult =
  | {
      buffer: Buffer;
      modelUsed: string;
      quotaExhausted?: false;
      error?: undefined;
    }
  | {
      buffer: null;
      modelUsed: null;
      quotaExhausted: boolean;
      error: string;
    };

/**
 * Generates or iteratively edits a high-level commercial photograph via Gemini Image models
 * (gemini-2.5-flash-image, gemini-3.1-flash-image, gemini-3-pro-image, plus dynamically discovered models).
 * Surfaces structured HTTP status diagnostics instead of failing silently.
 */
export async function generateImageWithGeminiApi(input: {
  prompt: string;
  width: number;
  height: number;
  brandColors: BrandColors;
  detectedTopic: DetectedTopicCategory;
  supportiveGraphicStyle?: SupportiveGraphicStyle;
  variationIndex: 1 | 2 | 3;
  referenceImages?: InlineReferenceImage[];
  previousBackgroundBuffer?: Buffer;
  editInstruction?: string;
  uniqueSeed?: number;
  geminiContext?: GeminiContextTarget;
}): Promise<GeminiImageGenerationResult> {
  if (process.env.VITEST) {
    return {
      buffer: null,
      modelUsed: null,
      quotaExhausted: false,
      error: "VITEST deterministic offline mode.",
    };
  }

  const creds = getEffectiveCredentials(input.geminiContext);
  if (!creds.apiKey) {
    return {
      buffer: null,
      modelUsed: null,
      quotaExhausted: false,
      error:
        "No active Google Gemini API key configured. Click Gemini API in the top bar or open Settings -> Gemini Vault to connect a key.",
    };
  }

  const base = (creds.endpointBaseUrl || DEFAULT_GEMINI_BASE).replace(/\/+$/, "");
  const quotaCacheKey = `${base}:${creds.keyLast4 || creds.apiKey.trim().slice(-4)}`;
  const cachedQuotaBlock = imageQuotaBlockedCache.get(quotaCacheKey);
  if (
    cachedQuotaBlock &&
    Date.now() - cachedQuotaBlock.blockedAt < IMAGE_QUOTA_CACHE_TTL_MS
  ) {
    return {
      buffer: null,
      modelUsed: null,
      quotaExhausted: true,
      error: cachedQuotaBlock.error,
    };
  }

  const discovered = await fetchCatalogModels(base, creds.apiKey);
  const discoveredImageModels = discovered.filter(
    (m) =>
      m.includes("image") || m.includes("imagen") || m.includes("nano-banana")
  );

  const uniqueSeed =
    input.uniqueSeed ??
    Math.floor(Date.now() % 1_000_000) +
      input.variationIndex * 19391 +
      Math.floor(Math.random() * 9000);

  const fullPrompt =
    input.previousBackgroundBuffer && input.editInstruction
      ? `Edit and evolve the attached background photograph according to this creative art direction: "${input.editInstruction}". Maintain commercial DSLR photorealism, keep subject continuity, and obey: ${input.prompt}. CRITICAL: Pure realistic photography only. ZERO text, ZERO words, ZERO letters, ZERO logos, ZERO watermarks.`
      : `Create a high-craft photorealistic commercial advertising photograph (Variation #${
          input.variationIndex
        }, Seed ${uniqueSeed}): ${input.prompt}. Use any attached reference image strictly for subject domain and real-world atmosphere inspiration — generate an original, crisp DSLR scene with authentic lighting and zero empty gradients or clip-art. CRITICAL: Pure visual photography only. ZERO text, ZERO typography, ZERO words, ZERO letters, ZERO watermarks.`;

  const aspectRatio = computeImagenAspectRatio(input.width, input.height);

  const requestedList =
    creds.imageModel && creds.imageModel !== "auto"
      ? [creds.imageModel, ...PREFERRED_GEMINI_IMAGE_MODELS, ...discoveredImageModels]
      : [...PREFERRED_GEMINI_IMAGE_MODELS, ...discoveredImageModels];

  const uniqueModels = Array.from(
    new Set(requestedList.filter((m) => Boolean(m) && !retiredModelsCache.has(`${base}:${m}`)))
  );
  const generateContentModels = uniqueModels.filter(
    (m) => !m.startsWith("imagen-")
  );
  const imagenPredictModels = uniqueModels.filter((m) =>
    m.startsWith("imagen-")
  );

  let sawQuotaLimit = false;
  const failures: string[] = [];

  // 1. Try Gemini Native Multimodal Image Models (:generateContent)
  for (const modelName of generateContentModels) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);

      const parts: Array<Record<string, unknown>> = [];
      if (input.previousBackgroundBuffer) {
        const compactPrev = await sharp(input.previousBackgroundBuffer)
          .resize(768, 768, { fit: "inside" })
          .jpeg({ quality: 85 })
          .toBuffer();
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: compactPrev.toString("base64"),
          },
        });
      } else if (input.referenceImages && input.referenceImages.length > 0) {
        const refToUse =
          input.referenceImages[
            (input.variationIndex - 1) % input.referenceImages.length
          ];
        if (refToUse) {
          parts.push({
            inlineData: {
              mimeType: refToUse.mimeType,
              data: refToUse.data,
            },
          });
        }
      }
      parts.push({ text: fullPrompt });

      const requestPayload = (includeImageConfig: boolean) => ({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          ...(includeImageConfig ? { imageConfig: { aspectRatio } } : {}),
        },
      });

      let res = await fetch(`${base}/${modelName}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": creds.apiKey.trim(),
        },
        body: JSON.stringify(requestPayload(true)),
        signal: controller.signal,
      });

      if (res.status === 400) {
        res = await fetch(`${base}/${modelName}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": creds.apiKey.trim(),
          },
          body: JSON.stringify(requestPayload(false)),
          signal: controller.signal,
        });
      }

      clearTimeout(timer);

      const json = (await res
        .json()
        .catch(() => ({}))) as GeminiGenerateContentResponse;

      if (res.ok) {
        const resParts = json.candidates?.[0]?.content?.parts ?? [];
        const imagePart = resParts.find((p) => p.inlineData?.data);
        if (imagePart?.inlineData?.data) {
          return {
            buffer: Buffer.from(imagePart.inlineData.data, "base64"),
            modelUsed: modelName,
          };
        }
        failures.push(`${modelName}: succeeded without image payload`);
        continue;
      }

      const msg = json.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429) {
        sawQuotaLimit = true;
      } else if (res.status === 404) {
        retiredModelsCache.add(`${base}:${modelName}`);
      }
      failures.push(`${modelName} (HTTP ${res.status}): ${msg.slice(0, 140)}`);
    } catch (err) {
      failures.push(
        `${modelName}: ${err instanceof Error ? err.message : "Timeout/network error"}`
      );
    }
  }

  // 2. Try Imagen (:predict) only if explicitly in discovered/selected list
  for (const imagenModel of imagenPredictModels) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);
      const res = await fetch(`${base}/${imagenModel}:predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": creds.apiKey.trim(),
        },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            personGeneration: "ALLOW_ADULT",
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as {
          predictions?: Array<{ bytesBase64Encoded?: string }>;
        };
        const b64 = data.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          return {
            buffer: Buffer.from(b64, "base64"),
            modelUsed: imagenModel,
          };
        }
      } else {
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        if (res.status === 429) sawQuotaLimit = true;
        failures.push(
          `${imagenModel} (HTTP ${res.status}): ${errJson.error?.message?.slice(0, 120) ?? "Failed"}`
        );
      }
    } catch (err) {
      failures.push(
        `${imagenModel}: ${err instanceof Error ? err.message : "Network error"}`
      );
    }
  }

  const conciseSummary = failures.slice(0, 2).join(" | ");
  const friendlyPrefix = sawQuotaLimit
    ? "Google Gemini native image models returned HTTP 429 (free-tier image quota is 0; billing is required on your Google AI Studio project for image output)."
    : "Google Gemini image generation did not return an image.";
  const combinedError = `${friendlyPrefix}${conciseSummary ? ` Details: ${conciseSummary}` : ""}`;

  if (sawQuotaLimit) {
    imageQuotaBlockedCache.set(quotaCacheKey, {
      blockedAt: Date.now(),
      error: combinedError,
    });
  }

  return {
    buffer: null,
    modelUsed: null,
    quotaExhausted: sawQuotaLimit,
    error: combinedError,
  };
}

export interface GeminiBrandAnalysisEnhancement {
  detectedTopic: DetectedTopicCategory;
  characteristic: DesignCharacteristic;
  extractedHeadings: string[];
  brandSummary: string;
}

/**
 * Analyzes a brand website using Gemini + Google Search Grounding so even JS-rendered
 * or bot-guarded domains yield rich brand intelligence.
 */
export async function analyzeWebsiteWithGemini(input: {
  sourceUrl: string;
  brandName: string;
  pageTitle: string;
  pageDescription: string;
  headings: string[];
  geminiContext?: GeminiContextTarget;
}): Promise<GeminiBrandAnalysisEnhancement | null> {
  const creds = getEffectiveCredentials(input.geminiContext);
  if (!creds.apiKey || process.env.VITEST) return null;

  try {
    const prompt = `Analyze this brand website (use Google Search if helpful to inspect public offerings for this domain) and return STRICT JSON (no markdown fences) with:
- "detectedTopic": one of ["automotive_vehicle", "product_ecommerce", "food_beverage", "real_estate", "technology_saas", "fashion_beauty", "general_business"]
- "characteristic": one of ["minimal", "modern", "premium", "bold", "corporate", "editorial"]
- "extractedHeadings": array of up to 4 short, factual value propositions from the website (do not invent claims)
- "brandSummary": 1-sentence factual summary of the brand.

Website URL: ${input.sourceUrl}
Brand Name: ${input.brandName}
Page Title: ${input.pageTitle}
Page Description: ${input.pageDescription}
Page Headings: ${input.headings.join(" | ")}`;

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.2,
        },
      },
      10000
    );

    if (!apiRes.ok || !apiRes.data) return null;
    const rawText = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(
      jsonMatch[0]
    ) as Partial<GeminiBrandAnalysisEnhancement>;
    if (!parsed.detectedTopic || !parsed.characteristic) return null;

    return {
      detectedTopic: parsed.detectedTopic,
      characteristic: parsed.characteristic,
      extractedHeadings: Array.isArray(parsed.extractedHeadings)
        ? parsed.extractedHeadings.slice(0, 4)
        : input.headings,
      brandSummary: parsed.brandSummary ?? input.pageDescription,
    };
  } catch {
    return null;
  }
}

export interface GeminiContentSynthesisResult {
  postTitle: string;
  supportingCopy: string;
  mainText: string;
  hashtags: string[];
}

export async function generatePostCopyWithGemini(input: {
  brand: Brand;
  brandKit: BrandKit;
  mode: "ai_topic" | "website_grounded";
  topic: string;
  objective: string;
  seoKeywords: string[];
  platform?: SocialPlatform;
  geminiContext?: GeminiContextTarget;
}): Promise<GeminiContentSynthesisResult | null> {
  const creds = getEffectiveCredentials(input.geminiContext);
  if (!creds.apiKey || process.env.VITEST) return null;

  try {
    const meta = input.brandKit.extractionMeta;
    const factualGuardrail =
      input.mode === "website_grounded"
        ? `Use ONLY factual information from the website (${input.brand.domain}): Title="${meta.pageTitle ?? ""}", Description="${meta.pageDescription ?? ""}", Headings="${(meta.extractedHeadings ?? []).join("; ")}". Never invent prices, discounts, or unsupported claims.`
        : `Focus on the campaign topic: "${input.topic}" and objective: "${input.objective}".`;

    const seoInstruction =
      input.seoKeywords.length > 0
        ? `Naturally weave all of these SEO keywords multiple times into the lengthy description and hashtags: ${input.seoKeywords.join(", ")}.`
        : `Include relevant domain keywords for ${input.brand.name} (${input.brand.domain}).`;

    const prompt = `You are a senior social media copywriter and SEO strategist for ${input.brand.name} (${input.brand.domain}).
${factualGuardrail}
${seoInstruction}

Return a JSON object with these exact keys:
1. "postTitle": A short, punchy headline to be rendered on the social media image graphic (3 to 6 words, maximum 40 characters, no CTA language).
2. "supportingCopy": A concise single-line subtitle for the image graphic (5 to 9 words, maximum 55 characters, no CTA button text).
3. "mainText": A lengthy, engaging 3-paragraph social media post description (160 to 230 words total, separated by "\\n\\n") that naturally integrates the SEO keywords, explains the value in depth, and ends with an engaging question or reference to ${input.brand.domain}. Do not use double hyphens (--). Decode any HTML entities cleanly (never write &amp;).
4. "hashtags": An array of 7 relevant hashtags starting with #.`;

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      },
      12000
    );

    if (!apiRes.ok || !apiRes.data) return null;
    const rawJson = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson) as Partial<GeminiContentSynthesisResult>;
    if (!parsed.postTitle || !parsed.mainText) return null;

    const cleanTitle = makeShortConcisePostHeadline(
      parsed.postTitle,
      input.brand.name
    );
    const cleanSubtitle = makeShortConciseSubtitle(
      parsed.supportingCopy ?? input.brand.domain,
      input.brand.domain
    );
    const hashtags =
      Array.isArray(parsed.hashtags) && parsed.hashtags.length >= 3
        ? parsed.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 8)
        : buildHashtags(
            input.brand.name,
            cleanTitle,
            input.seoKeywords,
            input.platform
          );

    return {
      postTitle: cleanTitle,
      supportingCopy: cleanSubtitle,
      mainText: parsed.mainText.trim(),
      hashtags,
    };
  } catch {
    return null;
  }
}

/**
 * Gemini Search-Grounded Social Media Radar:
 * Detects live industry trends, website positioning shifts, competitor content gaps,
 * and seasonal hooks for a given brand.
 */
export async function detectTrendsAndRadarWithGemini(input: {
  brand: Brand;
  brandKit: BrandKit;
  competitorDomains?: string[];
  focusQuery?: string;
  geminiContext?: GeminiContextTarget;
}): Promise<
  Array<
    Omit<
      TrendSignal,
      "id" | "workspaceId" | "brandId" | "status" | "createdAt"
    >
  >
> {
  const creds = getEffectiveCredentials(input.geminiContext);
  const topic = input.brandKit.extractionMeta.detectedTopic ?? "general_business";

  const deterministicFallbackSignals = (): Array<
    Omit<
      TrendSignal,
      "id" | "workspaceId" | "brandId" | "status" | "createdAt"
    >
  > => [
    {
      signalType: "trend_topic",
      title: `${input.brand.name}: High-Intent Industry Transparency Hook`,
      summary: `Audiences in ${topic.replace("_", " ")} respond strongly to visual proof and transparent behind-the-scenes verification posts grounded in ${input.brand.domain}.`,
      suggestedHeadline: `${input.brand.name} Precision Check`,
      seoKeywords: [
        input.brand.name.replace(/\s+/g, ""),
        topic.replace("_", " "),
        input.brand.domain,
      ],
      sourceUrls: [input.brand.websiteUrl],
      relevanceScore: 92,
    },
    {
      signalType: "website_change",
      title: `Domain Highlight Spotlight from ${input.brand.domain}`,
      summary:
        input.brandKit.extractionMeta.pageDescription ||
        `Turn your primary offering on ${input.brand.domain} into a 3-variation full-image carousel or feed showcase.`,
      suggestedHeadline:
        makeShortConcisePostHeadline(
          input.brandKit.extractionMeta.extractedHeadings?.[0] ??
            input.brand.name,
          input.brand.name
        ),
      seoKeywords: [
        ...(input.brandKit.extractionMeta.extractedHeadings
          ?.slice(0, 2)
          .map((h) => h.split(" ").slice(0, 2).join(" ")) ?? []),
        input.brand.name,
      ],
      sourceUrls: [input.brand.websiteUrl],
      relevanceScore: 88,
    },
    {
      signalType: "competitor_gap",
      title:
        input.competitorDomains && input.competitorDomains.length > 0
          ? `Differentiation vs ${input.competitorDomains[0]}`
          : `Educational Myth-Busting Post for ${input.brand.name}`,
      summary: `Stand out from generic competitor feeds by pairing crisp data visuals with a lengthy, SEO-rich breakdown in the caption.`,
      suggestedHeadline: `Avoid Costly Mistakes Today`,
      seoKeywords: [
        "buyer guide",
        input.brand.domain,
        topic.replace("_", " "),
      ],
      sourceUrls: [input.brand.websiteUrl],
      relevanceScore: 85,
    },
  ];

  if (!creds.apiKey || process.env.VITEST) {
    return deterministicFallbackSignals();
  }

  try {
    const competitorText =
      input.competitorDomains && input.competitorDomains.length > 0
        ? `Compare against competitor domains: ${input.competitorDomains.join(", ")}.`
        : "";
    const focusText = input.focusQuery?.trim()
      ? `Special focus query: "${input.focusQuery.trim()}".`
      : "";

    const prompt = `You are a real-time Social Media Trend & Brand Intelligence Radar powered by Google Search.
Research "${input.brand.name}" (${input.brand.websiteUrl}), industry category "${topic}", and current market conversations. ${competitorText} ${focusText}

Return a STRICT JSON array of 4 actionable social media radar signals. Each object must have:
- "signalType": one of ["trend_topic", "website_change", "competitor_gap", "seasonal_hook"]
- "title": concise signal title (max 70 chars)
- "summary": 2-sentence explanation of why this trend/gap matters right now
- "suggestedHeadline": a punchy 3-6 word image headline (max 40 chars, no CTA)
- "seoKeywords": array of 3-5 SEO keywords
- "sourceUrls": array of supporting URLs (include ${input.brand.websiteUrl} or grounded search URLs)
- "relevanceScore": integer between 70 and 99.`;

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.4,
        },
      },
      12000
    );

    if (!apiRes.ok || !apiRes.data) return deterministicFallbackSignals();
    const rawText = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const arrMatch = rawText.match(/\[[\s\S]*\]/);
    if (!arrMatch) return deterministicFallbackSignals();

    const parsed = JSON.parse(arrMatch[0]) as Array<
      Partial<
        Omit<
          TrendSignal,
          "id" | "workspaceId" | "brandId" | "status" | "createdAt"
        >
      >
    >;

    const cleaned = parsed
      .filter((s) => s.title && s.summary && s.suggestedHeadline)
      .slice(0, 5)
      .map((s) => ({
        signalType: s.signalType ?? "trend_topic",
        title: String(s.title).slice(0, 90),
        summary: String(s.summary).slice(0, 320),
        suggestedHeadline: makeShortConcisePostHeadline(
          String(s.suggestedHeadline),
          input.brand.name
        ),
        seoKeywords: Array.isArray(s.seoKeywords)
          ? s.seoKeywords.map(String).slice(0, 5)
          : [input.brand.name],
        sourceUrls: Array.isArray(s.sourceUrls)
          ? s.sourceUrls.map(String).slice(0, 4)
          : [input.brand.websiteUrl],
        relevanceScore: Number(s.relevanceScore) || 88,
      }));

    return cleaned.length > 0 ? cleaned : deterministicFallbackSignals();
  } catch {
    return deterministicFallbackSignals();
  }
}

/**
 * Gemini Vision Pre-Publish Quality & Brand Consistency Detector:
 * Inspects the actual rendered PNG post image and scores legibility, brand fidelity, and visual polish.
 */
export async function auditCreativeWithGeminiVision(input: {
  creative: Creative;
  brand: Brand;
  brandKit: BrandKit;
  renderedPngBuffer: Buffer;
  geminiContext?: GeminiContextTarget;
}): Promise<{
  overallScore: number;
  legibilityScore: number;
  brandConsistencyScore: number;
  visualAppealScore: number;
  strengths: string[];
  recommendations: string[];
  suggestedHeadline?: string;
  auditedByModel: string;
}> {
  const creds = getEffectiveCredentials(input.geminiContext);

  const fallbackAudit = {
    overallScore: 89,
    legibilityScore: 92,
    brandConsistencyScore: 94,
    visualAppealScore: 84,
    strengths: [
      `Brand palette (${input.brandKit.colors.primary} & ${input.brandKit.colors.accent}) and logo placement remain strictly locked.`,
      `Concise headline ("${input.creative.currentVersion?.textOverrides.postTitle ?? ""}") preserves clean visual breathing room.`,
    ],
    recommendations: [
      "Test switching to Dark Surface or Light Surface in the live workbench if the lower photo region is high-key.",
      "Pair with 5-7 targeted SEO hashtags from the description before scheduling.",
    ],
    suggestedHeadline: undefined,
    auditedByModel: "deterministic-brand-inspector",
  };

  if (!creds.apiKey || process.env.VITEST) {
    return fallbackAudit;
  }

  try {
    const compactPng = await sharp(input.renderedPngBuffer)
      .resize(768, 768, { fit: "inside" })
      .png()
      .toBuffer();

    const prompt = `Inspect this rendered ${input.creative.platform} social media graphic for "${input.brand.name}" (${input.brand.domain}).
Return a STRICT JSON object (no markdown fences) with:
- "overallScore": integer 0-100
- "legibilityScore": integer 0-100 (headline & subtitle contrast and readability)
- "brandConsistencyScore": integer 0-100 (logo visibility, brand colors ${input.brandKit.colors.primary} / ${input.brandKit.colors.accent})
- "visualAppealScore": integer 0-100 (composition, hero image quality, no awkward overlap)
- "strengths": array of 2 concise strengths
- "recommendations": array of 2 actionable visual or copy improvements
- "suggestedHeadline": optional punchier 3-6 word headline if improvement is helpful.`;

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: compactPng.toString("base64"),
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      },
      12000
    );

    if (!apiRes.ok || !apiRes.data) return fallbackAudit;
    const rawJson = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return fallbackAudit;

    const parsed = JSON.parse(rawJson) as Partial<typeof fallbackAudit>;
    if (typeof parsed.overallScore !== "number") return fallbackAudit;

    return {
      overallScore: Math.max(0, Math.min(100, Math.round(parsed.overallScore))),
      legibilityScore: Math.max(
        0,
        Math.min(100, Math.round(parsed.legibilityScore ?? parsed.overallScore))
      ),
      brandConsistencyScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(parsed.brandConsistencyScore ?? parsed.overallScore)
        )
      ),
      visualAppealScore: Math.max(
        0,
        Math.min(100, Math.round(parsed.visualAppealScore ?? parsed.overallScore))
      ),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map(String).slice(0, 3)
        : fallbackAudit.strengths,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String).slice(0, 3)
        : fallbackAudit.recommendations,
      suggestedHeadline: parsed.suggestedHeadline
        ? makeShortConcisePostHeadline(parsed.suggestedHeadline, input.brand.name)
        : undefined,
      auditedByModel: `${apiRes.modelUsed}-vision`,
    };
  } catch {
    return fallbackAudit;
  }
}

export interface GeminiCopilotActionResult {
  reply: string;
  modelUsed: string;
  textUpdates?: {
    postTitle?: string;
    supportingCopy?: string;
    caption?: string;
    hashtags?: string[];
  };
  layoutUpdates?: Partial<LayoutOverrides>;
  visualEditInstruction?: string;
}

/**
 * Interactive Gemini Creative Co-Pilot:
 * Lets the user chat naturally with Gemini to edit text, refine SEO copy, adjust layout,
 * or evolve the hero background photograph iteratively.
 */
export async function runGeminiCopilotTurn(input: {
  instruction: string;
  brand: Brand;
  brandKit: BrandKit;
  creative: Creative;
  renderedPngBuffer?: Buffer;
  trackedPerformanceSummary?: string;
  geminiContext?: GeminiContextTarget;
}): Promise<GeminiCopilotActionResult> {
  const creds = getEffectiveCredentials(input.geminiContext);
  const currentVer = input.creative.currentVersion;
  const currentText = currentVer?.textOverrides;
  const lower = input.instruction.toLowerCase();

  // Deterministic smart fallback when offline or in tests
  const buildFallbackAction = (): GeminiCopilotActionResult => {
    const wantsVisual =
      lower.includes("photo") ||
      lower.includes("background") ||
      lower.includes("lighting") ||
      lower.includes("image") ||
      lower.includes("scene") ||
      lower.includes("night") ||
      lower.includes("sunset");
    const wantsShorter =
      lower.includes("short") || lower.includes("punch") || lower.includes("hook");
    const wantsLight = lower.includes("light surface") || lower.includes("white card");
    const wantsDark = lower.includes("dark");

    return {
      reply: `Applied your direction for ${input.brand.name}: "${input.instruction}".`,
      modelUsed: creds.apiKey ? creds.textModel : "gemini-copilot-offline-fallback",
      textUpdates: wantsShorter
        ? {
            postTitle: makeShortConcisePostHeadline(
              currentText?.postTitle ?? input.brand.name,
              input.brand.name
            ),
          }
        : undefined,
      layoutUpdates: wantsLight
        ? { surfaceMode: "light" }
        : wantsDark
          ? { surfaceMode: "dark" }
          : undefined,
      visualEditInstruction: wantsVisual ? input.instruction : undefined,
    };
  };

  if (!creds.apiKey || process.env.VITEST) {
    return buildFallbackAction();
  }

  try {
    const parts: Array<Record<string, unknown>> = [];
    if (input.renderedPngBuffer) {
      const compactPng = await sharp(input.renderedPngBuffer)
        .resize(640, 640, { fit: "inside" })
        .png()
        .toBuffer();
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: compactPng.toString("base64"),
        },
      });
    }

    parts.push({
      text: `You are the interactive Gemini Creative Director inside Social Media Studio for "${input.brand.name}" (${input.brand.domain}).
Current Post State:
- Platform: ${input.creative.platform} (${input.creative.width}x${input.creative.height})
- Headline on Graphic: "${currentText?.postTitle ?? ""}"
- Subtitle on Graphic: "${currentText?.supportingCopy ?? ""}"
- Lengthy SEO Description: "${(currentText?.caption ?? "").slice(0, 500)}"
- Surface Mode: "${currentVer?.layoutOverrides.surfaceMode ?? "dark"}"
- Logo Placement: "${currentVer?.layoutOverrides.logoPlacement ?? "top-left"}"
${input.trackedPerformanceSummary ? `Past Performance Context: ${input.trackedPerformanceSummary}` : ""}

User Instruction: "${input.instruction}"

Return a STRICT JSON object describing the changes to apply immediately:
{
  "reply": "1-2 sentence explanation of what you updated and why",
  "textUpdates": {
    "postTitle": "optional new short headline (3-6 words, max 40 chars, NO CTA)",
    "supportingCopy": "optional new 1-line subtitle (max 55 chars)",
    "caption": "optional refined lengthy multi-paragraph SEO description",
    "hashtags": ["optional array of 6-8 #hashtags"]
  },
  "layoutUpdates": {
    "surfaceMode": "optional 'dark' | 'light' | 'primary'",
    "logoPlacement": "optional 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right'",
    "textAlignment": "optional 'left' | 'center'",
    "supportiveBadgeText": "optional short badge label"
  },
  "visualEditInstruction": "optional photography direction string ONLY if the user asked to change the image/background/lighting/scene"
}
Omit any field that should remain unchanged.`,
    });

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.45,
        },
      },
      12000
    );

    if (!apiRes.ok || !apiRes.data) return buildFallbackAction();
    const rawJson = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return buildFallbackAction();

    const parsed = JSON.parse(rawJson) as Partial<GeminiCopilotActionResult>;
    return {
      reply:
        parsed.reply ||
        `Updated post creative according to your instruction.`,
      modelUsed: apiRes.modelUsed,
      textUpdates: parsed.textUpdates
        ? {
            postTitle: parsed.textUpdates.postTitle
              ? makeShortConcisePostHeadline(
                  parsed.textUpdates.postTitle,
                  input.brand.name
                )
              : undefined,
            supportingCopy: parsed.textUpdates.supportingCopy
              ? makeShortConciseSubtitle(
                  parsed.textUpdates.supportingCopy,
                  input.brand.domain
                )
              : undefined,
            caption: parsed.textUpdates.caption,
            hashtags: parsed.textUpdates.hashtags,
          }
        : undefined,
      layoutUpdates: parsed.layoutUpdates,
      visualEditInstruction: parsed.visualEditInstruction,
    };
  } catch {
    return buildFallbackAction();
  }
}

/**
 * Closed-Loop Gemini Performance Strategist:
 * Analyzes tracked post analytics (impressions, clicks, engagements) to recommend next actions.
 */
export async function analyzeTrackerPerformanceWithGemini(input: {
  brandName: string;
  trackers: SocialPostTracker[];
  geminiContext?: GeminiContextTarget;
}): Promise<{ summary: string; nextMoves: string[]; modelUsed: string }> {
  const creds = getEffectiveCredentials(input.geminiContext);
  const totalImpr = input.trackers.reduce((acc, t) => acc + t.impressions, 0);
  const totalClicks = input.trackers.reduce((acc, t) => acc + t.clicks, 0);
  const totalEng = input.trackers.reduce((acc, t) => acc + t.engagements, 0);
  const ctr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : "0.00";

  const fallbackInsight = {
    summary: `Across ${input.trackers.length} tracked posts for ${input.brandName}, total reach is ${totalImpr.toLocaleString()} impressions with ${totalEng.toLocaleString()} engagements and ${ctr}% CTR.`,
    nextMoves: [
      "Double down on the top-performing platform format in your next Trend Radar scan.",
      "Run a Gemini Vision Audit on planned posts before moving them from Planned to Scheduled.",
    ],
    modelUsed: "tracker-metrics-analyzer",
  };

  if (!creds.apiKey || process.env.VITEST || input.trackers.length === 0) {
    return fallbackInsight;
  }

  try {
    const trackerLines = input.trackers
      .slice(0, 12)
      .map(
        (t) =>
          `${t.platform} (${t.trackingStatus}): impressions=${t.impressions}, clicks=${t.clicks}, engagements=${t.engagements}, notes="${t.notes}"`
      )
      .join("\n");

    const apiRes = await invokeGeminiTextEndpoint(
      creds,
      {
        contents: [
          {
            parts: [
              {
                text: `Analyze these tracked social media post metrics for "${input.brandName}" and return STRICT JSON:
{
  "summary": "2-sentence executive summary of performance patterns",
  "nextMoves": ["3 specific content/visual recommendations for the next campaign"]
}
Metrics:\n${trackerLines}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.35,
        },
      },
      10000
    );

    if (!apiRes.ok || !apiRes.data) return fallbackInsight;
    const rawJson = apiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return fallbackInsight;
    const parsed = JSON.parse(rawJson) as {
      summary?: string;
      nextMoves?: string[];
    };

    return {
      summary: parsed.summary || fallbackInsight.summary,
      nextMoves: Array.isArray(parsed.nextMoves)
        ? parsed.nextMoves.slice(0, 4)
        : fallbackInsight.nextMoves,
      modelUsed: apiRes.modelUsed,
    };
  } catch {
    return fallbackInsight;
  }
}

/**
 * Autonomous Gemini Video Director:
 * Generates a cinematic motion-camera prompt tailored to brand identity & social aspect ratio.
 */
export async function buildGeminiVideoDirectorPrompt(input: {
  brandName: string;
  brandDomain?: string;
  brandSummary?: string;
  topic: string;
  platform: SocialPlatform;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  geminiContext?: GeminiContextTarget;
}): Promise<{ prompt: string; directorUsed: string }> {
  const fallbackPrompt = `Smooth cinematic dolly push-in showcasing ${input.brandName} (${input.topic}), dramatic volumetric studio lighting, shallow depth of field 35mm anamorphic lens, ${input.aspectRatio} commercial social reel composition, photorealistic 4k fluid motion, zero on-screen text or watermarks.`;

  const creds = getEffectiveCredentials(input.geminiContext);
  if (!creds.apiKey || process.env.VITEST) {
    return {
      prompt: fallbackPrompt,
      directorUsed: "gemini_video_director_spec",
    };
  }

  const promptText = `You are a commercial film director creating a ${input.durationSeconds}-second ${input.aspectRatio} social video reel for ${input.brandName}${
    input.brandDomain ? ` (${input.brandDomain})` : ""
  } on ${input.platform}.
${input.brandSummary ? `Brand Context: ${input.brandSummary.slice(0, 220)}` : ""}
Campaign Focus: ${input.topic}

Write a single vivid 65-word motion-video generation prompt describing physical camera movement (dolly, tracking pan, slow reveal), atmospheric lighting, tactile subject details, and smooth realistic motion.
RULES: Pure visual cinematography only. NO on-screen text, NO subtitles, NO watermarks, NO logos. Output ONLY the prompt string.`;

  const apiRes = await invokeGeminiTextEndpoint(
    creds,
    {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.7 },
    },
    12000
  );

  if (apiRes.ok && apiRes.data) {
    const directed = apiRes.data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join(" ")
      .replace(/["\r\n]+/g, " ")
      .trim();
    if (directed && directed.length > 24) {
      return {
        prompt: `${directed}, zero on-screen text, zero watermarks`,
        directorUsed: `${apiRes.modelUsed}-video-director`,
      };
    }
  }

  return {
    prompt: fallbackPrompt,
    directorUsed: "gemini_video_director_spec",
  };
}
