import { describe, it, expect } from "vitest";
import {
  computeAiHordeDimensions,
  generateFreeFallbackImage,
  generateImageWithAiHorde,
} from "@/lib/ai/free-image-provider";

function createFakeImageBytes(size = 12000): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  view[0] = 0x52;
  view[1] = 0x49;
  view[2] = 0x46;
  view[3] = 0x46;
  return buf;
}

describe("Free Image Provider (AI Horde & Pollinations Fallback)", () => {
  it("computes AI Horde dimensions strictly inside anonymous kudos limits", () => {
    expect(computeAiHordeDimensions(1080, 1080)).toEqual({
      width: 576,
      height: 576,
    });
    expect(computeAiHordeDimensions(1200, 627)).toEqual({
      width: 640,
      height: 448,
    });
    expect(computeAiHordeDimensions(1080, 1920)).toEqual({
      width: 448,
      height: 640,
    });
  });

  it("handles AI Horde 429 retry, async check polling, status fetch, and final image download", async () => {
    let submitAttempts = 0;
    let pollChecks = 0;
    const fakeImage = createFakeImageBytes(14000);

    const mockFetch = (async (inputUrl: string | URL) => {
      const url = String(inputUrl);
      if (url.endsWith("/generate/async")) {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          return new Response(JSON.stringify({ message: "2 per 1 second" }), {
            status: 429,
          });
        }
        return new Response(JSON.stringify({ id: "horde-job-123" }), {
          status: 202,
        });
      }

      if (url.endsWith("/generate/check/horde-job-123")) {
        pollChecks += 1;
        return new Response(
          JSON.stringify({ done: pollChecks >= 2, faulted: false }),
          { status: 200 }
        );
      }

      if (url.endsWith("/generate/status/horde-job-123")) {
        return new Response(
          JSON.stringify({
            generations: [
              {
                img: "https://cdn.example.com/horde-result.webp",
                model: "AbsoluteReality",
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url === "https://cdn.example.com/horde-result.webp") {
        return new Response(fakeImage, {
          status: 200,
          headers: { "content-type": "image/webp" },
        });
      }

      return new Response("Not Found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await generateImageWithAiHorde({
      prompt: "Studio photo of sleek electric coupe in architectural pavilion",
      width: 1080,
      height: 1080,
      variationIndex: 1,
      seed: 42,
      customFetch: mockFetch,
      pollIntervalMs: 5,
      maxWaitMs: 1000,
    });

    expect(submitAttempts).toBe(2);
    expect(pollChecks).toBe(2);
    expect(result.modelUsed).toBe("aihorde:AbsoluteReality");
    expect(result.buffer).not.toBeNull();
    expect(result.buffer!.length).toBe(14000);
  });

  it("falls back cleanly to Pollinations when AI Horde fails and rejects invalid or undersized responses", async () => {
    const fakeJpeg = createFakeImageBytes(10000);

    const mockFallbackFetch = (async (inputUrl: string | URL) => {
      const url = String(inputUrl);
      if (url.includes("aihorde.net/api/v2/generate/async")) {
        return new Response(JSON.stringify({ message: "Maintenance" }), {
          status: 503,
        });
      }
      if (url.startsWith("https://image.pollinations.ai/prompt/")) {
        return new Response(fakeJpeg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response("Bad Request", { status: 400 });
    }) as unknown as typeof fetch;

    const okResult = await generateFreeFallbackImage({
      prompt: "Commercial product scene on brushed titanium surface",
      width: 1080,
      height: 1080,
      seed: 99,
      customFetch: mockFallbackFetch,
    });
    expect(okResult.modelUsed).toBe("pollinations:flux");
    expect(okResult.buffer).not.toBeNull();
    expect(okResult.buffer!.length).toBe(10000);

    // Reject non-image content-type and undersized payload
    const mockBadFetch = (async (inputUrl: string | URL) => {
      const url = String(inputUrl);
      if (url.includes("aihorde.net")) {
        return new Response("Down", { status: 503 });
      }
      if (url.startsWith("https://image.pollinations.ai/prompt/")) {
        return new Response("<html>error</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("Down", { status: 500 });
    }) as unknown as typeof fetch;

    const badCtResult = await generateFreeFallbackImage({
      prompt: "Test scene",
      width: 1080,
      height: 1080,
      customFetch: mockBadFetch,
    });
    expect(badCtResult.buffer).toBeNull();
    expect(badCtResult.error).toContain("non-image content-type");

    const mockTinyFetch = (async (inputUrl: string | URL) => {
      const url = String(inputUrl);
      if (url.includes("aihorde.net")) {
        return new Response("Down", { status: 503 });
      }
      return new Response(new ArrayBuffer(500), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as unknown as typeof fetch;

    const tinyResult = await generateFreeFallbackImage({
      prompt: "Test scene",
      width: 1080,
      height: 1080,
      customFetch: mockTinyFetch,
    });
    expect(tinyResult.buffer).toBeNull();
    expect(tinyResult.error).toContain("undersized image");
  });
});
