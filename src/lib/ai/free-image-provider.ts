/**
 * Free zero-watermark image fallback providers used automatically whenever
 * Google Gemini native image generation returns HTTP 429 quota/billing limits.
 */

export type FreeImageGenerationResult =
  | { buffer: Buffer; modelUsed: string; error?: undefined }
  | { buffer: null; modelUsed: null; error: string };

const AI_HORDE_BASE = "https://aihorde.net/api/v2";
const AI_HORDE_CLIENT_AGENT = "SocialMediaStudio:2.0:local";
const AI_HORDE_MODELS = [
  "AbsoluteReality",
  "Realistic Vision",
  "majicMIX realistic",
  "Edge Of Realism",
  "Ether Real Mix",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPollinationsDim(dim: number): number {
  const safe = Number.isFinite(dim) && dim > 0 ? dim : 1024;
  return Math.min(1024, Math.max(512, Math.round(safe / 64) * 64));
}

/**
 * Computes AI Horde dimensions within the anonymous free kudos cap
 * (`576x576` square, `640x448` landscape, `448x640` portrait).
 */
export function computeAiHordeDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const safeW = width > 0 ? width : 1080;
  const safeH = height > 0 ? height : 1080;
  const ratio = safeW / safeH;

  if (ratio > 1.15) return { width: 640, height: 448 };
  if (ratio < 0.85) return { width: 448, height: 640 };
  return { width: 576, height: 576 };
}

async function generateImageWithCloudflareAi(input: {
  prompt: string;
}): Promise<FreeImageGenerationResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    return { buffer: null, modelUsed: null, error: "Cloudflare Workers AI not configured" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          prompt: input.prompt.slice(0, 600),
          num_steps: 4,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      return { buffer: null, modelUsed: null, error: `Cloudflare AI HTTP ${res.status}` };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 8000) {
        return { buffer: buf, modelUsed: "cloudflare:flux-1-schnell" };
      }
      return { buffer: null, modelUsed: null, error: "Cloudflare AI returned undersized image" };
    }

    const json = (await res.json().catch(() => ({}))) as {
      result?: { image?: string };
    };
    if (json.result?.image) {
      const buf = Buffer.from(json.result.image, "base64");
      if (buf.length > 8000) {
        return { buffer: buf, modelUsed: "cloudflare:flux-1-schnell" };
      }
    }

    return { buffer: null, modelUsed: null, error: "Cloudflare AI missing image payload" };
  } catch (err) {
    return {
      buffer: null,
      modelUsed: null,
      error: `Cloudflare AI: ${err instanceof Error ? err.message : "Request failed"}`,
    };
  }
}

async function generateImageWithHuggingFace(input: {
  prompt: string;
}): Promise<FreeImageGenerationResult> {
  const token = process.env.HF_API_TOKEN?.trim();
  if (!token) {
    return { buffer: null, modelUsed: null, error: "HF_API_TOKEN not configured" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inputs: input.prompt.slice(0, 600) }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      return { buffer: null, modelUsed: null, error: `HuggingFace HTTP ${res.status}` };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      return { buffer: null, modelUsed: null, error: `HuggingFace non-image content-type: ${ct}` };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= 8000) {
      return { buffer: null, modelUsed: null, error: "HuggingFace returned undersized image" };
    }

    return { buffer: buf, modelUsed: "huggingface:FLUX.1-schnell" };
  } catch (err) {
    return {
      buffer: null,
      modelUsed: null,
      error: `HuggingFace: ${err instanceof Error ? err.message : "Request failed"}`,
    };
  }
}

/**
 * Generates a photorealistic image via AI Horde distributed workers (zero watermarks).
 */
export async function generateImageWithAiHorde(input: {
  prompt: string;
  width: number;
  height: number;
  variationIndex?: 1 | 2 | 3;
  seed?: number;
  customFetch?: typeof fetch;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<FreeImageGenerationResult> {
  if (process.env.VITEST && !input.customFetch) {
    return { buffer: null, modelUsed: null, error: "VITEST offline mode" };
  }

  const fetchFn = input.customFetch ?? fetch;
  const variation = input.variationIndex ?? 1;
  if (!input.customFetch && variation > 1) {
    await sleep((variation - 1) * 750);
  }

  const dims = computeAiHordeDimensions(input.width, input.height);
  const cleanPrompt = input.prompt.replace(/\s+/g, " ").trim().slice(0, 520);
  const hordePrompt = `${cleanPrompt} ### text, typography, words, letters, numbers, watermark, logo, signature, cartoon, anime, vector, flat illustration, blurry, distorted, deformed, low quality`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: process.env.AI_HORDE_API_KEY?.trim() || "0000000000",
    "Client-Agent": AI_HORDE_CLIENT_AGENT,
  };

  const payload = JSON.stringify({
    prompt: hordePrompt,
    params: {
      width: dims.width,
      height: dims.height,
      steps: 22,
      cfg_scale: 7,
      sampler_name: "k_dpmpp_2m",
      karras: true,
      n: 1,
      seed: String(input.seed ?? Math.floor(Math.random() * 1_000_000_000)),
    },
    models: AI_HORDE_MODELS,
    nsfw: false,
    censor_nsfw: true,
    r2: true,
  });

  try {
    let submitRes = await fetchFn(`${AI_HORDE_BASE}/generate/async`, {
      method: "POST",
      headers,
      body: payload,
    });

    if (submitRes.status === 429) {
      await sleep(input.customFetch ? 50 : 1300);
      submitRes = await fetchFn(`${AI_HORDE_BASE}/generate/async`, {
        method: "POST",
        headers,
        body: payload,
      });
    }

    if (!submitRes.ok) {
      const errBody = await submitRes.text().catch(() => "");
      return {
        buffer: null,
        modelUsed: null,
        error: `AI Horde submit HTTP ${submitRes.status}: ${errBody.slice(0, 140)}`,
      };
    }

    const submitJson = (await submitRes.json()) as { id?: string; message?: string };
    const jobId = submitJson.id;
    if (!jobId) {
      return {
        buffer: null,
        modelUsed: null,
        error: `AI Horde missing job id: ${submitJson.message ?? "unknown"}`,
      };
    }

    const pollIntervalMs = input.pollIntervalMs ?? 2200;
    const maxWaitMs = input.maxWaitMs ?? 48000;
    const startedAt = Date.now();
    let isDone = false;

    while (Date.now() - startedAt < maxWaitMs) {
      await sleep(pollIntervalMs);
      const checkRes = await fetchFn(`${AI_HORDE_BASE}/generate/check/${jobId}`, {
        headers: { "Client-Agent": AI_HORDE_CLIENT_AGENT },
      });
      if (!checkRes.ok) {
        return {
          buffer: null,
          modelUsed: null,
          error: `AI Horde check HTTP ${checkRes.status}`,
        };
      }
      const checkJson = (await checkRes.json()) as {
        done?: boolean;
        faulted?: boolean;
        is_possible?: boolean;
      };
      if (checkJson.faulted) {
        return { buffer: null, modelUsed: null, error: "AI Horde job faulted" };
      }
      if (checkJson.is_possible === false) {
        return { buffer: null, modelUsed: null, error: "AI Horde job impossible" };
      }
      if (checkJson.done) {
        isDone = true;
        break;
      }
    }

    if (!isDone) {
      return { buffer: null, modelUsed: null, error: "AI Horde generation timed out" };
    }

    const statusRes = await fetchFn(`${AI_HORDE_BASE}/generate/status/${jobId}`, {
      headers: { "Client-Agent": AI_HORDE_CLIENT_AGENT },
    });
    if (!statusRes.ok) {
      return {
        buffer: null,
        modelUsed: null,
        error: `AI Horde status HTTP ${statusRes.status}`,
      };
    }

    const statusJson = (await statusRes.json()) as {
      generations?: Array<{ img?: string; model?: string }>;
    };
    const gen = statusJson.generations?.[0];
    if (!gen?.img) {
      return { buffer: null, modelUsed: null, error: "AI Horde returned empty generations" };
    }

    let imgBuffer: Buffer;
    if (gen.img.startsWith("http")) {
      const dlRes = await fetchFn(gen.img);
      if (!dlRes.ok) {
        return {
          buffer: null,
          modelUsed: null,
          error: `AI Horde download HTTP ${dlRes.status}`,
        };
      }
      imgBuffer = Buffer.from(await dlRes.arrayBuffer());
    } else {
      const rawB64 = gen.img.replace(/^data:image\/\w+;base64,/, "");
      imgBuffer = Buffer.from(rawB64, "base64");
    }

    if (imgBuffer.length <= 5000) {
      return {
        buffer: null,
        modelUsed: null,
        error: "AI Horde returned undersized image buffer",
      };
    }

    return {
      buffer: imgBuffer,
      modelUsed: `aihorde:${gen.model || "AbsoluteReality"}`,
    };
  } catch (err) {
    return {
      buffer: null,
      modelUsed: null,
      error: `AI Horde: ${err instanceof Error ? err.message : "Request failed"}`,
    };
  }
}

/**
 * Emergency secondary fallback via image.pollinations.ai (no API key required).
 */
export async function generateImageWithPollinations(input: {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  customFetch?: typeof fetch;
}): Promise<FreeImageGenerationResult> {
  if (process.env.VITEST && !input.customFetch) {
    return { buffer: null, modelUsed: null, error: "VITEST offline mode" };
  }

  const fetchFn = input.customFetch ?? fetch;
  const w = clampPollinationsDim(input.width);
  const h = clampPollinationsDim(input.height);
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const trimmedPrompt = input.prompt.replace(/\s+/g, " ").trim().slice(0, 420);

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(trimmedPrompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetchFn(url, {
      headers: { "User-Agent": "SocialMediaStudio/2.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        buffer: null,
        modelUsed: null,
        error: `Pollinations HTTP ${res.status}`,
      };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      return {
        buffer: null,
        modelUsed: null,
        error: `Pollinations non-image content-type: ${ct || "missing"}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= 8000) {
      return {
        buffer: null,
        modelUsed: null,
        error: "Pollinations returned undersized image",
      };
    }

    return { buffer: buf, modelUsed: "pollinations:flux" };
  } catch (err) {
    return {
      buffer: null,
      modelUsed: null,
      error: `Pollinations: ${err instanceof Error ? err.message : "Request failed"}`,
    };
  }
}

/**
 * Tries free open image providers in priority order:
 * Cloudflare Workers AI (env) -> Hugging Face FLUX (env) -> AI Horde (no key, no watermark) -> Pollinations (emergency backup).
 */
export async function generateFreeFallbackImage(input: {
  prompt: string;
  width: number;
  height: number;
  variationIndex?: 1 | 2 | 3;
  seed?: number;
  customFetch?: typeof fetch;
}): Promise<FreeImageGenerationResult> {
  const failures: string[] = [];

  if (!input.customFetch && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    const cfRes = await generateImageWithCloudflareAi({ prompt: input.prompt });
    if (cfRes.buffer) return cfRes;
    failures.push(cfRes.error);
  }

  if (!input.customFetch && process.env.HF_API_TOKEN) {
    const hfRes = await generateImageWithHuggingFace({ prompt: input.prompt });
    if (hfRes.buffer) return hfRes;
    failures.push(hfRes.error);
  }

  const hordeRes = await generateImageWithAiHorde({
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    variationIndex: input.variationIndex,
    seed: input.seed,
    customFetch: input.customFetch,
  });
  if (hordeRes.buffer) return hordeRes;
  failures.push(hordeRes.error);

  const pollRes = await generateImageWithPollinations({
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    seed: input.seed,
    customFetch: input.customFetch,
  });
  if (pollRes.buffer) return pollRes;
  failures.push(pollRes.error);

  return {
    buffer: null,
    modelUsed: null,
    error: failures.join(" | "),
  };
}
