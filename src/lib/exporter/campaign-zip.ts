import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { ensureWorkspaceStorageDir } from "@/lib/db/client";
import {
  createExportJob,
  getBrandById,
  getCampaignById,
  listCreatives,
} from "@/lib/db/repository";
import { slugify } from "@/lib/utils";
import type { ExportJob, SocialPlatform } from "@/types/domain";

const PLATFORM_FOLDER_NAMES: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  pinterest: "Pinterest",
  tiktok: "TikTok",
};

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim() || "Untitled";
}

export async function exportApprovedCampaignZip(input: {
  workspaceId: string;
  campaignId: string;
  format?: "png" | "webp" | "both";
}): Promise<{
  exportJob: ExportJob;
  zipBuffer: Buffer;
}> {
  const campaign = getCampaignById(input.workspaceId, input.campaignId);
  if (!campaign) {
    throw new Error("Campaign not found in this workspace.");
  }

  const brand = getBrandById(input.workspaceId, campaign.brandId);
  if (!brand) {
    throw new Error("Brand not found in this workspace.");
  }

  const approvedCreatives = listCreatives(input.workspaceId, {
    campaignId: campaign.id,
    approvalStatus: "approved",
  });

  if (approvedCreatives.length === 0) {
    throw new Error(
      "Approval required: Approve at least one creative variation before exporting the campaign package."
    );
  }

  const format = input.format ?? "both";
  const zip = new JSZip();
  const brandFolder = sanitizeFolderName(brand.name);
  const campaignFolder = sanitizeFolderName(campaign.name);
  const manifestPaths: string[] = [];

  for (const creative of approvedCreatives) {
    const ver = creative.currentVersion;
    if (!ver) continue;

    const platformFolder = PLATFORM_FOLDER_NAMES[creative.platform] ?? creative.platform;
    const baseDir = `${brandFolder}/${campaignFolder}/${platformFolder}`;
    const fileStem = `${slugify(brand.name)}-${creative.platform}-${slugify(creative.formatName)}-${creative.width}x${creative.height}-variation-${creative.variationIndex}-v${ver.versionNumber}`;

    if ((format === "png" || format === "both") && fs.existsSync(ver.renderedPngPath)) {
      const pngEntryPath = `${baseDir}/${fileStem}.png`;
      zip.file(pngEntryPath, fs.readFileSync(ver.renderedPngPath));
      manifestPaths.push(pngEntryPath);
    }

    if ((format === "webp" || format === "both") && fs.existsSync(ver.renderedWebpPath)) {
      const webpEntryPath = `${baseDir}/${fileStem}.webp`;
      zip.file(webpEntryPath, fs.readFileSync(ver.renderedWebpPath));
      manifestPaths.push(webpEntryPath);
    }

    const copyTxtPath = `${baseDir}/${fileStem}-copy.txt`;
    const copyContent = [
      `Brand: ${brand.name} (${brand.domain})`,
      `Campaign: ${campaign.name}`,
      `Platform: ${platformFolder} (${creative.formatName} — ${creative.width}x${creative.height})`,
      `Variation: #${creative.variationIndex} (${creative.compositionTemplate})`,
      `Version: v${ver.versionNumber}`,
      ``,
      `Short Post Image Headline: ${ver.textOverrides.postTitle}`,
      `Short Post Image Subtitle: ${ver.textOverrides.supportingCopy}`,
      `SEO Keywords Used: ${(campaign.seoKeywords ?? []).join(", ") || "Domain Topics"}`,
      ``,
      `Lengthy Post Description & Caption:`,
      ver.textOverrides.caption,
      ``,
      `Hashtags:`,
      ver.textOverrides.hashtags.join(" "),
    ].join("\n");

    zip.file(copyTxtPath, copyContent);
    manifestPaths.push(copyTxtPath);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const exportDir = ensureWorkspaceStorageDir(input.workspaceId, "exports");
  const zipFileName = `${slugify(brand.name)}-${slugify(campaign.name)}-${Date.now()}.zip`;
  const zipAssetPath = path.join(exportDir, zipFileName);
  fs.writeFileSync(zipAssetPath, zipBuffer);

  const exportJob = createExportJob(input.workspaceId, {
    campaignId: campaign.id,
    brandName: brand.name,
    campaignName: campaign.name,
    format,
    zipAssetPath,
    fileCount: manifestPaths.length,
    manifestPaths,
  });

  return {
    exportJob,
    zipBuffer,
  };
}
