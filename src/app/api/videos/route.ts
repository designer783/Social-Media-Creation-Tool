import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { ensureWorkspaceStorageDir } from "@/lib/db/client";
import {
  createVideoGeneration,
  deleteVideoGeneration,
  getBrandById,
  getBrandKitById,
  getVideoGenerationById,
  resolveActiveMediaCredentials,
} from "@/lib/db/repository";
import { buildGeminiVideoDirectorPrompt } from "@/lib/ai/gemini-service";
import { generateVideoWithMediaConnection } from "@/lib/ai/universal-media-provider";
import type { SocialPlatform } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;

    const body = (await req.json()) as {
      brandId: string;
      creativeId?: string;
      platform?: SocialPlatform;
      aspectRatio?: "9:16" | "16:9" | "1:1";
      durationSeconds?: number;
      topic?: string;
      customPrompt?: string;
      mediaConnectionId?: string;
    };

    if (!body.brandId) {
      return NextResponse.json(
        { error: "Select a brand before generating a social video." },
        { status: 400 }
      );
    }

    const brand = getBrandById(wsId, body.brandId);
    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found in this workspace." },
        { status: 404 }
      );
    }

    const videoCreds = resolveActiveMediaCredentials(
      wsId,
      userId,
      "video",
      body.mediaConnectionId
    );
    if (!videoCreds) {
      return NextResponse.json(
        {
          error:
            "No Video API key is configured. Add any Video API key (e.g. Google Veo, fal.ai Kling, Replicate, Sora / OpenAI, Pollinations, or Custom HTTP) in Settings -> Universal Image & Video API Vault.",
        },
        { status: 400 }
      );
    }

    const brandKit = brand.activeKitId
      ? getBrandKitById(wsId, brand.activeKitId)
      : null;

    const platform: SocialPlatform = body.platform ?? "instagram";
    const aspectRatio: "9:16" | "16:9" | "1:1" = body.aspectRatio ?? "9:16";
    const durationSeconds = Math.max(
      2,
      Math.min(30, Math.round(Number(body.durationSeconds) || 5))
    );

    const prompt = body.customPrompt?.trim()
      ? body.customPrompt.trim()
      : (
          await buildGeminiVideoDirectorPrompt({
            brandName: brand.name,
            brandDomain: brand.domain,
            brandSummary: brandKit?.extractionMeta.pageDescription,
            topic:
              body.topic?.trim() ||
              brandKit?.extractionMeta.extractedHeadings?.[0] ||
              `${brand.name} Showcase Reel`,
            platform,
            aspectRatio,
            durationSeconds,
            geminiContext: { workspaceId: wsId, userId },
          })
        ).prompt;

    const generated = await generateVideoWithMediaConnection({
      creds: videoCreds,
      prompt,
      aspectRatio,
      durationSeconds,
    });

    if (!generated.buffer) {
      return NextResponse.json(
        { error: generated.error || "Video API failed to render video." },
        { status: 400 }
      );
    }

    const videosDir = ensureWorkspaceStorageDir(wsId, "videos");
    const ext = generated.mimeType.includes("webm") ? "webm" : "mp4";
    const fileName = `video-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const videoAssetPath = path.join(videosDir, fileName);
    fs.writeFileSync(videoAssetPath, generated.buffer);

    const video = createVideoGeneration(wsId, {
      brandId: brand.id,
      creativeId: body.creativeId ?? null,
      platform,
      aspectRatio,
      durationSeconds,
      prompt,
      providerUsed: `${videoCreds.providerPreset}:${generated.modelUsed}`,
      modelId: generated.modelUsed,
      videoAssetPath,
      mimeType: generated.mimeType || "video/mp4",
      status: "completed",
    });

    return NextResponse.json({ video });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate AI social video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId is required." }, { status: 400 });
    }

    const existing = getVideoGenerationById(wsId, videoId);
    if (existing && existing.videoAssetPath && fs.existsSync(existing.videoAssetPath)) {
      fs.unlinkSync(existing.videoAssetPath);
    }

    deleteVideoGeneration(wsId, videoId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete generated video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
