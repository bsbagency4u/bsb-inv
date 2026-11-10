import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { getServiceRoleKey, hasServiceRoleKey } from "@/lib/supabase/env";

export { maskUsername } from "@/lib/gst-mask";

const ALGO = "aes-256-gcm";

function keyMaterial(): Buffer {
  const secret = hasServiceRoleKey()
    ? getServiceRoleKey()
    : process.env.GST_IRP_SECRET ?? "bsb-stockflow-demo-irp-secret";
  return scryptSync(secret, "gst-irp-credentials", 32);
}

export function encryptSecret(plain: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, keyMaterial(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
