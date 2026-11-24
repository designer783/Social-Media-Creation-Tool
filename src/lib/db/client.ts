import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;
let initializedSchemaRevision = 0;
const CURRENT_SCHEMA_REVISION = 3;

export function getStorageRoot(): string {
  if (process.env.STUDIO_STORAGE_DIR) {
    const custom = path.resolve(process.env.STUDIO_STORAGE_DIR);
    try {
      fs.mkdirSync(custom, { recursive: true });
      return custom;
    } catch {
      // Fall through if custom directory is not writable
    }
  }

  // Detect serverless / read-only hosting environments (e.g. Vercel, AWS Lambda, Netlify)
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT) ||
    Boolean(process.env.NETLIFY) ||
    process.cwd().startsWith("/var/task");

  if (isServerless) {
    const serverlessDir = path.join(os.tmpdir(), "social-studio-storage");
    try {
      fs.mkdirSync(serverlessDir, { recursive: true });
    } catch {
      // Directory already exists or created by previous invocation
    }
    return serverlessDir;
  }

  // Standard container, VPS, or local development
  const localDir = path.join(process.cwd(), "storage");
  try {
    fs.mkdirSync(localDir, { recursive: true });
    return localDir;
  } catch {
    // If process.cwd() is read-only, safely fall back to os.tmpdir()
    const fallbackDir = path.join(os.tmpdir(), "social-studio-storage");
    try {
      fs.mkdirSync(fallbackDir, { recursive: true });
    } catch {}
    return fallbackDir;
  }
}

export function ensureWorkspaceStorageDir(workspaceId: string, subDir = ""): string {
  const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeWorkspaceId) {
    throw new Error("Invalid workspace identifier for storage directory.");
  }
  const targetDir = path.join(getStorageRoot(), "workspaces", safeWorkspaceId, subDir);
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      default_workspace_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      website_url TEXT NOT NULL,
      logo_asset_path TEXT,
      logo_data_url TEXT,
      active_kit_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brand_kits (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      colors_json TEXT NOT NULL,
      typography_json TEXT NOT NULL,
      visual_style_json TEXT NOT NULL,
      extraction_meta_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS platform_presets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      format_name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      safe_margin_px INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      brand_kit_id TEXT NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      input_mode TEXT NOT NULL,
      topic TEXT NOT NULL,
      seo_keywords_json TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      tone_of_voice TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      post_title TEXT NOT NULL,
      main_text TEXT NOT NULL,
      supporting_copy TEXT NOT NULL,
      caption TEXT NOT NULL,
      hashtags_json TEXT NOT NULL,
      cta_text TEXT NOT NULL,
      reference_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS creatives (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      brand_kit_id TEXT NOT NULL,
      content_item_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      format_name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      variation_index INTEGER NOT NULL,
      composition_template TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      current_version_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS creative_versions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      creative_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      background_asset_path TEXT NOT NULL,
      background_prompt TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      layout_overrides_json TEXT NOT NULL,
      text_overrides_json TEXT NOT NULL,
      rendered_png_path TEXT NOT NULL,
      rendered_webp_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      creative_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      format TEXT NOT NULL,
      zip_asset_path TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      manifest_paths_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_provider_configs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      model_id TEXT NOT NULL,
      is_enabled INTEGER NOT NULL,
      is_primary INTEGER NOT NULL,
      stats_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gemini_connections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      label TEXT NOT NULL,
      connection_mode TEXT NOT NULL,
      endpoint_base_url TEXT NOT NULL,
      text_model TEXT NOT NULL,
      image_model TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      key_last4 TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      capabilities_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS radar_signals (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      suggested_headline TEXT NOT NULL,
      seo_keywords_json TEXT NOT NULL,
      source_urls_json TEXT NOT NULL,
      relevance_score INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS creative_audits (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      creative_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      legibility_score INTEGER NOT NULL,
      brand_consistency_score INTEGER NOT NULL,
      visual_appeal_score INTEGER NOT NULL,
      strengths_json TEXT NOT NULL,
      recommendations_json TEXT NOT NULL,
      suggested_headline TEXT,
      audited_by_model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS social_trackers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      creative_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      tracking_status TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      published_url TEXT NOT NULL,
      utm_tag TEXT NOT NULL,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      engagements INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_api_connections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      capability TEXT NOT NULL,
      provider_preset TEXT NOT NULL,
      label TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      model_id TEXT NOT NULL,
      account_id TEXT NOT NULL DEFAULT '',
      auth_header_name TEXT NOT NULL DEFAULT 'Authorization',
      auth_prefix TEXT NOT NULL DEFAULT 'Bearer ',
      encrypted_api_key TEXT NOT NULL,
      key_last4 TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_generations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      creative_id TEXT,
      platform TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 5,
      prompt TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      model_id TEXT NOT NULL,
      video_asset_path TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'video/mp4',
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    -- PRD Section 8, 9, 13, 14: Storyboard-First Video, Consistency Lock, Unified Media Assets
    CREATE TABLE IF NOT EXISTS video_projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      name TEXT NOT NULL,
      campaign_objective TEXT NOT NULL,
      product_or_service TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      platform TEXT NOT NULL,
      desired_duration_seconds INTEGER NOT NULL DEFAULT 15,
      aspect_ratio TEXT NOT NULL DEFAULT '9:16',
      language TEXT NOT NULL DEFAULT 'en',
      visual_style TEXT NOT NULL DEFAULT 'cinematic',
      creative_direction TEXT NOT NULL,
      voiceover_preference TEXT NOT NULL,
      call_to_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storyboards (
      id TEXT PRIMARY KEY,
      video_project_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_at TEXT,
      approved_by TEXT,
      total_duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (video_project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storyboard_scenes (
      id TEXT PRIMARY KEY,
      storyboard_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      scene_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 3,
      narrative_purpose TEXT NOT NULL,
      visual_description TEXT NOT NULL,
      subjects TEXT NOT NULL,
      environment TEXT NOT NULL,
      camera_framing TEXT NOT NULL,
      camera_movement TEXT NOT NULL,
      lighting TEXT NOT NULL,
      mood TEXT NOT NULL,
      voiceover TEXT NOT NULL,
      dialogue TEXT,
      on_screen_text TEXT,
      image_prompt TEXT NOT NULL,
      video_prompt TEXT NOT NULL,
      negative_prompt TEXT,
      transition TEXT,
      reference_image_id TEXT,
      reference_image_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reference_entities (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      image_url TEXT,
      user_approved_description TEXT NOT NULL,
      distinguishing_attributes TEXT NOT NULL,
      color_details TEXT,
      continuity_rules TEXT NOT NULL,
      exclusions TEXT,
      is_locked INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scene_reference_assignments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      reference_entity_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id) REFERENCES storyboard_scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (reference_entity_id) REFERENCES reference_entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS unified_assets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      scene_id TEXT,
      asset_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER,
      duration_seconds INTEGER,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flow_credit_snapshots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      plan_label TEXT NOT NULL DEFAULT 'Google AI Pro',
      monthly_allocation INTEGER NOT NULL DEFAULT 1000,
      daily_allocation INTEGER NOT NULL DEFAULT 35,
      billing_reset_date TEXT NOT NULL,
      user_entered_balance INTEGER NOT NULL DEFAULT 1000,
      estimated_cost_per_generation INTEGER NOT NULL DEFAULT 10,
      notes TEXT,
      last_updated TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mcp_connections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      transport_type TEXT NOT NULL DEFAULT 'sse',
      server_url TEXT NOT NULL DEFAULT '',
      command TEXT NOT NULL DEFAULT '',
      args_json TEXT NOT NULL DEFAULT '[]',
      env_json TEXT NOT NULL DEFAULT '{}',
      auth_token_encrypted TEXT NOT NULL DEFAULT '',
      token_last4 TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'connected',
      tools_discovered_json TEXT NOT NULL DEFAULT '[]',
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    -- PRD Section 4: Blog Studio Tables
    CREATE TABLE IF NOT EXISTS blog_dimension_presets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      format_name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      usage_description TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blog_projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT '',
      keywords_json TEXT NOT NULL DEFAULT '{}',
      image_format_name TEXT NOT NULL DEFAULT 'Landscape',
      image_width INTEGER NOT NULL DEFAULT 1200,
      image_height INTEGER NOT NULL DEFAULT 675,
      target_audience TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      blog_category TEXT NOT NULL DEFAULT '',
      desired_word_count INTEGER NOT NULL DEFAULT 1000,
      writing_tone TEXT NOT NULL DEFAULT 'Professional & Insightful',
      target_country TEXT NOT NULL DEFAULT 'Global',
      language TEXT NOT NULL DEFAULT 'English',
      search_intent TEXT NOT NULL DEFAULT 'Informational',
      competitor_urls_json TEXT NOT NULL DEFAULT '[]',
      specific_cta TEXT NOT NULL DEFAULT '',
      additional_instructions TEXT NOT NULL DEFAULT '',
      input_intelligence_mode TEXT NOT NULL DEFAULT 'topic_and_keywords',
      research_json TEXT,
      outline_json TEXT,
      current_article_json TEXT,
      versions_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      has_approved_user_edits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);
}

export function getDb(customPath?: string): DatabaseSync {
  if (!customPath && dbInstance && currentDbPath === ":memory:") {
    return dbInstance;
  }

  const resolvedPath =
    customPath ??
    process.env.STUDIO_DB_PATH ??
    path.join(getStorageRoot(), "social-media-studio.db");

  if (dbInstance && currentDbPath === resolvedPath) {
    if (initializedSchemaRevision < CURRENT_SCHEMA_REVISION) {
      initializeSchema(dbInstance);
      initializedSchemaRevision = CURRENT_SCHEMA_REVISION;
    }
    return dbInstance;
  }

  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore if directory exists
    }

    // In serverless environments, if a seed database exists in the deployment bundle
    // and resolvedPath is in /tmp, copy the seed database to /tmp if not already present
    const bundleSeedPath = path.join(process.cwd(), "storage", "social-media-studio.db");
    if (resolvedPath !== bundleSeedPath && fs.existsSync(bundleSeedPath) && !fs.existsSync(resolvedPath)) {
      try {
        fs.copyFileSync(bundleSeedPath, resolvedPath);
      } catch {
        // Fall back to creating fresh database in resolvedPath
      }
    }
  }

  dbInstance = new DatabaseSync(resolvedPath);
  currentDbPath = resolvedPath;
  initializeSchema(dbInstance);
  initializedSchemaRevision = CURRENT_SCHEMA_REVISION;
  return dbInstance;
}

export function resetDbForTests(): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore close error on already closed instance
    }
  }
  dbInstance = new DatabaseSync(":memory:");
  currentDbPath = ":memory:";
  initializeSchema(dbInstance);
  return dbInstance;
}
