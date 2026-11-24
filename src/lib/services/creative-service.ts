import crypto from "node:crypto";
import fs from "node:fs";
import {
  appendCreativeVersion,
  createCampaign,
  createContentItem,
  createCreativeWithInitialVersion,
  getBrandById,
  getBrandKitById,
  getCampaignById,
  getCreativeById,
  listContentItems,
  listPlatformPresets,
  upsertSocialTracker,
} from "@/lib/db/repository";
import { generateCampaignContent } from "@/lib/ai/content-engine";
import { generateVisualAsset } from "@/lib/ai/visual-provider";
import { detectTopicFromContent } from "@/lib/extractor/website-extractor";
import {
  getDefaultLayoutOverrides,
  getVariationTemplate,
} from "@/lib/renderer/brand-consistency";
import { renderDeterministicCreative } from "@/lib/renderer/creative-compositor";
import type {
  Campaign,
  CampaignInputMode,
  Creative,
  GeminiModelId,
  LayoutOverrides,
  SocialPlatform,
  SupportiveGraphicStyle,
  TextOverrides,
} from "@/types/domain";

export interface LaunchCampaignInput {
  workspaceId: string;
  userId?: string;
  brandId: string;
  brandKitId?: string;
  campaignName: string;
  objective: string;
  inputMode: CampaignInputMode;
  topic?: string;
  seoKeywords?: string[];
  targetAudience?: string;
  toneOfVoice?: string;
  adaptPerPlatform?: boolean;
  presetIds: string[];
  selectedVariations?: Array<1 | 2 | 3>;
  supportiveGraphicStyle?: SupportiveGraphicStyle;
  supportiveBadgeText?: string;
  selectedDomainImageUrl?: string;
  showSupportiveElements?: boolean;
  aiModel?: GeminiModelId;
  customPromptsByVariation?: Partial<Record<1 | 2 | 3, string>>;
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

export async function generateFullCampaignCreatives(
  input: LaunchCampaignInput
): Promise<{
  campaign: Campaign;
  creatives: Creative[];
}> {
  const brand = getBrandById(input.workspaceId, input.brandId);
  if (!brand) {
    throw new Error("Brand not found in this workspace.");
  }

  const resolvedKitId = input.brandKitId ?? brand.activeKitId;
  if (!resolvedKitId) {
    throw new Error("Brand does not have an active Brand Kit.");
  }

  const brandKit = getBrandKitById(input.workspaceId, resolvedKitId);
  if (!brandKit || brandKit.brandId !== brand.id) {
    throw new Error("Selected Brand Kit does not belong to this brand.");
  }

  const allPresets = listPlatformPresets(input.workspaceId);
  const selectedPresets = allPresets.filter((p) => input.presetIds.includes(p.id));
  if (selectedPresets.length === 0) {
    throw new Error("Select at least one social media platform format preset.");
  }

  const uniquePlatforms = Array.from(
    new Set(selectedPresets.map((p) => p.platform))
  ) as SocialPlatform[];

  const campaign = createCampaign(input.workspaceId, {
    brandId: brand.id,
    brandKitId: brandKit.id,
    name: input.campaignName,
    objective: input.objective,
    inputMode: input.inputMode,
    topic: input.topic || input.manualInput?.postTitle || input.campaignName,
    seoKeywords: input.seoKeywords ?? [],
    targetAudience: input.targetAudience,
    toneOfVoice: input.toneOfVoice,
  });

  const generatedCopyList = await generateCampaignContent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    brand,
    brandKit,
    inputMode: input.inputMode,
    topic: campaign.topic,
    objective: campaign.objective,
    seoKeywords: campaign.seoKeywords,
    targetAudience: campaign.targetAudience,
    toneOfVoice: campaign.toneOfVoice,
    adaptPerPlatform: input.adaptPerPlatform,
    platforms: uniquePlatforms,
    manualInput: input.manualInput,
  });

  const savedContentItems = generatedCopyList.map((copyItem) =>
    createContentItem(input.workspaceId, {
      campaignId: campaign.id,
      platform: copyItem.platform,
      postTitle: copyItem.postTitle,
      mainText: copyItem.mainText,
      supportingCopy: copyItem.supportingCopy,
      caption: copyItem.caption,
      hashtags: copyItem.hashtags,
      ctaText: copyItem.ctaText,
      referenceUrl: copyItem.referenceUrl,
    })
  );

  // Detect topic from campaign topic + keywords + brand domain metadata
  const combinedTopicContext = [
    campaign.topic,
    campaign.name,
    ...(campaign.seoKeywords ?? []),
    brand.name,
    brand.domain,
  ].join(" ");
  const detectedFromCampaign = detectTopicFromContent(combinedTopicContext);
  const effectiveTopic =
    detectedFromCampaign !== "general_business"
      ? detectedFromCampaign
      : (brandKit.extractionMeta.detectedTopic ?? "general_business");

  const createdCreatives: Creative[] = [];

  for (const preset of selectedPresets) {
    const matchingContent =
      savedContentItems.find((c) => c.platform === preset.platform) ??
      savedContentItems[0]!;

    const textOverrides: TextOverrides = {
      postTitle: matchingContent.postTitle,
      supportingCopy: matchingContent.supportingCopy,
      ctaText: matchingContent.ctaText,
      caption: matchingContent.caption,
      hashtags: matchingContent.hashtags,
    };

    const variationsToRender: Array<1 | 2 | 3> =
      input.selectedVariations && input.selectedVariations.length > 0
        ? input.selectedVariations
        : [1, 2, 3];

    const preparedVariations = await Promise.all(
      variationsToRender.map(async (variationIndex) => {
        const visualPrompt = `${brand.name} — ${campaign.topic} (${preset.platform} ${preset.formatName})`;
        const visualAsset = await generateVisualAsset({
          workspaceId: input.workspaceId,
          userId: input.userId,
          brandName: brand.name,
          brandDomain: brand.domain,
          brandSummary: brandKit.extractionMeta.pageDescription,
          brandHeadings: brandKit.extractionMeta.extractedHeadings,
          seoKeywords: campaign.seoKeywords,
          platform: preset.platform,
          formatName: preset.formatName,
          headlineText: matchingContent.postTitle,
          customPromptOverride: input.customPromptsByVariation?.[variationIndex],
          prompt: visualPrompt,
          width: preset.width,
          height: preset.height,
          brandColors: brandKit.colors,
          characteristic: brandKit.visualStyle.characteristic,
          variationIndex,
          detectedTopic: effectiveTopic,
          supportiveGraphicStyle: input.supportiveGraphicStyle ?? "auto_topic",
          candidateDomainImages: brandKit.extractionMeta.extractedImages ?? [],
          selectedDomainImageUrl: input.selectedDomainImageUrl,
          aiModel: "gemini_unified",
        });

        const baseLayout = getDefaultLayoutOverrides(brandKit, variationIndex);
        const layoutOverrides: LayoutOverrides = {
          ...baseLayout,
          supportiveGraphicStyle: input.supportiveGraphicStyle ?? "auto_topic",
          supportiveBadgeText:
            input.supportiveBadgeText || visualAsset.artDirectionBadge,
          selectedDomainImageUrl: input.selectedDomainImageUrl,
          showSupportiveElements:
            input.showSupportiveElements !== undefined
              ? input.showSupportiveElements
              : input.supportiveGraphicStyle !== "minimal_clean",
          aiModel: "gemini_unified",
        };

        const creativeKey = `${campaign.id.slice(0, 8)}-${preset.platform}-${preset.formatName.toLowerCase()}-v${variationIndex}-${crypto.randomUUID().slice(0, 6)}`;

        const rendered = await renderDeterministicCreative({
          workspaceId: input.workspaceId,
          creativeKey,
          brand,
          brandKit,
          width: preset.width,
          height: preset.height,
          safeMarginPx: preset.safeMarginPx,
          variationIndex,
          backgroundBuffer: visualAsset.buffer,
          layoutOverrides,
          textOverrides,
        });

        return {
          variationIndex,
          visualAsset,
          layoutOverrides,
          rendered,
        };
      })
    );

    for (const { variationIndex, visualAsset, layoutOverrides, rendered } of preparedVariations) {
      const creative = createCreativeWithInitialVersion(input.workspaceId, {
        campaignId: campaign.id,
        brandId: brand.id,
        brandKitId: brandKit.id,
        contentItemId: matchingContent.id,
        platform: preset.platform,
        formatName: preset.formatName,
        width: preset.width,
        height: preset.height,
        variationIndex,
        compositionTemplate: getVariationTemplate(variationIndex),
        backgroundAssetPath: rendered.backgroundAssetPath,
        backgroundPrompt: visualAsset.promptUsed,
        providerUsed: visualAsset.providerUsed,
        layoutOverrides,
        textOverrides,
        renderedPngPath: rendered.renderedPngPath,
        renderedWebpPath: rendered.renderedWebpPath,
      });

      createdCreatives.push(creative);

      // Register in Social Post Tracker so the user can schedule/track/measure every generated post
      upsertSocialTracker(input.workspaceId, {
        creativeId: creative.id,
        trackingStatus: "planned",
      });
    }
  }

  return {
    campaign: getCampaignById(input.workspaceId, campaign.id)!,
    creatives: createdCreatives,
  };
}

export interface EditOrRegenerateCreativeInput {
  workspaceId: string;
  userId?: string;
  creativeId: string;
  regenerateBackground?: boolean;
  visualEditInstruction?: string;
  customBackgroundBuffer?: Buffer;
  customBackgroundPrompt?: string;
  layoutOverrides?: Partial<LayoutOverrides>;
  textOverrides?: Partial<TextOverrides>;
}

export async function editOrRegenerateCreative(
  input: EditOrRegenerateCreativeInput
): Promise<Creative> {
  const creative = getCreativeById(input.workspaceId, input.creativeId);
  if (!creative || !creative.currentVersion) {
    throw new Error("Creative not found in this workspace.");
  }

  const brand = getBrandById(input.workspaceId, creative.brandId);
  const brandKit = getBrandKitById(input.workspaceId, creative.brandKitId);
  if (!brand || !brandKit) {
    throw new Error("Associated Brand or Brand Kit not found.");
  }

  const currentVer = creative.currentVersion;
  const nextLayoutOverrides: LayoutOverrides = {
    ...currentVer.layoutOverrides,
    ...(input.layoutOverrides ?? {}),
  };

  const nextTextOverrides: TextOverrides = {
    ...currentVer.textOverrides,
    ...(input.textOverrides ?? {}),
  };

  let backgroundBuffer: Buffer;
  let backgroundPrompt = currentVer.backgroundPrompt;
  let providerUsed = currentVer.providerUsed;

  const graphicStyleChanged =
    input.layoutOverrides?.supportiveGraphicStyle !== undefined &&
    input.layoutOverrides.supportiveGraphicStyle !==
      currentVer.layoutOverrides.supportiveGraphicStyle;

  const domainImgChanged =
    input.layoutOverrides?.selectedDomainImageUrl !== undefined &&
    input.layoutOverrides.selectedDomainImageUrl !==
      currentVer.layoutOverrides.selectedDomainImageUrl;

  if (input.customBackgroundBuffer) {
    backgroundBuffer = input.customBackgroundBuffer;
    backgroundPrompt = input.customBackgroundPrompt ?? "User-uploaded visual asset";
    providerUsed = "custom_upload";
  } else if (
    input.regenerateBackground ||
    input.visualEditInstruction ||
    graphicStyleChanged ||
    domainImgChanged ||
    !fs.existsSync(currentVer.backgroundAssetPath)
  ) {
    const contentItems = listContentItems(input.workspaceId, creative.campaignId);
    const promptBase =
      input.customBackgroundPrompt?.trim() ||
      nextTextOverrides.postTitle ||
      contentItems[0]?.postTitle ||
      brand.name;

    const prevBgBuffer =
      input.visualEditInstruction && fs.existsSync(currentVer.backgroundAssetPath)
        ? fs.readFileSync(currentVer.backgroundAssetPath)
        : undefined;

    const generatedBg = await generateVisualAsset({
      workspaceId: input.workspaceId,
      userId: input.userId,
      brandName: brand.name,
      brandDomain: brand.domain,
      brandSummary: brandKit.extractionMeta.pageDescription,
      brandHeadings: brandKit.extractionMeta.extractedHeadings,
      platform: creative.platform,
      formatName: creative.formatName,
      headlineText: nextTextOverrides.postTitle,
      customPromptOverride:
        !input.visualEditInstruction && input.customBackgroundPrompt?.trim()
          ? input.customBackgroundPrompt.trim()
          : undefined,
      prompt: `${brand.name} — ${promptBase} (variation ${creative.variationIndex})`,
      width: creative.width,
      height: creative.height,
      brandColors: brandKit.colors,
      characteristic: brandKit.visualStyle.characteristic,
      variationIndex: creative.variationIndex,
      detectedTopic: detectTopicFromContent(`${brand.name} ${promptBase}`),
      supportiveGraphicStyle: nextLayoutOverrides.supportiveGraphicStyle,
      candidateDomainImages: brandKit.extractionMeta.extractedImages ?? [],
      selectedDomainImageUrl: nextLayoutOverrides.selectedDomainImageUrl,
      previousBackgroundBuffer: prevBgBuffer,
      editInstruction: input.visualEditInstruction,
      aiModel: "gemini_unified",
      seed: Date.now(),
    });
    backgroundBuffer = generatedBg.buffer;
    backgroundPrompt = generatedBg.promptUsed;
    providerUsed = generatedBg.providerUsed;
  } else {
    backgroundBuffer = fs.readFileSync(currentVer.backgroundAssetPath);
  }

  const nextVerNum = (creative.versions?.[0]?.versionNumber ?? 1) + 1;
  const creativeKey = `${creative.id.slice(0, 8)}-ver${nextVerNum}-${crypto.randomUUID().slice(0, 6)}`;

  const rendered = await renderDeterministicCreative({
    workspaceId: input.workspaceId,
    creativeKey,
    brand,
    brandKit,
    width: creative.width,
    height: creative.height,
    variationIndex: creative.variationIndex,
    backgroundBuffer,
    layoutOverrides: nextLayoutOverrides,
    textOverrides: nextTextOverrides,
  });

  return appendCreativeVersion(input.workspaceId, creative.id, {
    backgroundAssetPath: rendered.backgroundAssetPath,
    backgroundPrompt,
    providerUsed,
    layoutOverrides: nextLayoutOverrides,
    textOverrides: nextTextOverrides,
    renderedPngPath: rendered.renderedPngPath,
    renderedWebpPath: rendered.renderedWebpPath,
    resetApprovalToPending: false,
  });
}
