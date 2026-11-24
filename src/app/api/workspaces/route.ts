import { NextRequest, NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth/crypto-vault";
import { resolveRequestSession } from "@/lib/auth/session";
import {
  clearWorkspaceData,
  createWorkspaceWithDefaults,
  deleteWorkspace,
  registerOrLoginUser,
  updateWorkspace,
} from "@/lib/db/repository";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action:
        | "create_workspace"
        | "update_workspace"
        | "clear_workspace"
        | "delete_workspace"
        | "auth"
        | "logout";
      workspaceId?: string;
      name?: string;
      email?: string;
      password?: string;
      workspaceName?: string;
      settings?: {
        defaultExportFormat?: "png" | "webp" | "both";
        requireApprovalBeforeExport?: boolean;
      };
    };

    if (body.action === "logout") {
      const res = NextResponse.json({ loggedOut: true });
      res.cookies.delete("studio_session");
      res.cookies.delete("studio_workspace_id");
      return res;
    }

    if (body.action === "auth") {
      if (!body.email || !body.password) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 }
        );
      }
      const authResult = registerOrLoginUser({
        email: body.email,
        name: body.name,
        password: body.password,
        workspaceName: body.workspaceName,
      });

      const res = NextResponse.json(authResult);
      const token = signSessionToken(authResult.user.id);
      res.cookies.set("studio_session", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      if (authResult.workspaces[0]) {
        res.cookies.set("studio_workspace_id", authResult.workspaces[0].id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    }

    const session = resolveRequestSession(req);

    if (body.action === "create_workspace") {
      if (!body.name || body.name.trim().length < 2) {
        return NextResponse.json(
          { error: "Provide a workspace name with at least 2 characters." },
          { status: 400 }
        );
      }
      const created = createWorkspaceWithDefaults({
        name: body.name,
        ownerId: session.user.id,
      });
      return NextResponse.json({ workspace: created });
    }

    if (body.action === "update_workspace") {
      const updated = updateWorkspace(session.activeWorkspace.id, {
        name: body.name,
        settings: body.settings,
      });
      return NextResponse.json({ workspace: updated });
    }

    if (body.action === "clear_workspace") {
      clearWorkspaceData(session.activeWorkspace.id);
      return NextResponse.json({ cleared: true });
    }

    if (body.action === "delete_workspace") {
      const targetWsId = body.workspaceId || session.activeWorkspace.id;
      const remainingWorkspaces = deleteWorkspace(targetWsId, session.user.id);
      const res = NextResponse.json({
        deleted: true,
        workspaces: remainingWorkspaces,
        nextWorkspaceId: remainingWorkspaces[0]?.id ?? "",
      });
      if (remainingWorkspaces[0]) {
        res.cookies.set("studio_workspace_id", remainingWorkspaces[0].id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    }

    return NextResponse.json(
      { error: "Unsupported workspace action." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Workspace operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
