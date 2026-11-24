import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ensureWorkspaceStorageDir } from "@/lib/db/client";
import {
  makeShortConcisePostHeadline,
  makeShortConciseSubtitle,
} from "@/lib/ai/content-engine";
import {
  enforceBrandConsistency,
  type ValidatedRenderSpec,
} from "@/lib/renderer/brand-consistency";
import type {
  Brand,
  BrandKit,
  LayoutOverrides,
  LogoPlacement,
  TextOverrides,
} from "@/types/domain";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTextLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length <= maxCharsPerLine) {
      currentLine = tentative;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine) : word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

function computeLogoCoordinates(
  placement: LogoPlacement,
  width: number,
  height: number,
  margin: number,
  badgeWidth: number,
  badgeHeight: number
): { x: number; y: number } {
  switch (placement) {
    case "top-right":
      return { x: width - margin - badgeWidth, y: margin };
    case "bottom-left":
      return { x: margin, y: height - margin - badgeHeight };
    case "bottom-right":
      return { x: width - margin - badgeWidth, y: height - margin - badgeHeight };
    case "top-center":
      return { x: Math.round((width - badgeWidth) / 2), y: margin };
    case "top-left":
    default:
      return { x: margin, y: margin };
  }
}

function buildSupportiveGraphicsMarkup(input: {
  width: number;
  height: number;
  margin: number;
  spec: ValidatedRenderSpec;
  logoCoords: { x: number; y: number };
  badgeHeight: number;
}): string {
  const { width, height, margin, spec, logoCoords, badgeHeight } = input;
  if (!spec.showSupportiveElements || spec.supportiveGraphicStyle === "minimal_clean") {
    return "";
  }

  const pillW = Math.round(Math.max(210, Math.min(width, height) * 0.26));
  const pillH = badgeHeight;
  const pillX = logoCoords.x < width / 2 ? width - margin - pillW : margin;
  const pillY = margin;
  const pillFontSize = Math.round(pillH * 0.29);

  return `
    <g>
      <!-- Sleek Translucent Editorial Topic Pill -->
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" fill="#090D16" fill-opacity="0.76" stroke="${spec.accentColor}" stroke-opacity="0.85" stroke-width="1.5" />
      <circle cx="${pillX + Math.round(pillH * 0.46)}" cy="${pillY + Math.round(pillH / 2)}" r="${Math.round(pillH * 0.12)}" fill="${spec.accentColor}" />
      <text x="${pillX + Math.round(pillW * 0.55)}" y="${pillY + Math.round(pillH * 0.60)}" text-anchor="middle" fill="#FFFFFF" font-family="${escapeXml(spec.bodyFont)}" font-size="${pillFontSize}" font-weight="700" letter-spacing="1.4">
        ${escapeXml(spec.supportiveBadgeText.slice(0, 20).toUpperCase())}
      </text>
    </g>
  `;
}

function buildDeterministicOverlaySvg(input: {
  width: number;
  height: number;
  safeMarginPx: number;
  spec: ValidatedRenderSpec;
  hasUploadedLogoImage: boolean;
}): {
  svg: string;
  logoBox: { x: number; y: number; width: number; height: number };
} {
  const { width, height, spec, hasUploadedLogoImage } = input;
  const isLandscape = width > height * 1.15;
  const margin = Math.round(input.safeMarginPx * 0.78 * spec.spacingMultiplier);

  const baseHeadingPx = Math.round(
    Math.min(width, height) * (isLandscape ? 0.064 : 0.05) * spec.headingScaleMultiplier
  );
  const headingLineHeight = Math.round(baseHeadingPx * 1.16);
  const bodyPx = Math.round(Math.max(18, baseHeadingPx * 0.44));
  const bodyLineHeight = Math.round(bodyPx * 1.35);

  const badgeHeight = Math.round(Math.max(50, Math.min(width, height) * 0.056));
  const badgeWidth = Math.round(Math.max(196, badgeHeight * 3.6));
  const logoCoords = computeLogoCoordinates(
    spec.logoPlacement,
    width,
    height,
    margin,
    badgeWidth,
    badgeHeight
  );

  let panelX = 0;
  let panelY = 0;
  let panelW = width;
  let panelH = height;

  if (spec.compositionTemplate === "editorial_split") {
    panelX = 0;
    panelH = Math.round(height * (isLandscape ? 0.34 : 0.27));
    panelY = height - panelH;
    panelW = width;
  } else if (spec.compositionTemplate === "bold_hero") {
    panelX = margin;
    panelW = width - margin * 2;
    panelH = Math.round(height * (isLandscape ? 0.3 : 0.24));
    panelY = height - margin - panelH;
  } else {
    panelX = Math.round(margin * 0.8);
    panelW = width - panelX * 2;
    panelH = Math.round(height * (isLandscape ? 0.29 : 0.23));
    panelY = height - panelX - panelH;
  }

  const innerPad = Math.round(
    Math.max(24, Math.min(panelW, panelH) * 0.12) * spec.spacingMultiplier
  );
  const textAreaWidth = Math.max(260, panelW - innerPad * 2);
  const maxHeadingChars = Math.max(18, Math.floor(textAreaWidth / (baseHeadingPx * 0.55)));
  const maxBodyChars = Math.max(28, Math.floor(textAreaWidth / (bodyPx * 0.51)));

  const conciseTitle = makeShortConcisePostHeadline(spec.postTitle, spec.brandName);
  const conciseSubtitle = makeShortConciseSubtitle(spec.supportingCopy, spec.domain);

  const titleLines = wrapTextLines(conciseTitle, maxHeadingChars, 2);
  const bodyLines = wrapTextLines(conciseSubtitle, maxBodyChars, 1);

  const isCentered = spec.textAlignment === "center";
  const textAnchor = isCentered ? "middle" : "start";
  const textX = isCentered ? Math.round(panelX + panelW / 2) : panelX + innerPad;

  const blockStartY = panelY + innerPad + baseHeadingPx;
  const accentBarY = blockStartY - baseHeadingPx - 14;
  const accentBarW = 68;
  const accentBarX = isCentered ? Math.round(textX - accentBarW / 2) : textX;

  // Use high-contrast editorial typography over a dark cinema scrim/glass deck
  // unless user explicitly selected "light" card mode
  const isExplicitLightCard =
    spec.surfaceBg.toUpperCase() === "#F8FAFC" ||
    spec.surfaceBg.toUpperCase() === "#FFFFFF" ||
    spec.surfaceBg.toUpperCase() === "#FAF8F5";

  const cardFillHex = isExplicitLightCard ? "#F8FAFC" : "#090D16";
  const headingColorHex = isExplicitLightCard ? "#0F172A" : "#FFFFFF";
  const subtitleColorHex = isExplicitLightCard ? "#334155" : "#E2E8F0";

  const titleSpans = titleLines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" y="${blockStartY + idx * headingLineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const afterTitleY =
    blockStartY + titleLines.length * headingLineHeight + Math.round(bodyPx * 0.52);
  const bodySpans = bodyLines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" y="${afterTitleY + idx * bodyLineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const minimalPerimeterFrame =
    spec.compositionTemplate === "minimal_card"
      ? `<rect x="${Math.round(margin * 0.45)}" y="${Math.round(margin * 0.45)}" width="${width - Math.round(margin * 0.9)}" height="${height - Math.round(margin * 0.9)}" rx="${Math.max(12, spec.cardRadiusPx)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="2" />`
      : "";

  const panelRadius = Math.max(14, spec.cardRadiusPx);

  const containerSurfaceMarkup =
    spec.compositionTemplate === "editorial_split"
      ? `
        <defs>
          <linearGradient id="editorialBottomScrim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#090D16" stop-opacity="0.0" />
            <stop offset="32%" stop-color="#090D16" stop-opacity="0.58" />
            <stop offset="100%" stop-color="#090D16" stop-opacity="0.86" />
          </linearGradient>
        </defs>
        <rect x="0" y="${panelY - Math.round(panelH * 0.14)}" width="${width}" height="${Math.round(panelH * 1.14)}" fill="url(#editorialBottomScrim)" />
        <line x1="0" y1="${height - 5}" x2="${width}" y2="${height - 5}" stroke="${spec.accentColor}" stroke-width="10" />
      `
      : `<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="${panelRadius}" fill="${cardFillHex}" fill-opacity="${isExplicitLightCard ? "0.94" : "0.84"}" stroke="${spec.accentColor}" stroke-opacity="0.55" stroke-width="1.5" />`;

  const initials = spec.brandName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Clean light/glass plate behind uploaded logo so dark or colored logos are always crisp
  const fallbackLogoMarkup = hasUploadedLogoImage
    ? `<rect x="${logoCoords.x}" y="${logoCoords.y}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="#FFFFFF" fill-opacity="0.94" stroke="${spec.accentColor}" stroke-width="2" />`
    : `
      <g>
        <rect x="${logoCoords.x}" y="${logoCoords.y}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="#090D16" fill-opacity="0.82" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="1.5" />
        <circle cx="${logoCoords.x + Math.round(badgeHeight / 2)}" cy="${logoCoords.y + Math.round(badgeHeight / 2)}" r="${Math.round((badgeHeight - 16) / 2)}" fill="${spec.accentColor}" />
        <text x="${logoCoords.x + Math.round(badgeHeight / 2)}" y="${logoCoords.y + Math.round(badgeHeight * 0.61)}" text-anchor="middle" fill="${spec.ctaText}" font-family="${escapeXml(spec.headingFont)}" font-size="${Math.round(badgeHeight * 0.34)}" font-weight="700">${escapeXml(initials)}</text>
        <text x="${logoCoords.x + badgeHeight + 2}" y="${logoCoords.y + Math.round(badgeHeight * 0.60)}" fill="#FFFFFF" font-family="${escapeXml(spec.bodyFont)}" font-size="${Math.round(badgeHeight * 0.32)}" font-weight="600">${escapeXml(spec.brandName.slice(0, 18))}</text>
      </g>
    `;

  const supportiveMarkup = buildSupportiveGraphicsMarkup({
    width,
    height,
    margin,
    spec,
    logoCoords,
    badgeHeight,
  });

  const headlineColor =
    spec.compositionTemplate === "editorial_split" ? "#FFFFFF" : headingColorHex;
  const subColor =
    spec.compositionTemplate === "editorial_split" ? "#E2E8F0" : subtitleColorHex;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${minimalPerimeterFrame}
      ${supportiveMarkup}
      ${containerSurfaceMarkup}
      <rect x="${accentBarX}" y="${accentBarY}" width="${accentBarW}" height="5" rx="2.5" fill="${spec.accentColor}" />
      <text fill="${headlineColor}" font-family="${escapeXml(spec.headingFont)}" font-size="${baseHeadingPx}" font-weight="${spec.headingWeight}" text-anchor="${textAnchor}">
        ${titleSpans}
      </text>
      <text fill="${subColor}" font-family="${escapeXml(spec.bodyFont)}" font-size="${bodyPx}" font-weight="500" text-anchor="${textAnchor}">
        ${bodySpans}
      </text>
      ${fallbackLogoMarkup}
    </svg>
  `;

  return {
    svg,
    logoBox: {
      x: logoCoords.x + 16,
      y: logoCoords.y + 8,
      width: badgeWidth - 32,
      height: badgeHeight - 16,
    },
  };
}

export interface RenderCreativeInput {
  workspaceId: string;
  creativeKey: string;
  brand: Brand;
  brandKit: BrandKit;
  width: number;
  height: number;
  safeMarginPx?: number;
  variationIndex: 1 | 2 | 3;
  backgroundBuffer: Buffer;
  layoutOverrides?: Partial<LayoutOverrides>;
  textOverrides: TextOverrides;
}

export interface RenderedCreativeAssets {
  backgroundAssetPath: string;
  renderedPngPath: string;
  renderedWebpPath: string;
  pngBuffer: Buffer;
  webpBuffer: Buffer;
  validatedSpec: ValidatedRenderSpec;
}

export async function renderDeterministicCreative(
  input: RenderCreativeInput
): Promise<RenderedCreativeAssets> {
  const validatedSpec = enforceBrandConsistency({
    brand: input.brand,
    brandKit: input.brandKit,
    variationIndex: input.variationIndex,
    layoutOverrides: input.layoutOverrides,
    textOverrides: input.textOverrides,
  });

  let logoBuffer: Buffer | null = null;
  if (input.brand.logoAssetPath && fs.existsSync(input.brand.logoAssetPath)) {
    logoBuffer = fs.readFileSync(input.brand.logoAssetPath);
  } else if (input.brand.logoDataUrl?.startsWith("data:image/")) {
    const base64Part = input.brand.logoDataUrl.split(",")[1];
    if (base64Part) {
      logoBuffer = Buffer.from(base64Part, "base64");
    }
  }

  const { svg, logoBox } = buildDeterministicOverlaySvg({
    width: input.width,
    height: input.height,
    safeMarginPx: input.safeMarginPx ?? 72,
    spec: validatedSpec,
    hasUploadedLogoImage: Boolean(logoBuffer),
  });

  const compositeLayers: sharp.OverlayOptions[] = [
    {
      input: Buffer.from(svg),
      top: 0,
      left: 0,
    },
  ];

  if (logoBuffer) {
    try {
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoBox.width, logoBox.height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      compositeLayers.push({
        input: resizedLogo,
        left: logoBox.x,
        top: logoBox.y,
      });
    } catch {
      // Fallback badge remains visible
    }
  }

  const baseImage = sharp(input.backgroundBuffer).resize(input.width, input.height, {
    fit: "cover",
    position: "centre",
  });

  const pngBuffer = await baseImage
    .clone()
    .composite(compositeLayers)
    .png({ compressionLevel: 8 })
    .toBuffer();

  const webpBuffer = await sharp(pngBuffer).webp({ quality: 92 }).toBuffer();

  const outDir = ensureWorkspaceStorageDir(input.workspaceId, "creatives");
  const safeKey = input.creativeKey.replace(/[^a-zA-Z0-9_-]/g, "");
  const backgroundAssetPath = path.join(outDir, `${safeKey}-bg.png`);
  const renderedPngPath = path.join(outDir, `${safeKey}.png`);
  const renderedWebpPath = path.join(outDir, `${safeKey}.webp`);

  fs.writeFileSync(backgroundAssetPath, input.backgroundBuffer);
  fs.writeFileSync(renderedPngPath, pngBuffer);
  fs.writeFileSync(renderedWebpPath, webpBuffer);

  return {
    backgroundAssetPath,
    renderedPngPath,
    renderedWebpPath,
    pngBuffer,
    webpBuffer,
    validatedSpec,
  };
}
