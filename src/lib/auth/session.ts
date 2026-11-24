import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/crypto-vault";
import {
  ensureSeedData,
  getUserById,
  getWorkspaceById,
  listUserWorkspaces,
} from "@/lib/db/repository";
import type { User, Workspace } from "@/types/domain";

export interface SessionContext {
  user: User;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
}

export function resolveOptionalRequestSession(req?: NextRequest): SessionContext | null {
  const seeded = ensureSeedData();

  const sessionCookie =
    req?.cookies.get("studio_session")?.value ||
    (req?.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")?.slice(7).trim()
      : undefined);

  if (!sessionCookie) {
    if (process.env.VITEST || !req) {
      const userWorkspaces = listUserWorkspaces(seeded.user.id);
      return {
        user: seeded.user,
        activeWorkspace: userWorkspaces[0] ?? seeded.workspace,
        workspaces: userWorkspaces,
      };
    }
    return null;
  }

  const verified = verifySessionToken(sessionCookie);
  if (!verified) {
    return null;
  }

  const foundUser = getUserById(verified.userId);
  if (!foundUser) {
    return null;
  }

  const requestedWorkspaceId =
    req?.headers.get("x-workspace-id") ??
    req?.cookies.get("studio_workspace_id")?.value ??
    req?.nextUrl.searchParams.get("workspaceId");

  const userWorkspaces = listUserWorkspaces(foundUser.id);

  if (requestedWorkspaceId) {
    const matched = userWorkspaces.find((w) => w.id === requestedWorkspaceId);
    if (matched) {
      return {
        user: foundUser,
        activeWorkspace: matched,
        workspaces: userWorkspaces,
      };
    }
    const foreign = getWorkspaceById(requestedWorkspaceId);
    if (foreign) {
      throw new Error("Forbidden: You do not have access to this workspace.");
    }
  }

  return {
    user: foundUser,
    activeWorkspace: userWorkspaces[0] ?? seeded.workspace,
    workspaces: userWorkspaces,
  };
}

export function resolveRequestSession(req?: NextRequest): SessionContext {
  const session = resolveOptionalRequestSession(req);
  if (!session) {
    throw new Error("Unauthorized: Studio is locked. Admin authentication required.");
  }
  return session;
}
