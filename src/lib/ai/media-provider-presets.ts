import type { MediaProviderPreset } from "@/types/domain";

export interface MediaProviderPresetMeta {
  displayName: string;
  defaultEndpointUrl: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  defaultAuthHeader: string;
  defaultAuthPrefix: string;
  requiresAccountId?: boolean;
}

export const MEDIA_PROVIDER_DEFAULTS: Record<
  MediaProviderPreset,
  MediaProviderPresetMeta
> = {
  openai_compatible: {
    displayName: "OpenAI / OpenAI-Compatible (Sora, GPT Image, Together, Fireworks, Grok)",
    defaultEndpointUrl: "https://api.openai.com/v1",
    defaultImageModel: "gpt-image-1",
    defaultVideoModel: "sora-2",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
  },
  fal_ai: {
    displayName: "fal.ai (FLUX Pro/Schnell, Kling, Runway, Luma, Wan)",
    defaultEndpointUrl: "https://fal.run",
    defaultImageModel: "fal-ai/flux/schnell",
    defaultVideoModel: "fal-ai/kling-video/v2/master/text-to-video",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Key ",
  },
  replicate: {
    displayName: "Replicate (Any Public or Private Model Slug)",
    defaultEndpointUrl: "https://api.replicate.com/v1/models",
    defaultImageModel: "black-forest-labs/flux-schnell",
    defaultVideoModel: "minimax/video-01",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
  },
  gemini: {
    displayName: "Google Gemini / Veo (Separate Key for Image or Video)",
    defaultEndpointUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultImageModel: "gemini-2.5-flash-image",
    defaultVideoModel: "veo-2.0-generate-001",
    defaultAuthHeader: "x-goog-api-key",
    defaultAuthPrefix: "",
  },
  cloudflare_ai: {
    displayName: "Cloudflare Workers AI (Free Daily Neurons Tier)",
    defaultEndpointUrl: "https://api.cloudflare.com/client/v4",
    defaultImageModel: "@cf/black-forest-labs/flux-1-schnell",
    defaultVideoModel: "@cf/black-forest-labs/flux-1-schnell",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
    requiresAccountId: true,
  },
  huggingface: {
    displayName: "Hugging Face Inference Providers (hf_... Token)",
    defaultEndpointUrl: "https://router.huggingface.co/hf-inference/models",
    defaultImageModel: "black-forest-labs/FLUX.1-schnell",
    defaultVideoModel: "Wan-AI/Wan2.1-T2V-14B",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
  },
  pollinations: {
    displayName: "Pollinations Unified API (sk_... Key for Image & Video)",
    defaultEndpointUrl: "https://gen.pollinations.ai",
    defaultImageModel: "flux",
    defaultVideoModel: "veo",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
  },
  custom_http: {
    displayName: "Custom AI HTTP Endpoint (Any Model / Any Gateway)",
    defaultEndpointUrl: "https://api.example.com/v1/generate",
    defaultImageModel: "custom-image-model",
    defaultVideoModel: "custom-video-model",
    defaultAuthHeader: "Authorization",
    defaultAuthPrefix: "Bearer ",
  },
};
