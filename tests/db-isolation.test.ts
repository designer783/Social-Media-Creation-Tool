import { describe, it, expect, beforeEach } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import {
  createBrand,
  createBrandKit,
  createCampaign,
  createWorkspaceWithDefaults,
  deleteMcpConnection,
  deleteWorkspace,
  ensureSeedData,
  getBrandById,
  getBrandKitById,
  getCampaignById,
  listBrands,
  listMcpConnections,
  listPlatformPresets,
  registerOrLoginUser,
  updateBrandKit,
  updateMcpConnection,
  upsertMcpConnection,
  upsertPlatformPreset,
} from "@/lib/db/repository";

describe("Workspace Isolation & Repository Persistence", () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it("isolates brands, brand kits, and campaigns strictly between workspaces", () => {
    const wsAlpha = createWorkspaceWithDefaults({
      name: "Alpha Studio",
      ownerId: "user-alpha",
    });
    const wsBeta = createWorkspaceWithDefaults({
      name: "Beta Agency",
      ownerId: "user-beta",
    });

    const alphaBrand = createBrand(wsAlpha.id, {
      name: "Alpha Footwear",
      domain: "alphafootwear.com",
      websiteUrl: "https://alphafootwear.com",
    });

    const alphaKit = createBrandKit(wsAlpha.id, {
      brandId: alphaBrand.id,
      colors: {
        primary: "#111827",
        secondary: ["#374151"],
        accent: "#2563EB",
        backgroundLight: "#F9FAFB",
        backgroundDark: "#111827",
        textOnLight: "#111827",
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
          backgroundColor: "#2563EB",
          textColor: "#FFFFFF",
        },
        commonPatterns: ["Clean grid"],
      },
      extractionMeta: {
        sourceUrl: "https://alphafootwear.com",
        extractedAt: new Date().toISOString(),
        fallbackUsed: false,
        detectedColorsCount: 3,
        detectedFontsCount: 1,
      },
    });

    const alphaCampaign = createCampaign(wsAlpha.id, {
      brandId: alphaBrand.id,
      brandKitId: alphaKit.id,
      name: "Spring Launch",
      objective: "Product awareness",
      inputMode: "manual",
      topic: "Carbon plate marathon runner",
    });

    // Workspace Beta must see zero brands, kits, or campaigns from Workspace Alpha
    expect(listBrands(wsBeta.id)).toHaveLength(0);
    expect(getBrandById(wsBeta.id, alphaBrand.id)).toBeNull();
    expect(getBrandKitById(wsBeta.id, alphaKit.id)).toBeNull();
    expect(getCampaignById(wsBeta.id, alphaCampaign.id)).toBeNull();

    // Cross-workspace creation attempt must throw an error
    expect(() =>
      createCampaign(wsBeta.id, {
        brandId: alphaBrand.id,
        brandKitId: alphaKit.id,
        name: "Unauthorized Campaign",
        objective: "Intrusion",
        inputMode: "manual",
        topic: "Test",
      })
    ).toThrow(/Invalid Brand or Brand Kit/);
  });

  it("supports saving multiple versions of Brand Kits per brand", () => {
    const ws = createWorkspaceWithDefaults({
      name: "Versioning Workspace",
      ownerId: "user-1",
    });
    const brand = createBrand(ws.id, {
      name: "Kroma Audio",
      domain: "kromaaudio.com",
      websiteUrl: "https://kromaaudio.com",
    });

    const kitV1 = createBrandKit(ws.id, {
      brandId: brand.id,
      colors: {
        primary: "#0F172A",
        secondary: ["#334155"],
        accent: "#059669",
        backgroundLight: "#FFFFFF",
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
        characteristic: "minimal",
        borderRadiusPx: 4,
        spacingUnitPx: 8,
        logoPlacementDefault: "top-left",
        ctaStyle: {
          shape: "sharp",
          treatment: "solid",
          backgroundColor: "#059669",
          textColor: "#FFFFFF",
        },
        commonPatterns: [],
      },
      extractionMeta: {
        sourceUrl: "https://kromaaudio.com",
        extractedAt: new Date().toISOString(),
        fallbackUsed: false,
        detectedColorsCount: 3,
        detectedFontsCount: 1,
      },
    });

    const kitV2 = updateBrandKit(ws.id, kitV1.id, {
      createNewVersion: true,
      name: "Kroma Audio Holiday Kit",
      colors: {
        ...kitV1.colors,
        accent: "#D97706",
      },
    });

    expect(kitV1.version).toBe(1);
    expect(kitV2.version).toBe(2);
    expect(kitV2.colors.accent).toBe("#D97706");
    expect(getBrandById(ws.id, brand.id)?.activeKitId).toBe(kitV2.id);
  });

  it("seeds 7 default configurable social platform presets and allows custom dimension updates", () => {
    const ws = createWorkspaceWithDefaults({
      name: "Presets Workspace",
      ownerId: "user-1",
    });
    const presets = listPlatformPresets(ws.id);
    expect(presets).toHaveLength(7);

    const igPortrait = presets.find(
      (p) => p.platform === "instagram" && p.formatName === "Portrait"
    );
    expect(igPortrait).toBeDefined();
    expect(igPortrait?.width).toBe(1080);
    expect(igPortrait?.height).toBe(1350);

    const updated = upsertPlatformPreset(ws.id, {
      id: igPortrait!.id,
      platform: "instagram",
      formatName: "Portrait Tall",
      width: 1080,
      height: 1440,
      safeMarginPx: 88,
      isActive: true,
    });
    expect(updated.height).toBe(1440);
    expect(updated.formatName).toBe("Portrait Tall");
  });

  it("enforces Admin-only workspace deletion and manages MCP servers per workspace", () => {
    const seeded = ensureSeedData();
    expect(seeded.user.isAdmin).toBe(false);

    // Non-admin user cannot delete a workspace
    expect(() =>
      deleteWorkspace(seeded.agencyWorkspace.id, seeded.user.id)
    ).toThrow(/Only the Admin account/);

    // Admin account can sign in, view all workspaces, and delete a workspace
    const adminAuth = registerOrLoginUser({
      email: "admin@socialstudio.local",
      password: "admin123",
    });
    expect(adminAuth.user.isAdmin).toBe(true);
    expect(adminAuth.workspaces.length).toBeGreaterThanOrEqual(2);

    // Register MCP servers in primary workspace
    const mcp = upsertMcpConnection({
      workspaceId: seeded.workspace.id,
      userId: adminAuth.user.id,
      name: "Filesystem MCP",
      transportType: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./storage"],
      authToken: "mcp-secret-token-9876",
    });
    expect(mcp.name).toBe("Filesystem MCP");
    expect(mcp.hasAuthToken).toBe(true);
    expect(mcp.tokenLast4).toBe("9876");
    expect(listMcpConnections(seeded.workspace.id)).toHaveLength(1);
    expect(listMcpConnections(seeded.agencyWorkspace.id)).toHaveLength(0);

    const paused = updateMcpConnection({
      workspaceId: seeded.workspace.id,
      connectionId: mcp.id,
      isActive: false,
    });
    expect(paused.isActive).toBe(false);

    deleteMcpConnection(seeded.workspace.id, mcp.id);
    expect(listMcpConnections(seeded.workspace.id)).toHaveLength(0);

    // Admin deletes the secondary workspace
    const remaining = deleteWorkspace(seeded.agencyWorkspace.id, adminAuth.user.id);
    expect(remaining.some((w) => w.id === seeded.agencyWorkspace.id)).toBe(false);
  });

  it("locks the studio and supports concurrent multiple logins with the single admin credential", () => {
    ensureSeedData();

    // 1. Invalid credentials must be rejected
    expect(() =>
      registerOrLoginUser({
        email: "admin@socialstudio.local",
        password: "wrongpassword999",
      })
    ).toThrow(/Invalid password/);

    // 2. First login with Admin credentials succeeds
    const session1 = registerOrLoginUser({
      email: "admin@socialstudio.local",
      password: "admin123",
    });
    expect(session1.user.isAdmin).toBe(true);
    expect(session1.user.email).toBe("admin@socialstudio.local");

    // 3. Second concurrent login with the same credentials succeeds (multi-login with one credential)
    const session2 = registerOrLoginUser({
      email: "admin", // shorthand ID also accepted
      password: "admin123",
    });
    expect(session2.user.isAdmin).toBe(true);
    expect(session2.user.id).toBe(session1.user.id);
  });
});
