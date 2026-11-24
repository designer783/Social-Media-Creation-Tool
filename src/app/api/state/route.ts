import { NextRequest, NextResponse } from "next/server";
import { resolveOptionalRequestSession } from "@/lib/auth/session";
import { isGeminiApiConfigured } from "@/lib/ai/gemini-service";
import {
  getDashboardMetrics,
  listAIProviderConfigs,
  listApprovalLogs,
  listBlogDimensionPresets,
  listBlogProjects,
  listBrandKits,
  listBrands,
  listCampaigns,
  listContentItems,
  listCreativeAudits,
  listCreatives,
  listExportJobs,
  listGeminiConnections,
  listMcpConnections,
  listMediaApiConnections,
  listPlatformPresets,
  listRadarSignals,
  listSocialTrackers,
  listVideoGenerations,
  resolveActiveGeminiCredentials,
} from "@/lib/db/repository";

export async function GET(req: NextRequest) {
  try {
    const session = resolveOptionalRequestSession(req);
    if (!session) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "Studio is locked. Admin credentials required to access workspace.",
        },
        { status: 401 }
      );
    }
    const wsId = session.activeWorkspace.id;
    const userId = session.user.id;
    const activeCreds = resolveActiveGeminiCredentials(wsId, userId);

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      activeWorkspace: session.activeWorkspace,
      workspaces: session.workspaces,
      metrics: getDashboardMetrics(wsId),
      brands: listBrands(wsId),
      brandKits: listBrandKits(wsId),
      presets: listPlatformPresets(wsId),
      blogDimensionPresets: listBlogDimensionPresets(wsId),
      blogProjects: listBlogProjects(wsId),
      campaigns: listCampaigns(wsId),
      contentItems: listContentItems(wsId),
      creatives: listCreatives(wsId),
      approvalLogs: listApprovalLogs(wsId),
      exportJobs: listExportJobs(wsId),
      aiProviders: listAIProviderConfigs(wsId),
      geminiConnections: listGeminiConnections(wsId, userId),
      activeGeminiMeta: {
        configured: isGeminiApiConfigured({ workspaceId: wsId, userId }),
        sourceScope: activeCreds.sourceScope,
        keyLast4: activeCreds.keyLast4,
        textModel: activeCreds.textModel,
        imageModel: activeCreds.imageModel,
      },
      geminiConfigured: isGeminiApiConfigured({ workspaceId: wsId, userId }),
      mediaConnections: listMediaApiConnections(wsId, userId),
      mcpConnections: listMcpConnections(wsId),
      videoGenerations: listVideoGenerations(wsId),
      radarSignals: listRadarSignals(wsId),
      creativeAudits: listCreativeAudits(wsId),
      socialTrackers: listSocialTrackers(wsId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load workspace state.";
    const status = message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
