import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseBusinessRepository } from "./business.repository";
import { SupabaseProfileRepository } from "./profile.repository";
import { SupabaseAuditRepository } from "./audit.repository";
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
  };
}
