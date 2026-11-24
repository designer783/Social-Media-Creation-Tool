import sharp from "sharp";
import { validateSafePublicUrl } from "@/lib/extractor/ssrf-guard";
import { analyzeWebsiteWithGemini } from "@/lib/ai/gemini-service";
import {
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  normalizeHexColor,
  pickAccessibleTextColor,
} from "@/lib/utils";
import type {
  BrandColors,
  BrandTypography,
  BrandVisualStyle,
  CtaShape,
  DesignCharacteristic,
  DetectedTopicCategory,
  ExtractionMetadata,
} from "@/types/domain";

export interface ExtractedBrandIdentity {
  colors: BrandColors;
  typography: BrandTypography;
  visualStyle: BrandVisualStyle;
  extractionMeta: ExtractionMetadata;
}

const IGNORED_GENERIC_HEX = new Set([
  "#000000",
  "#FFFFFF",
  "#CCCCCC",
  "#DDDDDD",
  "#EEEEEE",
  "#F5F5F5",
  "#333333",
  "#666666",
  "#999999",
  "#808080",
]);

function colorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 999;
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  );
}

function rgbStringToHex(match: string): string | null {
  const nums = match.match(/\d+/g);
  if (!nums || nums.length < 3) return null;
  const [r, g, b] = nums
    .slice(0, 3)
    .map((n) => Math.min(255, Math.max(0, parseInt(n, 10))));
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, ":")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    });
}

export function detectTopicFromContent(text: string): DetectedTopicCategory {
  const lower = text.toLowerCase();

  const vehicleKeywords = [
    /\bcar\b/,
    /\bcars\b/,
    /\bvehicle\b/,
    /\bvehicles\b/,
    /\bauto\b/,
    /\bautomotive\b/,
    /\bsuv\b/,
    /\bsedan\b/,
    /\btruck\b/,
    /\bmotor\b/,
    /\bmotors\b/,
    /\bdealership\b/,
    /\bfleet\b/,
    /\bleasing\b/,
    /\brent a car\b/,
    /\bcar rental\b/,
    /\bchauffeur\b/,
    /\bdetailing\b/,
    /\bshowroom\b/,
    /\bhorsepower\b/,
    /\belectric vehicle\b/,
    /\bsupercar\b/,
  ];
  if (vehicleKeywords.some((rx) => rx.test(lower))) {
    return "automotive_vehicle";
  }

  const realEstateKeywords = [
    /\breal estate\b/,
    /\bproperty\b/,
    /\bproperties\b/,
    /\bapartment\b/,
    /\bvilla\b/,
    /\bmortgage\b/,
    /\brealtor\b/,
    /\barchitecture\b/,
  ];
  if (realEstateKeywords.some((rx) => rx.test(lower))) {
    return "real_estate";
  }

  const foodKeywords = [
    /\bcoffee\b/,
    /\bespresso\b/,
    /\brestaurant\b/,
    /\bcafe\b/,
    /\bbakery\b/,
    /\broast\b/,
    /\broastery\b/,
    /\bdining\b/,
    /\bbeverage\b/,
  ];
  if (foodKeywords.some((rx) => rx.test(lower))) {
    return "food_beverage";
  }

  const fashionKeywords = [
    /\bfashion\b/,
    /\bapparel\b/,
    /\bwatch\b/,
    /\btimepiece\b/,
    /\bchrono\b/,
    /\bjewelry\b/,
    /\bskincare\b/,
    /\bbeauty\b/,
  ];
  if (fashionKeywords.some((rx) => rx.test(lower))) {
    return "fashion_beauty";
  }

  const techKeywords = [
    /\bcloud\b/,
    /\bsoftware\b/,
    /\bsaas\b/,
    /\bcyber\b/,
    /\bsecurity\b/,
    /\banalytics\b/,
    /\bautomation\b/,
    /\bplatform\b/,
  ];
  if (techKeywords.some((rx) => rx.test(lower))) {
    return "technology_saas";
  }

  const productKeywords = [
    /\bshop\b/,
    /\bstore\b/,
    /\bcollection\b/,
    /\baudio\b/,
    /\bfootwear\b/,
    /\bproduct\b/,
  ];
  if (productKeywords.some((rx) => rx.test(lower))) {
    return "product_ecommerce";
  }

  return "general_business";
}

export function extractDomainImagesFromHtml(
  sourceUrl: string,
  html: string,
  cssText = ""
): string[] {
  const discovered: string[] = [];

  const pushCandidate = (rawUrl: string | undefined) => {
    if (!rawUrl) return;
    const cleaned = rawUrl
      .replace(/&amp;/gi, "&")
      .replace(/^['"]|['"]$/g, "")
      .trim();
    if (!cleaned || cleaned.startsWith("data:")) return;

    const lower = cleaned.toLowerCase();
    if (
      lower.includes("favicon") ||
      lower.includes("sprite") ||
      lower.includes("pixel") ||
      lower.includes("tracker") ||
      lower.includes("analytics") ||
      lower.includes("1x1") ||
      lower.endsWith(".svg") ||
      lower.endsWith(".ico") ||
      lower.endsWith(".gif")
    ) {
      return;
    }

    try {
      const resolved = new URL(cleaned, sourceUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
      const full = resolved.toString();
      if (!discovered.includes(full)) {
        discovered.push(full);
      }
    } catch {
      // Ignore malformed URLs
    }
  };

  // 1. OpenGraph and Twitter Card images (highest relevance)
  const metaImageRegex =
    /<meta[^>]+(?:property|name|itemprop)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src|image)["'][^>]+content=["']([^"']+)["']/gi;
  let mMatch: RegExpExecArray | null;
  while ((mMatch = metaImageRegex.exec(html)) !== null) {
    pushCandidate(mMatch[1]);
  }

  // Also check reversed attribute order (<meta content="..." property="og:image">)
  const revMetaImageRegex =
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
  let rmMatch: RegExpExecArray | null;
  while ((rmMatch = revMetaImageRegex.exec(html)) !== null) {
    pushCandidate(rmMatch[1]);
  }

  // 2. Prominent <img> tags (src, data-src)
  const imgTagRegex = /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    const fullTag = imgMatch[0].toLowerCase();
    if (fullTag.includes('width="1"') || fullTag.includes('height="1"')) continue;
    pushCandidate(imgMatch[1]);
    if (discovered.length >= 8) break;
  }

  // 3. CSS background-image URLs
  const bgUrlRegex = /background(?:-image)?\s*:[^;}{]*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  const combined = `${html}\n${cssText}`;
  let bgMatch: RegExpExecArray | null;
  while ((bgMatch = bgUrlRegex.exec(combined)) !== null && discovered.length < 8) {
    pushCandidate(bgMatch[1]);
  }

  return discovered.slice(0, 8);
}

export async function extractLogoDominantColors(logoBuffer: Buffer): Promise<string[]> {
  try {
    const { data, info } = await sharp(logoBuffer)
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 128) continue;

      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      const hex = `#${[qr, qg, qb]
        .map((v) => Math.min(255, v).toString(16).padStart(2, "0").toUpperCase())
        .join("")}`;

      if (IGNORED_GENERIC_HEX.has(hex)) continue;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }

    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([hex]) => hex);

    const distinct: string[] = [];
    for (const hex of sorted) {
      if (distinct.every((existing) => colorDistance(existing, hex) > 36)) {
        distinct.push(hex);
      }
      if (distinct.length >= 4) break;
    }
    return distinct;
  } catch {
    return [];
  }
}

export function analyzeHtmlAndCssForBrand(input: {
  sourceUrl: string;
  html: string;
  cssText?: string;
  logoColors?: string[];
}): ExtractedBrandIdentity {
  const combinedSource = `${input.html}\n${input.cssText ?? ""}`;
  const colorScores = new Map<string, number>();

  const bumpColor = (rawHex: string | null, weight: number) => {
    if (!rawHex) return;
    const normalized = normalizeHexColor(rawHex);
    if (!normalized) return;
    colorScores.set(normalized, (colorScores.get(normalized) ?? 0) + weight);
  };

  // 1. High-signal theme-color meta tag
  const themeColorMatch = input.html.match(
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
  );
  if (themeColorMatch?.[1]) {
    bumpColor(themeColorMatch[1], 25);
  }

  // 2. High-signal CSS custom properties (--primary, --brand, --accent, --color-*)
  const cssVarRegex =
    /--(?:[a-z0-9-]*?(?:primary|brand|accent|main|theme|cta|action)[a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/gi;
  let varMatch: RegExpExecArray | null;
  while ((varMatch = cssVarRegex.exec(combinedSource)) !== null) {
    const rawVal = varMatch[1];
    const hex = rawVal.startsWith("rgb")
      ? rgbStringToHex(rawVal)
      : normalizeHexColor(rawVal);
    bumpColor(hex, 18);
  }

  // 3. General hex colors in stylesheets & inline styles
  const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexRegex.exec(combinedSource)) !== null) {
    const hex = normalizeHexColor(hexMatch[0]);
    if (hex && !IGNORED_GENERIC_HEX.has(hex)) {
      bumpColor(hex, 2);
    }
  }

  // 4. General rgb(...) colors
  const rgbRegex = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi;
  let rgbMatch: RegExpExecArray | null;
  while ((rgbMatch = rgbRegex.exec(combinedSource)) !== null) {
    const hex = rgbStringToHex(rgbMatch[0]);
    if (hex && !IGNORED_GENERIC_HEX.has(hex)) {
      bumpColor(hex, 2);
    }
  }

  // 5. Logo dominant colors boost
  for (const [idx, logoHex] of (input.logoColors ?? []).entries()) {
    bumpColor(logoHex, idx === 0 ? 22 : 14);
  }

  // Cluster similar colors and rank recurring brand palette
  const rankedColors = [...colorScores.entries()]
    .filter(([hex]) => !IGNORED_GENERIC_HEX.has(hex))
    .sort((a, b) => b[1] - a[1]);

  const clusteredPalette: string[] = [];
  for (const [hex] of rankedColors) {
    if (clusteredPalette.every((existing) => colorDistance(existing, hex) > 32)) {
      clusteredPalette.push(hex);
    }
    if (clusteredPalette.length >= 6) break;
  }

  const primary = clusteredPalette[0] ?? "#0F172A";
  const accent =
    clusteredPalette.find(
      (c, idx) => idx > 0 && getContrastRatio(c, "#FFFFFF") >= 3.0
    ) ??
    clusteredPalette[1] ??
    "#2563EB";
  const secondary =
    clusteredPalette.length > 2
      ? clusteredPalette.slice(1, 4)
      : [clusteredPalette[1] ?? "#334155", "#CBD5E1"];

  const primaryLum = getRelativeLuminance(primary);
  const backgroundDark = primaryLum < 0.18 ? primary : "#0F172A";
  const backgroundLight = "#F8FAFC";

  const colors: BrandColors = {
    primary,
    secondary,
    accent,
    backgroundLight,
    backgroundDark,
    textOnLight: pickAccessibleTextColor(backgroundLight),
    textOnDark: pickAccessibleTextColor(backgroundDark),
  };

  // Typography extraction (Google Fonts v1/v2 + font-family declarations)
  const detectedFonts: string[] = [];
  const googleFontLinkRegex = /fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi;
  let gfMatch: RegExpExecArray | null;
  while ((gfMatch = googleFontLinkRegex.exec(combinedSource)) !== null) {
    const query = gfMatch[1].replace(/&amp;/gi, "&");
    const familyParams = query.matchAll(/(?:^|[?&])family=([^&]+)/gi);
    for (const famParam of familyParams) {
      const rawFamilies = decodeURIComponent(famParam[1]).split("|");
      for (const fam of rawFamilies) {
        const cleanName = fam.split(":")[0].replace(/\+/g, " ").trim();
        if (cleanName && !detectedFonts.includes(cleanName)) {
          detectedFonts.push(cleanName);
        }
      }
    }
  }

  const fontFamilyRegex = /font-family\s*:\s*([^;}{]+)/gi;
  let ffMatch: RegExpExecArray | null;
  while ((ffMatch = fontFamilyRegex.exec(combinedSource)) !== null) {
    const firstFont = ffMatch[1]
      .split(",")[0]
      .replace(/["']/g, "")
      .trim();
    if (
      firstFont &&
      !firstFont.startsWith("var(") &&
      !["inherit", "initial", "sans-serif", "serif", "monospace", "system-ui"].includes(
        firstFont.toLowerCase()
      ) &&
      !detectedFonts.includes(firstFont)
    ) {
      detectedFonts.push(firstFont);
    }
  }

  const headingFont = detectedFonts[0]
    ? `${detectedFonts[0]}, sans-serif`
    : "Inter, sans-serif";
  const bodyFont = detectedFonts[1]
    ? `${detectedFonts[1]}, sans-serif`
    : headingFont;

  const typography: BrandTypography = {
    headingFont,
    bodyFont,
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    scaleRatio: 1.25,
  };

  // Border-radius & button style analysis
  const radiusRegex = /border-radius\s*:\s*(\d+)px/gi;
  const radii: number[] = [];
  let rMatch: RegExpExecArray | null;
  while ((rMatch = radiusRegex.exec(combinedSource)) !== null) {
    const val = parseInt(rMatch[1], 10);
    if (!Number.isNaN(val) && val <= 9999) {
      radii.push(val);
    }
  }

  const avgRadius =
    radii.length > 0
      ? Math.round(radii.reduce((acc, v) => acc + Math.min(v, 32), 0) / radii.length)
      : 8;

  let ctaShape: CtaShape = "rounded";
  if (radii.some((r) => r >= 24) || avgRadius >= 16) {
    ctaShape = "pill";
  } else if (avgRadius <= 2) {
    ctaShape = "sharp";
  }

  // Classify design characteristic
  let characteristic: DesignCharacteristic = "modern";
  const lowerFont = headingFont.toLowerCase();
  if (
    lowerFont.includes("playfair") ||
    lowerFont.includes("georgia") ||
    lowerFont.includes("cormorant") ||
    lowerFont.includes("serif")
  ) {
    characteristic = "premium";
  } else if (ctaShape === "sharp" && avgRadius <= 2) {
    characteristic = "minimal";
  } else if (getContrastRatio(accent, "#FFFFFF") >= 5.5) {
    characteristic = "corporate";
  }

  // Extract factual page metadata (for website-grounded content generation)
  const titleMatch = input.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = decodeHtmlEntities(titleMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const descMatch =
    input.html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    ) ??
    input.html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    );
  const pageDescription = decodeHtmlEntities(descMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const extractedHeadings: string[] = [];
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingRegex.exec(input.html)) !== null) {
    const stripped = decodeHtmlEntities(hMatch[1].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (
      stripped.length >= 4 &&
      stripped.length <= 120 &&
      !extractedHeadings.includes(stripped)
    ) {
      extractedHeadings.push(stripped);
    }
    if (extractedHeadings.length >= 6) break;
  }

  const extractedImages = extractDomainImagesFromHtml(
    input.sourceUrl,
    input.html,
    input.cssText
  );

  const detectedTopic = detectTopicFromContent(
    [input.sourceUrl, pageTitle, pageDescription, ...extractedHeadings].join(" ")
  );

  const ctaTextColor = pickAccessibleTextColor(accent);

  const visualStyle: BrandVisualStyle = {
    characteristic,
    borderRadiusPx: ctaShape === "pill" ? 16 : ctaShape === "sharp" ? 2 : 8,
    spacingUnitPx: 8,
    logoPlacementDefault: "top-left",
    ctaStyle: {
      shape: ctaShape,
      treatment: "solid",
      backgroundColor: accent,
      textColor: ctaTextColor,
    },
    commonPatterns: [
      `${characteristic.charAt(0).toUpperCase() + characteristic.slice(1)} layout hierarchy`,
      `${ctaShape.charAt(0).toUpperCase() + ctaShape.slice(1)} CTA button geometry`,
      `Topic: ${detectedTopic.replace("_", " ")}`,
    ],
  };

  return {
    colors,
    typography,
    visualStyle,
    extractionMeta: {
      sourceUrl: input.sourceUrl,
      extractedAt: new Date().toISOString(),
      fallbackUsed: false,
      pageTitle,
      pageDescription,
      extractedHeadings,
      extractedImages,
      detectedTopic,
      detectedColorsCount: clusteredPalette.length,
      detectedFontsCount: detectedFonts.length || 1,
    },
  };
}

export function buildFallbackBrandIdentity(input: {
  sourceUrl: string;
  brandName: string;
  reason: string;
  logoColors?: string[];
}): ExtractedBrandIdentity {
  const primary = input.logoColors?.[0] ?? "#0F172A";
  const accent = input.logoColors?.[1] ?? "#2563EB";
  const secondary =
    input.logoColors && input.logoColors.length > 2
      ? input.logoColors.slice(1, 4)
      : ["#334155", "#CBD5E1"];

  const detectedTopic = detectTopicFromContent(
    `${input.sourceUrl} ${input.brandName}`
  );

  return {
    colors: {
      primary,
      secondary,
      accent,
      backgroundLight: "#F8FAFC",
      backgroundDark: "#0F172A",
      textOnLight: "#0F172A",
      textOnDark: "#FFFFFF",
    },
    typography: {
      headingFont: "Inter, sans-serif",
      bodyFont: "Inter, sans-serif",
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      scaleRatio: 1.25,
    },
    visualStyle: {
      characteristic: "modern",
      borderRadiusPx: 8,
      spacingUnitPx: 8,
      logoPlacementDefault: "top-left",
      ctaStyle: {
        shape: "rounded",
        treatment: "solid",
        backgroundColor: accent,
        textColor: pickAccessibleTextColor(accent),
      },
      commonPatterns: ["Manual fallback brand profile", "8pt baseline spacing"],
    },
    extractionMeta: {
      sourceUrl: input.sourceUrl,
      extractedAt: new Date().toISOString(),
      fallbackUsed: true,
      fallbackReason: input.reason,
      pageTitle: input.brandName,
      pageDescription: "",
      extractedHeadings: [input.brandName],
      extractedImages: [],
      detectedTopic,
      detectedColorsCount: input.logoColors?.length ?? 0,
      detectedFontsCount: 1,
    },
  };
}

export async function extractBrandFromWebsite(input: {
  websiteUrl: string;
  brandName: string;
  workspaceId?: string;
  userId?: string;
  logoBuffer?: Buffer;
  customDnsResolver?: (hostname: string) => Promise<string[]>;
  customFetch?: typeof fetch;
}): Promise<ExtractedBrandIdentity> {
  // Always validate SSRF before any network operation; SSRF errors must NOT be swallowed
  const safeUrl = await validateSafePublicUrl(input.websiteUrl, input.customDnsResolver);
  const logoColors = input.logoBuffer
    ? await extractLogoDominantColors(input.logoBuffer)
    : [];

  const fetchImpl = input.customFetch ?? fetch;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetchImpl(safeUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "SocialMediaStudioBrandAnalyzer/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return buildFallbackBrandIdentity({
        sourceUrl: safeUrl.toString(),
        brandName: input.brandName,
        reason: `Website returned HTTP ${response.status}. Manual adjustment fallback enabled.`,
        logoColors,
      });
    }

    const html = (await response.text()).slice(0, 500_000);

    // Fetch up to 2 same-origin or linked stylesheets for deeper color/typography extraction
    const cssChunks: string[] = [];
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
    let linkMatch: RegExpExecArray | null;
    let fetchedSheets = 0;
    while ((linkMatch = linkRegex.exec(html)) !== null && fetchedSheets < 2) {
      try {
        const cssUrl = new URL(linkMatch[1], safeUrl).toString();
        const safeCssUrl = await validateSafePublicUrl(cssUrl, input.customDnsResolver);
        const cssRes = await fetchImpl(safeCssUrl.toString(), {
          headers: { Accept: "text/css,*/*;q=0.1" },
        });
        if (cssRes.ok) {
          cssChunks.push((await cssRes.text()).slice(0, 200_000));
          fetchedSheets += 1;
        }
      } catch {
        // Ignore individual stylesheet fetch failure
      }
    }

    const baseIdentity = analyzeHtmlAndCssForBrand({
      sourceUrl: safeUrl.toString(),
      html,
      cssText: cssChunks.join("\n"),
      logoColors,
    });

    // Enhance brand extraction with Gemini 2.5 Flash + Search Grounding
    const geminiEnhancement = await analyzeWebsiteWithGemini({
      sourceUrl: safeUrl.toString(),
      brandName: input.brandName,
      pageTitle: baseIdentity.extractionMeta.pageTitle ?? "",
      pageDescription: baseIdentity.extractionMeta.pageDescription ?? "",
      headings: baseIdentity.extractionMeta.extractedHeadings ?? [],
      geminiContext: {
        workspaceId: input.workspaceId,
        userId: input.userId,
      },
    });

    if (geminiEnhancement) {
      baseIdentity.extractionMeta.detectedTopic = geminiEnhancement.detectedTopic;
      baseIdentity.visualStyle.characteristic = geminiEnhancement.characteristic;
      if (geminiEnhancement.extractedHeadings.length > 0) {
        baseIdentity.extractionMeta.extractedHeadings =
          geminiEnhancement.extractedHeadings;
      }
      if (
        !baseIdentity.extractionMeta.pageDescription &&
        geminiEnhancement.brandSummary
      ) {
        baseIdentity.extractionMeta.pageDescription =
          geminiEnhancement.brandSummary;
      }
    }

    return baseIdentity;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network connection failed";
    return buildFallbackBrandIdentity({
      sourceUrl: safeUrl.toString(),
      brandName: input.brandName,
      reason: `Automated access blocked or timed out (${message}). Manual brand setup activated.`,
      logoColors,
    });
  }
}
