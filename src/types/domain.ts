export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "pinterest"
  | "tiktok";

export type DesignCharacteristic =
  | "minimal"
  | "modern"
  | "premium"
  | "bold"
  | "corporate"
  | "editorial";

export type LogoPlacement =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center";

export type CtaShape = "sharp" | "rounded" | "pill";
export type CtaTreatment = "solid" | "outline" | "soft";

export type CompositionTemplate = "editorial_split" | "bold_hero" | "minimal_card";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type CampaignInputMode = "manual" | "ai_topic" | "website_grounded";

export type DetectedTopicCategory =
  | "automotive_vehicle"
  | "product_ecommerce"
  | "food_beverage"
  | "real_estate"
  | "technology_saas"
  | "fashion_beauty"
  | "general_business";

export type SupportiveGraphicStyle =
  | "auto_topic"
  | "domain_images"
  | "vehicle_showcase"
  | "product_spotlight"
  | "promo_badges"
  | "minimal_clean";

export type GeminiModelId =
  | "gemini_unified"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro";

export type GeminiConnectionScope = "user" | "workspace";
export type GeminiConnectionMode = "google_ai_studio" | "custom_endpoint";

export interface GeminiCapabilities {
  textGeneration: boolean;
  searchGrounding: boolean;
  visionAudit: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  embeddings: boolean;
  discoveredModels: string[];
  lastCheckedAt: string | null;
}

export interface GeminiConnectionSummary {
  id: string;
  workspaceId: string;
  userId: string;
  scope: GeminiConnectionScope;
  label: string;
  connectionMode: GeminiConnectionMode;
  endpointBaseUrl: string;
  textModel: string;
  imageModel: string;
  hasKey: boolean;
  keyLast4: string;
  isActive: boolean;
  capabilities: GeminiCapabilities;
  updatedAt: string;
}

export interface BrandColors {
  primary: string;
  secondary: string[];
  accent: string;
  backgroundLight: string;
  backgroundDark: string;
  textOnLight: string;
  textOnDark: string;
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
  weights: {
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  scaleRatio: number;
}

export interface BrandCtaStyle {
  shape: CtaShape;
  treatment: CtaTreatment;
  backgroundColor: string;
  textColor: string;
}

export interface BrandVisualStyle {
  characteristic: DesignCharacteristic;
  borderRadiusPx: number;
  spacingUnitPx: number;
  logoPlacementDefault: LogoPlacement;
  ctaStyle: BrandCtaStyle;
  commonPatterns: string[];
}

export interface ExtractionMetadata {
  sourceUrl: string;
  extractedAt: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  pageTitle?: string;
  pageDescription?: string;
  extractedHeadings?: string[];
  extractedImages?: string[];
  detectedTopic?: DetectedTopicCategory;
  detectedColorsCount: number;
  detectedFontsCount: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  settings: {
    defaultExportFormat: "png" | "webp" | "both";
    requireApprovalBeforeExport: boolean;
  };
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  role?: "admin" | "member";
  defaultWorkspaceId: string;
  createdAt: string;
}

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  domain: string;
  websiteUrl: string;
  logoAssetPath: string | null;
  logoDataUrl: string | null;
  activeKitId: string | null;
  status: "active" | "archived";
  createdAt: string;
}

export interface BrandKit {
  id: string;
  workspaceId: string;
  brandId: string;
  version: number;
  name: string;
  status: "draft" | "approved" | "archived";
  colors: BrandColors;
  typography: BrandTypography;
  visualStyle: BrandVisualStyle;
  extractionMeta: ExtractionMetadata;
  createdAt: string;
}

export interface PlatformPreset {
  id: string;
  workspaceId: string;
  platform: SocialPlatform;
  formatName: string;
  width: number;
  height: number;
  safeMarginPx: number;
  isActive: boolean;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  brandId: string;
  brandKitId: string;
  name: string;
  objective: string;
  inputMode: CampaignInputMode;
  topic: string;
  seoKeywords: string[];
  targetAudience: string;
  toneOfVoice: string;
  status: "draft" | "generating" | "review" | "approved" | "exported";
  createdAt: string;
}

export interface ContentItem {
  id: string;
  workspaceId: string;
  campaignId: string;
  platform: "shared" | SocialPlatform;
  postTitle: string;
  mainText: string;
  supportingCopy: string;
  caption: string;
  hashtags: string[];
  ctaText: string;
  referenceUrl: string;
  createdAt: string;
}

export interface LayoutOverrides {
  logoPlacement: LogoPlacement;
  textAlignment: "left" | "center";
  headingScaleMultiplier: number;
  headingWeight: 500 | 600 | 700;
  spacingMultiplier: number;
  surfaceMode: "light" | "dark" | "primary";
  accentColorOverride?: string;
  supportiveGraphicStyle?: SupportiveGraphicStyle;
  supportiveBadgeText?: string;
  selectedDomainImageUrl?: string;
  showSupportiveElements?: boolean;
  aiModel?: GeminiModelId;
}

export interface TextOverrides {
  postTitle: string;
  supportingCopy: string;
  ctaText: string;
  caption: string;
  hashtags: string[];
}

export interface CreativeVersion {
  id: string;
  workspaceId: string;
  creativeId: string;
  versionNumber: number;
  backgroundAssetPath: string;
  backgroundPrompt: string;
  providerUsed: string;
  layoutOverrides: LayoutOverrides;
  textOverrides: TextOverrides;
  renderedPngPath: string;
  renderedWebpPath: string;
  createdAt: string;
}

export interface Creative {
  id: string;
  workspaceId: string;
  campaignId: string;
  brandId: string;
  brandKitId: string;
  contentItemId: string;
  platform: SocialPlatform;
  formatName: string;
  width: number;
  height: number;
  variationIndex: 1 | 2 | 3;
  compositionTemplate: CompositionTemplate;
  approvalStatus: ApprovalStatus;
  currentVersionId: string;
  currentVersion?: CreativeVersion;
  versions?: CreativeVersion[];
  createdAt: string;
}

export interface ApprovalLog {
  id: string;
  workspaceId: string;
  creativeId: string;
  versionId: string;
  action: "approved" | "rejected" | "reset";
  actorName: string;
  note: string;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  workspaceId: string;
  campaignId: string;
  brandName: string;
  campaignName: string;
  format: "png" | "webp" | "both";
  zipAssetPath: string;
  fileCount: number;
  manifestPaths: string[];
  createdAt: string;
}

export interface AIProviderConfig {
  id: string;
  workspaceId: string;
  providerType: "image" | "text";
  providerKey: "gemini";
  displayName: string;
  endpointUrl: string;
  modelId: string;
  isEnabled: boolean;
  isPrimary: boolean;
  stats: {
    totalRequests: number;
    failedRequests: number;
    fallbackCount: number;
    estimatedCostUsd: number;
    lastUsedAt: string | null;
  };
}

export interface TrendSignal {
  id: string;
  workspaceId: string;
  brandId: string;
  signalType: "trend_topic" | "website_change" | "competitor_gap" | "seasonal_hook";
  title: string;
  summary: string;
  suggestedHeadline: string;
  seoKeywords: string[];
  sourceUrls: string[];
  relevanceScore: number;
  status: "new" | "launched" | "dismissed";
  createdAt: string;
}

export interface CreativeAudit {
  id: string;
  workspaceId: string;
  creativeId: string;
  versionId: string;
  overallScore: number;
  legibilityScore: number;
  brandConsistencyScore: number;
  visualAppealScore: number;
  strengths: string[];
  recommendations: string[];
  suggestedHeadline?: string;
  auditedByModel: string;
  createdAt: string;
}

export interface SocialPostTracker {
  id: string;
  workspaceId: string;
  creativeId: string;
  brandId: string;
  campaignId: string;
  platform: SocialPlatform;
  trackingStatus: "planned" | "scheduled" | "published" | "archived";
  scheduledFor: string;
  publishedUrl: string;
  utmTag: string;
  impressions: number;
  clicks: number;
  engagements: number;
  notes: string;
  updatedAt: string;
}

export type MediaApiCapability = "image" | "video" | "both";
export type MediaProviderPreset =
  | "openai_compatible"
  | "fal_ai"
  | "replicate"
  | "gemini"
  | "cloudflare_ai"
  | "huggingface"
  | "pollinations"
  | "custom_http";

export interface MediaApiConnectionSummary {
  id: string;
  workspaceId: string;
  userId: string;
  scope: GeminiConnectionScope;
  capability: MediaApiCapability;
  providerPreset: MediaProviderPreset;
  label: string;
  endpointUrl: string;
  modelId: string;
  accountId: string;
  authHeaderName: string;
  authPrefix: string;
  hasKey: boolean;
  keyLast4: string;
  isActive: boolean;
  updatedAt: string;
}

export interface VideoGeneration {
  id: string;
  workspaceId: string;
  brandId: string;
  creativeId: string | null;
  platform: SocialPlatform;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  prompt: string;
  providerUsed: string;
  modelId: string;
  videoAssetPath: string;
  mimeType: string;
  status: "completed" | "failed";
  createdAt: string;
}

export interface DashboardMetrics {
  totalBrands: number;
  totalCampaigns: number;
  totalCreatives: number;
  pendingApprovals: number;
  approvedCreatives: number;
  completedExports: number;
  activeRadarSignals: number;
  trackedPostsCount: number;
}

// PRD Section 6-14 Domain Types for Storyboard, Flow Companion & Consistency Lock
export type VideoProjectStatus = "draft" | "storyboard_ready" | "storyboard_approved" | "generating" | "completed";
export type StoryboardApprovalStatus = "draft" | "submitted" | "approved" | "rejected";
export type SceneStatus = "draft" | "ready" | "approved" | "generating" | "generated" | "rejected";
export type ReferenceEntityType = "character" | "product" | "vehicle" | "brand" | "wardrobe" | "environment" | "prop" | "custom";
export type MediaAssetProvider = "google_flow" | "gemini_api" | "veo_api" | "huggingface" | "fal_ai" | "replicate" | "uploaded" | "local_generated";

export interface ReferenceEntity {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  name: string;
  type: ReferenceEntityType;
  imageUrl?: string | null;
  userApprovedDescription: string;
  distinguishingAttributes: string[];
  colorDetails?: string;
  continuityRules: string;
  exclusions?: string;
  isLocked: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardScene {
  id: string;
  storyboardId: string;
  sceneNumber: number;
  title: string;
  durationSeconds: number;
  narrativePurpose: string;
  visualDescription: string;
  subjects: string;
  environment: string;
  cameraFraming: string;
  cameraMovement: string;
  lighting: string;
  mood: string;
  voiceover: string;
  dialogue?: string;
  onScreenText?: string;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt?: string;
  transition?: string;
  referenceImageId?: string | null;
  referenceImageUrl?: string | null;
  status: SceneStatus;
  version: number;
  assignedReferenceIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  id: string;
  videoProjectId: string;
  version: number;
  status: StoryboardApprovalStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  scenes: StoryboardScene[];
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoProjectBrief {
  id: string;
  workspaceId: string;
  brandId: string;
  name: string;
  campaignObjective: string;
  productOrService: string;
  targetAudience: string;
  platform: SocialPlatform;
  desiredDurationSeconds: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
  language: string;
  visualStyle: string;
  creativeDirection: string;
  voiceoverPreference: string;
  callToAction: string;
  status: VideoProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FlowCompanionPackage {
  sceneId: string;
  sceneNumber: number;
  title: string;
  durationSeconds: number;
  aspectRatio: string;
  composedPrompt: string;
  negativePrompt: string;
  continuityNotes: string[];
  attachedReferences: {
    name: string;
    type: string;
    rules: string;
  }[];
  flowUrl: string;
}

export interface FlowCreditSnapshot {
  id: string;
  workspaceId: string;
  planLabel: string;
  monthlyAllocation: number;
  dailyAllocation: number;
  billingResetDate: string;
  userEnteredBalance: number;
  estimatedCostPerGeneration: number;
  lastUpdated: string;
  notes?: string;
}

export interface MediaAsset {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  sceneId?: string | null;
  assetType: "image" | "video" | "audio" | "reference";
  provider: MediaAssetProvider;
  modelId: string;
  prompt: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  approvalStatus: ApprovalStatus;
  version: number;
  createdAt: string;
}

export type McpTransportType = "sse" | "streamable_http" | "stdio";

export interface McpConnectionSummary {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  transportType: McpTransportType;
  serverUrl: string;
  command: string;
  args: string[];
  envKeys: string[];
  hasAuthToken: boolean;
  tokenLast4: string;
  isActive: boolean;
  status: "connected" | "disconnected" | "error";
  discoveredTools: string[];
  lastCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PRD Section 4: Blog Studio Domain Types
// ============================================================================

export interface BlogImageDimensionPreset {
  id: string;
  workspaceId: string;
  formatName: string;
  width: number;
  height: number;
  usageDescription: string;
  isActive: boolean;
}

export interface BlogSeoKeywords {
  primaryKeyword: string;
  secondaryKeywords: string[];
  supportingKeywords: string[];
}

export interface BlogGroundedSource {
  title: string;
  url: string;
  associatedClaim: string;
  verifiedFromGrounding: boolean;
}

export interface BlogResearchStrategy {
  primarySearchIntent: string;
  secondarySearchIntent: string;
  mainKeyword: string;
  relatedKeywords: string[];
  semanticVariations: string[];
  relevantQuestions: string[];
  topicCoverage: string[];
  suggestedStructureSummary: string;
  audienceKnowledgeLevel: string;
  searchCompetitionNotes: string;
  groundedSources: BlogGroundedSource[];
  disclaimer: string;
}

export interface BlogOutlineSection {
  id: string;
  order: number;
  h2Heading: string;
  h3Subsections: string[];
  talkingPoints: string[];
  relevantExamples: string[];
}

export interface BlogOutline {
  suggestedBlogTitle: string;
  introductionDirection: string;
  h1Heading: string;
  sections: BlogOutlineSection[];
  faqSuggestions: Array<{ question: string; answerDirection: string }>;
  conclusionDirection: string;
  ctaRecommendation: string;
  approved: boolean;
  approvedAt: string | null;
}

export interface BlogArticleSubsection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface BlogArticleSection {
  id: string;
  order: number;
  h2Heading: string;
  h3Subsections: BlogArticleSubsection[];
  paragraphs: string[];
  bulletPoints: string[];
  examples: string[];
}

export interface BlogInternalLinkSuggestion {
  anchorText: string;
  targetTopicOrUrl: string;
  placementContext: string;
}

export interface BlogFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BlogKeywordPlacement {
  keyword: string;
  type: "primary" | "secondary" | "supporting";
  occurrences: number;
  locations: string[];
}

export interface BlogArticleContent {
  blogTitle: string;
  seoTitle: string;
  metaDescription: string;
  suggestedSlug: string;
  h1Heading: string;
  introduction: string;
  sections: BlogArticleSection[];
  internalLinks: BlogInternalLinkSuggestion[];
  externalSources: BlogGroundedSource[];
  faqs: BlogFaqItem[];
  conclusion: string;
  cta: string;
  featuredImageUrl: string;
  featuredImagePrompt: string;
  featuredImageFormatName: string;
  featuredImageWidth: number;
  featuredImageHeight: number;
  imageAltText: string;
  imageCaption: string;
  wordCount: number;
  keywordPlacements: BlogKeywordPlacement[];
}

export interface BlogArticleVersion {
  id: string;
  versionNumber: number;
  label: string;
  createdAt: string;
  isUserEdited: boolean;
  content: BlogArticleContent;
}

export type BlogInputIntelligenceMode =
  | "topic_and_keywords"
  | "topic_only"
  | "keywords_only"
  | "neither";

export type BlogProjectStatus =
  | "draft"
  | "outline_ready"
  | "outline_approved"
  | "article_ready"
  | "approved";

export interface BlogPostProject {
  id: string;
  workspaceId: string;
  brandId: string;
  topic: string;
  keywords: BlogSeoKeywords;
  imageFormatName: string;
  imageWidth: number;
  imageHeight: number;
  targetAudience: string;
  industry: string;
  blogCategory: string;
  desiredWordCount: number;
  writingTone: string;
  targetCountry: string;
  language: string;
  searchIntent: string;
  competitorUrls: string[];
  specificCta: string;
  additionalInstructions: string;
  inputIntelligenceMode: BlogInputIntelligenceMode;
  research: BlogResearchStrategy | null;
  outline: BlogOutline | null;
  currentArticle: BlogArticleContent | null;
  versions: BlogArticleVersion[];
  status: BlogProjectStatus;
  hasApprovedUserEdits: boolean;
  createdAt: string;
  updatedAt: string;
}

