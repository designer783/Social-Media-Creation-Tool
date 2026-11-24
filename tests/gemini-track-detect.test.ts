import { describe, it, expect, beforeEach } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/crypto-vault";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBrand,
  createBrandKit,
  createRadarSignals,
  createWorkspaceWithDefaults,
  deleteGeminiConnection,
  getDashboardMetrics,
  listCreativeAudits,
  listGeminiConnections,
  listPlatformPresets,
  listRadarSignals,
  listSocialTrackers,
  registerOrLoginUser,
  resolveActiveGeminiCredentials,
  saveCreativeAudit,
  updateGeminiConnectionModelsAndCapabilities,
  updateRadarSignalStatus,
  upsertGeminiConnection,
  upsertSocialTracker,
} from "@/lib/db/repository";
import { generateFullCampaignCreatives } from "@/lib/services/creative-service";

function createTestBrandAndKit(workspaceId: string) {
  const brand = createBrand(workspaceId, {
    name: "Apex Mobility",
    domain: "apexmobility.io",
    websiteUrl: "https://apexmobility.io",
  });

  const kit = createBrandKit(workspaceId, {
    brandId: brand.id,
    colors: {
      primary: "#0F172A",
      secondary: ["#334155"],
      accent: "#2563EB",
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
      borderRadiusPx: 10,
      spacingUnitPx: 8,
      logoPlacementDefault: "top-left",
      ctaStyle: {
        shape: "rounded",
        treatment: "solid",
        backgroundColor: "#2563EB",
        textColor: "#FFFFFF",
      },
      commonPatterns: ["Minimal contrast"],
    },
    extractionMeta: {
      sourceUrl: "https://apexmobility.io",
      extractedAt: new Date().toISOString(),
      fallbackUsed: false,
      detectedColorsCount: 3,
      detectedFontsCount: 1,
    },
  });

  return { brand, kit };
}

describe("Gemini Vault Encryption, Multi-User Isolation & Track-and-Detect", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("encrypts/decrypts API secrets with AES-256-GCM and verifies signed session tokens", () => {
    const rawKey = "AIzaSyTestSecretKeyForVault123456";
    const cipherOne = encryptSecret(rawKey);
    const cipherTwo = encryptSecret(rawKey);

    expect(cipherOne).not.toEqual(rawKey);
    expect(cipherOne).not.toEqual(cipherTwo);
    expect(cipherOne.split(":")).toHaveLength(3);
    expect(decryptSecret(cipherOne)).toBe(rawKey);
    expect(decryptSecret(cipherTwo)).toBe(rawKey);

    // Tampered auth tag or payload fails safely
    const [iv, tag, data] = cipherOne.split(":");
    expect(decryptSecret(`${iv}:${tag}:${data}00`)).toBeNull();
    expect(decryptSecret("invalid-format")).toBeNull();

    // Session token signing and tamper detection
    const token = signSessionToken("user-alice-42");
    expect(verifySessionToken(token)).toEqual({ userId: "user-alice-42" });

    const [payload, sig] = token.split(".");
    expect(verifySessionToken(`${payload}.tampered${sig}`)).toBeNull();
    expect(verifySessionToken("malformed")).toBeNull();
  });

  it("enforces password auth, personal-over-workspace key precedence, and cross-user isolation", () => {
    const alice = registerOrLoginUser({
      email: "alice@agency.example",
      name: "Alice Director",
      password: "alice-strong-password",
      workspaceName: "Alice Workspace",
    });
    const aliceWs = alice.workspaces[0]!;

    const bob = registerOrLoginUser({
      email: "bob@agency.example",
      name: "Bob Partner",
      password: "bob-strong-password",
      workspaceName: "Bob Workspace",
    });
    const bobWs = bob.workspaces[0]!;

    // Existing user password check
    expect(() =>
      registerOrLoginUser({
        email: "alice@agency.example",
        password: "wrong-password",
      })
    ).toThrow();
    const aliceRelogin = registerOrLoginUser({
      email: "alice@agency.example",
      password: "alice-strong-password",
    });
    expect(aliceRelogin.user.id).toBe(alice.user.id);

    // Connect Workspace Shared Key for Alice's workspace
    const wsSharedConn = upsertGeminiConnection({
      workspaceId: aliceWs.id,
      userId: alice.user.id,
      scope: "workspace",
      label: "Alice Team Shared Key",
      textModel: "gemini-2.5-flash",
      imageModel: "auto",
      apiKey: "AIzaSyTeamSharedKey0001",
    });

    const resolvedFromTeam = resolveActiveGeminiCredentials(aliceWs.id, alice.user.id);
    expect(resolvedFromTeam.sourceScope).toBe("workspace");
    expect(resolvedFromTeam.apiKey).toBe("AIzaSyTeamSharedKey0001");

    // Personal User Key overrides Workspace Shared Key
    const personalConn = upsertGeminiConnection({
      workspaceId: aliceWs.id,
      userId: alice.user.id,
      scope: "user",
      label: "Alice Personal Pro Key",
      textModel: "gemini-2.5-pro",
      imageModel: "imagen-3.0-generate-002",
      apiKey: "AIzaSyAlicePersonal9999",
    });

    const resolvedPersonal = resolveActiveGeminiCredentials(aliceWs.id, alice.user.id);
    expect(resolvedPersonal.sourceScope).toBe("user");
    expect(resolvedPersonal.apiKey).toBe("AIzaSyAlicePersonal9999");
    expect(resolvedPersonal.textModel).toBe("gemini-2.5-pro");

    // Personal key follows Alice to a second workspace she owns
    const aliceSecondWs = createWorkspaceWithDefaults({
      name: "Alice Secondary Client",
      ownerId: alice.user.id,
    });
    const resolvedSecondWs = resolveActiveGeminiCredentials(
      aliceSecondWs.id,
      alice.user.id
    );
    expect(resolvedSecondWs.sourceScope).toBe("user");
    expect(resolvedSecondWs.apiKey).toBe("AIzaSyAlicePersonal9999");

    // Cross-user isolation: Bob cannot see or delete Alice's connections
    expect(listGeminiConnections(bobWs.id, bob.user.id)).toHaveLength(0);
    deleteGeminiConnection(personalConn.id, bob.user.id, bobWs.id);
    expect(listGeminiConnections(aliceWs.id, alice.user.id)).toHaveLength(2);

    // Pausing Alice's personal key falls back cleanly to Workspace Shared Key
    updateGeminiConnectionModelsAndCapabilities({
      connectionId: personalConn.id,
      userId: alice.user.id,
      workspaceId: aliceWs.id,
      isActive: false,
    });
    const fallbackToWs = resolveActiveGeminiCredentials(aliceWs.id, alice.user.id);
    expect(fallbackToWs.sourceScope).toBe("workspace");
    expect(fallbackToWs.connectionId).toBe(wsSharedConn.id);

    // Delete personal connection permanently
    deleteGeminiConnection(personalConn.id, alice.user.id, aliceWs.id);
    expect(listGeminiConnections(aliceWs.id, alice.user.id)).toHaveLength(1);
  });

  it("isolates radar signals, vision audits, and social post trackers per workspace", async () => {
    const wsA = createWorkspaceWithDefaults({
      name: "Studio Alpha",
      ownerId: "user-alpha",
    });
    const wsB = createWorkspaceWithDefaults({
      name: "Studio Beta",
      ownerId: "user-beta",
    });

    const { brand, kit } = createTestBrandAndKit(wsA.id);
    const presetsA = listPlatformPresets(wsA.id);
    const squarePreset = presetsA.find((p) => p.platform === "instagram") ?? presetsA[0]!;

    // Radar signal creation, status update, and workspace isolation
    const createdSignals = createRadarSignals(wsA.id, brand.id, [
      {
        signalType: "trend_topic",
        title: "Real-Time Battery Health Diagnostics",
        summary: "EV buyers increasingly search transparent battery grading reports.",
        suggestedHeadline: "Verified EV Battery Checks",
        seoKeywords: ["ev battery health", "verified vin report"],
        sourceUrls: ["https://apexmobility.io/insights"],
        relevanceScore: 92,
      },
    ]);
    expect(createdSignals).toHaveLength(1);
    expect(createdSignals[0]!.status).toBe("new");

    expect(listRadarSignals(wsA.id)).toHaveLength(1);
    expect(listRadarSignals(wsB.id)).toHaveLength(0);

    updateRadarSignalStatus(wsA.id, createdSignals[0]!.id, "launched");
    expect(listRadarSignals(wsA.id)[0]!.status).toBe("launched");

    // Launching campaign automatically registers planned SocialPostTracker records
    const launched = await generateFullCampaignCreatives({
      workspaceId: wsA.id,
      userId: "user-alpha",
      brandId: brand.id,
      brandKitId: kit.id,
      campaignName: "Battery Diagnostics Push",
      objective: "Educate EV shoppers",
      inputMode: "ai_topic",
      topic: "Verified EV Battery Checks",
      seoKeywords: ["ev battery health", "vin check"],
      targetAudience: "Used EV buyers",
      toneOfVoice: "Trustworthy",
      presetIds: [squarePreset.id],
      selectedVariations: [1],
    });

    expect(launched.creatives).toHaveLength(1);
    const creative = launched.creatives[0]!;

    // Vision Audit persistence & isolation
    const audit = saveCreativeAudit(wsA.id, {
      creativeId: creative.id,
      versionId: creative.currentVersionId,
      overallScore: 91,
      legibilityScore: 94,
      brandConsistencyScore: 89,
      visualAppealScore: 90,
      strengths: ["Crisp high-contrast headline", "Clear corner logo placement"],
      recommendations: ["Test warm ambient highlight for higher save rate"],
      suggestedHeadline: "Verify Every EV Battery",
      auditedByModel: "gemini-2.5-flash",
    });
    expect(audit.overallScore).toBe(91);
    expect(listCreativeAudits(wsA.id, creative.id)).toHaveLength(1);
    expect(listCreativeAudits(wsB.id)).toHaveLength(0);

    // Tracker auto-created as 'planned' and updatable to 'published' with KPI metrics
    const initialTrackers = listSocialTrackers(wsA.id);
    expect(initialTrackers).toHaveLength(1);
    expect(initialTrackers[0]!.creativeId).toBe(creative.id);
    expect(initialTrackers[0]!.trackingStatus).toBe("planned");
    expect(listSocialTrackers(wsB.id)).toHaveLength(0);

    const updatedTracker = upsertSocialTracker(wsA.id, {
      creativeId: creative.id,
      trackingStatus: "published",
      publishedUrl: "https://instagram.com/p/demo123",
      impressions: 18400,
      clicks: 740,
      engagements: 1120,
      notes: "Strong organic share velocity",
    });
    expect(updatedTracker.trackingStatus).toBe("published");
    expect(updatedTracker.impressions).toBe(18400);
    expect(updatedTracker.engagements).toBe(1120);

    // Dashboard metrics include new radar and tracker counters
    const metricsA = getDashboardMetrics(wsA.id);
    expect(metricsA.trackedPostsCount).toBe(1);
    expect(metricsA.activeRadarSignals).toBe(0); // launched signal no longer 'new'
  });
});
