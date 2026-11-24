import crypto from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto-vault";
import { getDb } from "@/lib/db/client";
import { slugify } from "@/lib/utils";
import type {
  AIProviderConfig,
  ApprovalLog,
  ApprovalStatus,
  Brand,
  BrandColors,
  BrandKit,
  BrandTypography,
  BrandVisualStyle,
  Campaign,
  CampaignInputMode,
  CompositionTemplate,
  ContentItem,
  Creative,
  CreativeAudit,
  CreativeVersion,
  DashboardMetrics,
  ExportJob,
  ExtractionMetadata,
  GeminiCapabilities,
  GeminiConnectionMode,
  GeminiConnectionScope,
  GeminiConnectionSummary,
  LayoutOverrides,
  MediaApiCapability,
  MediaApiConnectionSummary,
  MediaProviderPreset,
  PlatformPreset,
  SocialPlatform,
  SocialPostTracker,
  TextOverrides,
  TrendSignal,
  User,
  VideoGeneration,
  Workspace,
} from "@/types/domain";

export const DEFAULT_PLATFORM_PRESETS: Array<
  Omit<PlatformPreset, "id" | "workspaceId">
> = [
  {
    platform: "instagram",
    formatName: "Square",
    width: 1080,
    height: 1080,
    safeMarginPx: 72,
    isActive: true,
  },
  {
    platform: "instagram",
    formatName: "Portrait",
    width: 1080,
    height: 1350,
    safeMarginPx: 80,
    isActive: true,
  },
  {
    platform: "facebook",
    formatName: "Square",
    width: 1080,
    height: 1080,
    safeMarginPx: 72,
    isActive: true,
  },
  {
    platform: "linkedin",
    formatName: "Landscape",
    width: 1200,
    height: 627,
    safeMarginPx: 64,
    isActive: true,
  },
  {
    platform: "x",
    formatName: "Landscape",
    width: 1600,
    height: 900,
    safeMarginPx: 84,
    isActive: true,
  },
  {
    platform: "pinterest",
    formatName: "Portrait",
    width: 1000,
    height: 1500,
    safeMarginPx: 76,
    isActive: true,
  },
  {
    platform: "tiktok",
    formatName: "Vertical",
    width: 1080,
    height: 1920,
    safeMarginPx: 96,
    isActive: true,
  },
];

export const DEFAULT_PROVIDER_CONFIGS: Array<
  Omit<AIProviderConfig, "id" | "workspaceId">
> = [
  {
    providerType: "image",
    providerKey: "gemini",
    displayName: "Google Gemini Real-Time Image & Imagen 3 Studio",
    endpointUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation",
    modelId: "gemini-2.0-flash-image / imagen-3.0-generate-002",
    isEnabled: true,
    isPrimary: true,
    stats: {
      totalRequests: 0,
      failedRequests: 0,
      fallbackCount: 0,
      estimatedCostUsd: 0,
      lastUsedAt: null,
    },
  },
  {
    providerType: "text",
    providerKey: "gemini",
    displayName: "Google Gemini 2.5 Flash Content, Brand & SEO Engine",
    endpointUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash",
    modelId: "gemini-2.5-flash",
    isEnabled: true,
    isPrimary: true,
    stats: {
      totalRequests: 0,
      failedRequests: 0,
      fallbackCount: 0,
      estimatedCostUsd: 0,
      lastUsedAt: null,
    },
  },
];

export function hashPassword(password: string): string {
  const salt = "social-media-studio-v1-salt";
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function createWorkspaceWithDefaults(input: {
  name: string;
  ownerId: string;
  id?: string;
}): Workspace {
  const db = getDb();
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.name) || "workspace";
  const uniqueSlug = `${baseSlug}-${id.slice(0, 6)}`;
  const settings: Workspace["settings"] = {
    defaultExportFormat: "both",
    requireApprovalBeforeExport: true,
  };

  db.prepare(
    `INSERT INTO workspaces (id, name, slug, owner_id, settings_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.name.trim(), uniqueSlug, input.ownerId, JSON.stringify(settings), now);

  db.prepare(
    `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), id, input.ownerId, "owner", now);

  const presetStmt = db.prepare(
    `INSERT INTO platform_presets (id, workspace_id, platform, format_name, width, height, safe_margin_px, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const preset of DEFAULT_PLATFORM_PRESETS) {
    presetStmt.run(
      crypto.randomUUID(),
      id,
      preset.platform,
      preset.formatName,
      preset.width,
      preset.height,
      preset.safeMarginPx,
      preset.isActive ? 1 : 0
    );
  }

  const providerStmt = db.prepare(
    `INSERT INTO ai_provider_configs (id, workspace_id, provider_type, provider_key, display_name, endpoint_url, model_id, is_enabled, is_primary, stats_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const provider of DEFAULT_PROVIDER_CONFIGS) {
    providerStmt.run(
      crypto.randomUUID(),
      id,
      provider.providerType,
      provider.providerKey,
      provider.displayName,
      provider.endpointUrl,
      provider.modelId,
      provider.isEnabled ? 1 : 0,
      provider.isPrimary ? 1 : 0,
      JSON.stringify(provider.stats)
    );
  }

  return {
    id,
    name: input.name.trim(),
    slug: uniqueSlug,
    ownerId: input.ownerId,
    settings,
    createdAt: now,
  };
}

let initialCleanPurgeExecuted = false;

export function purgeLegacyDemoSeedData(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Remove any legacy non-Gemini provider configs so only Google Gemini remains
  db.prepare(`DELETE FROM ai_provider_configs WHERE provider_key != 'gemini'`).run();

  const alreadyPurged = db
    .prepare(`SELECT value FROM studio_meta WHERE key = 'clean_reset_v3'`)
    .get() as { value: string } | undefined;

  if (!alreadyPurged && !initialCleanPurgeExecuted) {
    initialCleanPurgeExecuted = true;
    db.exec(`
      DELETE FROM export_jobs;
      DELETE FROM approval_logs;
      DELETE FROM creative_versions;
      DELETE FROM creatives;
      DELETE FROM content_items;
      DELETE FROM campaigns;
      DELETE FROM brand_kits;
      DELETE FROM brands;
    `);
    db.prepare(
      `INSERT OR REPLACE INTO studio_meta (key, value) VALUES ('clean_reset_v3', ?)`
    ).run(new Date().toISOString());
  }
}

export function deleteCreatives(workspaceId: string, creativeIds: string[]): number {
  if (!creativeIds.length) return 0;
  const db = getDb();
  const delVer = db.prepare(
    `DELETE FROM creative_versions WHERE workspace_id = ? AND creative_id = ?`
  );
  const delLogs = db.prepare(
    `DELETE FROM approval_logs WHERE workspace_id = ? AND creative_id = ?`
  );
  const delCreative = db.prepare(
    `DELETE FROM creatives WHERE workspace_id = ? AND id = ?`
  );

  let deletedCount = 0;
  for (const id of creativeIds) {
    delVer.run(workspaceId, id);
    delLogs.run(workspaceId, id);
    const res = delCreative.run(workspaceId, id);
    deletedCount += Number(res.changes ?? 0);
  }

  // Clean up any campaigns in this workspace that no longer have any creatives
  db.prepare(
    `DELETE FROM campaigns
     WHERE workspace_id = ?
       AND id NOT IN (SELECT DISTINCT campaign_id FROM creatives WHERE workspace_id = ?)`
  ).run(workspaceId, workspaceId);

  return deletedCount;
}

export function deleteContentItems(workspaceId: string, contentIds: string[]): number {
  if (!contentIds.length) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `DELETE FROM content_items WHERE workspace_id = ? AND id = ?`
  );
  let count = 0;
  for (const id of contentIds) {
    const res = stmt.run(workspaceId, id);
    count += Number(res.changes ?? 0);
  }
  return count;
}

export function clearWorkspaceData(workspaceId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM export_jobs WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM approval_logs WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM creative_versions WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM creatives WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM content_items WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM campaigns WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM brand_kits WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM brands WHERE workspace_id = ?`).run(workspaceId);
}

export function deleteBrand(workspaceId: string, brandId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM brands WHERE workspace_id = ? AND id = ?`).run(
    workspaceId,
    brandId
  );
}

export function deleteCampaign(workspaceId: string, campaignId: string): void {
  const db = getDb();
  // Clean up child creatives, versions, approval logs, and export jobs for this campaign
  const creatives = db.prepare(`SELECT id FROM creatives WHERE workspace_id = ? AND campaign_id = ?`).all(workspaceId, campaignId) as { id: string }[];
  const delVer = db.prepare(`DELETE FROM creative_versions WHERE workspace_id = ? AND creative_id = ?`);
  const delLogs = db.prepare(`DELETE FROM approval_logs WHERE workspace_id = ? AND creative_id = ?`);
  const delCreative = db.prepare(`DELETE FROM creatives WHERE workspace_id = ? AND id = ?`);

  for (const c of creatives) {
    delVer.run(workspaceId, c.id);
    delLogs.run(workspaceId, c.id);
    delCreative.run(workspaceId, c.id);
  }

  db.prepare(`DELETE FROM export_jobs WHERE workspace_id = ? AND campaign_id = ?`).run(workspaceId, campaignId);
  db.prepare(`DELETE FROM campaigns WHERE workspace_id = ? AND id = ?`).run(workspaceId, campaignId);
}

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@socialstudio.local").trim().toLowerCase();
export const ADMIN_USER_ID = "usr-studio-admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
export const ADMIN_NAME = process.env.ADMIN_NAME || "Studio Admin";

export function isAdminAccount(email: string, id?: string): boolean {
  const clean = email.trim().toLowerCase();
  return (
    clean === ADMIN_EMAIL ||
    clean === "admin" ||
    clean === "admin@socialstudio.local" ||
    id === ADMIN_USER_ID
  );
}

function ensureAdminAccountExists(defaultWorkspaceId: string): void {
  const db = getDb();
  const existingAdmin = db
    .prepare(`SELECT id, email, password_hash FROM users WHERE email = ? OR id = ?`)
    .get(ADMIN_EMAIL, ADMIN_USER_ID) as { id: string; email: string; password_hash: string } | undefined;

  const currentAdminPassHash = hashPassword(ADMIN_PASSWORD);
  if (!existingAdmin) {
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, default_workspace_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      ADMIN_USER_ID,
      ADMIN_EMAIL,
      ADMIN_NAME,
      currentAdminPassHash,
      defaultWorkspaceId,
      "2099-01-01T00:00:00.000Z"
    );
  } else if (existingAdmin.password_hash !== currentAdminPassHash || existingAdmin.email !== ADMIN_EMAIL) {
    db.prepare(`UPDATE users SET email = ?, name = ?, password_hash = ? WHERE id = ?`).run(
      ADMIN_EMAIL,
      ADMIN_NAME,
      currentAdminPassHash,
      ADMIN_USER_ID
    );
  }
}

function deduplicateWorkspacesByName(): void {
  const db = getDb();
  const allWorkspaces = db
    .prepare(`SELECT id, name FROM workspaces ORDER BY created_at ASC`)
    .all() as Array<{ id: string; name: string }>;

  const seenNames = new Map<string, string>();
  for (const ws of allWorkspaces) {
    const key = ws.name.trim().toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.set(key, ws.id);
      continue;
    }
    // Check if this duplicate-named workspace is empty; if so, remove the duplicate
    const brandCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM brands WHERE workspace_id = ?`)
        .get(ws.id) as { c: number }
    ).c;
    const campaignCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM campaigns WHERE workspace_id = ?`)
        .get(ws.id) as { c: number }
    ).c;
    if (brandCount === 0 && campaignCount === 0) {
      db.prepare(`DELETE FROM platform_presets WHERE workspace_id = ?`).run(ws.id);
      db.prepare(`DELETE FROM ai_provider_configs WHERE workspace_id = ?`).run(ws.id);
      db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ?`).run(ws.id);
      db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(ws.id);
    }
  }
}

export function ensureSeedData(): { user: User; workspace: Workspace; agencyWorkspace: Workspace } {
  const db = getDb();
  purgeLegacyDemoSeedData();
  deduplicateWorkspacesByName();

  const existingUser = db
    .prepare(`SELECT * FROM users WHERE id != ? ORDER BY created_at ASC LIMIT 1`)
    .get(ADMIN_USER_ID) as Record<string, unknown> | undefined;

  if (existingUser) {
    const workspaces = listUserWorkspaces(String(existingUser.id));
    const primary = workspaces[0] ?? createWorkspaceWithDefaults({
      name: "My Brand Workspace",
      ownerId: String(existingUser.id),
    });
    const secondary = workspaces[1] ?? primary;
    ensureAdminAccountExists(primary.id);
    const email = String(existingUser.email);
    const id = String(existingUser.id);
    const admin = isAdminAccount(email, id);
    return {
      user: {
        id,
        email,
        name: String(existingUser.name),
        isAdmin: admin,
        role: admin ? "admin" : "member",
        defaultWorkspaceId: String(existingUser.default_workspace_id),
        createdAt: String(existingUser.created_at),
      },
      workspace: primary,
      agencyWorkspace: secondary,
    };
  }

  const userId = "usr-studio-founder";
  const primaryWsId = "ws-northstar-studio";
  const secondaryWsId = "ws-apex-agency";
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, default_workspace_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    "studio@workspace.local",
    "Studio Creator",
    hashPassword("studio-pass-2026"),
    primaryWsId,
    now
  );

  const primaryWorkspace = createWorkspaceWithDefaults({
    id: primaryWsId,
    name: "My Brand Workspace",
    ownerId: userId,
  });

  const agencyWorkspace = createWorkspaceWithDefaults({
    id: secondaryWsId,
    name: "Client Projects Workspace",
    ownerId: userId,
  });

  ensureAdminAccountExists(primaryWorkspace.id);

  return {
    user: {
      id: userId,
      email: "studio@workspace.local",
      name: "Studio Creator",
      isAdmin: false,
      role: "member",
      defaultWorkspaceId: primaryWorkspace.id,
      createdAt: now,
    },
    workspace: primaryWorkspace,
    agencyWorkspace,
  };
}

export function getUserById(userId: string): User | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const email = String(row.email);
  const id = String(row.id);
  const admin = isAdminAccount(email, id);
  return {
    id,
    email,
    name: String(row.name),
    isAdmin: admin,
    role: admin ? "admin" : "member",
    defaultWorkspaceId: String(row.default_workspace_id),
    createdAt: String(row.created_at),
  };
}

export function listUserWorkspaces(userId: string): Workspace[] {
  const db = getDb();
  const user = getUserById(userId);
  const rows = user?.isAdmin
    ? (db
        .prepare(`SELECT * FROM workspaces ORDER BY created_at ASC`)
        .all() as Array<Record<string, unknown>>)
    : (db
        .prepare(
          `SELECT w.* FROM workspaces w
           INNER JOIN workspace_members wm ON wm.workspace_id = w.id
           WHERE wm.user_id = ?
           ORDER BY w.created_at ASC`
        )
        .all(userId) as Array<Record<string, unknown>>);

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    ownerId: String(row.owner_id),
    settings: JSON.parse(String(row.settings_json)),
    createdAt: String(row.created_at),
  }));
}

export function getWorkspaceById(workspaceId: string): Workspace | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM workspaces WHERE id = ?`)
    .get(workspaceId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    ownerId: String(row.owner_id),
    settings: JSON.parse(String(row.settings_json)),
    createdAt: String(row.created_at),
  };
}

export function updateWorkspace(
  workspaceId: string,
  input: {
    name?: string;
    settings?: Partial<Workspace["settings"]>;
  }
): Workspace {
  const db = getDb();
  const current = getWorkspaceById(workspaceId);
  if (!current) {
    throw new Error("Workspace not found.");
  }
  const nextName = input.name?.trim() || current.name;
  const nextSettings = {
    ...current.settings,
    ...(input.settings ?? {}),
  };
  db.prepare(`UPDATE workspaces SET name = ?, settings_json = ? WHERE id = ?`).run(
    nextName,
    JSON.stringify(nextSettings),
    workspaceId
  );
  return {
    ...current,
    name: nextName,
    settings: nextSettings,
  };
}

export function registerOrLoginUser(input: {
  email: string;
  name?: string;
  password: string;
  workspaceName?: string;
}): { user: User; workspaces: Workspace[] } {
  const db = getDb();
  let email = input.email.trim().toLowerCase();
  if (email === "admin" || email === "admin@socialstudio.local") {
    email = ADMIN_EMAIL;
  }
  const existing = db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .get(email) as Record<string, unknown> | undefined;

  if (existing) {
    if (String(existing.password_hash) !== hashPassword(input.password)) {
      throw new Error("Invalid password for this account.");
    }
    const id = String(existing.id);
    const existingEmail = String(existing.email);
    const admin = isAdminAccount(existingEmail, id);
    const workspaces = listUserWorkspaces(id);
    return {
      user: {
        id,
        email: existingEmail,
        name: String(existing.name),
        isAdmin: admin,
        role: admin ? "admin" : "member",
        defaultWorkspaceId: String(existing.default_workspace_id),
        createdAt: String(existing.created_at),
      },
      workspaces,
    };
  }

  const userId = isAdminAccount(email) ? ADMIN_USER_ID : crypto.randomUUID();
  const wsId = crypto.randomUUID();
  const now = new Date().toISOString();
  const displayName = input.name?.trim() || (isAdminAccount(email) ? "Studio Admin" : email.split("@")[0] || "Studio Member");
  const admin = isAdminAccount(email, userId);

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, default_workspace_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, email, displayName, hashPassword(input.password), wsId, now);

  const ws = createWorkspaceWithDefaults({
    id: wsId,
    name: input.workspaceName?.trim() || `${displayName} Workspace`,
    ownerId: userId,
  });

  return {
    user: {
      id: userId,
      email,
      name: displayName,
      isAdmin: admin,
      role: admin ? "admin" : "member",
      defaultWorkspaceId: ws.id,
      createdAt: now,
    },
    workspaces: listUserWorkspaces(userId),
  };
}

export function deleteWorkspace(workspaceId: string, requestingUserId: string): Workspace[] {
  const db = getDb();
  const user = getUserById(requestingUserId);
  if (!user || !user.isAdmin) {
    throw new Error("Forbidden: Only the Admin account (admin@socialstudio.local) can delete workspaces.");
  }

  const allWorkspaces = db
    .prepare(`SELECT id FROM workspaces ORDER BY created_at ASC`)
    .all() as { id: string }[];
  if (allWorkspaces.length <= 1) {
    throw new Error("Cannot delete the last remaining workspace. Create another workspace first.");
  }

  const target = getWorkspaceById(workspaceId);
  if (!target) {
    throw new Error("Workspace not found.");
  }

  clearWorkspaceData(workspaceId);
  db.prepare(`DELETE FROM mcp_connections WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM scene_reference_assignments WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM storyboard_scenes WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM storyboards WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM video_projects WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM reference_entities WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM unified_assets WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM flow_credit_snapshots WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM video_generations WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM media_api_connections WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM social_trackers WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM creative_audits WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM radar_signals WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM gemini_connections WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM ai_provider_configs WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM platform_presets WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(workspaceId);

  return listUserWorkspaces(requestingUserId);
}

// ============================================================================
// BRANDS & DOMAINS (Workspace-Isolated)
// ============================================================================

function mapBrandRow(row: Record<string, unknown>): Brand {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    domain: String(row.domain),
    websiteUrl: String(row.website_url),
    logoAssetPath: row.logo_asset_path ? String(row.logo_asset_path) : null,
    logoDataUrl: row.logo_data_url ? String(row.logo_data_url) : null,
    activeKitId: row.active_kit_id ? String(row.active_kit_id) : null,
    status: (row.status as "active" | "archived") ?? "active",
    createdAt: String(row.created_at),
  };
}

export function listBrands(workspaceId: string): Brand[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM brands WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapBrandRow);
}

export function getBrandById(workspaceId: string, brandId: string): Brand | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM brands WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, brandId) as Record<string, unknown> | undefined;
  return row ? mapBrandRow(row) : null;
}

export function createBrand(
  workspaceId: string,
  input: {
    name: string;
    domain: string;
    websiteUrl: string;
    logoAssetPath?: string | null;
    logoDataUrl?: string | null;
  }
): Brand {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO brands (id, workspace_id, name, domain, website_url, logo_asset_path, logo_data_url, active_kit_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?)`
  ).run(
    id,
    workspaceId,
    input.name.trim(),
    input.domain.trim().toLowerCase(),
    input.websiteUrl.trim(),
    input.logoAssetPath ?? null,
    input.logoDataUrl ?? null,
    now
  );

  return getBrandById(workspaceId, id)!;
}

export function updateBrand(
  workspaceId: string,
  brandId: string,
  input: {
    name?: string;
    domain?: string;
    websiteUrl?: string;
    logoAssetPath?: string | null;
    logoDataUrl?: string | null;
    activeKitId?: string | null;
  }
): Brand {
  const db = getDb();
  const existing = getBrandById(workspaceId, brandId);
  if (!existing) {
    throw new Error("Brand not found in this workspace.");
  }

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  const nextDomain =
    input.domain !== undefined ? input.domain.trim().toLowerCase() : existing.domain;
  const nextUrl =
    input.websiteUrl !== undefined ? input.websiteUrl.trim() : existing.websiteUrl;
  const nextLogoPath =
    input.logoAssetPath !== undefined ? input.logoAssetPath : existing.logoAssetPath;
  const nextLogoDataUrl =
    input.logoDataUrl !== undefined ? input.logoDataUrl : existing.logoDataUrl;
  const nextActiveKitId =
    input.activeKitId !== undefined ? input.activeKitId : existing.activeKitId;

  db.prepare(
    `UPDATE brands
     SET name = ?, domain = ?, website_url = ?, logo_asset_path = ?, logo_data_url = ?, active_kit_id = ?
     WHERE workspace_id = ? AND id = ?`
  ).run(
    nextName,
    nextDomain,
    nextUrl,
    nextLogoPath,
    nextLogoDataUrl,
    nextActiveKitId,
    workspaceId,
    brandId
  );

  return getBrandById(workspaceId, brandId)!;
}

export function updateBrandActiveKit(
  workspaceId: string,
  brandId: string,
  kitId: string
): Brand {
  return updateBrand(workspaceId, brandId, { activeKitId: kitId });
}

// ============================================================================
// BRAND KITS (Workspace-Isolated & Versioned)
// ============================================================================

function mapBrandKitRow(row: Record<string, unknown>): BrandKit {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    version: Number(row.version),
    name: String(row.name),
    status: row.status as BrandKit["status"],
    colors: JSON.parse(String(row.colors_json)),
    typography: JSON.parse(String(row.typography_json)),
    visualStyle: JSON.parse(String(row.visual_style_json)),
    extractionMeta: JSON.parse(String(row.extraction_meta_json)),
    createdAt: String(row.created_at),
  };
}

export function listBrandKits(workspaceId: string, brandId?: string): BrandKit[] {
  const db = getDb();
  if (brandId) {
    const rows = db
      .prepare(
        `SELECT * FROM brand_kits WHERE workspace_id = ? AND brand_id = ? ORDER BY version DESC`
      )
      .all(workspaceId, brandId) as Array<Record<string, unknown>>;
    return rows.map(mapBrandKitRow);
  }
  const rows = db
    .prepare(`SELECT * FROM brand_kits WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapBrandKitRow);
}

export function getBrandKitById(workspaceId: string, kitId: string): BrandKit | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM brand_kits WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, kitId) as Record<string, unknown> | undefined;
  return row ? mapBrandKitRow(row) : null;
}

export function createBrandKit(
  workspaceId: string,
  input: {
    brandId: string;
    name?: string;
    status?: "draft" | "approved";
    colors: BrandColors;
    typography: BrandTypography;
    visualStyle: BrandVisualStyle;
    extractionMeta: ExtractionMetadata;
  }
): BrandKit {
  const db = getDb();
  const brand = getBrandById(workspaceId, input.brandId);
  if (!brand) {
    throw new Error("Cannot create Brand Kit: Brand does not belong to this workspace.");
  }

  const maxRow = db
    .prepare(
      `SELECT MAX(version) as max_version FROM brand_kits WHERE workspace_id = ? AND brand_id = ?`
    )
    .get(workspaceId, input.brandId) as { max_version: number | null } | undefined;

  const nextVersion = (maxRow?.max_version ?? 0) + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const kitName = input.name?.trim() || `${brand.name} Brand Kit v${nextVersion}`;
  const status = input.status ?? "approved";

  db.prepare(
    `INSERT INTO brand_kits (id, workspace_id, brand_id, version, name, status, colors_json, typography_json, visual_style_json, extraction_meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.brandId,
    nextVersion,
    kitName,
    status,
    JSON.stringify(input.colors),
    JSON.stringify(input.typography),
    JSON.stringify(input.visualStyle),
    JSON.stringify(input.extractionMeta),
    now
  );

  if (status === "approved" || !brand.activeKitId) {
    updateBrandActiveKit(workspaceId, brand.id, id);
  }

  return getBrandKitById(workspaceId, id)!;
}

export function updateBrandKit(
  workspaceId: string,
  kitId: string,
  input: {
    name?: string;
    status?: "draft" | "approved" | "archived";
    colors?: BrandColors;
    typography?: BrandTypography;
    visualStyle?: BrandVisualStyle;
    createNewVersion?: boolean;
  }
): BrandKit {
  const db = getDb();
  const existing = getBrandKitById(workspaceId, kitId);
  if (!existing) {
    throw new Error("Brand Kit not found in this workspace.");
  }

  if (input.createNewVersion) {
    return createBrandKit(workspaceId, {
      brandId: existing.brandId,
      name: input.name,
      status: input.status === "archived" ? "draft" : (input.status ?? "approved"),
      colors: input.colors ?? existing.colors,
      typography: input.typography ?? existing.typography,
      visualStyle: input.visualStyle ?? existing.visualStyle,
      extractionMeta: existing.extractionMeta,
    });
  }

  const nextName = input.name?.trim() || existing.name;
  const nextStatus = input.status ?? existing.status;
  const nextColors = input.colors ?? existing.colors;
  const nextTypography = input.typography ?? existing.typography;
  const nextVisualStyle = input.visualStyle ?? existing.visualStyle;

  db.prepare(
    `UPDATE brand_kits
     SET name = ?, status = ?, colors_json = ?, typography_json = ?, visual_style_json = ?
     WHERE workspace_id = ? AND id = ?`
  ).run(
    nextName,
    nextStatus,
    JSON.stringify(nextColors),
    JSON.stringify(nextTypography),
    JSON.stringify(nextVisualStyle),
    workspaceId,
    kitId
  );

  if (nextStatus === "approved") {
    updateBrandActiveKit(workspaceId, existing.brandId, kitId);
  }

  return getBrandKitById(workspaceId, kitId)!;
}

// ============================================================================
// PLATFORM PRESETS (Configurable per Workspace)
// ============================================================================

export function listPlatformPresets(workspaceId: string): PlatformPreset[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM platform_presets WHERE workspace_id = ? ORDER BY platform ASC, format_name ASC`)
    .all(workspaceId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    platform: row.platform as SocialPlatform,
    formatName: String(row.format_name),
    width: Number(row.width),
    height: Number(row.height),
    safeMarginPx: Number(row.safe_margin_px),
    isActive: Number(row.is_active) === 1,
  }));
}

export function upsertPlatformPreset(
  workspaceId: string,
  input: {
    id?: string;
    platform: SocialPlatform;
    formatName: string;
    width: number;
    height: number;
    safeMarginPx?: number;
    isActive?: boolean;
  }
): PlatformPreset {
  const db = getDb();
  const width = Math.max(320, Math.min(4096, Math.round(input.width)));
  const height = Math.max(320, Math.min(4096, Math.round(input.height)));
  const safeMarginPx = Math.max(24, Math.min(240, Math.round(input.safeMarginPx ?? 72)));
  const isActive = input.isActive ?? true;

  if (input.id) {
    db.prepare(
      `UPDATE platform_presets
       SET platform = ?, format_name = ?, width = ?, height = ?, safe_margin_px = ?, is_active = ?
       WHERE workspace_id = ? AND id = ?`
    ).run(
      input.platform,
      input.formatName.trim(),
      width,
      height,
      safeMarginPx,
      isActive ? 1 : 0,
      workspaceId,
      input.id
    );
    return listPlatformPresets(workspaceId).find((p) => p.id === input.id)!;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO platform_presets (id, workspace_id, platform, format_name, width, height, safe_margin_px, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.platform,
    input.formatName.trim(),
    width,
    height,
    safeMarginPx,
    isActive ? 1 : 0
  );

  return listPlatformPresets(workspaceId).find((p) => p.id === id)!;
}

// ============================================================================
// CAMPAIGNS & CONTENT ITEMS (Workspace-Isolated)
// ============================================================================

function mapCampaignRow(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    brandKitId: String(row.brand_kit_id),
    name: String(row.name),
    objective: String(row.objective),
    inputMode: row.input_mode as CampaignInputMode,
    topic: String(row.topic),
    seoKeywords: JSON.parse(String(row.seo_keywords_json)),
    targetAudience: String(row.target_audience),
    toneOfVoice: String(row.tone_of_voice),
    status: row.status as Campaign["status"],
    createdAt: String(row.created_at),
  };
}

export function listCampaigns(workspaceId: string, brandId?: string): Campaign[] {
  const db = getDb();
  if (brandId) {
    const rows = db
      .prepare(
        `SELECT * FROM campaigns WHERE workspace_id = ? AND brand_id = ? ORDER BY created_at DESC`
      )
      .all(workspaceId, brandId) as Array<Record<string, unknown>>;
    return rows.map(mapCampaignRow);
  }
  const rows = db
    .prepare(`SELECT * FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapCampaignRow);
}

export function getCampaignById(workspaceId: string, campaignId: string): Campaign | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM campaigns WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, campaignId) as Record<string, unknown> | undefined;
  return row ? mapCampaignRow(row) : null;
}

export function createCampaign(
  workspaceId: string,
  input: {
    brandId: string;
    brandKitId: string;
    name: string;
    objective: string;
    inputMode: CampaignInputMode;
    topic: string;
    seoKeywords?: string[];
    targetAudience?: string;
    toneOfVoice?: string;
  }
): Campaign {
  const db = getDb();
  const brand = getBrandById(workspaceId, input.brandId);
  const kit = getBrandKitById(workspaceId, input.brandKitId);
  if (!brand || !kit || kit.brandId !== brand.id) {
    throw new Error("Invalid Brand or Brand Kit for this workspace.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO campaigns (id, workspace_id, brand_id, brand_kit_id, name, objective, input_mode, topic, seo_keywords_json, target_audience, tone_of_voice, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?)`
  ).run(
    id,
    workspaceId,
    input.brandId,
    input.brandKitId,
    input.name.trim(),
    input.objective.trim(),
    input.inputMode,
    input.topic.trim(),
    JSON.stringify(input.seoKeywords ?? []),
    input.targetAudience?.trim() ?? "General audience",
    input.toneOfVoice?.trim() ?? kit.visualStyle.characteristic,
    now
  );

  return getCampaignById(workspaceId, id)!;
}

export function updateCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: Campaign["status"]
): void {
  const db = getDb();
  db.prepare(`UPDATE campaigns SET status = ? WHERE workspace_id = ? AND id = ?`).run(
    status,
    workspaceId,
    campaignId
  );
}

function mapContentItemRow(row: Record<string, unknown>): ContentItem {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    campaignId: String(row.campaign_id),
    platform: row.platform as ContentItem["platform"],
    postTitle: String(row.post_title),
    mainText: String(row.main_text),
    supportingCopy: String(row.supporting_copy),
    caption: String(row.caption),
    hashtags: JSON.parse(String(row.hashtags_json)),
    ctaText: String(row.cta_text),
    referenceUrl: String(row.reference_url),
    createdAt: String(row.created_at),
  };
}

export function createContentItem(
  workspaceId: string,
  input: {
    campaignId: string;
    platform: "shared" | SocialPlatform;
    postTitle: string;
    mainText: string;
    supportingCopy: string;
    caption: string;
    hashtags: string[];
    ctaText: string;
    referenceUrl?: string;
  }
): ContentItem {
  const db = getDb();
  const campaign = getCampaignById(workspaceId, input.campaignId);
  if (!campaign) {
    throw new Error("Campaign not found in this workspace.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO content_items (id, workspace_id, campaign_id, platform, post_title, main_text, supporting_copy, caption, hashtags_json, cta_text, reference_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.campaignId,
    input.platform,
    input.postTitle.trim(),
    input.mainText.trim(),
    input.supportingCopy.trim(),
    input.caption.trim(),
    JSON.stringify(input.hashtags),
    input.ctaText.trim(),
    input.referenceUrl?.trim() ?? "",
    now
  );

  const row = db
    .prepare(`SELECT * FROM content_items WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, id) as Record<string, unknown>;
  return mapContentItemRow(row);
}

export function listContentItems(workspaceId: string, campaignId?: string): ContentItem[] {
  const db = getDb();
  if (campaignId) {
    const rows = db
      .prepare(
        `SELECT * FROM content_items WHERE workspace_id = ? AND campaign_id = ? ORDER BY created_at DESC`
      )
      .all(workspaceId, campaignId) as Array<Record<string, unknown>>;
    return rows.map(mapContentItemRow);
  }
  const rows = db
    .prepare(`SELECT * FROM content_items WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapContentItemRow);
}

// ============================================================================
// CREATIVES, VERSIONS & APPROVAL LOGS (Workspace-Isolated)
// ============================================================================

function mapCreativeVersionRow(row: Record<string, unknown>): CreativeVersion {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    creativeId: String(row.creative_id),
    versionNumber: Number(row.version_number),
    backgroundAssetPath: String(row.background_asset_path),
    backgroundPrompt: String(row.background_prompt),
    providerUsed: String(row.provider_used),
    layoutOverrides: JSON.parse(String(row.layout_overrides_json)),
    textOverrides: JSON.parse(String(row.text_overrides_json)),
    renderedPngPath: String(row.rendered_png_path),
    renderedWebpPath: String(row.rendered_webp_path),
    createdAt: String(row.created_at),
  };
}

export function listCreativeVersions(
  workspaceId: string,
  creativeId: string
): CreativeVersion[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM creative_versions WHERE workspace_id = ? AND creative_id = ? ORDER BY version_number DESC`
    )
    .all(workspaceId, creativeId) as Array<Record<string, unknown>>;
  return rows.map(mapCreativeVersionRow);
}

function hydrateCreativeRow(row: Record<string, unknown>): Creative {
  const workspaceId = String(row.workspace_id);
  const creativeId = String(row.id);
  const currentVersionId = String(row.current_version_id);
  const versions = listCreativeVersions(workspaceId, creativeId);
  const currentVersion =
    versions.find((v) => v.id === currentVersionId) ?? versions[0];

  return {
    id: creativeId,
    workspaceId,
    campaignId: String(row.campaign_id),
    brandId: String(row.brand_id),
    brandKitId: String(row.brand_kit_id),
    contentItemId: String(row.content_item_id),
    platform: row.platform as SocialPlatform,
    formatName: String(row.format_name),
    width: Number(row.width),
    height: Number(row.height),
    variationIndex: Number(row.variation_index) as 1 | 2 | 3,
    compositionTemplate: row.composition_template as CompositionTemplate,
    approvalStatus: row.approval_status as ApprovalStatus,
    currentVersionId,
    currentVersion,
    versions,
    createdAt: String(row.created_at),
  };
}

export function getCreativeById(workspaceId: string, creativeId: string): Creative | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM creatives WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, creativeId) as Record<string, unknown> | undefined;
  return row ? hydrateCreativeRow(row) : null;
}

export function listCreatives(
  workspaceId: string,
  filters?: {
    campaignId?: string;
    brandId?: string;
    platform?: SocialPlatform;
    approvalStatus?: ApprovalStatus;
  }
): Creative[] {
  const db = getDb();
  const clauses = ["workspace_id = ?"];
  const params: Array<string> = [workspaceId];

  if (filters?.campaignId) {
    clauses.push("campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters?.brandId) {
    clauses.push("brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters?.platform) {
    clauses.push("platform = ?");
    params.push(filters.platform);
  }
  if (filters?.approvalStatus) {
    clauses.push("approval_status = ?");
    params.push(filters.approvalStatus);
  }

  const rows = db
    .prepare(
      `SELECT * FROM creatives WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, platform ASC, variation_index ASC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  return rows.map(hydrateCreativeRow);
}

export function createCreativeWithInitialVersion(
  workspaceId: string,
  input: {
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
    backgroundAssetPath: string;
    backgroundPrompt: string;
    providerUsed: string;
    layoutOverrides: LayoutOverrides;
    textOverrides: TextOverrides;
    renderedPngPath: string;
    renderedWebpPath: string;
  }
): Creative {
  const db = getDb();
  const creativeId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO creatives (id, workspace_id, campaign_id, brand_id, brand_kit_id, content_item_id, platform, format_name, width, height, variation_index, composition_template, approval_status, current_version_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    creativeId,
    workspaceId,
    input.campaignId,
    input.brandId,
    input.brandKitId,
    input.contentItemId,
    input.platform,
    input.formatName,
    input.width,
    input.height,
    input.variationIndex,
    input.compositionTemplate,
    versionId,
    now
  );

  db.prepare(
    `INSERT INTO creative_versions (id, workspace_id, creative_id, version_number, background_asset_path, background_prompt, provider_used, layout_overrides_json, text_overrides_json, rendered_png_path, rendered_webp_path, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    versionId,
    workspaceId,
    creativeId,
    input.backgroundAssetPath,
    input.backgroundPrompt,
    input.providerUsed,
    JSON.stringify(input.layoutOverrides),
    JSON.stringify(input.textOverrides),
    input.renderedPngPath,
    input.renderedWebpPath,
    now
  );

  return getCreativeById(workspaceId, creativeId)!;
}

export function appendCreativeVersion(
  workspaceId: string,
  creativeId: string,
  input: {
    backgroundAssetPath: string;
    backgroundPrompt: string;
    providerUsed: string;
    layoutOverrides: LayoutOverrides;
    textOverrides: TextOverrides;
    renderedPngPath: string;
    renderedWebpPath: string;
    resetApprovalToPending?: boolean;
  }
): Creative {
  const db = getDb();
  const existing = getCreativeById(workspaceId, creativeId);
  if (!existing) {
    throw new Error("Creative not found in this workspace.");
  }

  const maxRow = db
    .prepare(
      `SELECT MAX(version_number) as max_ver FROM creative_versions WHERE workspace_id = ? AND creative_id = ?`
    )
    .get(workspaceId, creativeId) as { max_ver: number | null } | undefined;

  const nextVersionNumber = (maxRow?.max_ver ?? 1) + 1;
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO creative_versions (id, workspace_id, creative_id, version_number, background_asset_path, background_prompt, provider_used, layout_overrides_json, text_overrides_json, rendered_png_path, rendered_webp_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    versionId,
    workspaceId,
    creativeId,
    nextVersionNumber,
    input.backgroundAssetPath,
    input.backgroundPrompt,
    input.providerUsed,
    JSON.stringify(input.layoutOverrides),
    JSON.stringify(input.textOverrides),
    input.renderedPngPath,
    input.renderedWebpPath,
    now
  );

  const nextApprovalStatus =
    input.resetApprovalToPending === false ? existing.approvalStatus : "pending";

  db.prepare(
    `UPDATE creatives SET current_version_id = ?, approval_status = ? WHERE workspace_id = ? AND id = ?`
  ).run(versionId, nextApprovalStatus, workspaceId, creativeId);

  return getCreativeById(workspaceId, creativeId)!;
}

export function restoreCreativeVersion(
  workspaceId: string,
  creativeId: string,
  versionId: string
): Creative {
  const db = getDb();
  const existing = getCreativeById(workspaceId, creativeId);
  if (!existing) {
    throw new Error("Creative not found in this workspace.");
  }
  const targetVersion = existing.versions?.find((v) => v.id === versionId);
  if (!targetVersion) {
    throw new Error("Requested version does not belong to this creative.");
  }
  db.prepare(
    `UPDATE creatives SET current_version_id = ? WHERE workspace_id = ? AND id = ?`
  ).run(versionId, workspaceId, creativeId);
  return getCreativeById(workspaceId, creativeId)!;
}

export function setCreativeApprovalStatus(
  workspaceId: string,
  creativeIds: string[],
  status: ApprovalStatus,
  actorName = "Studio Reviewer",
  note = ""
): Creative[] {
  const db = getDb();
  const now = new Date().toISOString();
  const updated: Creative[] = [];

  for (const creativeId of creativeIds) {
    const existing = getCreativeById(workspaceId, creativeId);
    if (!existing) continue;

    db.prepare(
      `UPDATE creatives SET approval_status = ? WHERE workspace_id = ? AND id = ?`
    ).run(status, workspaceId, creativeId);

    const logAction =
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "reset";

    db.prepare(
      `INSERT INTO approval_logs (id, workspace_id, creative_id, version_id, action, actor_name, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      workspaceId,
      creativeId,
      existing.currentVersionId,
      logAction,
      actorName,
      note,
      now
    );

    updated.push(getCreativeById(workspaceId, creativeId)!);
  }

  return updated;
}

export function listApprovalLogs(workspaceId: string, creativeId?: string): ApprovalLog[] {
  const db = getDb();
  const rows = creativeId
    ? (db
        .prepare(
          `SELECT * FROM approval_logs WHERE workspace_id = ? AND creative_id = ? ORDER BY created_at DESC`
        )
        .all(workspaceId, creativeId) as Array<Record<string, unknown>>)
    : (db
        .prepare(`SELECT * FROM approval_logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`)
        .all(workspaceId) as Array<Record<string, unknown>>);

  return rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    creativeId: String(row.creative_id),
    versionId: String(row.version_id),
    action: row.action as ApprovalLog["action"],
    actorName: String(row.actor_name),
    note: String(row.note),
    createdAt: String(row.created_at),
  }));
}

// ============================================================================
// EXPORT JOBS & AI PROVIDER CONFIGS
// ============================================================================

export function createExportJob(
  workspaceId: string,
  input: {
    campaignId: string;
    brandName: string;
    campaignName: string;
    format: "png" | "webp" | "both";
    zipAssetPath: string;
    fileCount: number;
    manifestPaths: string[];
  }
): ExportJob {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO export_jobs (id, workspace_id, campaign_id, brand_name, campaign_name, format, zip_asset_path, file_count, manifest_paths_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.campaignId,
    input.brandName,
    input.campaignName,
    input.format,
    input.zipAssetPath,
    input.fileCount,
    JSON.stringify(input.manifestPaths),
    now
  );

  updateCampaignStatus(workspaceId, input.campaignId, "exported");

  return {
    id,
    workspaceId,
    campaignId: input.campaignId,
    brandName: input.brandName,
    campaignName: input.campaignName,
    format: input.format,
    zipAssetPath: input.zipAssetPath,
    fileCount: input.fileCount,
    manifestPaths: input.manifestPaths,
    createdAt: now,
  };
}

export function listExportJobs(workspaceId: string): ExportJob[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM export_jobs WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    campaignId: String(row.campaign_id),
    brandName: String(row.brand_name),
    campaignName: String(row.campaign_name),
    format: row.format as ExportJob["format"],
    zipAssetPath: String(row.zip_asset_path),
    fileCount: Number(row.file_count),
    manifestPaths: JSON.parse(String(row.manifest_paths_json)),
    createdAt: String(row.created_at),
  }));
}

export function getExportJobById(workspaceId: string, exportId: string): ExportJob | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM export_jobs WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, exportId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    campaignId: String(row.campaign_id),
    brandName: String(row.brand_name),
    campaignName: String(row.campaign_name),
    format: row.format as ExportJob["format"],
    zipAssetPath: String(row.zip_asset_path),
    fileCount: Number(row.file_count),
    manifestPaths: JSON.parse(String(row.manifest_paths_json)),
    createdAt: String(row.created_at),
  };
}

export function listAIProviderConfigs(workspaceId: string): AIProviderConfig[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM ai_provider_configs WHERE workspace_id = ? ORDER BY provider_type ASC, is_primary DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    providerType: row.provider_type as AIProviderConfig["providerType"],
    providerKey: row.provider_key as AIProviderConfig["providerKey"],
    displayName: String(row.display_name),
    endpointUrl: String(row.endpoint_url),
    modelId: String(row.model_id),
    isEnabled: Number(row.is_enabled) === 1,
    isPrimary: Number(row.is_primary) === 1,
    stats: JSON.parse(String(row.stats_json)),
  }));
}

export function updateAIProviderConfig(
  workspaceId: string,
  configId: string,
  input: {
    endpointUrl?: string;
    modelId?: string;
    isEnabled?: boolean;
    isPrimary?: boolean;
  }
): AIProviderConfig {
  const db = getDb();
  const existing = listAIProviderConfigs(workspaceId).find((c) => c.id === configId);
  if (!existing) {
    throw new Error("AI Provider configuration not found in this workspace.");
  }

  if (input.isPrimary) {
    db.prepare(
      `UPDATE ai_provider_configs SET is_primary = 0 WHERE workspace_id = ? AND provider_type = ?`
    ).run(workspaceId, existing.providerType);
  }

  db.prepare(
    `UPDATE ai_provider_configs
     SET endpoint_url = ?, model_id = ?, is_enabled = ?, is_primary = ?
     WHERE workspace_id = ? AND id = ?`
  ).run(
    input.endpointUrl?.trim() ?? existing.endpointUrl,
    input.modelId?.trim() ?? existing.modelId,
    (input.isEnabled ?? existing.isEnabled) ? 1 : 0,
    (input.isPrimary ?? existing.isPrimary) ? 1 : 0,
    workspaceId,
    configId
  );

  return listAIProviderConfigs(workspaceId).find((c) => c.id === configId)!;
}

export function recordAIProviderTelemetry(
  workspaceId: string,
  providerType: "image" | "text",
  providerKey: AIProviderConfig["providerKey"],
  outcome: { failed?: boolean; fallbackTriggered?: boolean; costUsd?: number }
): void {
  const db = getDb();
  const configs = listAIProviderConfigs(workspaceId);
  const target = configs.find(
    (c) => c.providerType === providerType && c.providerKey === providerKey
  );
  if (!target) return;

  const nextStats = {
    totalRequests: target.stats.totalRequests + 1,
    failedRequests: target.stats.failedRequests + (outcome.failed ? 1 : 0),
    fallbackCount: target.stats.fallbackCount + (outcome.fallbackTriggered ? 1 : 0),
    estimatedCostUsd: Number(
      (target.stats.estimatedCostUsd + (outcome.costUsd ?? 0)).toFixed(4)
    ),
    lastUsedAt: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE ai_provider_configs SET stats_json = ? WHERE workspace_id = ? AND id = ?`
  ).run(JSON.stringify(nextStats), workspaceId, target.id);
}

export function getDashboardMetrics(workspaceId: string): DashboardMetrics {
  const db = getDb();
  const totalBrands = Number(
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM brands WHERE workspace_id = ?`)
        .get(workspaceId) as { c: number }
    ).c
  );
  const totalCampaigns = Number(
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM campaigns WHERE workspace_id = ?`)
        .get(workspaceId) as { c: number }
    ).c
  );
  const totalCreatives = Number(
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM creatives WHERE workspace_id = ?`)
        .get(workspaceId) as { c: number }
    ).c
  );
  const pendingApprovals = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM creatives WHERE workspace_id = ? AND approval_status = 'pending'`
        )
        .get(workspaceId) as { c: number }
    ).c
  );
  const approvedCreatives = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM creatives WHERE workspace_id = ? AND approval_status = 'approved'`
        )
        .get(workspaceId) as { c: number }
    ).c
  );
  const completedExports = Number(
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM export_jobs WHERE workspace_id = ?`)
        .get(workspaceId) as { c: number }
    ).c
  );
  const activeRadarSignals = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM radar_signals WHERE workspace_id = ? AND status = 'new'`
        )
        .get(workspaceId) as { c: number }
    ).c
  );
  const trackedPostsCount = Number(
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM social_trackers WHERE workspace_id = ?`)
        .get(workspaceId) as { c: number }
    ).c
  );

  return {
    totalBrands,
    totalCampaigns,
    totalCreatives,
    pendingApprovals,
    approvedCreatives,
    completedExports,
    activeRadarSignals,
    trackedPostsCount,
  };
}

// ============================================================================
// MULTI-USER / MULTI-WORKSPACE GEMINI CONNECTIONS VAULT
// ============================================================================

const DEFAULT_GEMINI_CAPABILITIES: GeminiCapabilities = {
  textGeneration: true,
  searchGrounding: true,
  visionAudit: true,
  imageGeneration: true,
  videoGeneration: false,
  embeddings: true,
  discoveredModels: [],
  lastCheckedAt: null,
};

function mapGeminiConnectionRow(
  row: Record<string, unknown>
): GeminiConnectionSummary {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    scope: row.scope as GeminiConnectionScope,
    label: String(row.label),
    connectionMode: row.connection_mode as GeminiConnectionMode,
    endpointBaseUrl: String(row.endpoint_base_url),
    textModel: String(row.text_model),
    imageModel: String(row.image_model),
    hasKey: Boolean(row.encrypted_api_key),
    keyLast4: String(row.key_last4),
    isActive: Number(row.is_active) === 1,
    capabilities: JSON.parse(String(row.capabilities_json)),
    updatedAt: String(row.updated_at),
  };
}

export function listGeminiConnections(
  workspaceId: string,
  userId: string
): GeminiConnectionSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM gemini_connections
       WHERE (scope = 'workspace' AND workspace_id = ?)
          OR (scope = 'user' AND user_id = ? AND workspace_id = ?)
       ORDER BY CASE WHEN scope = 'user' THEN 0 ELSE 1 END, updated_at DESC`
    )
    .all(workspaceId, userId, workspaceId) as Array<Record<string, unknown>>;

  return rows.map(mapGeminiConnectionRow);
}

export function upsertGeminiConnection(input: {
  workspaceId: string;
  userId: string;
  scope: GeminiConnectionScope;
  label: string;
  connectionMode?: GeminiConnectionMode;
  endpointBaseUrl?: string;
  textModel?: string;
  imageModel?: string;
  apiKey: string;
  capabilities?: GeminiCapabilities;
}): GeminiConnectionSummary {
  const db = getDb();
  const cleanedKey = input.apiKey.trim();
  if (cleanedKey.length < 12) {
    throw new Error("Provide a valid Gemini API key (at least 12 characters).");
  }

  const encrypted = encryptSecret(cleanedKey);
  const keyLast4 = cleanedKey.slice(-4);
  const now = new Date().toISOString();
  const connectionMode = input.connectionMode ?? "google_ai_studio";
  const endpointBaseUrl =
    input.endpointBaseUrl?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta/models";
  const textModel = input.textModel?.trim() || "gemini-flash-latest";
  const imageModel = input.imageModel?.trim() || "auto";
  const capabilities = input.capabilities ?? DEFAULT_GEMINI_CAPABILITIES;

  // One active connection per (scope, user/workspace)
  if (input.scope === "user") {
    db.prepare(
      `UPDATE gemini_connections SET is_active = 0 WHERE scope = 'user' AND user_id = ? AND workspace_id = ?`
    ).run(input.userId, input.workspaceId);
  } else {
    db.prepare(
      `UPDATE gemini_connections SET is_active = 0 WHERE scope = 'workspace' AND workspace_id = ?`
    ).run(input.workspaceId);
  }

  const existing =
    input.scope === "user"
      ? (db
          .prepare(
            `SELECT id FROM gemini_connections WHERE scope = 'user' AND user_id = ? AND workspace_id = ? LIMIT 1`
          )
          .get(input.userId, input.workspaceId) as { id: string } | undefined)
      : (db
          .prepare(
            `SELECT id FROM gemini_connections WHERE scope = 'workspace' AND workspace_id = ? LIMIT 1`
          )
          .get(input.workspaceId) as { id: string } | undefined);

  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    db.prepare(
      `UPDATE gemini_connections
       SET workspace_id = ?, label = ?, connection_mode = ?, endpoint_base_url = ?, text_model = ?, image_model = ?, encrypted_api_key = ?, key_last4 = ?, is_active = 1, capabilities_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.workspaceId,
      input.label.trim() || (input.scope === "user" ? "Personal Gemini Key" : "Workspace Gemini Key"),
      connectionMode,
      endpointBaseUrl,
      textModel,
      imageModel,
      encrypted,
      keyLast4,
      JSON.stringify(capabilities),
      now,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO gemini_connections (id, workspace_id, user_id, scope, label, connection_mode, endpoint_base_url, text_model, image_model, encrypted_api_key, key_last4, is_active, capabilities_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      id,
      input.workspaceId,
      input.userId,
      input.scope,
      input.label.trim() || (input.scope === "user" ? "Personal Gemini Key" : "Workspace Gemini Key"),
      connectionMode,
      endpointBaseUrl,
      textModel,
      imageModel,
      encrypted,
      keyLast4,
      JSON.stringify(capabilities),
      now
    );
  }

  const row = db
    .prepare(`SELECT * FROM gemini_connections WHERE id = ?`)
    .get(id) as Record<string, unknown>;
  return mapGeminiConnectionRow(row);
}

export function updateGeminiConnectionModelsAndCapabilities(input: {
  connectionId: string;
  userId: string;
  workspaceId: string;
  textModel?: string;
  imageModel?: string;
  isActive?: boolean;
  capabilities?: GeminiCapabilities;
}): GeminiConnectionSummary {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM gemini_connections
       WHERE id = ? AND ((scope = 'user' AND user_id = ?) OR (scope = 'workspace' AND workspace_id = ?))`
    )
    .get(input.connectionId, input.userId, input.workspaceId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error("Gemini connection not found in this user or workspace.");
  }

  const current = mapGeminiConnectionRow(row);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE gemini_connections
     SET text_model = ?, image_model = ?, is_active = ?, capabilities_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.textModel ?? current.textModel,
    input.imageModel ?? current.imageModel,
    (input.isActive ?? current.isActive) ? 1 : 0,
    JSON.stringify(input.capabilities ?? current.capabilities),
    now,
    current.id
  );

  const updated = db
    .prepare(`SELECT * FROM gemini_connections WHERE id = ?`)
    .get(current.id) as Record<string, unknown>;
  return mapGeminiConnectionRow(updated);
}

export function deleteGeminiConnection(
  connectionId: string,
  userId: string,
  workspaceId: string
): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM gemini_connections
     WHERE id = ? AND ((scope = 'user' AND user_id = ?) OR (scope = 'workspace' AND workspace_id = ?))`
  ).run(connectionId, userId, workspaceId);
}

export interface ResolvedGeminiCredentials {
  apiKey: string | null;
  endpointBaseUrl: string;
  textModel: string;
  imageModel: string;
  sourceScope: "user" | "workspace" | "env" | "none";
  connectionId: string | null;
  keyLast4: string;
}

export function resolveActiveGeminiCredentials(
  workspaceId?: string,
  userId?: string
): ResolvedGeminiCredentials {
  const db = getDb();

  // 1. Personal User Key takes priority if active
  if (userId) {
    const userRow = db
      .prepare(
        `SELECT * FROM gemini_connections WHERE scope = 'user' AND user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`
      )
      .get(userId) as Record<string, unknown> | undefined;
    if (userRow) {
      const decrypted = decryptSecret(String(userRow.encrypted_api_key));
      if (decrypted) {
        return {
          apiKey: decrypted,
          endpointBaseUrl: String(userRow.endpoint_base_url),
          textModel: String(userRow.text_model),
          imageModel: String(userRow.image_model),
          sourceScope: "user",
          connectionId: String(userRow.id),
          keyLast4: String(userRow.key_last4),
        };
      }
    }
  }

  // 2. Workspace Shared Key next if active
  if (workspaceId) {
    const wsRow = db
      .prepare(
        `SELECT * FROM gemini_connections WHERE scope = 'workspace' AND workspace_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`
      )
      .get(workspaceId) as Record<string, unknown> | undefined;
    if (wsRow) {
      const decrypted = decryptSecret(String(wsRow.encrypted_api_key));
      if (decrypted) {
        return {
          apiKey: decrypted,
          endpointBaseUrl: String(wsRow.endpoint_base_url),
          textModel: String(wsRow.text_model),
          imageModel: String(wsRow.image_model),
          sourceScope: "workspace",
          connectionId: String(wsRow.id),
          keyLast4: String(wsRow.key_last4),
        };
      }
    }
  }

  // 3. Server Environment Variable fallback
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey.length > 10) {
    return {
      apiKey: envKey,
      endpointBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
      textModel: "gemini-flash-latest",
      imageModel: "auto",
      sourceScope: "env",
      connectionId: null,
      keyLast4: envKey.slice(-4),
    };
  }

  return {
    apiKey: null,
    endpointBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    textModel: "gemini-flash-latest",
    imageModel: "auto",
    sourceScope: "none",
    connectionId: null,
    keyLast4: "",
  };
}

// ============================================================================
// SOCIAL MEDIA RADAR SIGNALS (Brand, Competitor & Trend Detection)
// ============================================================================

function mapRadarSignalRow(row: Record<string, unknown>): TrendSignal {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    signalType: row.signal_type as TrendSignal["signalType"],
    title: String(row.title),
    summary: String(row.summary),
    suggestedHeadline: String(row.suggested_headline),
    seoKeywords: JSON.parse(String(row.seo_keywords_json)),
    sourceUrls: JSON.parse(String(row.source_urls_json)),
    relevanceScore: Number(row.relevance_score),
    status: row.status as TrendSignal["status"],
    createdAt: String(row.created_at),
  };
}

export function listRadarSignals(
  workspaceId: string,
  brandId?: string
): TrendSignal[] {
  const db = getDb();
  const rows = brandId
    ? (db
        .prepare(
          `SELECT * FROM radar_signals WHERE workspace_id = ? AND brand_id = ? ORDER BY created_at DESC`
        )
        .all(workspaceId, brandId) as Array<Record<string, unknown>>)
    : (db
        .prepare(
          `SELECT * FROM radar_signals WHERE workspace_id = ? ORDER BY created_at DESC`
        )
        .all(workspaceId) as Array<Record<string, unknown>>);
  return rows.map(mapRadarSignalRow);
}

export function createRadarSignals(
  workspaceId: string,
  brandId: string,
  signals: Array<
    Omit<TrendSignal, "id" | "workspaceId" | "brandId" | "status" | "createdAt">
  >
): TrendSignal[] {
  const db = getDb();
  const brand = getBrandById(workspaceId, brandId);
  if (!brand) {
    throw new Error("Brand not found in this workspace.");
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO radar_signals (id, workspace_id, brand_id, signal_type, title, summary, suggested_headline, seo_keywords_json, source_urls_json, relevance_score, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
  );

  const created: TrendSignal[] = [];
  for (const sig of signals) {
    const id = crypto.randomUUID();
    stmt.run(
      id,
      workspaceId,
      brandId,
      sig.signalType,
      sig.title.trim(),
      sig.summary.trim(),
      sig.suggestedHeadline.trim(),
      JSON.stringify(sig.seoKeywords),
      JSON.stringify(sig.sourceUrls),
      Math.max(1, Math.min(100, Math.round(sig.relevanceScore))),
      now
    );
    created.push({
      id,
      workspaceId,
      brandId,
      signalType: sig.signalType,
      title: sig.title.trim(),
      summary: sig.summary.trim(),
      suggestedHeadline: sig.suggestedHeadline.trim(),
      seoKeywords: sig.seoKeywords,
      sourceUrls: sig.sourceUrls,
      relevanceScore: Math.max(1, Math.min(100, Math.round(sig.relevanceScore))),
      status: "new",
      createdAt: now,
    });
  }

  return created;
}

export function updateRadarSignalStatus(
  workspaceId: string,
  signalId: string,
  status: TrendSignal["status"]
): void {
  const db = getDb();
  db.prepare(
    `UPDATE radar_signals SET status = ? WHERE workspace_id = ? AND id = ?`
  ).run(status, workspaceId, signalId);
}

// ============================================================================
// GEMINI VISION CREATIVE AUDITS (Quality & Readiness Detector)
// ============================================================================

function mapCreativeAuditRow(row: Record<string, unknown>): CreativeAudit {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    creativeId: String(row.creative_id),
    versionId: String(row.version_id),
    overallScore: Number(row.overall_score),
    legibilityScore: Number(row.legibility_score),
    brandConsistencyScore: Number(row.brand_consistency_score),
    visualAppealScore: Number(row.visual_appeal_score),
    strengths: JSON.parse(String(row.strengths_json)),
    recommendations: JSON.parse(String(row.recommendations_json)),
    suggestedHeadline: row.suggested_headline
      ? String(row.suggested_headline)
      : undefined,
    auditedByModel: String(row.audited_by_model),
    createdAt: String(row.created_at),
  };
}

export function saveCreativeAudit(
  workspaceId: string,
  input: Omit<CreativeAudit, "id" | "workspaceId" | "createdAt">
): CreativeAudit {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO creative_audits (id, workspace_id, creative_id, version_id, overall_score, legibility_score, brand_consistency_score, visual_appeal_score, strengths_json, recommendations_json, suggested_headline, audited_by_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.creativeId,
    input.versionId,
    input.overallScore,
    input.legibilityScore,
    input.brandConsistencyScore,
    input.visualAppealScore,
    JSON.stringify(input.strengths),
    JSON.stringify(input.recommendations),
    input.suggestedHeadline ?? null,
    input.auditedByModel,
    now
  );

  const row = db
    .prepare(`SELECT * FROM creative_audits WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, id) as Record<string, unknown>;
  return mapCreativeAuditRow(row);
}

export function listCreativeAudits(
  workspaceId: string,
  creativeId?: string
): CreativeAudit[] {
  const db = getDb();
  const rows = creativeId
    ? (db
        .prepare(
          `SELECT * FROM creative_audits WHERE workspace_id = ? AND creative_id = ? ORDER BY created_at DESC`
        )
        .all(workspaceId, creativeId) as Array<Record<string, unknown>>)
    : (db
        .prepare(
          `SELECT * FROM creative_audits WHERE workspace_id = ? ORDER BY created_at DESC`
        )
        .all(workspaceId) as Array<Record<string, unknown>>);

  return rows.map(mapCreativeAuditRow);
}

// ============================================================================
// SOCIAL POST TRACKER & PERFORMANCE ANALYTICS
// ============================================================================

function mapSocialTrackerRow(row: Record<string, unknown>): SocialPostTracker {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    creativeId: String(row.creative_id),
    brandId: String(row.brand_id),
    campaignId: String(row.campaign_id),
    platform: row.platform as SocialPlatform,
    trackingStatus: row.tracking_status as SocialPostTracker["trackingStatus"],
    scheduledFor: String(row.scheduled_for),
    publishedUrl: String(row.published_url),
    utmTag: String(row.utm_tag),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    engagements: Number(row.engagements),
    notes: String(row.notes),
    updatedAt: String(row.updated_at),
  };
}

export function listSocialTrackers(workspaceId: string): SocialPostTracker[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM social_trackers WHERE workspace_id = ? ORDER BY updated_at DESC`
    )
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapSocialTrackerRow);
}

export function upsertSocialTracker(
  workspaceId: string,
  input: {
    id?: string;
    creativeId: string;
    trackingStatus?: SocialPostTracker["trackingStatus"];
    scheduledFor?: string;
    publishedUrl?: string;
    utmTag?: string;
    impressions?: number;
    clicks?: number;
    engagements?: number;
    notes?: string;
  }
): SocialPostTracker {
  const db = getDb();
  const creative = getCreativeById(workspaceId, input.creativeId);
  if (!creative) {
    throw new Error("Creative not found in this workspace.");
  }

  const existing = db
    .prepare(
      `SELECT * FROM social_trackers WHERE workspace_id = ? AND creative_id = ? LIMIT 1`
    )
    .get(workspaceId, creative.id) as Record<string, unknown> | undefined;

  const now = new Date().toISOString();
  const id = existing ? String(existing.id) : (input.id ?? crypto.randomUUID());
  const prev = existing ? mapSocialTrackerRow(existing) : null;

  const nextStatus =
    input.trackingStatus ?? prev?.trackingStatus ?? "planned";
  const nextScheduled =
    input.scheduledFor !== undefined
      ? input.scheduledFor
      : (prev?.scheduledFor ?? now.slice(0, 16));
  const nextPublishedUrl =
    input.publishedUrl !== undefined
      ? input.publishedUrl.trim()
      : (prev?.publishedUrl ?? "");
  const nextUtm =
    input.utmTag !== undefined
      ? input.utmTag.trim()
      : (prev?.utmTag ??
        `utm_source=${creative.platform}&utm_medium=social&utm_campaign=${creative.campaignId.slice(0, 8)}`);
  const nextImpressions =
    input.impressions !== undefined
      ? Math.max(0, Math.round(input.impressions))
      : (prev?.impressions ?? 0);
  const nextClicks =
    input.clicks !== undefined
      ? Math.max(0, Math.round(input.clicks))
      : (prev?.clicks ?? 0);
  const nextEngagements =
    input.engagements !== undefined
      ? Math.max(0, Math.round(input.engagements))
      : (prev?.engagements ?? 0);
  const nextNotes =
    input.notes !== undefined ? input.notes.trim() : (prev?.notes ?? "");

  if (existing) {
    db.prepare(
      `UPDATE social_trackers
       SET tracking_status = ?, scheduled_for = ?, published_url = ?, utm_tag = ?, impressions = ?, clicks = ?, engagements = ?, notes = ?, updated_at = ?
       WHERE workspace_id = ? AND id = ?`
    ).run(
      nextStatus,
      nextScheduled,
      nextPublishedUrl,
      nextUtm,
      nextImpressions,
      nextClicks,
      nextEngagements,
      nextNotes,
      now,
      workspaceId,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO social_trackers (id, workspace_id, creative_id, brand_id, campaign_id, platform, tracking_status, scheduled_for, published_url, utm_tag, impressions, clicks, engagements, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId,
      creative.id,
      creative.brandId,
      creative.campaignId,
      creative.platform,
      nextStatus,
      nextScheduled,
      nextPublishedUrl,
      nextUtm,
      nextImpressions,
      nextClicks,
      nextEngagements,
      nextNotes,
      now
    );
  }

  const row = db
    .prepare(`SELECT * FROM social_trackers WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, id) as Record<string, unknown>;
  return mapSocialTrackerRow(row);
}

export function deleteSocialTracker(workspaceId: string, trackerId: string): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM social_trackers WHERE workspace_id = ? AND id = ?`
  ).run(workspaceId, trackerId);
}

// ============================================================================
// UNIVERSAL MULTI-PROVIDER IMAGE & VIDEO API VAULT
// ============================================================================

export interface ResolvedMediaCredentials {
  connectionId: string;
  sourceScope: "user" | "workspace";
  capability: MediaApiCapability;
  providerPreset: MediaProviderPreset;
  label: string;
  endpointUrl: string;
  modelId: string;
  accountId: string;
  authHeaderName: string;
  authPrefix: string;
  apiKey: string;
  keyLast4: string;
}

function mapMediaApiConnectionRow(
  row: Record<string, unknown>
): MediaApiConnectionSummary {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    scope: row.scope as GeminiConnectionScope,
    capability: row.capability as MediaApiCapability,
    providerPreset: row.provider_preset as MediaProviderPreset,
    label: String(row.label),
    endpointUrl: String(row.endpoint_url),
    modelId: String(row.model_id),
    accountId: String(row.account_id ?? ""),
    authHeaderName: String(row.auth_header_name ?? "Authorization"),
    authPrefix: String(row.auth_prefix ?? "Bearer "),
    hasKey: Boolean(row.encrypted_api_key),
    keyLast4: String(row.key_last4),
    isActive: Number(row.is_active) === 1,
    updatedAt: String(row.updated_at),
  };
}

export function listMediaApiConnections(
  workspaceId: string,
  userId: string
): MediaApiConnectionSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM media_api_connections
       WHERE (scope = 'workspace' AND workspace_id = ?)
          OR (scope = 'user' AND user_id = ? AND workspace_id = ?)
       ORDER BY updated_at DESC`
    )
    .all(workspaceId, userId, workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapMediaApiConnectionRow);
}

export function upsertMediaApiConnection(input: {
  workspaceId: string;
  userId: string;
  scope: GeminiConnectionScope;
  capability: MediaApiCapability;
  providerPreset: MediaProviderPreset;
  label: string;
  endpointUrl: string;
  modelId: string;
  accountId?: string;
  authHeaderName?: string;
  authPrefix?: string;
  apiKey: string;
}): MediaApiConnectionSummary {
  const db = getDb();
  const cleanedKey = input.apiKey.trim();
  if (cleanedKey.length < 8) {
    throw new Error("Provide a valid API key (at least 8 characters).");
  }

  const endpointUrl = input.endpointUrl.trim();
  if (!endpointUrl) {
    throw new Error("Endpoint URL is required.");
  }

  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("Model ID is required.");
  }

  const encrypted = encryptSecret(cleanedKey);
  const keyLast4 = cleanedKey.slice(-4);
  const now = new Date().toISOString();

  if (input.scope === "user") {
    db.prepare(
      `UPDATE media_api_connections SET is_active = 0 WHERE scope = 'user' AND user_id = ? AND workspace_id = ? AND capability = ?`
    ).run(input.userId, input.workspaceId, input.capability);
  } else {
    db.prepare(
      `UPDATE media_api_connections SET is_active = 0 WHERE scope = 'workspace' AND workspace_id = ? AND capability = ?`
    ).run(input.workspaceId, input.capability);
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO media_api_connections (
       id, workspace_id, user_id, scope, capability, provider_preset, label,
       endpoint_url, model_id, account_id, auth_header_name, auth_prefix,
       encrypted_api_key, key_last4, is_active, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id,
    input.workspaceId,
    input.userId,
    input.scope,
    input.capability,
    input.providerPreset,
    input.label.trim() || `${input.providerPreset} (${input.capability})`,
    endpointUrl,
    modelId,
    input.accountId?.trim() ?? "",
    input.authHeaderName !== undefined ? input.authHeaderName : "Authorization",
    input.authPrefix !== undefined ? input.authPrefix : "Bearer ",
    encrypted,
    keyLast4,
    now
  );

  const row = db
    .prepare(`SELECT * FROM media_api_connections WHERE id = ?`)
    .get(id) as Record<string, unknown>;
  return mapMediaApiConnectionRow(row);
}

export function updateMediaApiConnection(input: {
  connectionId: string;
  userId: string;
  workspaceId: string;
  label?: string;
  endpointUrl?: string;
  modelId?: string;
  capability?: MediaApiCapability;
  accountId?: string;
  authHeaderName?: string;
  authPrefix?: string;
  isActive?: boolean;
}): MediaApiConnectionSummary {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM media_api_connections
       WHERE id = ? AND ((scope = 'user' AND user_id = ?) OR (scope = 'workspace' AND workspace_id = ?))`
    )
    .get(input.connectionId, input.userId, input.workspaceId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error("Media API connection not found in this user or workspace.");
  }

  const current = mapMediaApiConnectionRow(row);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE media_api_connections
     SET label = ?, endpoint_url = ?, model_id = ?, capability = ?, account_id = ?,
         auth_header_name = ?, auth_prefix = ?, is_active = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.label?.trim() || current.label,
    input.endpointUrl?.trim() || current.endpointUrl,
    input.modelId?.trim() || current.modelId,
    input.capability ?? current.capability,
    input.accountId !== undefined ? input.accountId.trim() : current.accountId,
    input.authHeaderName !== undefined
      ? input.authHeaderName
      : current.authHeaderName,
    input.authPrefix !== undefined ? input.authPrefix : current.authPrefix,
    (input.isActive ?? current.isActive) ? 1 : 0,
    now,
    current.id
  );

  const updated = db
    .prepare(`SELECT * FROM media_api_connections WHERE id = ?`)
    .get(current.id) as Record<string, unknown>;
  return mapMediaApiConnectionRow(updated);
}

export function deleteMediaApiConnection(
  connectionId: string,
  userId: string,
  workspaceId: string
): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM media_api_connections
     WHERE id = ? AND ((scope = 'user' AND user_id = ?) OR (scope = 'workspace' AND workspace_id = ?))`
  ).run(connectionId, userId, workspaceId);
}

function toResolvedMediaCredentials(
  row: Record<string, unknown>
): ResolvedMediaCredentials | null {
  const decrypted = decryptSecret(String(row.encrypted_api_key));
  if (!decrypted) return null;
  return {
    connectionId: String(row.id),
    sourceScope: row.scope as "user" | "workspace",
    capability: row.capability as MediaApiCapability,
    providerPreset: row.provider_preset as MediaProviderPreset,
    label: String(row.label),
    endpointUrl: String(row.endpoint_url),
    modelId: String(row.model_id),
    accountId: String(row.account_id ?? ""),
    authHeaderName: String(row.auth_header_name ?? "Authorization"),
    authPrefix: String(row.auth_prefix ?? "Bearer "),
    apiKey: decrypted,
    keyLast4: String(row.key_last4),
  };
}

export function resolveActiveMediaCredentials(
  workspaceId: string | undefined,
  userId: string | undefined,
  capability: "image" | "video",
  preferredConnectionId?: string
): ResolvedMediaCredentials | null {
  const db = getDb();

  if (preferredConnectionId) {
    const specific = db
      .prepare(
        `SELECT * FROM media_api_connections
         WHERE id = ? AND ((scope = 'user' AND user_id = ?) OR (scope = 'workspace' AND workspace_id = ?))
         LIMIT 1`
      )
      .get(preferredConnectionId, userId ?? "", workspaceId ?? "") as
      | Record<string, unknown>
      | undefined;
    return specific ? toResolvedMediaCredentials(specific) : null;
  }

  // 1. Personal User Key takes priority over Workspace Shared Key
  if (userId) {
    const userRow = db
      .prepare(
        `SELECT * FROM media_api_connections
         WHERE scope = 'user' AND user_id = ? AND is_active = 1
           AND (capability = ? OR capability = 'both')
         ORDER BY CASE WHEN capability = ? THEN 0 ELSE 1 END, updated_at DESC
         LIMIT 1`
      )
      .get(userId, capability, capability) as Record<string, unknown> | undefined;
    if (userRow) {
      const resolved = toResolvedMediaCredentials(userRow);
      if (resolved) return resolved;
    }
  }

  // 2. Workspace Shared Key fallback
  if (workspaceId) {
    const wsRow = db
      .prepare(
        `SELECT * FROM media_api_connections
         WHERE scope = 'workspace' AND workspace_id = ? AND is_active = 1
           AND (capability = ? OR capability = 'both')
         ORDER BY CASE WHEN capability = ? THEN 0 ELSE 1 END, updated_at DESC
         LIMIT 1`
      )
      .get(workspaceId, capability, capability) as
      | Record<string, unknown>
      | undefined;
    if (wsRow) {
      const resolved = toResolvedMediaCredentials(wsRow);
      if (resolved) return resolved;
    }
  }

  return null;
}

// ============================================================================
// AI SOCIAL VIDEO GENERATIONS
// ============================================================================

function mapVideoGenerationRow(row: Record<string, unknown>): VideoGeneration {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    creativeId: row.creative_id ? String(row.creative_id) : null,
    platform: row.platform as SocialPlatform,
    aspectRatio: row.aspect_ratio as VideoGeneration["aspectRatio"],
    durationSeconds: Number(row.duration_seconds),
    prompt: String(row.prompt),
    providerUsed: String(row.provider_used),
    modelId: String(row.model_id),
    videoAssetPath: String(row.video_asset_path),
    mimeType: String(row.mime_type),
    status: row.status as VideoGeneration["status"],
    createdAt: String(row.created_at),
  };
}

export function createVideoGeneration(
  workspaceId: string,
  input: Omit<VideoGeneration, "id" | "workspaceId" | "createdAt">
): VideoGeneration {
  const db = getDb();
  const brand = getBrandById(workspaceId, input.brandId);
  if (!brand) {
    throw new Error("Brand not found in this workspace.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO video_generations (
       id, workspace_id, brand_id, creative_id, platform, aspect_ratio,
       duration_seconds, prompt, provider_used, model_id, video_asset_path,
       mime_type, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.brandId,
    input.creativeId ?? null,
    input.platform,
    input.aspectRatio,
    Math.max(2, Math.min(30, Math.round(input.durationSeconds))),
    input.prompt,
    input.providerUsed,
    input.modelId,
    input.videoAssetPath,
    input.mimeType || "video/mp4",
    input.status,
    now
  );

  const row = db
    .prepare(`SELECT * FROM video_generations WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, id) as Record<string, unknown>;
  return mapVideoGenerationRow(row);
}

export function listVideoGenerations(workspaceId: string): VideoGeneration[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM video_generations WHERE workspace_id = ? ORDER BY created_at DESC`
    )
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapVideoGenerationRow);
}

export function getVideoGenerationById(
  workspaceId: string,
  videoId: string
): VideoGeneration | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM video_generations WHERE workspace_id = ? AND id = ?`)
    .get(workspaceId, videoId) as Record<string, unknown> | undefined;
  return row ? mapVideoGenerationRow(row) : null;
}

export function deleteVideoGeneration(workspaceId: string, videoId: string): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM video_generations WHERE workspace_id = ? AND id = ?`
  ).run(workspaceId, videoId);
}

// ============================================================================
// PRD Sections 8, 9, 13, 14: Storyboards, Consistency Lock & Unified Media Assets
// ============================================================================

export function createVideoProject(
  workspaceId: string,
  input: Omit<import("@/types/domain").VideoProjectBrief, "id" | "workspaceId" | "createdAt" | "updatedAt">
): import("@/types/domain").VideoProjectBrief {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO video_projects (
      id, workspace_id, brand_id, name, campaign_objective, product_or_service,
      target_audience, platform, desired_duration_seconds, aspect_ratio, language,
      visual_style, creative_direction, voiceover_preference, call_to_action, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    input.brandId,
    input.name.trim(),
    input.campaignObjective.trim(),
    input.productOrService.trim(),
    input.targetAudience.trim(),
    input.platform,
    input.desiredDurationSeconds,
    input.aspectRatio,
    input.language || "en",
    input.visualStyle || "cinematic",
    input.creativeDirection.trim(),
    input.voiceoverPreference.trim(),
    input.callToAction.trim(),
    input.status || "draft",
    now,
    now
  );

  return getVideoProjectById(workspaceId, id)!;
}

export function listVideoProjects(workspaceId: string): import("@/types/domain").VideoProjectBrief[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM video_projects WHERE workspace_id = ? ORDER BY created_at DESC`).all(workspaceId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    brandId: String(r.brand_id),
    name: String(r.name),
    campaignObjective: String(r.campaign_objective),
    productOrService: String(r.product_or_service),
    targetAudience: String(r.target_audience),
    platform: r.platform as import("@/types/domain").SocialPlatform,
    desiredDurationSeconds: Number(r.desired_duration_seconds),
    aspectRatio: r.aspect_ratio as "9:16" | "16:9" | "1:1",
    language: String(r.language),
    visualStyle: String(r.visual_style),
    creativeDirection: String(r.creative_direction),
    voiceoverPreference: String(r.voiceover_preference),
    callToAction: String(r.call_to_action),
    status: r.status as import("@/types/domain").VideoProjectStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function getVideoProjectById(workspaceId: string, projectId: string): import("@/types/domain").VideoProjectBrief | null {
  const db = getDb();
  const r = db.prepare(`SELECT * FROM video_projects WHERE workspace_id = ? AND id = ?`).get(workspaceId, projectId) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    brandId: String(r.brand_id),
    name: String(r.name),
    campaignObjective: String(r.campaign_objective),
    productOrService: String(r.product_or_service),
    targetAudience: String(r.target_audience),
    platform: r.platform as import("@/types/domain").SocialPlatform,
    desiredDurationSeconds: Number(r.desired_duration_seconds),
    aspectRatio: r.aspect_ratio as "9:16" | "16:9" | "1:1",
    language: String(r.language),
    visualStyle: String(r.visual_style),
    creativeDirection: String(r.creative_direction),
    voiceoverPreference: String(r.voiceover_preference),
    callToAction: String(r.call_to_action),
    status: r.status as import("@/types/domain").VideoProjectStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function updateVideoProjectStatus(
  workspaceId: string,
  projectId: string,
  status: import("@/types/domain").VideoProjectStatus
): void {
  const db = getDb();
  db.prepare(`UPDATE video_projects SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`).run(
    status,
    new Date().toISOString(),
    workspaceId,
    projectId
  );
}

export function updateVideoProject(
  workspaceId: string,
  projectId: string,
  updates: Partial<Omit<import("@/types/domain").VideoProjectBrief, "id" | "workspaceId" | "createdAt" | "updatedAt">>
): import("@/types/domain").VideoProjectBrief | null {
  const db = getDb();
  const existing = getVideoProjectById(workspaceId, projectId);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE video_projects SET
      brand_id = ?,
      name = ?,
      campaign_objective = ?,
      product_or_service = ?,
      target_audience = ?,
      platform = ?,
      desired_duration_seconds = ?,
      aspect_ratio = ?,
      language = ?,
      visual_style = ?,
      creative_direction = ?,
      voiceover_preference = ?,
      call_to_action = ?,
      status = ?,
      updated_at = ?
    WHERE workspace_id = ? AND id = ?
  `).run(
    updates.brandId ?? existing.brandId,
    updates.name ?? existing.name,
    updates.campaignObjective ?? existing.campaignObjective,
    updates.productOrService ?? existing.productOrService,
    updates.targetAudience ?? existing.targetAudience,
    updates.platform ?? existing.platform,
    updates.desiredDurationSeconds ?? existing.desiredDurationSeconds,
    updates.aspectRatio ?? existing.aspectRatio,
    updates.language ?? existing.language,
    updates.visualStyle ?? existing.visualStyle,
    updates.creativeDirection ?? existing.creativeDirection,
    updates.voiceoverPreference ?? existing.voiceoverPreference,
    updates.callToAction ?? existing.callToAction,
    updates.status ?? existing.status,
    now,
    workspaceId,
    projectId
  );

  return getVideoProjectById(workspaceId, projectId);
}

// Storyboards & Scenes
export function getOrCreateStoryboard(workspaceId: string, videoProjectId: string): import("@/types/domain").Storyboard {
  const db = getDb();
  let row = db.prepare(`SELECT * FROM storyboards WHERE workspace_id = ? AND video_project_id = ?`).get(workspaceId, videoProjectId) as Record<string, unknown> | undefined;

  const now = new Date().toISOString();
  if (!row) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO storyboards (id, video_project_id, workspace_id, version, status, total_duration_seconds, created_at, updated_at)
      VALUES (?, ?, ?, 1, 'draft', 0, ?, ?)
    `).run(id, videoProjectId, workspaceId, now, now);
    row = db.prepare(`SELECT * FROM storyboards WHERE id = ?`).get(id) as Record<string, unknown>;
  }

  const storyboardId = String(row.id);
  const sceneRows = db.prepare(`
    SELECT * FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ? ORDER BY scene_number ASC
  `).all(storyboardId, workspaceId) as Record<string, unknown>[];

  const scenes: import("@/types/domain").StoryboardScene[] = sceneRows.map((s) => {
    const assignedRows = db.prepare(`
      SELECT reference_entity_id FROM scene_reference_assignments WHERE scene_id = ? AND workspace_id = ?
    `).all(String(s.id), workspaceId) as { reference_entity_id: string }[];

    return {
      id: String(s.id),
      storyboardId: String(s.storyboard_id),
      sceneNumber: Number(s.scene_number),
      title: String(s.title),
      durationSeconds: Number(s.duration_seconds),
      narrativePurpose: String(s.narrative_purpose),
      visualDescription: String(s.visual_description),
      subjects: String(s.subjects),
      environment: String(s.environment),
      cameraFraming: String(s.camera_framing),
      cameraMovement: String(s.camera_movement),
      lighting: String(s.lighting),
      mood: String(s.mood),
      voiceover: String(s.voiceover),
      dialogue: s.dialogue ? String(s.dialogue) : undefined,
      onScreenText: s.on_screen_text ? String(s.on_screen_text) : undefined,
      imagePrompt: String(s.image_prompt),
      videoPrompt: String(s.video_prompt),
      negativePrompt: s.negative_prompt ? String(s.negative_prompt) : undefined,
      transition: s.transition ? String(s.transition) : undefined,
      referenceImageId: s.reference_image_id ? String(s.reference_image_id) : null,
      referenceImageUrl: s.reference_image_url ? String(s.reference_image_url) : null,
      status: s.status as import("@/types/domain").SceneStatus,
      version: Number(s.version),
      assignedReferenceIds: assignedRows.map((a) => a.reference_entity_id),
      createdAt: String(s.created_at),
      updatedAt: String(s.updated_at),
    };
  });

  const totalDuration = scenes.reduce((acc, curr) => acc + curr.durationSeconds, 0);

  return {
    id: storyboardId,
    videoProjectId: String(row.video_project_id),
    version: Number(row.version),
    status: row.status as import("@/types/domain").StoryboardApprovalStatus,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    scenes,
    totalDurationSeconds: totalDuration,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function saveStoryboardScenes(
  workspaceId: string,
  storyboardId: string,
  scenesInput: Omit<import("@/types/domain").StoryboardScene, "id" | "storyboardId" | "createdAt" | "updatedAt">[]
): import("@/types/domain").StoryboardScene[] {
  const db = getDb();
  const now = new Date().toISOString();

  // Clear previous scenes and assignments for this storyboard safely
  const existingScenes = db.prepare(`SELECT id FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ?`).all(storyboardId, workspaceId) as { id: string }[];
  for (const s of existingScenes) {
    db.prepare(`DELETE FROM scene_reference_assignments WHERE scene_id = ? AND workspace_id = ?`).run(s.id, workspaceId);
  }
  db.prepare(`DELETE FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ?`).run(storyboardId, workspaceId);

  let totalDuration = 0;
  for (let idx = 0; idx < scenesInput.length; idx++) {
    const s = scenesInput[idx];
    const sceneId = crypto.randomUUID();
    const duration = Math.max(1, Math.min(60, Number(s.durationSeconds) || 3));
    totalDuration += duration;

    db.prepare(`
      INSERT INTO storyboard_scenes (
        id, storyboard_id, workspace_id, scene_number, title, duration_seconds,
        narrative_purpose, visual_description, subjects, environment, camera_framing,
        camera_movement, lighting, mood, voiceover, dialogue, on_screen_text,
        image_prompt, video_prompt, negative_prompt, transition, reference_image_id,
        reference_image_url, status, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sceneId,
      storyboardId,
      workspaceId,
      idx + 1,
      s.title || `Scene ${idx + 1}`,
      duration,
      s.narrativePurpose || "",
      s.visualDescription || "",
      s.subjects || "",
      s.environment || "",
      s.cameraFraming || "Medium shot",
      s.cameraMovement || "Slow pan",
      s.lighting || "Natural soft lighting",
      s.mood || "Dynamic",
      s.voiceover || "",
      s.dialogue || null,
      s.onScreenText || null,
      s.imagePrompt || s.visualDescription,
      s.videoPrompt || s.visualDescription,
      s.negativePrompt || null,
      s.transition || "cut",
      s.referenceImageId || null,
      s.referenceImageUrl || null,
      s.status || "ready",
      s.version || 1,
      now,
      now
    );

    if (s.assignedReferenceIds && s.assignedReferenceIds.length > 0) {
      for (const refId of s.assignedReferenceIds) {
        db.prepare(`
          INSERT INTO scene_reference_assignments (id, workspace_id, scene_id, reference_entity_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), workspaceId, sceneId, refId, now);
      }
    }
  }

  // Update storyboard duration and reset approval status if modified
  db.prepare(`
    UPDATE storyboards SET total_duration_seconds = ?, status = 'draft', approved_at = NULL, approved_by = NULL, updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(totalDuration, now, storyboardId, workspaceId);

  return getOrCreateStoryboard(workspaceId, (db.prepare(`SELECT video_project_id FROM storyboards WHERE id = ?`).get(storyboardId) as { video_project_id: string }).video_project_id).scenes;
}

export function updateStoryboardScene(
  workspaceId: string,
  sceneId: string,
  updates: Partial<Omit<import("@/types/domain").StoryboardScene, "id" | "storyboardId" | "createdAt" | "updatedAt">>
): import("@/types/domain").StoryboardScene | null {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM storyboard_scenes WHERE id = ? AND workspace_id = ?`).get(sceneId, workspaceId) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextVer = Number(existing.version || 1) + 1;

  db.prepare(`
    UPDATE storyboard_scenes SET
      title = COALESCE(?, title),
      duration_seconds = COALESCE(?, duration_seconds),
      narrative_purpose = COALESCE(?, narrative_purpose),
      visual_description = COALESCE(?, visual_description),
      subjects = COALESCE(?, subjects),
      environment = COALESCE(?, environment),
      camera_framing = COALESCE(?, camera_framing),
      camera_movement = COALESCE(?, camera_movement),
      lighting = COALESCE(?, lighting),
      mood = COALESCE(?, mood),
      voiceover = COALESCE(?, voiceover),
      image_prompt = COALESCE(?, image_prompt),
      video_prompt = COALESCE(?, video_prompt),
      reference_image_url = COALESCE(?, reference_image_url),
      status = COALESCE(?, status),
      version = ?,
      updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(
    updates.title ?? null,
    updates.durationSeconds ?? null,
    updates.narrativePurpose ?? null,
    updates.visualDescription ?? null,
    updates.subjects ?? null,
    updates.environment ?? null,
    updates.cameraFraming ?? null,
    updates.cameraMovement ?? null,
    updates.lighting ?? null,
    updates.mood ?? null,
    updates.voiceover ?? null,
    updates.imagePrompt ?? null,
    updates.videoPrompt ?? null,
    updates.referenceImageUrl ?? null,
    updates.status ?? null,
    nextVer,
    now,
    sceneId,
    workspaceId
  );

  const updated = db.prepare(`SELECT * FROM storyboard_scenes WHERE id = ? AND workspace_id = ?`).get(sceneId, workspaceId) as Record<string, unknown>;
  return {
    id: String(updated.id),
    storyboardId: String(updated.storyboard_id),
    sceneNumber: Number(updated.scene_number),
    title: String(updated.title),
    durationSeconds: Number(updated.duration_seconds),
    narrativePurpose: String(updated.narrative_purpose),
    visualDescription: String(updated.visual_description),
    subjects: String(updated.subjects),
    environment: String(updated.environment),
    cameraFraming: String(updated.camera_framing),
    cameraMovement: String(updated.camera_movement),
    lighting: String(updated.lighting),
    mood: String(updated.mood),
    voiceover: String(updated.voiceover),
    imagePrompt: String(updated.image_prompt),
    videoPrompt: String(updated.video_prompt),
    referenceImageUrl: updated.reference_image_url ? String(updated.reference_image_url) : null,
    status: updated.status as import("@/types/domain").SceneStatus,
    version: Number(updated.version),
    createdAt: String(updated.created_at),
    updatedAt: String(updated.updated_at),
  };
}

export function approveStoryboard(
  workspaceId: string,
  storyboardId: string,
  approvedBy: string = "usr-studio-founder"
): import("@/types/domain").Storyboard {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE storyboards SET status = 'approved', approved_at = ?, approved_by = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(now, approvedBy, now, storyboardId, workspaceId);

  // Update associated video project to storyboard_approved
  const sb = db.prepare(`SELECT video_project_id FROM storyboards WHERE id = ?`).get(storyboardId) as { video_project_id: string };
  if (sb) {
    db.prepare(`UPDATE video_projects SET status = 'storyboard_approved', updated_at = ? WHERE id = ? AND workspace_id = ?`).run(now, sb.video_project_id, workspaceId);
  }

  return getOrCreateStoryboard(workspaceId, sb.video_project_id);
}

export function deleteStoryboard(workspaceId: string, storyboardId: string): boolean {
  const db = getDb();
  const sb = db.prepare(`SELECT id, video_project_id FROM storyboards WHERE id = ? AND workspace_id = ?`).get(storyboardId, workspaceId) as { id: string; video_project_id: string } | undefined;
  if (!sb) return false;

  const scenes = db.prepare(`SELECT id FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ?`).all(storyboardId, workspaceId) as { id: string }[];
  for (const s of scenes) {
    db.prepare(`DELETE FROM scene_reference_assignments WHERE scene_id = ? AND workspace_id = ?`).run(s.id, workspaceId);
  }
  db.prepare(`DELETE FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ?`).run(storyboardId, workspaceId);
  db.prepare(`DELETE FROM storyboards WHERE id = ? AND workspace_id = ?`).run(storyboardId, workspaceId);

  db.prepare(`UPDATE video_projects SET status = 'concept_approved', updated_at = ? WHERE id = ? AND workspace_id = ?`).run(
    new Date().toISOString(),
    sb.video_project_id,
    workspaceId
  );
  return true;
}

export function deleteStoryboardScene(workspaceId: string, sceneId: string): import("@/types/domain").Storyboard | null {
  const db = getDb();
  const scene = db.prepare(`SELECT storyboard_id FROM storyboard_scenes WHERE id = ? AND workspace_id = ?`).get(sceneId, workspaceId) as { storyboard_id: string } | undefined;
  if (!scene) return null;

  const storyboardId = scene.storyboard_id;
  db.prepare(`DELETE FROM scene_reference_assignments WHERE scene_id = ? AND workspace_id = ?`).run(sceneId, workspaceId);
  db.prepare(`DELETE FROM storyboard_scenes WHERE id = ? AND workspace_id = ?`).run(sceneId, workspaceId);

  // Re-number remaining scenes and update total duration
  const remaining = db.prepare(`SELECT id, duration_seconds FROM storyboard_scenes WHERE storyboard_id = ? AND workspace_id = ? ORDER BY scene_number ASC`).all(storyboardId, workspaceId) as { id: string; duration_seconds: number }[];
  let totalDuration = 0;
  remaining.forEach((s, idx) => {
    totalDuration += s.duration_seconds;
    db.prepare(`UPDATE storyboard_scenes SET scene_number = ? WHERE id = ?`).run(idx + 1, s.id);
  });

  const now = new Date().toISOString();
  db.prepare(`UPDATE storyboards SET total_duration_seconds = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`).run(totalDuration, now, storyboardId, workspaceId);

  const sb = db.prepare(`SELECT video_project_id FROM storyboards WHERE id = ?`).get(storyboardId) as { video_project_id: string } | undefined;
  if (!sb) return null;
  return getOrCreateStoryboard(workspaceId, sb.video_project_id);
}

export function deleteVideoProject(workspaceId: string, projectId: string): boolean {
  const db = getDb();
  const sbs = db.prepare(`SELECT id FROM storyboards WHERE video_project_id = ? AND workspace_id = ?`).all(projectId, workspaceId) as { id: string }[];
  for (const sb of sbs) {
    deleteStoryboard(workspaceId, sb.id);
  }
  const res = db.prepare(`DELETE FROM video_projects WHERE id = ? AND workspace_id = ?`).run(projectId, workspaceId);
  return Number(res.changes ?? 0) > 0;
}

// Consistency Lock: Reference Entities
export function createReferenceEntity(
  workspaceId: string,
  input: Omit<import("@/types/domain").ReferenceEntity, "id" | "workspaceId" | "createdAt" | "updatedAt">
): import("@/types/domain").ReferenceEntity {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reference_entities (
      id, workspace_id, project_id, name, type, image_url, user_approved_description,
      distinguishing_attributes, color_details, continuity_rules, exclusions, is_locked, version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    input.projectId || null,
    input.name.trim(),
    input.type,
    input.imageUrl || null,
    input.userApprovedDescription.trim(),
    JSON.stringify(input.distinguishingAttributes || []),
    input.colorDetails || null,
    input.continuityRules.trim(),
    input.exclusions || null,
    input.isLocked ? 1 : 0,
    input.version || 1,
    now,
    now
  );

  return getReferenceEntityById(workspaceId, id)!;
}

export function listReferenceEntities(workspaceId: string, projectId?: string): import("@/types/domain").ReferenceEntity[] {
  const db = getDb();
  let query = `SELECT * FROM reference_entities WHERE workspace_id = ?`;
  const params: (string | number | bigint | null)[] = [workspaceId];
  if (projectId) {
    query += ` AND (project_id = ? OR project_id IS NULL)`;
    params.push(projectId);
  }
  query += ` ORDER BY created_at DESC`;

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    projectId: r.project_id ? String(r.project_id) : null,
    name: String(r.name),
    type: r.type as import("@/types/domain").ReferenceEntityType,
    imageUrl: r.image_url ? String(r.image_url) : null,
    userApprovedDescription: String(r.user_approved_description),
    distinguishingAttributes: JSON.parse(String(r.distinguishing_attributes || "[]")),
    colorDetails: r.color_details ? String(r.color_details) : undefined,
    continuityRules: String(r.continuity_rules),
    exclusions: r.exclusions ? String(r.exclusions) : undefined,
    isLocked: Number(r.is_locked) === 1,
    version: Number(r.version),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function getReferenceEntityById(workspaceId: string, id: string): import("@/types/domain").ReferenceEntity | null {
  const db = getDb();
  const r = db.prepare(`SELECT * FROM reference_entities WHERE workspace_id = ? AND id = ?`).get(workspaceId, id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    projectId: r.project_id ? String(r.project_id) : null,
    name: String(r.name),
    type: r.type as import("@/types/domain").ReferenceEntityType,
    imageUrl: r.image_url ? String(r.image_url) : null,
    userApprovedDescription: String(r.user_approved_description),
    distinguishingAttributes: JSON.parse(String(r.distinguishing_attributes || "[]")),
    colorDetails: r.color_details ? String(r.color_details) : undefined,
    continuityRules: String(r.continuity_rules),
    exclusions: r.exclusions ? String(r.exclusions) : undefined,
    isLocked: Number(r.is_locked) === 1,
    version: Number(r.version),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function deleteReferenceEntity(workspaceId: string, id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM reference_entities WHERE workspace_id = ? AND id = ?`).run(workspaceId, id);
}

// Unified Media Assets (§13)
export function createUnifiedAsset(
  workspaceId: string,
  input: Omit<import("@/types/domain").MediaAsset, "id" | "workspaceId" | "createdAt">
): import("@/types/domain").MediaAsset {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO unified_assets (
      id, workspace_id, project_id, scene_id, asset_type, provider, model_id,
      prompt, storage_path, mime_type, file_size_bytes, width, height, duration_seconds,
      approval_status, version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    input.projectId || null,
    input.sceneId || null,
    input.assetType,
    input.provider,
    input.modelId,
    input.prompt,
    input.storagePath,
    input.mimeType,
    input.fileSizeBytes || 0,
    input.width || null,
    input.height || null,
    input.durationSeconds || null,
    input.approvalStatus || "approved",
    input.version || 1,
    now
  );

  return {
    id,
    workspaceId,
    ...input,
    createdAt: now,
  };
}

export function listUnifiedAssets(
  workspaceId: string,
  filter?: { assetType?: string; provider?: string; projectId?: string }
): import("@/types/domain").MediaAsset[] {
  const db = getDb();
  let query = `SELECT * FROM unified_assets WHERE workspace_id = ?`;
  const params: (string | number | bigint | null)[] = [workspaceId];

  if (filter?.assetType) {
    query += ` AND asset_type = ?`;
    params.push(filter.assetType);
  }
  if (filter?.provider) {
    query += ` AND provider = ?`;
    params.push(filter.provider);
  }
  if (filter?.projectId) {
    query += ` AND project_id = ?`;
    params.push(filter.projectId);
  }
  query += ` ORDER BY created_at DESC`;

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    projectId: r.project_id ? String(r.project_id) : null,
    sceneId: r.scene_id ? String(r.scene_id) : null,
    assetType: r.asset_type as "image" | "video" | "audio" | "reference",
    provider: r.provider as import("@/types/domain").MediaAssetProvider,
    modelId: String(r.model_id),
    prompt: String(r.prompt),
    storagePath: String(r.storage_path),
    mimeType: String(r.mime_type),
    fileSizeBytes: Number(r.file_size_bytes),
    width: r.width ? Number(r.width) : undefined,
    height: r.height ? Number(r.height) : undefined,
    durationSeconds: r.duration_seconds ? Number(r.duration_seconds) : undefined,
    approvalStatus: r.approval_status as import("@/types/domain").ApprovalStatus,
    version: Number(r.version),
    createdAt: String(r.created_at),
  }));
}

// Flow Credit Planner (§6.3)
export function getOrCreateFlowCreditSnapshot(workspaceId: string): import("@/types/domain").FlowCreditSnapshot {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM flow_credit_snapshots WHERE workspace_id = ?`).get(workspaceId) as Record<string, unknown> | undefined;
  const now = new Date().toISOString();

  if (!row) {
    const id = crypto.randomUUID();
    const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
    db.prepare(`
      INSERT INTO flow_credit_snapshots (
        id, workspace_id, plan_label, monthly_allocation, daily_allocation,
        billing_reset_date, user_entered_balance, estimated_cost_per_generation,
        notes, last_updated
      ) VALUES (?, ?, 'Google AI Pro', 1000, 35, ?, 1000, 10, 'Manual estimate - not verified by Google', ?)
    `).run(id, workspaceId, nextMonth, now);

    return {
      id,
      workspaceId,
      planLabel: "Google AI Pro",
      monthlyAllocation: 1000,
      dailyAllocation: 35,
      billingResetDate: nextMonth,
      userEnteredBalance: 1000,
      estimatedCostPerGeneration: 10,
      lastUpdated: now,
      notes: "Manual estimate - not verified by Google",
    };
  }

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    planLabel: String(row.plan_label),
    monthlyAllocation: Number(row.monthly_allocation),
    dailyAllocation: Number(row.daily_allocation),
    billingResetDate: String(row.billing_reset_date),
    userEnteredBalance: Number(row.user_entered_balance),
    estimatedCostPerGeneration: Number(row.estimated_cost_per_generation),
    lastUpdated: String(row.last_updated),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export function updateFlowCreditSnapshot(
  workspaceId: string,
  input: Partial<Omit<import("@/types/domain").FlowCreditSnapshot, "id" | "workspaceId">>
): import("@/types/domain").FlowCreditSnapshot {
  const current = getOrCreateFlowCreditSnapshot(workspaceId);
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE flow_credit_snapshots SET
      plan_label = ?, monthly_allocation = ?, daily_allocation = ?,
      billing_reset_date = ?, user_entered_balance = ?, estimated_cost_per_generation = ?,
      notes = ?, last_updated = ?
    WHERE id = ? AND workspace_id = ?
  `).run(
    input.planLabel ?? current.planLabel,
    input.monthlyAllocation ?? current.monthlyAllocation,
    input.dailyAllocation ?? current.dailyAllocation,
    input.billingResetDate ?? current.billingResetDate,
    input.userEnteredBalance ?? current.userEnteredBalance,
    input.estimatedCostPerGeneration ?? current.estimatedCostPerGeneration,
    input.notes ?? current.notes ?? null,
    now,
    current.id,
    workspaceId
  );

  return getOrCreateFlowCreditSnapshot(workspaceId);
}

// ============================================================================
// MODEL CONTEXT PROTOCOL (MCP) SERVERS REGISTRY
// ============================================================================

function mapMcpConnectionRow(row: Record<string, unknown>): import("@/types/domain").McpConnectionSummary {
  let args: string[] = [];
  let envObj: Record<string, string> = {};
  let discoveredTools: string[] = [];
  try {
    args = JSON.parse(String(row.args_json || "[]"));
  } catch {
    args = [];
  }
  try {
    envObj = JSON.parse(String(row.env_json || "{}"));
  } catch {
    envObj = {};
  }
  try {
    discoveredTools = JSON.parse(String(row.tools_discovered_json || "[]"));
  } catch {
    discoveredTools = [];
  }

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    name: String(row.name),
    transportType: (row.transport_type as import("@/types/domain").McpTransportType) || "sse",
    serverUrl: String(row.server_url || ""),
    command: String(row.command || ""),
    args,
    envKeys: Object.keys(envObj),
    hasAuthToken: Boolean(row.auth_token_encrypted),
    tokenLast4: String(row.token_last4 || ""),
    isActive: Number(row.is_active) === 1,
    status: (row.status as "connected" | "disconnected" | "error") || "connected",
    discoveredTools,
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listMcpConnections(workspaceId: string): import("@/types/domain").McpConnectionSummary[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM mcp_connections WHERE workspace_id = ? ORDER BY updated_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapMcpConnectionRow);
}

export function upsertMcpConnection(input: {
  workspaceId: string;
  userId: string;
  name: string;
  transportType: import("@/types/domain").McpTransportType;
  serverUrl?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  authToken?: string;
  discoveredTools?: string[];
}): import("@/types/domain").McpConnectionSummary {
  const db = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error("MCP Server name is required.");
  }

  const transportType = input.transportType || "sse";
  const serverUrl = input.serverUrl?.trim() || "";
  const command = input.command?.trim() || "";

  if ((transportType === "sse" || transportType === "streamable_http") && !serverUrl) {
    throw new Error("Provide a Server Endpoint URL for SSE or Streamable HTTP MCP servers.");
  }
  if (transportType === "stdio" && !command) {
    throw new Error("Provide an executable command (e.g. npx, uvx, node) for Stdio MCP servers.");
  }

  const rawToken = input.authToken?.trim() || "";
  const encryptedToken = rawToken ? encryptSecret(rawToken) : "";
  const tokenLast4 = rawToken ? rawToken.slice(-4) : "";
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const defaultTools =
    input.discoveredTools && input.discoveredTools.length > 0
      ? input.discoveredTools
      : ["mcp.tools.list", "mcp.resources.read", "mcp.prompts.get"];

  db.prepare(
    `INSERT INTO mcp_connections (
       id, workspace_id, user_id, name, transport_type, server_url, command,
       args_json, env_json, auth_token_encrypted, token_last4, is_active,
       status, tools_discovered_json, last_checked_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'connected', ?, ?, ?, ?)`
  ).run(
    id,
    input.workspaceId,
    input.userId,
    name,
    transportType,
    serverUrl,
    command,
    JSON.stringify(input.args ?? []),
    JSON.stringify(input.env ?? {}),
    encryptedToken,
    tokenLast4,
    JSON.stringify(defaultTools),
    now,
    now,
    now
  );

  const row = db
    .prepare(`SELECT * FROM mcp_connections WHERE id = ?`)
    .get(id) as Record<string, unknown>;
  return mapMcpConnectionRow(row);
}

export function updateMcpConnection(input: {
  workspaceId: string;
  connectionId: string;
  isActive?: boolean;
  status?: "connected" | "disconnected" | "error";
  discoveredTools?: string[];
}): import("@/types/domain").McpConnectionSummary {
  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM mcp_connections WHERE id = ? AND workspace_id = ?`)
    .get(input.connectionId, input.workspaceId) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new Error("MCP server connection not found in this workspace.");
  }

  const current = mapMcpConnectionRow(existing);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE mcp_connections
     SET is_active = ?, status = ?, tools_discovered_json = ?, last_checked_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`
  ).run(
    (input.isActive ?? current.isActive) ? 1 : 0,
    input.status ?? current.status,
    JSON.stringify(input.discoveredTools ?? current.discoveredTools),
    now,
    now,
    input.connectionId,
    input.workspaceId
  );

  const updated = db
    .prepare(`SELECT * FROM mcp_connections WHERE id = ?`)
    .get(input.connectionId) as Record<string, unknown>;
  return mapMcpConnectionRow(updated);
}

export function deleteMcpConnection(workspaceId: string, connectionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM mcp_connections WHERE id = ? AND workspace_id = ?`).run(
    connectionId,
    workspaceId
  );
}

// ============================================================================
// PRD SECTION 4: BLOG STUDIO REPOSITORY
// ============================================================================

export const DEFAULT_BLOG_DIMENSION_PRESETS: Array<
  Omit<import("@/types/domain").BlogImageDimensionPreset, "id" | "workspaceId">
> = [
  {
    formatName: "Square",
    width: 1080,
    height: 1080,
    usageDescription: "Social sharing and square thumbnails",
    isActive: true,
  },
  {
    formatName: "Landscape",
    width: 1200,
    height: 675,
    usageDescription: "Blog featured images and article headers",
    isActive: true,
  },
  {
    formatName: "Portrait",
    width: 1080,
    height: 1350,
    usageDescription: "Pinterest and portrait-oriented promotion",
    isActive: true,
  },
  {
    formatName: "Rectangle",
    width: 1200,
    height: 628,
    usageDescription: "General website thumbnails and link previews",
    isActive: true,
  },
];

export function listBlogDimensionPresets(
  workspaceId: string
): import("@/types/domain").BlogImageDimensionPreset[] {
  const db = getDb();
  let rows = db
    .prepare(
      `SELECT * FROM blog_dimension_presets WHERE workspace_id = ? ORDER BY rowid ASC`
    )
    .all(workspaceId) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    const stmt = db.prepare(
      `INSERT INTO blog_dimension_presets (id, workspace_id, format_name, width, height, usage_description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );
    for (const preset of DEFAULT_BLOG_DIMENSION_PRESETS) {
      stmt.run(
        crypto.randomUUID(),
        workspaceId,
        preset.formatName,
        preset.width,
        preset.height,
        preset.usageDescription
      );
    }
    rows = db
      .prepare(
        `SELECT * FROM blog_dimension_presets WHERE workspace_id = ? ORDER BY rowid ASC`
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
  }

  return rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    formatName: String(r.format_name),
    width: Number(r.width),
    height: Number(r.height),
    usageDescription: String(r.usage_description || ""),
    isActive: Number(r.is_active) === 1,
  }));
}

export function upsertBlogDimensionPreset(
  workspaceId: string,
  input: {
    id?: string;
    formatName: string;
    width: number;
    height: number;
    usageDescription?: string;
    isActive?: boolean;
  }
): import("@/types/domain").BlogImageDimensionPreset {
  const db = getDb();
  const formatName = input.formatName.trim() || "Custom";
  const width = Math.max(200, Math.min(4096, Math.round(input.width)));
  const height = Math.max(200, Math.min(4096, Math.round(input.height)));
  const usageDescription =
    input.usageDescription?.trim() || "Custom blog featured image format";
  const isActive = (input.isActive ?? true) ? 1 : 0;

  if (input.id) {
    const existing = db
      .prepare(
        `SELECT id FROM blog_dimension_presets WHERE id = ? AND workspace_id = ?`
      )
      .get(input.id, workspaceId) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE blog_dimension_presets
         SET format_name = ?, width = ?, height = ?, usage_description = ?, is_active = ?
         WHERE id = ? AND workspace_id = ?`
      ).run(
        formatName,
        width,
        height,
        usageDescription,
        isActive,
        input.id,
        workspaceId
      );
      return {
        id: input.id,
        workspaceId,
        formatName,
        width,
        height,
        usageDescription,
        isActive: isActive === 1,
      };
    }
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO blog_dimension_presets (id, workspace_id, format_name, width, height, usage_description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, workspaceId, formatName, width, height, usageDescription, isActive);

  return {
    id,
    workspaceId,
    formatName,
    width,
    height,
    usageDescription,
    isActive: isActive === 1,
  };
}

function mapBlogProjectRow(
  row: Record<string, unknown>
): import("@/types/domain").BlogPostProject {
  const parseJson = <T>(raw: unknown, fallback: T): T => {
    if (!raw || typeof raw !== "string") return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    topic: String(row.topic || ""),
    keywords: parseJson<import("@/types/domain").BlogSeoKeywords>(
      row.keywords_json,
      {
        primaryKeyword: "",
        secondaryKeywords: [],
        supportingKeywords: [],
      }
    ),
    imageFormatName: String(row.image_format_name || "Landscape"),
    imageWidth: Number(row.image_width || 1200),
    imageHeight: Number(row.image_height || 675),
    targetAudience: String(row.target_audience || ""),
    industry: String(row.industry || ""),
    blogCategory: String(row.blog_category || ""),
    desiredWordCount: Number(row.desired_word_count || 1000),
    writingTone: String(row.writing_tone || "Professional & Insightful"),
    targetCountry: String(row.target_country || "Global"),
    language: String(row.language || "English"),
    searchIntent: String(row.search_intent || "Informational"),
    competitorUrls: parseJson<string[]>(row.competitor_urls_json, []),
    specificCta: String(row.specific_cta || ""),
    additionalInstructions: String(row.additional_instructions || ""),
    inputIntelligenceMode:
      (row.input_intelligence_mode as import("@/types/domain").BlogInputIntelligenceMode) ||
      "topic_and_keywords",
    research: parseJson<import("@/types/domain").BlogResearchStrategy | null>(
      row.research_json,
      null
    ),
    outline: parseJson<import("@/types/domain").BlogOutline | null>(
      row.outline_json,
      null
    ),
    currentArticle:
      parseJson<import("@/types/domain").BlogArticleContent | null>(
        row.current_article_json,
        null
      ),
    versions: parseJson<import("@/types/domain").BlogArticleVersion[]>(
      row.versions_json,
      []
    ),
    status:
      (row.status as import("@/types/domain").BlogProjectStatus) || "draft",
    hasApprovedUserEdits: Number(row.has_approved_user_edits) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listBlogProjects(
  workspaceId: string
): import("@/types/domain").BlogPostProject[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM blog_projects WHERE workspace_id = ? ORDER BY updated_at DESC`
    )
    .all(workspaceId) as Array<Record<string, unknown>>;
  return rows.map(mapBlogProjectRow);
}

export function getBlogProjectById(
  workspaceId: string,
  projectId: string
): import("@/types/domain").BlogPostProject | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM blog_projects WHERE id = ? AND workspace_id = ?`)
    .get(projectId, workspaceId) as Record<string, unknown> | undefined;
  return row ? mapBlogProjectRow(row) : null;
}

export function createBlogProject(
  workspaceId: string,
  input: {
    brandId: string;
    topic?: string;
    keywords?: Partial<import("@/types/domain").BlogSeoKeywords>;
    imageFormatName?: string;
    imageWidth?: number;
    imageHeight?: number;
    targetAudience?: string;
    industry?: string;
    blogCategory?: string;
    desiredWordCount?: number;
    writingTone?: string;
    targetCountry?: string;
    language?: string;
    searchIntent?: string;
    competitorUrls?: string[];
    specificCta?: string;
    additionalInstructions?: string;
    inputIntelligenceMode?: import("@/types/domain").BlogInputIntelligenceMode;
  }
): import("@/types/domain").BlogPostProject {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const keywords: import("@/types/domain").BlogSeoKeywords = {
    primaryKeyword: input.keywords?.primaryKeyword?.trim() || "",
    secondaryKeywords: (input.keywords?.secondaryKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean),
    supportingKeywords: (input.keywords?.supportingKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean),
  };

  db.prepare(
    `INSERT INTO blog_projects (
       id, workspace_id, brand_id, topic, keywords_json,
       image_format_name, image_width, image_height,
       target_audience, industry, blog_category, desired_word_count,
       writing_tone, target_country, language, search_intent,
       competitor_urls_json, specific_cta, additional_instructions,
       input_intelligence_mode, research_json, outline_json,
       current_article_json, versions_json, status, has_approved_user_edits,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, '[]', 'draft', 0, ?, ?)`
  ).run(
    id,
    workspaceId,
    input.brandId,
    input.topic?.trim() || "",
    JSON.stringify(keywords),
    input.imageFormatName?.trim() || "Landscape",
    Math.max(200, Math.round(input.imageWidth || 1200)),
    Math.max(200, Math.round(input.imageHeight || 675)),
    input.targetAudience?.trim() || "",
    input.industry?.trim() || "",
    input.blogCategory?.trim() || "",
    Math.max(200, Math.round(input.desiredWordCount || 1000)),
    input.writingTone?.trim() || "Professional & Insightful",
    input.targetCountry?.trim() || "Global",
    input.language?.trim() || "English",
    input.searchIntent?.trim() || "Informational",
    JSON.stringify((input.competitorUrls ?? []).map((u) => u.trim()).filter(Boolean)),
    input.specificCta?.trim() || "",
    input.additionalInstructions?.trim() || "",
    input.inputIntelligenceMode || "topic_and_keywords",
    now,
    now
  );

  return getBlogProjectById(workspaceId, id)!;
}

export function updateBlogProject(
  workspaceId: string,
  projectId: string,
  updates: Partial<{
    brandId: string;
    topic: string;
    keywords: import("@/types/domain").BlogSeoKeywords;
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
    inputIntelligenceMode: import("@/types/domain").BlogInputIntelligenceMode;
    research: import("@/types/domain").BlogResearchStrategy | null;
    outline: import("@/types/domain").BlogOutline | null;
    currentArticle: import("@/types/domain").BlogArticleContent | null;
    versions: import("@/types/domain").BlogArticleVersion[];
    status: import("@/types/domain").BlogProjectStatus;
    hasApprovedUserEdits: boolean;
  }>
): import("@/types/domain").BlogPostProject {
  const db = getDb();
  const current = getBlogProjectById(workspaceId, projectId);
  if (!current) {
    throw new Error("Blog project not found in this workspace.");
  }

  const now = new Date().toISOString();
  const next = {
    brandId: updates.brandId ?? current.brandId,
    topic: updates.topic !== undefined ? updates.topic : current.topic,
    keywords: updates.keywords ?? current.keywords,
    imageFormatName: updates.imageFormatName ?? current.imageFormatName,
    imageWidth: updates.imageWidth ?? current.imageWidth,
    imageHeight: updates.imageHeight ?? current.imageHeight,
    targetAudience: updates.targetAudience ?? current.targetAudience,
    industry: updates.industry ?? current.industry,
    blogCategory: updates.blogCategory ?? current.blogCategory,
    desiredWordCount: updates.desiredWordCount ?? current.desiredWordCount,
    writingTone: updates.writingTone ?? current.writingTone,
    targetCountry: updates.targetCountry ?? current.targetCountry,
    language: updates.language ?? current.language,
    searchIntent: updates.searchIntent ?? current.searchIntent,
    competitorUrls: updates.competitorUrls ?? current.competitorUrls,
    specificCta: updates.specificCta ?? current.specificCta,
    additionalInstructions:
      updates.additionalInstructions ?? current.additionalInstructions,
    inputIntelligenceMode:
      updates.inputIntelligenceMode ?? current.inputIntelligenceMode,
    research:
      updates.research !== undefined ? updates.research : current.research,
    outline: updates.outline !== undefined ? updates.outline : current.outline,
    currentArticle:
      updates.currentArticle !== undefined
        ? updates.currentArticle
        : current.currentArticle,
    versions: updates.versions ?? current.versions,
    status: updates.status ?? current.status,
    hasApprovedUserEdits:
      updates.hasApprovedUserEdits !== undefined
        ? updates.hasApprovedUserEdits
        : current.hasApprovedUserEdits,
  };

  db.prepare(
    `UPDATE blog_projects
     SET brand_id = ?, topic = ?, keywords_json = ?,
         image_format_name = ?, image_width = ?, image_height = ?,
         target_audience = ?, industry = ?, blog_category = ?,
         desired_word_count = ?, writing_tone = ?, target_country = ?,
         language = ?, search_intent = ?, competitor_urls_json = ?,
         specific_cta = ?, additional_instructions = ?,
         input_intelligence_mode = ?, research_json = ?, outline_json = ?,
         current_article_json = ?, versions_json = ?, status = ?,
         has_approved_user_edits = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`
  ).run(
    next.brandId,
    next.topic,
    JSON.stringify(next.keywords),
    next.imageFormatName,
    next.imageWidth,
    next.imageHeight,
    next.targetAudience,
    next.industry,
    next.blogCategory,
    next.desiredWordCount,
    next.writingTone,
    next.targetCountry,
    next.language,
    next.searchIntent,
    JSON.stringify(next.competitorUrls),
    next.specificCta,
    next.additionalInstructions,
    next.inputIntelligenceMode,
    next.research ? JSON.stringify(next.research) : null,
    next.outline ? JSON.stringify(next.outline) : null,
    next.currentArticle ? JSON.stringify(next.currentArticle) : null,
    JSON.stringify(next.versions),
    next.status,
    next.hasApprovedUserEdits ? 1 : 0,
    now,
    projectId,
    workspaceId
  );

  return getBlogProjectById(workspaceId, projectId)!;
}

export function deleteBlogProject(workspaceId: string, projectId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM blog_projects WHERE id = ? AND workspace_id = ?`).run(
    projectId,
    workspaceId
  );
}

