import { describe, it, expect, beforeEach } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBrand,
  createVideoGeneration,
  createWorkspaceWithDefaults,
  deleteMediaApiConnection,
  deleteVideoGeneration,
  listMediaApiConnections,
  listVideoGenerations,
  registerOrLoginUser,
  resolveActiveMediaCredentials,
  updateMediaApiConnection,
  upsertMediaApiConnection,
} from "@/lib/db/repository";
import {
  generateImageWithMediaConnection,
  generateVideoWithMediaConnection,
} from "@/lib/ai/universal-media-provider";

function createFakeBinaryBuffer(size = 9000): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  view[0] = 0x89;
  view[1] = 0x50;
  view[2] = 0x4e;
  view[3] = 0x47;
  return buf;
}

describe("Universal Multi-Provider Image & Video API Vault", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("encrypts, isolates, prioritizes personal keys over workspace keys, and resolves image/video capabilities", () => {
    const alice = registerOrLoginUser({
      email: "alice@media.test",
      name: "Alice Creator",
      password: "alice-password-1",
      workspaceName: "Alice Studio",
    });
    const aliceWs = alice.workspaces[0]!;

    const bob = registerOrLoginUser({
      email: "bob@media.test",
      name: "Bob Creator",
      password: "bob-password-1",
      workspaceName: "Bob Studio",
    });
    const bobWs = bob.workspaces[0]!;

    // Workspace-shared 'both' key
    const sharedBoth = upsertMediaApiConnection({
      workspaceId: aliceWs.id,
      userId: alice.user.id,
      scope: "workspace",
      capability: "both",
      providerPreset: "openai_compatible",
      label: "Team Shared OpenAI",
      endpointUrl: "https://api.openai.com/v1",
      modelId: "gpt-image-1",
      apiKey: "sk-team-shared-key-1234",
    });

    const imgFromShared = resolveActiveMediaCredentials(
      aliceWs.id,
      alice.user.id,
      "image"
    );
    const vidFromShared = resolveActiveMediaCredentials(
      aliceWs.id,
      alice.user.id,
      "video"
    );
    expect(imgFromShared?.connectionId).toBe(sharedBoth.id);
    expect(imgFromShared?.apiKey).toBe("sk-team-shared-key-1234");
    expect(vidFromShared?.connectionId).toBe(sharedBoth.id);

    // Personal dedicated 'video' key overrides workspace key for video, while image still falls back to shared 'both'
    const personalVideo = upsertMediaApiConnection({
      workspaceId: aliceWs.id,
      userId: alice.user.id,
      scope: "user",
      capability: "video",
      providerPreset: "fal_ai",
      label: "Alice Kling Video",
      endpointUrl: "https://fal.run",
      modelId: "fal-ai/kling-video/v2/master/text-to-video",
      authHeaderName: "Authorization",
      authPrefix: "Key ",
      apiKey: "fal-key-alice-9999",
    });

    const resolvedImg = resolveActiveMediaCredentials(
      aliceWs.id,
      alice.user.id,
      "image"
    );
    const resolvedVid = resolveActiveMediaCredentials(
      aliceWs.id,
      alice.user.id,
      "video"
    );
    expect(resolvedImg?.connectionId).toBe(sharedBoth.id);
    expect(resolvedVid?.connectionId).toBe(personalVideo.id);
    expect(resolvedVid?.apiKey).toBe("fal-key-alice-9999");

    // Cross-user isolation: Bob cannot see, modify, or delete Alice's keys
    expect(listMediaApiConnections(bobWs.id, bob.user.id)).toHaveLength(0);
    expect(() =>
      updateMediaApiConnection({
        connectionId: personalVideo.id,
        userId: bob.user.id,
        workspaceId: bobWs.id,
        modelId: "hacked-model",
      })
    ).toThrow();
    deleteMediaApiConnection(personalVideo.id, bob.user.id, bobWs.id);
    expect(listMediaApiConnections(aliceWs.id, alice.user.id)).toHaveLength(2);

    // Alice updates model ID cleanly
    const updated = updateMediaApiConnection({
      connectionId: personalVideo.id,
      userId: alice.user.id,
      workspaceId: aliceWs.id,
      modelId: "fal-ai/luma-dream-machine",
    });
    expect(updated.modelId).toBe("fal-ai/luma-dream-machine");
  });

  it("generates images across OpenAI-compatible, fal.ai, Replicate polling, and custom HTTP presets", async () => {
    const fakePng = createFakeBinaryBuffer(10000);
    const base64Png = Buffer.from(fakePng).toString("base64");

    // 1. OpenAI-compatible (b64_json)
    const openaiMock = (async () =>
      new Response(JSON.stringify({ data: [{ b64_json: base64Png }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const openaiRes = await generateImageWithMediaConnection({
      creds: {
        connectionId: "c1",
        sourceScope: "user",
        capability: "image",
        providerPreset: "openai_compatible",
        label: "OpenAI",
        endpointUrl: "https://api.openai.com/v1",
        modelId: "gpt-image-1",
        accountId: "",
        authHeaderName: "Authorization",
        authPrefix: "Bearer ",
        apiKey: "sk-test-1234",
        keyLast4: "1234",
      },
      prompt: "Commercial SUV showcase",
      width: 1080,
      height: 1080,
      customFetch: openaiMock,
    });
    expect(openaiRes.modelUsed).toBe("gpt-image-1");
    expect(openaiRes.buffer?.length).toBe(10000);

    // 2. fal.ai (images[0].url download)
    const falMock = (async (url: string | URL) => {
      if (String(url).includes("cdn.fal.example")) {
        return new Response(fakePng, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response(
        JSON.stringify({ images: [{ url: "https://cdn.fal.example/img.png" }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const falRes = await generateImageWithMediaConnection({
      creds: {
        connectionId: "c2",
        sourceScope: "user",
        capability: "image",
        providerPreset: "fal_ai",
        label: "fal.ai",
        endpointUrl: "https://fal.run",
        modelId: "fal-ai/flux/schnell",
        accountId: "",
        authHeaderName: "Authorization",
        authPrefix: "Key ",
        apiKey: "fal-key-1234",
        keyLast4: "1234",
      },
      prompt: "Product flatlay",
      width: 1080,
      height: 1080,
      customFetch: falMock,
    });
    expect(falRes.modelUsed).toBe("fal-ai/flux/schnell");
    expect(falRes.buffer?.length).toBe(10000);

    // 3. Replicate (async prediction poll + output URL download)
    let replicatePolls = 0;
    const replicateMock = (async (url: string | URL) => {
      const s = String(url);
      if (s.endsWith("/predictions")) {
        return new Response(
          JSON.stringify({
            id: "pred-1",
            status: "starting",
            urls: { get: "https://api.replicate.com/v1/predictions/pred-1" },
          }),
          { status: 201 }
        );
      }
      if (s.endsWith("/predictions/pred-1")) {
        replicatePolls += 1;
        return new Response(
          JSON.stringify({
            id: "pred-1",
            status: "succeeded",
            output: ["https://replicate.delivery/out.png"],
          }),
          { status: 200 }
        );
      }
      return new Response(fakePng, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as unknown as typeof fetch;

    const repRes = await generateImageWithMediaConnection({
      creds: {
        connectionId: "c3",
        sourceScope: "user",
        capability: "image",
        providerPreset: "replicate",
        label: "Replicate",
        endpointUrl: "https://api.replicate.com/v1/models",
        modelId: "black-forest-labs/flux-schnell",
        accountId: "",
        authHeaderName: "Authorization",
        authPrefix: "Bearer ",
        apiKey: "r8-test-1234",
        keyLast4: "1234",
      },
      prompt: "Watch macro lighting",
      width: 1080,
      height: 1080,
      customFetch: replicateMock,
    });
    expect(replicatePolls).toBe(1);
    expect(repRes.buffer?.length).toBe(10000);

    // 4. Custom HTTP (custom header + binary image/png)
    let capturedHeader = "";
    const customMock = (async (_url: string | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      capturedHeader = headers?.["X-Custom-Token"] ?? "";
      return new Response(fakePng, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as unknown as typeof fetch;

    const customRes = await generateImageWithMediaConnection({
      creds: {
        connectionId: "c4",
        sourceScope: "user",
        capability: "image",
        providerPreset: "custom_http",
        label: "Custom Gateway",
        endpointUrl: "https://custom.gateway.example/generate",
        modelId: "my-studio-v2",
        accountId: "",
        authHeaderName: "X-Custom-Token",
        authPrefix: "Token ",
        apiKey: "secret-abc-9876",
        keyLast4: "9876",
      },
      prompt: "Editorial scene",
      width: 1080,
      height: 1080,
      customFetch: customMock,
    });
    expect(capturedHeader).toBe("Token secret-abc-9876");
    expect(customRes.modelUsed).toBe("my-studio-v2");
    expect(customRes.buffer?.length).toBe(10000);
  });

  it("generates social videos via Gemini Veo long-running polling and fal.ai queue, with workspace isolation", async () => {
    const fakeMp4 = createFakeBinaryBuffer(15000);

    // 1. Gemini Veo predictLongRunning + operation poll + MP4 download
    let veoPolls = 0;
    const veoMock = (async (url: string | URL) => {
      const s = String(url);
      if (s.includes(":predictLongRunning")) {
        return new Response(
          JSON.stringify({ name: "operations/veo-op-1", done: false }),
          { status: 200 }
        );
      }
      if (s.includes("operations/veo-op-1")) {
        veoPolls += 1;
        return new Response(
          JSON.stringify({
            name: "operations/veo-op-1",
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  { video: { uri: "https://generativelanguage.googleapis.com/v1beta/files/v1.mp4" } },
                ],
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(fakeMp4, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    }) as unknown as typeof fetch;

    const veoRes = await generateVideoWithMediaConnection({
      creds: {
        connectionId: "v1",
        sourceScope: "user",
        capability: "video",
        providerPreset: "gemini",
        label: "Paid Veo Key",
        endpointUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        modelId: "veo-2.0-generate-001",
        accountId: "",
        authHeaderName: "x-goog-api-key",
        authPrefix: "",
        apiKey: "AIzaVeoPaid1234",
        keyLast4: "1234",
      },
      prompt: "Smooth tracking pan around electric coupe in concrete gallery",
      aspectRatio: "9:16",
      durationSeconds: 5,
      customFetch: veoMock,
      pollIntervalMs: 5,
    });
    expect(veoPolls).toBe(1);
    expect(veoRes.mimeType).toBe("video/mp4");
    expect(veoRes.buffer?.length).toBe(15000);

    // 2. fal.ai Queue polling + MP4 download
    const falVideoMock = (async (url: string | URL) => {
      const s = String(url);
      if (s === "https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video") {
        return new Response(
          JSON.stringify({
            status_url: "https://queue.fal.run/requests/r1/status",
            response_url: "https://queue.fal.run/requests/r1",
          }),
          { status: 200 }
        );
      }
      if (s === "https://queue.fal.run/requests/r1/status") {
        return new Response(JSON.stringify({ status: "COMPLETED" }), {
          status: 200,
        });
      }
      if (s === "https://queue.fal.run/requests/r1") {
        return new Response(
          JSON.stringify({ video: { url: "https://fal.media/files/reel.mp4" } }),
          { status: 200 }
        );
      }
      return new Response(fakeMp4, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    }) as unknown as typeof fetch;

    const falVidRes = await generateVideoWithMediaConnection({
      creds: {
        connectionId: "v2",
        sourceScope: "user",
        capability: "video",
        providerPreset: "fal_ai",
        label: "fal Kling",
        endpointUrl: "https://fal.run",
        modelId: "fal-ai/kling-video/v2/master/text-to-video",
        accountId: "",
        authHeaderName: "Authorization",
        authPrefix: "Key ",
        apiKey: "fal-secret-5555",
        keyLast4: "5555",
      },
      prompt: "Golden-hour highway aerial follow cam",
      aspectRatio: "9:16",
      durationSeconds: 5,
      customFetch: falVideoMock,
      pollIntervalMs: 5,
    });
    expect(falVidRes.modelUsed).toBe("fal-ai/kling-video/v2/master/text-to-video");
    expect(falVidRes.buffer?.length).toBe(15000);

    // 3. VideoGeneration SQLite persistence & workspace isolation
    const wsA = createWorkspaceWithDefaults({ name: "WS A", ownerId: "u-a" });
    const wsB = createWorkspaceWithDefaults({ name: "WS B", ownerId: "u-b" });
    const brandA = createBrand(wsA.id, {
      name: "Motors A",
      domain: "motorsa.example",
      websiteUrl: "https://motorsa.example",
    });

    const saved = createVideoGeneration(wsA.id, {
      brandId: brandA.id,
      creativeId: null,
      platform: "instagram",
      aspectRatio: "9:16",
      durationSeconds: 5,
      prompt: "Tracking shot reel",
      providerUsed: "fal_ai:kling",
      modelId: "fal-ai/kling-video/v2/master/text-to-video",
      videoAssetPath: "/tmp/reel.mp4",
      mimeType: "video/mp4",
      status: "completed",
    });

    expect(listVideoGenerations(wsA.id)).toHaveLength(1);
    expect(listVideoGenerations(wsB.id)).toHaveLength(0);
    deleteVideoGeneration(wsB.id, saved.id); // Must not delete wsA's video
    expect(listVideoGenerations(wsA.id)).toHaveLength(1);
    deleteVideoGeneration(wsA.id, saved.id);
    expect(listVideoGenerations(wsA.id)).toHaveLength(0);
  });
});
