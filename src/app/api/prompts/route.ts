import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  buildGeminiDirectedImagePrompt,
  fetchReferenceImagesForGemini,
} from "@/lib/ai/gemini-service";
import { detectTopicFromContent } from "@/lib/extractor/website-extractor";
import { getBrandById, getBrandKitById } from "@/lib/db/repository";
import type { SocialPlatform, SupportiveGraphicStyle } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      brandId: string;
      topic?: string;
      seoKeywords?: string[];
      platform?: SocialPlatform;
      formatName?: string;
      supportiveGraphicStyle?: SupportiveGraphicStyle;
      selectedDomainImageUrl?: string;
      selectedVariations?: Array<1 | 2 | 3>;
      promptsToRefine?: Partial<Record<1 | 2 | 3, string>>;
      mode?: "autowrite" | "refine";
    };

    if (!body.brandId) {
      return NextResponse.json(
        { error: "Select a brand before generating autonomous prompts." },
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

    const brandKit = brand.activeKitId
      ? getBrandKitById(wsId, brand.activeKitId)
      : null;
    if (!brandKit) {
      return NextResponse.json(
        { error: "Approve a Brand Kit first so Gemini can ground visual prompts." },
        { status: 400 }
      );
    }

    const variations: Array<1 | 2 | 3> =
      body.selectedVariations && body.selectedVariations.length > 0
        ? body.selectedVariations
        : [1, 2, 3];

    const effectiveTopicText =
      body.topic?.trim() ||
      brandKit.extractionMeta.extractedHeadings?.[0] ||
      brandKit.extractionMeta.pageTitle ||
      brand.name;

    const detectedTopic =
      brandKit.extractionMeta.detectedTopic ??
      detectTopicFromContent(`${brand.name} ${effectiveTopicText}`);

    const referenceUrls: string[] = [];
    if (body.selectedDomainImageUrl) {
      referenceUrls.push(body.selectedDomainImageUrl);
    }
    for (const url of brandKit.extractionMeta.extractedImages ?? []) {
      if (url && !referenceUrls.includes(url)) {
        referenceUrls.push(url);
      }
    }
    const referenceImages = await fetchReferenceImagesForGemini(referenceUrls, 2);

    const prompts = await Promise.all(
      variations.map(async (variationIndex) => {
        const userPromptDraft = body.promptsToRefine?.[variationIndex];
        const isRefine = body.mode === "refine" && Boolean(userPromptDraft?.trim());

        const directed = await buildGeminiDirectedImagePrompt({
          brandName: brand.name,
          brandDomain: brand.domain,
          brandSummary: brandKit.extractionMeta.pageDescription,
          brandHeadings: brandKit.extractionMeta.extractedHeadings,
          seoKeywords: body.seoKeywords,
          platform: body.platform,
          formatName: body.formatName,
          topicPrompt: `${brand.name} — ${effectiveTopicText}`,
          userPromptDraft,
          refineExisting: isRefine,
          detectedTopic,
          supportiveGraphicStyle: body.supportiveGraphicStyle ?? "auto_topic",
          characteristic: brandKit.visualStyle.characteristic,
          brandColors: brandKit.colors,
          variationIndex,
          referenceImages,
          geminiContext: {
            workspaceId: wsId,
            userId: session.user.id,
          },
        });

        return {
          variationIndex,
          ...directed,
        };
      })
    );

    return NextResponse.json({ prompts });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate Gemini visual prompts.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
