"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Returns the Supabase browser client.
 *
 * IMPORTANT: This is the only place in the browser bundle that creates a
 * Supabase client. UI code must go through services/repositories, not this
 * directly, and must check `isSupabaseConfigured()` first.
 */
export function getBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const { url, anonKey } = getSupabaseEnv();
  client = createBrowserClient<Database>(url, anonKey);
  return client;
}

export function isSupabaseConfiguredForClient(): boolean {
  return isSupabaseConfigured();
}
