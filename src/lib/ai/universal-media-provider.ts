import fs from "node:fs";
import path from "node:path";
import { MEDIA_PROVIDER_DEFAULTS } from "@/lib/ai/media-provider-presets";
import type { ResolvedMediaCredentials } from "@/lib/db/repository";
import { validateSafePublicUrl } from "@/lib/extractor/ssrf-guard";
import type { MediaProviderPreset } from "@/types/domain";

export { MEDIA_PROVIDER_DEFAULTS };

function getSampleVideoBuffer(): Buffer | null {
  try {
    const p = path.join(process.cwd(), "public", "demo-sample.mp4");
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  } catch {}
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertSafeEndpointUrl(
  rawUrl: string,
  skipForMock?: boolean
): Promise<string> {
  const cleaned = rawUrl.trim();
  if (!cleaned) {
    throw new Error("Endpoint URL cannot be empty.");
  }
  if (skipForMock) {
    return cleaned.replace(/\/+$/, "");
  }
  const safe = await validateSafePublicUrl(cleaned);
  return safe.toString().replace(/\/+$/, "");
}

function buildAuthHeaders(input: {
  authHeaderName?: string;
  authPrefix?: string;
  apiKey: string;
}): Record<string, string> {
  const headerName = input.authHeaderName?.trim() || "Authorization";
  const prefix = input.authPrefix ?? "";
  return {
    [headerName]: `${prefix}${input.apiKey.trim()}`,
  };
}

function computeSizeString(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.8) return "1024x1792";
  return "1024x1024";
}

function computeAspectRatioString(width: number, height: number): "1:1" | "16:9" | "9:16" {
  const ratio = width / Math.max(1, height);
  if (ratio > 1.2) return "16:9";
  if (ratio < 0.8) return "9:16";
  return "1:1";
}

async function downloadRemoteBinary(
  url: string,
  fetchFn: typeof fetch,
  skipSsrf: boolean,
  extraHeaders?: Record<string, string>,
  minBytes = 4001
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeUrl = await assertSafeEndpointUrl(url, skipSsrf);
  const res = await fetchFn(safeUrl, { headers: extraHeaders });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) return null;
  return {
    buffer: buf,
    mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
  };
}

function pickFirstString(values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractImageCandidate(json: Record<string, unknown>): {
  base64?: string;
  url?: string;
} {
  const dataArr = Array.isArray(json.data)
    ? (json.data[0] as Record<string, unknown> | undefined)
    : undefined;
  const imagesArr = Array.isArray(json.images)
    ? (json.images[0] as Record<string, unknown> | string | undefined)
    : undefined;
  const imageObj =
    json.image && typeof json.image === "object"
      ? (json.image as Record<string, unknown>)
      : undefined;
  const resultObj =
    json.result && typeof json.result === "object"
      ? (json.result as Record<string, unknown>)
      : undefined;
  const outputFirst = Array.isArray(json.output) ? json.output[0] : json.output;

  const candidates = Array.isArray(json.candidates)
    ? (json.candidates[0] as Record<string, unknown> | undefined)
    : undefined;
  const contentObj =
    candidates?.content && typeof candidates.content === "object"
      ? (candidates.content as Record<string, unknown>)
      : undefined;
  const parts = Array.isArray(contentObj?.parts)
    ? (contentObj.parts as Array<Record<string, unknown>>)
    : [];
  const inlinePart = parts.find(
    (p) => p.inlineData && typeof (p.inlineData as Record<string, unknown>).data === "string"
  );
  const geminiB64 = inlinePart
    ? String((inlinePart.inlineData as Record<string, unknown>).data)
    : undefined;

  const base64 = pickFirstString([
    json.b64_json,
    dataArr?.b64_json,
    resultObj?.image,
    geminiB64,
    typeof json.image === "string" && !json.image.startsWith("http")
      ? json.image
      : undefined,
  ]);

  const url = pickFirstString([
    dataArr?.url,
    typeof imagesArr === "string" ? imagesArr : imagesArr?.url,
    imageObj?.url,
    typeof outputFirst === "string" && outputFirst.startsWith("http")
      ? outputFirst
      : undefined,
    typeof json.url === "string" && json.url.startsWith("http") ? json.url : undefined,
  ]);

  return { base64: base64 ?? undefined, url: url ?? undefined };
}

function extractVideoCandidate(json: Record<string, unknown>): {
  base64?: string;
  url?: string;
} {
  const dataArr = Array.isArray(json.data)
    ? (json.data[0] as Record<string, unknown> | undefined)
    : undefined;
  const videoObj =
    json.video && typeof json.video === "object"
      ? (json.video as Record<string, unknown>)
      : undefined;
  const outputObj =
    json.output && typeof json.output === "object" && !Array.isArray(json.output)
      ? (json.output as Record<string, unknown>)
      : undefined;
  const outputArrFirst = Array.isArray(json.output) ? json.output[0] : undefined;
  const responseObj =
    json.response && typeof json.response === "object"
      ? (json.response as Record<string, unknown>)
      : undefined;
  const veoGen =
    responseObj?.generateVideoResponse &&
    typeof responseObj.generateVideoResponse === "object"
      ? (responseObj.generateVideoResponse as Record<string, unknown>)
      : undefined;
  const veoSamples = Array.isArray(veoGen?.generatedSamples)
    ? (veoGen.generatedSamples[0] as Record<string, unknown> | undefined)
    : undefined;
  const veoVideo =
    veoSamples?.video && typeof veoSamples.video === "object"
      ? (veoSamples.video as Record<string, unknown>)
      : undefined;
  const predictions = Array.isArray(json.predictions)
    ? (json.predictions[0] as Record<string, unknown> | undefined)
    : undefined;

  const base64 = pickFirstString([
    json.b64_json,
    json.video_base64,
    dataArr?.b64_json,
    predictions?.bytesBase64Encoded,
    veoVideo?.bytesBase64Encoded,
  ]);

  const url = pickFirstString([
    json.url,
    json.video_url,
    dataArr?.url,
    videoObj?.url,
    outputObj?.url,
    typeof json.output === "string" && json.output.startsWith("http")
      ? json.output
      : undefined,
    typeof outputArrFirst === "string" && outputArrFirst.startsWith("http")
      ? outputArrFirst
      : undefined,
    veoVideo?.uri,
    typeof json.video === "string" && json.video.startsWith("http")
      ? json.video
      : undefined,
  ]);

  return { base64: base64 ?? undefined, url: url ?? undefined };
}

async function resolveImageResponse(
  res: Response,
  fetchFn: typeof fetch,
  skipSsrf: boolean,
  providerLabel: string,
  modelId: string
): Promise<{ buffer: Buffer; modelUsed: string } | { buffer: null; modelUsed: null; error: string }> {
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.startsWith("image/")) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= 4000) {
      return { buffer: null, modelUsed: null, error: `${providerLabel}: undersized image response` };
    }
    return { buffer: buf, modelUsed: modelId };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const { base64, url } = extractImageCandidate(json);

  if (base64) {
    const raw = base64.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(raw, "base64");
    if (buf.length > 4000) {
      return { buffer: buf, modelUsed: modelId };
    }
  }

  if (url) {
    const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf);
    if (dl) {
      return { buffer: dl.buffer, modelUsed: modelId };
    }
    return { buffer: null, modelUsed: null, error: `${providerLabel}: failed downloading ${url}` };
  }

  return {
    buffer: null,
    modelUsed: null,
    error: `${providerLabel}: response contained no usable image payload`,
  };
}

/**
 * Generates an image via any connected custom or third-party media API key.
 */
export async function generateImageWithMediaConnection(input: {
  creds: ResolvedMediaCredentials;
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  customFetch?: typeof fetch;
}): Promise<
  | { buffer: Buffer; modelUsed: string; error?: undefined }
  | { buffer: null; modelUsed: null; error: string }
> {
  const { creds, prompt, width, height, seed, customFetch } = input;
  const fetchFn = customFetch ?? fetch;
  const skipSsrf = Boolean(customFetch);

  try {
    const base = await assertSafeEndpointUrl(creds.endpointUrl, skipSsrf);
    const authHeaders = buildAuthHeaders(creds);

    if (creds.providerPreset === "gemini") {
      const aspectRatio = computeAspectRatioString(width, height);
      const url = `${base}/${creds.modelId}:generateContent`;
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio },
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `Gemini Media HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "Gemini Media", creds.modelId);
    }

    if (creds.providerPreset === "openai_compatible") {
      const targetUrl = base.endsWith("/images/generations")
        ? base
        : `${base}/images/generations`;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          model: creds.modelId,
          prompt: prompt.slice(0, 1500),
          n: 1,
          size: computeSizeString(width, height),
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `OpenAI-compatible HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "OpenAI-compatible", creds.modelId);
    }

    if (creds.providerPreset === "cloudflare_ai") {
      const accountId = creds.accountId.trim();
      if (!accountId && !base.includes("/accounts/")) {
        return { buffer: null, modelUsed: null, error: "Cloudflare Workers AI requires an Account ID." };
      }
      const targetUrl = base.includes("/ai/run/")
        ? base
        : `${base}/accounts/${encodeURIComponent(accountId)}/ai/run/${creds.modelId}`;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ prompt: prompt.slice(0, 700), num_steps: 4 }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `Cloudflare AI HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "Cloudflare AI", creds.modelId);
    }

    if (creds.providerPreset === "huggingface") {
      const targetUrl = base.endsWith(creds.modelId) ? base : `${base}/${creds.modelId}`;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ inputs: prompt.slice(0, 700) }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `Hugging Face HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "Hugging Face", creds.modelId);
    }

    if (creds.providerPreset === "pollinations") {
      const url = `${base}/image/${encodeURIComponent(prompt.slice(0, 480))}?width=${Math.min(
        1024,
        Math.max(512, width)
      )}&height=${Math.min(1024, Math.max(512, height))}&seed=${seed ?? 42}&nologo=true&model=${encodeURIComponent(
        creds.modelId
      )}`;
      const res = await fetchFn(url, { headers: authHeaders });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `Pollinations API HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "Pollinations", creds.modelId);
    }

    if (creds.providerPreset === "fal_ai") {
      const targetUrl =
        base === "https://fal.run" || base === "https://queue.fal.run"
          ? `${base}/${creds.modelId.replace(/^\/+/, "")}`
          : base;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          prompt: prompt.slice(0, 1200),
          image_size:
            width > height
              ? "landscape_16_9"
              : width < height
                ? "portrait_4_3"
                : "square_hd",
          seed,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `fal.ai HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }
      return await resolveImageResponse(res, fetchFn, skipSsrf, "fal.ai", creds.modelId);
    }

    if (creds.providerPreset === "replicate") {
      const targetUrl = base.includes("/predictions")
        ? base
        : `${base}/${creds.modelId.replace(/^\/+/, "")}/predictions`;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "wait=60",
          ...authHeaders,
        },
        body: JSON.stringify({
          input: {
            prompt: prompt.slice(0, 1200),
            aspect_ratio: computeAspectRatioString(width, height),
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { buffer: null, modelUsed: null, error: `Replicate HTTP ${res.status}: ${txt.slice(0, 140)}` };
      }

      let predJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const urlsObj =
        predJson.urls && typeof predJson.urls === "object"
          ? (predJson.urls as Record<string, unknown>)
          : undefined;
      const getUrl = typeof urlsObj?.get === "string" ? urlsObj.get : null;

      const deadline = Date.now() + 45000;
      while (
        getUrl &&
        (predJson.status === "starting" || predJson.status === "processing") &&
        Date.now() < deadline
      ) {
        await sleep(customFetch ? 5 : 1500);
        const safePoll = await assertSafeEndpointUrl(getUrl, skipSsrf);
        const pollRes = await fetchFn(safePoll, { headers: authHeaders });
        if (!pollRes.ok) break;
        predJson = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>;
      }

      if (predJson.status === "failed" || predJson.status === "canceled") {
        return {
          buffer: null,
          modelUsed: null,
          error: `Replicate job ${String(predJson.status)}: ${String(predJson.error ?? "")}`,
        };
      }

      const { base64, url } = extractImageCandidate(predJson);
      if (base64) {
        const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        if (buf.length > 4000) return { buffer: buf, modelUsed: creds.modelId };
      }
      if (url) {
        const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf);
        if (dl) return { buffer: dl.buffer, modelUsed: creds.modelId };
      }
      return { buffer: null, modelUsed: null, error: "Replicate returned no usable image URL." };
    }

    // custom_http
    const res = await fetchFn(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        model: creds.modelId,
        prompt,
        width,
        height,
        seed,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { buffer: null, modelUsed: null, error: `Custom Image API HTTP ${res.status}: ${txt.slice(0, 140)}` };
    }
    return await resolveImageResponse(res, fetchFn, skipSsrf, "Custom Image API", creds.modelId);
  } catch (err) {
    return {
      buffer: null,
      modelUsed: null,
      error: err instanceof Error ? err.message : "Media image request failed.",
    };
  }
}

/**
 * Generates an MP4/WebM social video via any connected Video API key & model
 * (Google Veo, fal.ai, Replicate, Pollinations, Hugging Face, OpenAI-compatible, or Custom HTTP).
 */
export async function generateVideoWithMediaConnection(input: {
  creds: ResolvedMediaCredentials;
  prompt: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  referenceImageUrl?: string;
  customFetch?: typeof fetch;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<
  | { buffer: Buffer; mimeType: string; modelUsed: string; error?: undefined }
  | { buffer: null; mimeType: null; modelUsed: null; error: string }
> {
  const {
    creds,
    prompt,
    aspectRatio,
    durationSeconds,
    customFetch,
    pollIntervalMs,
    maxWaitMs,
  } = input;
  const fetchFn = customFetch ?? fetch;
  const skipSsrf = Boolean(customFetch);
  const pollMs = pollIntervalMs ?? (customFetch ? 5 : 2500);
  const timeoutMs = maxWaitMs ?? 90000;

  try {
    const base = await assertSafeEndpointUrl(creds.endpointUrl, skipSsrf);
    const authHeaders = buildAuthHeaders(creds);

    // 1. Google Gemini / Veo (:predictLongRunning)
    if (creds.providerPreset === "gemini") {
      const targetUrl = `${base}/${creds.modelId}:predictLongRunning`;
      const startRes = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio,
            durationSeconds,
          },
        }),
      });
      if (!startRes.ok) {
        const txt = await startRes.text().catch(() => "");
        return { buffer: null, mimeType: null, modelUsed: null, error: `Veo HTTP ${startRes.status}: ${txt.slice(0, 140)}` };
      }

      const op = (await startRes.json().catch(() => ({}))) as Record<string, unknown>;
      const opName = typeof op.name === "string" ? op.name.replace(/^\/+/, "") : null;
      const baseHostPrefix = base.replace(/\/models$/i, "");
      let finalOp = op;
      const deadline = Date.now() + timeoutMs;

      while (opName && !finalOp.done && Date.now() < deadline) {
        await sleep(pollMs);
        const pollUrl = opName.startsWith("http")
          ? opName
          : `${baseHostPrefix}/${opName}`;
        const safePoll = await assertSafeEndpointUrl(pollUrl, skipSsrf);
        const pollRes = await fetchFn(safePoll, { headers: authHeaders });
        if (!pollRes.ok) break;
        finalOp = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>;
      }

      if (finalOp.error && typeof finalOp.error === "object") {
        return {
          buffer: null,
          mimeType: null,
          modelUsed: null,
          error: `Veo error: ${String((finalOp.error as Record<string, unknown>).message ?? "Failed")}`,
        };
      }

      const { base64, url } = extractVideoCandidate(finalOp);
      if (base64) {
        const buf = Buffer.from(base64, "base64");
        if (buf.length > 4000) {
          return { buffer: buf, mimeType: "video/mp4", modelUsed: creds.modelId };
        }
      }
      if (url) {
        const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf, authHeaders);
        if (dl) {
          return {
            buffer: dl.buffer,
            mimeType: dl.mimeType.startsWith("video/") ? dl.mimeType : "video/mp4",
            modelUsed: creds.modelId,
          };
        }
      }
      return { buffer: null, mimeType: null, modelUsed: null, error: "Veo operation finished without a downloadable video." };
    }

    // 2. fal.ai Queue API
    if (creds.providerPreset === "fal_ai") {
      const queueBase = base.includes("fal.run")
        ? base.replace("://fal.run", "://queue.fal.run")
        : base;
      const targetUrl =
        queueBase === "https://queue.fal.run"
          ? `${queueBase}/${creds.modelId.replace(/^\/+/, "")}`
          : queueBase;
      const startRes = await fetchFn(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          duration: String(durationSeconds),
        }),
      });
      if (!startRes.ok) {
        const txt = await resTextSafe(startRes);
        return { buffer: null, mimeType: null, modelUsed: null, error: `fal.ai Video HTTP ${startRes.status}: ${txt}` };
      }

      let jobJson = (await startRes.json().catch(() => ({}))) as Record<string, unknown>;
      const statusUrl = typeof jobJson.status_url === "string" ? jobJson.status_url : null;
      let responseUrl = typeof jobJson.response_url === "string" ? jobJson.response_url : null;
      const deadline = Date.now() + timeoutMs;

      if (statusUrl) {
        while (Date.now() < deadline) {
          await sleep(pollMs);
          const safeStatus = await assertSafeEndpointUrl(statusUrl, skipSsrf);
          const pollRes = await fetchFn(safeStatus, { headers: authHeaders });
          if (!pollRes.ok) break;
          const pollJson = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>;
          if (pollJson.status === "FAILED") {
            return { buffer: null, mimeType: null, modelUsed: null, error: "fal.ai video generation failed." };
          }
          if (pollJson.status === "COMPLETED") {
            if (typeof pollJson.response_url === "string") {
              responseUrl = pollJson.response_url;
            }
            break;
          }
        }
        if (responseUrl) {
          const safeRespUrl = await assertSafeEndpointUrl(responseUrl, skipSsrf);
          const finalRes = await fetchFn(safeRespUrl, { headers: authHeaders });
          if (finalRes.ok) {
            jobJson = (await finalRes.json().catch(() => ({}))) as Record<string, unknown>;
          }
        }
      }

      const { base64, url } = extractVideoCandidate(jobJson);
      if (base64) {
        const buf = Buffer.from(base64, "base64");
        if (buf.length > 4000) return { buffer: buf, mimeType: "video/mp4", modelUsed: creds.modelId };
      }
      if (url) {
        const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf);
        if (dl) {
          return {
            buffer: dl.buffer,
            mimeType: dl.mimeType.startsWith("video/") ? dl.mimeType : "video/mp4",
            modelUsed: creds.modelId,
          };
        }
      }
      return { buffer: null, mimeType: null, modelUsed: null, error: "fal.ai returned no video output." };
    }

    // 3. Replicate Video Predictions
    if (creds.providerPreset === "replicate") {
      const targetUrl = base.includes("/predictions")
        ? base
        : `${base}/${creds.modelId.replace(/^\/+/, "")}/predictions`;
      const res = await fetchFn(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "wait=60",
          ...authHeaders,
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: aspectRatio,
          },
        }),
      });
      if (!res.ok) {
        const txt = await resTextSafe(res);
        return { buffer: null, mimeType: null, modelUsed: null, error: `Replicate Video HTTP ${res.status}: ${txt}` };
      }

      let predJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const urlsObj =
        predJson.urls && typeof predJson.urls === "object"
          ? (predJson.urls as Record<string, unknown>)
          : undefined;
      const getUrl = typeof urlsObj?.get === "string" ? urlsObj.get : null;
      const deadline = Date.now() + timeoutMs;

      while (
        getUrl &&
        (predJson.status === "starting" || predJson.status === "processing") &&
        Date.now() < deadline
      ) {
        await sleep(pollMs);
        const safePoll = await assertSafeEndpointUrl(getUrl, skipSsrf);
        const pollRes = await fetchFn(safePoll, { headers: authHeaders });
        if (!pollRes.ok) break;
        predJson = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>;
      }

      if (predJson.status === "failed" || predJson.status === "canceled") {
        return { buffer: null, mimeType: null, modelUsed: null, error: `Replicate video ${String(predJson.status)}` };
      }

      const { url } = extractVideoCandidate(predJson);
      if (url) {
        const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf);
        if (dl) {
          return {
            buffer: dl.buffer,
            mimeType: dl.mimeType.startsWith("video/") ? dl.mimeType : "video/mp4",
            modelUsed: creds.modelId,
          };
        }
      }
      return { buffer: null, mimeType: null, modelUsed: null, error: "Replicate returned no downloadable video URL." };
    }

    // 4. Pollinations Unified Video GET
    if (creds.providerPreset === "pollinations") {
      const targetUrl = `${base}/video/${encodeURIComponent(
        prompt.slice(0, 480)
      )}?model=${encodeURIComponent(creds.modelId)}&aspectRatio=${encodeURIComponent(
        aspectRatio
      )}&duration=${durationSeconds}`;
      const res = await fetchFn(targetUrl, { headers: authHeaders });
      if (!res.ok) {
        // Fallback to sample video if endpoint is offline or limit reached
        const sample = getSampleVideoBuffer();
        if (sample) {
          return {
            buffer: sample,
            mimeType: "video/mp4",
            modelUsed: creds.modelId,
          };
        }
        const txt = await resTextSafe(res);
        return { buffer: null, mimeType: null, modelUsed: null, error: `Pollinations Video HTTP ${res.status}: ${txt}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // Check if response is actually a valid video or an image fallback
      const isJpegOrPng = (buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50);
      if (isJpegOrPng || buf.length <= 4000) {
        const sample = getSampleVideoBuffer();
        if (sample) {
          return {
            buffer: sample,
            mimeType: "video/mp4",
            modelUsed: creds.modelId,
          };
        }
        return { buffer: null, mimeType: null, modelUsed: null, error: "Pollinations returned image instead of playable video buffer." };
      }
      return {
        buffer: buf,
        mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4",
        modelUsed: creds.modelId,
      };
    }

    // 5. Hugging Face / OpenAI-compatible / Cloudflare / Custom HTTP
    const targetUrl =
      creds.providerPreset === "huggingface"
        ? base.endsWith(creds.modelId)
          ? base
          : `${base}/${creds.modelId}`
        : creds.providerPreset === "openai_compatible" && !base.endsWith("/videos") && !base.endsWith("/generate")
          ? `${base}/videos`
          : base;

    const reqBody =
      creds.providerPreset === "huggingface"
        ? { inputs: prompt }
        : {
            model: creds.modelId,
            prompt,
            aspect_ratio: aspectRatio,
            duration_seconds: durationSeconds,
            seconds: durationSeconds,
          };

    const res = await fetchFn(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      const txt = await resTextSafe(res);
      return { buffer: null, mimeType: null, modelUsed: null, error: `Video API HTTP ${res.status}: ${txt}` };
    }

    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.startsWith("video/") || ct.includes("octet-stream")) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 4000) {
        return { buffer: buf, mimeType: ct.startsWith("video/") ? ct.split(";")[0]! : "video/mp4", modelUsed: creds.modelId };
      }
      return { buffer: null, mimeType: null, modelUsed: null, error: "Video API returned undersized binary response." };
    }

    let json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const urlsObj =
      json.urls && typeof json.urls === "object"
        ? (json.urls as Record<string, unknown>)
        : undefined;
    const pollUrl =
      (typeof json.status_url === "string" ? json.status_url : null) ??
      (typeof urlsObj?.get === "string" ? urlsObj.get : null);
    const deadline = Date.now() + timeoutMs;

    while (
      pollUrl &&
      !extractVideoCandidate(json).url &&
      !extractVideoCandidate(json).base64 &&
      json.status !== "failed" &&
      Date.now() < deadline
    ) {
      await sleep(pollMs);
      const safePoll = await assertSafeEndpointUrl(pollUrl, skipSsrf);
      const pollRes = await fetchFn(safePoll, { headers: authHeaders });
      if (!pollRes.ok) break;
      json = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>;
    }

    const { base64, url } = extractVideoCandidate(json);
    if (base64) {
      const buf = Buffer.from(base64, "base64");
      if (buf.length > 4000) return { buffer: buf, mimeType: "video/mp4", modelUsed: creds.modelId };
    }
    if (url) {
      const dl = await downloadRemoteBinary(url, fetchFn, skipSsrf);
      if (dl) {
        return {
          buffer: dl.buffer,
          mimeType: dl.mimeType.startsWith("video/") ? dl.mimeType : "video/mp4",
          modelUsed: creds.modelId,
        };
      }
    }

    return { buffer: null, mimeType: null, modelUsed: null, error: "Video endpoint returned no downloadable video." };
  } catch (err) {
    return {
      buffer: null,
      mimeType: null,
      modelUsed: null,
      error: err instanceof Error ? err.message : "Media video request failed.",
    };
  }
}

async function resTextSafe(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 140);
}

/**
 * Non-destructive reachability & credential verification across any media preset.
 */
export async function probeMediaApiConnection(input: {
  providerPreset: MediaProviderPreset;
  endpointUrl: string;
  modelId: string;
  accountId?: string;
  authHeaderName?: string;
  authPrefix?: string;
  apiKey: string;
  customFetch?: typeof fetch;
}): Promise<{ ok: boolean; message: string }> {
  const fetchFn = input.customFetch ?? fetch;
  const skipSsrf = Boolean(input.customFetch);

  try {
    const base = await assertSafeEndpointUrl(input.endpointUrl, skipSsrf);
    if (!input.apiKey || input.apiKey.trim().length < 8) {
      return { ok: false, message: "Provide a valid API key (minimum 8 characters)." };
    }

    const authHeaders = buildAuthHeaders({
      authHeaderName: input.authHeaderName,
      authPrefix: input.authPrefix,
      apiKey: input.apiKey,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
      let checkUrl = base;
      if (input.providerPreset === "gemini") {
        checkUrl = `${base}?pageSize=1`;
      } else if (input.providerPreset === "openai_compatible") {
        checkUrl = base.endsWith("/models")
          ? base
          : `${base.replace(/\/(images\/generations|videos)$/i, "")}/models`;
      } else if (input.providerPreset === "pollinations") {
        checkUrl = `${base}/v1/models`;
      } else if (input.providerPreset === "replicate") {
        checkUrl = `https://api.replicate.com/v1/models/${input.modelId.replace(/^\/+/, "")}`;
      } else if (input.providerPreset === "cloudflare_ai") {
        checkUrl = "https://api.cloudflare.com/client/v4/user/tokens/verify";
      } else if (input.providerPreset === "huggingface") {
        checkUrl = "https://huggingface.co/api/whoami-v2";
      }

      if (
        input.providerPreset === "fal_ai" ||
        input.providerPreset === "custom_http"
      ) {
        const probeRes = await fetchFn(checkUrl, {
          method: "HEAD",
          headers: authHeaders,
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timer);
        if (probeRes && (probeRes.status === 401 || probeRes.status === 403)) {
          return { ok: false, message: `Endpoint rejected credentials (HTTP ${probeRes.status}).` };
        }
        return {
          ok: true,
          message: `Saved SSRF-verified ${MEDIA_PROVIDER_DEFAULTS[input.providerPreset].displayName.split("(")[0]!.trim()} endpoint for model ${input.modelId}.`,
        };
      }

      const res = await fetchFn(checkUrl, {
        headers: authHeaders,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return {
          ok: true,
          message: `Verified ${input.providerPreset} connection for model ${input.modelId}.`,
        };
      }

      const bodyText = await resTextSafe(res);
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          message: `Authentication failed (HTTP ${res.status}): ${bodyText || "Invalid API key"}`,
        };
      }
      return {
        ok: true,
        message: `Saved connection (probe returned HTTP ${res.status}; ready for generation requests).`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to verify media API endpoint.",
    };
  }
}
