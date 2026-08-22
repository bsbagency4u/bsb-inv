import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseBusinessRepository } from "./business.repository";
import { SupabaseProfileRepository } from "./profile.repository";
import { SupabaseAuditRepository } from "./audit.repository";
import { SupabaseProductRepository } from "./product.repository";
import { SupabaseInventoryRepository } from "./inventory.repository";
import { SupabasePartyRepository } from "./party.repository";
import { SupabaseTransactionRepository } from "./transaction.repository";
import { SupabaseNotificationRepository } from "./notification.repository";
import type { Repositories } from "./types";

/**
 * Returns the repository set for the server runtime (server components,
 * route handlers, server actions). Supabase repositories when configured.
 */
export async function getServerRepositories(): Promise<Repositories> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured for server-side data access.");
  }
  const client = await createServerSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured for server-side data access.");
  }
  return {
    businesses: new SupabaseBusinessRepository(client),
    profiles: new SupabaseProfileRepository(client),
    audits: new SupabaseAuditRepository(client),
    products: new SupabaseProductRepository(client),
    inventory: new SupabaseInventoryRepository(client),
    parties: new SupabasePartyRepository(client),
    transactions: new SupabaseTransactionRepository(client),
    notifications: new SupabaseNotificationRepository(client),
  };
}
