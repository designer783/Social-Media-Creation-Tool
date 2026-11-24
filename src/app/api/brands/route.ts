import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession } from "@/lib/auth/session";
import { ensureWorkspaceStorageDir } from "@/lib/db/client";
import {
  createBrand,
  createBrandKit,
  deleteBrand,
  getBrandById,
  updateBrand,
} from "@/lib/db/repository";
import { extractBrandFromWebsite } from "@/lib/extractor/website-extractor";
import { slugify } from "@/lib/utils";

function parseLogoDataUrl(logoDataUrl?: string | null): Buffer | undefined {
  if (!logoDataUrl || !logoDataUrl.startsWith("data:image/")) {
    return undefined;
  }
  const allowedMimes = [
    "data:image/png;",
    "data:image/jpeg;",
    "data:image/webp;",
    "data:image/svg+xml;",
  ];
  if (!allowedMimes.some((m) => logoDataUrl.startsWith(m))) {
    throw new Error("Unsupported logo image format. Upload PNG, JPEG, WebP, or SVG.");
  }
  const base64Part = logoDataUrl.split(",")[1];
  if (!base64Part) return undefined;
  const buf = Buffer.from(base64Part, "base64");
  if (buf.byteLength > 5 * 1024 * 1024) {
    throw new Error("Logo file size exceeds the 5 MB limit.");
  }
  // If SVG, strip any dangerous script or event handlers
  if (logoDataUrl.startsWith("data:image/svg+xml;")) {
    const cleanSvg = buf
      .toString("utf8")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
    return Buffer.from(cleanSvg, "utf8");
  }
  return buf;
}

export async function POST(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      name: string;
      domain: string;
      websiteUrl: string;
      logoDataUrl?: string | null;
    };

    if (!body.name?.trim() || !body.domain?.trim() || !body.websiteUrl?.trim()) {
      return NextResponse.json(
        { error: "Brand name, domain, and website URL are required." },
        { status: 400 }
      );
    }

    const logoBuffer = parseLogoDataUrl(body.logoDataUrl);
    const extracted = await extractBrandFromWebsite({
      websiteUrl: body.websiteUrl,
      brandName: body.name,
      workspaceId: wsId,
      userId: session.user.id,
      logoBuffer,
    });

    let logoAssetPath: string | null = null;
    if (logoBuffer) {
      const logosDir = ensureWorkspaceStorageDir(wsId, "logos");
      logoAssetPath = path.join(logosDir, `${slugify(body.name)}-${Date.now()}.png`);
      fs.writeFileSync(logoAssetPath, logoBuffer);
    }

    const brand = createBrand(wsId, {
      name: body.name,
      domain: body.domain,
      websiteUrl: body.websiteUrl,
      logoAssetPath,
      logoDataUrl: body.logoDataUrl ?? null,
    });

    const brandKit = createBrandKit(wsId, {
      brandId: brand.id,
      name: `${brand.name} Extracted Kit v1`,
      status: "approved",
      colors: extracted.colors,
      typography: extracted.typography,
      visualStyle: extracted.visualStyle,
      extractionMeta: extracted.extractionMeta,
    });

    return NextResponse.json({
      brand: getBrandById(wsId, brand.id),
      brandKit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create and extract brand.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;

    const body = (await req.json()) as {
      brandId: string;
      name?: string;
      domain?: string;
      websiteUrl?: string;
      logoDataUrl?: string | null;
      reExtract?: boolean;
      activeKitId?: string;
    };

    const existing = getBrandById(wsId, body.brandId);
    if (!existing) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    const logoBuffer = parseLogoDataUrl(body.logoDataUrl ?? existing.logoDataUrl);
    let logoAssetPath = existing.logoAssetPath;
    if (body.logoDataUrl && logoBuffer) {
      const logosDir = ensureWorkspaceStorageDir(wsId, "logos");
      logoAssetPath = path.join(logosDir, `${slugify(existing.name)}-${Date.now()}.png`);
      fs.writeFileSync(logoAssetPath, logoBuffer);
    }

    const updatedBrand = updateBrand(wsId, existing.id, {
      name: body.name,
      domain: body.domain,
      websiteUrl: body.websiteUrl,
      logoAssetPath,
      logoDataUrl: body.logoDataUrl !== undefined ? body.logoDataUrl : existing.logoDataUrl,
      activeKitId: body.activeKitId,
    });

    if (body.reExtract) {
      const extracted = await extractBrandFromWebsite({
        websiteUrl: updatedBrand.websiteUrl,
        brandName: updatedBrand.name,
        workspaceId: wsId,
        userId: session.user.id,
        logoBuffer,
      });

      const newKit = createBrandKit(wsId, {
        brandId: updatedBrand.id,
        status: "approved",
        colors: extracted.colors,
        typography: extracted.typography,
        visualStyle: extracted.visualStyle,
        extractionMeta: extracted.extractionMeta,
      });

      return NextResponse.json({
        brand: getBrandById(wsId, updatedBrand.id),
        brandKit: newKit,
      });
    }

    return NextResponse.json({ brand: updatedBrand });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update brand.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = resolveRequestSession(req);
    const wsId = session.activeWorkspace.id;
    const brandId = req.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required." }, { status: 400 });
    }
    deleteBrand(wsId, brandId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete brand.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
