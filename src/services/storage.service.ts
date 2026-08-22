import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const BUCKET = "product-images";

/**
 * Product image storage. When Supabase is configured, images are uploaded to
 * the `product-images` Storage bucket and only the public URL is stored in
 * Postgres (never the binary). In demo mode uploads are simulated so the
 * catalogue still works offline.
 */
export class StorageService {
  /** Uploads an image file for a business and returns storage path + URL. */
  async uploadProductImage(
    businessId: string,
    productId: string,
    file: File
  ): Promise<{ storagePath: string; url: string }> {
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${businessId}/${productId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    if (!isSupabaseConfigured()) {
      // Demo fallback: keep the app usable offline. The binary is not stored
      // in Postgres; only the object URL is recorded.
      return {
        storagePath,
        url: URL.createObjectURL(file),
      };
    }

    const client = getBrowserClient();
    if (!client) throw new Error("Image storage is unavailable.");

    const { error } = await client.storage.from(BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;

    const { data } = client.storage.from(BUCKET).getPublicUrl(storagePath);
    return { storagePath, url: data.publicUrl };
  }

  /** Deletes a stored image object (ignores demo paths). */
  async deleteProductImage(businessId: string, storagePath: string): Promise<void> {
    if (!isSupabaseConfigured() || storagePath.startsWith("blob:")) return;
    const client = getBrowserClient();
    if (!client) return;
    await client.storage.from(BUCKET).remove([storagePath]);
  }
}
