import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getStorageRoot } from "@/lib/db/client";

let cachedMasterKey: Buffer | null = null;

function getVaultMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const envSecret = process.env.STUDIO_VAULT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    cachedMasterKey = crypto.createHash("sha256").update(envSecret).digest();
    return cachedMasterKey;
  }

  if (process.env.VITEST) {
    cachedMasterKey = crypto
      .createHash("sha256")
      .update("vitest-deterministic-vault-key")
      .digest();
    return cachedMasterKey;
  }

  const keyFilePath = path.join(getStorageRoot(), ".vault.key");
  try {
    fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
    if (fs.existsSync(keyFilePath)) {
      const hex = fs.readFileSync(keyFilePath, "utf8").trim();
      if (/^[0-9a-fA-F]{64}$/.test(hex)) {
        cachedMasterKey = Buffer.from(hex, "hex");
        return cachedMasterKey;
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(keyFilePath, generated.toString("hex"), { mode: 0o600 });
    cachedMasterKey = generated;
    return cachedMasterKey;
  } catch {
    cachedMasterKey = crypto
      .createHash("sha256")
      .update(`fallback-${process.cwd()}`)
      .digest();
    return cachedMasterKey;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getVaultMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const parts = payload.split(":");
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;
    const key = getVaultMasterKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function signSessionToken(userId: string): string {
  const key = getVaultMasterKey();
  const payload = Buffer.from(
    JSON.stringify({ userId, issuedAt: Date.now() }),
    "utf8"
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const key = getVaultMasterKey();
    const expected = crypto
      .createHmac("sha256", key)
      .update(payload)
      .digest("base64url");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { userId?: string };
    return parsed.userId ? { userId: parsed.userId } : null;
  } catch {
    return null;
  }
}
