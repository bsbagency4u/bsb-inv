import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PRODUCT_BUCKET = "product-images";
const DOCUMENT_BUCKET = "business-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type BusinessDocumentKind = "logo" | "watermark" | "signature" | "stamp";

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return "jpg";
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Product image storage plus private business-document assets.
 * Quotation branding (logo, watermark, signature, stamp) lives in the
 * private `business-documents` bucket and is never given a public URL.
 */
export class StorageService {
  /** Uploads an image file for a business and returns storage path + URL. */
  async uploadProductImage(
    businessId: string,
    productId: string,
    file: File
  ): Promise<{ storagePath: string; url: string }> {
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${businessId}/${productId}/${Date.now()}-${randomToken()}.${extension}`;

    if (!isSupabaseConfigured()) {
      return {
        storagePath,
        url: URL.createObjectURL(file),
      };
    }

    const client = getBrowserClient();
    if (!client) throw new Error("Image storage is unavailable.");

    const { error } = await client.storage.from(PRODUCT_BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;

    const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(storagePath);
    return { storagePath, url: data.publicUrl };
  }

  /** Deletes a stored image object (ignores demo paths). */
  async deleteProductImage(businessId: string, storagePath: string): Promise<void> {
    if (!isSupabaseConfigured() || storagePath.startsWith("blob:")) return;
    const client = getBrowserClient();
    if (!client) return;
    await client.storage.from(PRODUCT_BUCKET).remove([storagePath]);
  }

  async uploadBusinessDocument(
    businessId: string,
    kind: BusinessDocumentKind,
    file: File
  ): Promise<{ storagePath: string; url: string }> {
    const extension = fileExtension(file);
    const storagePath = `${businessId}/quotation/${kind}/${Date.now()}-${randomToken()}.${extension}`;

    if (!isSupabaseConfigured()) {
      return { storagePath, url: URL.createObjectURL(file) };
    }

    const client = getBrowserClient();
    if (!client) throw new Error("Document storage is unavailable.");

    const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || "image/png",
    });
    if (error) throw error;

    const url = await this.signedBusinessDocumentUrl(storagePath);
    return { storagePath, url };
  }

  async signedBusinessDocumentUrl(storagePath: string): Promise<string> {
    if (!storagePath || storagePath.startsWith("blob:") || storagePath.startsWith("data:")) {
      return storagePath;
    }
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
      return storagePath;
    }
    if (!isSupabaseConfigured()) return storagePath;

    const client = getBrowserClient();
    if (!client) return storagePath;
    const { data, error } = await client.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) throw error ?? new Error("Could not create a document link.");
    return data.signedUrl;
  }

  async deleteBusinessDocument(storagePath: string): Promise<void> {
    if (!isSupabaseConfigured() || storagePath.startsWith("blob:") || storagePath.startsWith("data:")) return;
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) return;
    const client = getBrowserClient();
    if (!client) return;
    await client.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
  }
}
