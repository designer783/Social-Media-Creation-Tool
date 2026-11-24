import { getContrastRatio, normalizeHexColor, pickAccessibleTextColor } from "@/lib/utils";
import { detectTopicFromContent } from "@/lib/extractor/website-extractor";
import type {
  Brand,
  BrandKit,
  CompositionTemplate,
  LayoutOverrides,
  SupportiveGraphicStyle,
  TextOverrides,
} from "@/types/domain";

export interface ValidatedRenderSpec {
  brandName: string;
  domain: string;
  surfaceBg: string;
  surfaceText: string;
  mutedText: string;
  accentColor: string;
  ctaBg: string;
  ctaText: string;
  ctaRadiusPx: number;
  cardRadiusPx: number;
  headingFont: string;
  bodyFont: string;
  headingWeight: 500 | 600 | 700;
  headingScaleMultiplier: number;
  spacingMultiplier: number;
  logoPlacement: LayoutOverrides["logoPlacement"];
  textAlignment: "left" | "center";
  postTitle: string;
  supportingCopy: string;
  ctaLabel: string;
  compositionTemplate: CompositionTemplate;
  supportiveGraphicStyle: SupportiveGraphicStyle;
  supportiveBadgeText: string;
  showSupportiveElements: boolean;
}

export function getVariationTemplate(variationIndex: 1 | 2 | 3): CompositionTemplate {
  if (variationIndex === 1) return "editorial_split";
  if (variationIndex === 2) return "bold_hero";
  return "minimal_card";
}

export function getDefaultLayoutOverrides(
  brandKit: BrandKit,
  variationIndex: 1 | 2 | 3
): LayoutOverrides {
  return {
    logoPlacement: brandKit.visualStyle.logoPlacementDefault ?? "top-left",
    textAlignment: variationIndex === 3 ? "center" : "left",
    headingScaleMultiplier: 1.0,
    headingWeight: 700,
    spacingMultiplier: 1.0,
    surfaceMode:
      variationIndex === 1
        ? "dark"
        : variationIndex === 2
          ? "light"
          : "primary",
    supportiveGraphicStyle: "auto_topic",
    showSupportiveElements: true,
  };
}

function defaultBadgeLabelForTopic(
  style: SupportiveGraphicStyle,
  brandKit: BrandKit,
  postTitle: string
): string {
  if (style === "vehicle_showcase") return "FEATURED VEHICLE";
  if (style === "product_spotlight") return "PRODUCT SPOTLIGHT";
  if (style === "promo_badges") return "LIMITED OFFER";
  if (style === "domain_images") return "OFFICIAL FEATURE";

  const topic =
    brandKit.extractionMeta.detectedTopic ??
    detectTopicFromContent(`${brandKit.extractionMeta.sourceUrl} ${postTitle}`);

  switch (topic) {
    case "automotive_vehicle":
      return "VEHICLE SHOWCASE";
    case "real_estate":
      return "FEATURED PROPERTY";
    case "food_beverage":
      return "SIGNATURE SELECTION";
    case "fashion_beauty":
      return "NEW COLLECTION";
    case "technology_saas":
      return "PLATFORM SPOTLIGHT";
    case "product_ecommerce":
      return "FEATURED RELEASE";
    default:
      return "OFFICIAL UPDATE";
  }
}

export function enforceBrandConsistency(input: {
  brand: Brand;
  brandKit: BrandKit;
  variationIndex: 1 | 2 | 3;
  layoutOverrides?: Partial<LayoutOverrides>;
  textOverrides: TextOverrides;
}): ValidatedRenderSpec {
  const { brand, brandKit, variationIndex, textOverrides } = input;
  if (brandKit.brandId !== brand.id || brandKit.workspaceId !== brand.workspaceId) {
    throw new Error(
      "Brand Consistency Violation: Brand Kit does not belong to the selected Brand and Workspace."
    );
  }

  const defaults = getDefaultLayoutOverrides(brandKit, variationIndex);
  const mergedLayout: LayoutOverrides = {
    ...defaults,
    ...(input.layoutOverrides ?? {}),
  };

  const headingScaleMultiplier = Math.max(
    0.85,
    Math.min(1.25, Number(mergedLayout.headingScaleMultiplier) || 1.0)
  );
  const spacingMultiplier = Math.max(
    0.85,
    Math.min(1.25, Number(mergedLayout.spacingMultiplier) || 1.0)
  );
  const allowedWeights: Array<500 | 600 | 700> = [500, 600, 700];
  const headingWeight = allowedWeights.includes(mergedLayout.headingWeight)
    ? mergedLayout.headingWeight
    : 700;

  const approvedPalette = new Set(
    [
      brandKit.colors.primary,
      brandKit.colors.accent,
      brandKit.colors.backgroundLight,
      brandKit.colors.backgroundDark,
      ...brandKit.colors.secondary,
    ]
      .map((c) => normalizeHexColor(c))
      .filter((c): c is string => Boolean(c))
  );

  let accentColor = normalizeHexColor(brandKit.colors.accent) ?? "#2563EB";
  if (mergedLayout.accentColorOverride) {
    const candidate = normalizeHexColor(mergedLayout.accentColorOverride);
    if (candidate && approvedPalette.has(candidate)) {
      accentColor = candidate;
    }
  }

  let surfaceBg = brandKit.colors.backgroundDark;
  if (mergedLayout.surfaceMode === "light") {
    surfaceBg = brandKit.colors.backgroundLight;
  } else if (mergedLayout.surfaceMode === "primary") {
    surfaceBg = brandKit.colors.primary;
  }

  const surfaceText = pickAccessibleTextColor(surfaceBg);
  const mutedText = surfaceText === "#FFFFFF" ? "#CBD5E1" : "#334155";

  const ctaBg = accentColor;
  const ctaText =
    getContrastRatio(ctaBg, brandKit.visualStyle.ctaStyle.textColor) >= 4.5
      ? brandKit.visualStyle.ctaStyle.textColor
      : pickAccessibleTextColor(ctaBg);

  const ctaShape = brandKit.visualStyle.ctaStyle.shape;
  const ctaRadiusPx = ctaShape === "pill" ? 999 : ctaShape === "sharp" ? 2 : 10;
  const cardRadiusPx = Math.max(0, Math.min(28, brandKit.visualStyle.borderRadiusPx));

  const cleanFont = (font: string) =>
    font.replace(/["'<>]/g, "").trim() || "Inter, sans-serif";

  const supportiveGraphicStyle = mergedLayout.supportiveGraphicStyle ?? "auto_topic";
  const postTitle = textOverrides.postTitle.trim() || brand.name;
  const supportiveBadgeText =
    mergedLayout.supportiveBadgeText?.trim() ||
    defaultBadgeLabelForTopic(supportiveGraphicStyle, brandKit, postTitle);

  return {
    brandName: brand.name,
    domain: brand.domain,
    surfaceBg,
    surfaceText,
    mutedText,
    accentColor,
    ctaBg,
    ctaText,
    ctaRadiusPx,
    cardRadiusPx,
    headingFont: cleanFont(brandKit.typography.headingFont),
    bodyFont: cleanFont(brandKit.typography.bodyFont),
    headingWeight,
    headingScaleMultiplier,
    spacingMultiplier,
    logoPlacement: mergedLayout.logoPlacement,
    textAlignment: mergedLayout.textAlignment,
    postTitle,
    supportingCopy: textOverrides.supportingCopy.trim(),
    ctaLabel: textOverrides.ctaText.trim() || `Visit ${brand.domain}`,
    compositionTemplate: getVariationTemplate(variationIndex),
    supportiveGraphicStyle,
    supportiveBadgeText,
    showSupportiveElements: mergedLayout.showSupportiveElements !== false,
  };
}
