/**
 * Centralized Supabase environment configuration.
 *
 * Never import process.env directly in UI or repository code — go through here.
 *
 * NOTE: The service-role key accessors are intended for server-side code only.
 * Public values (url / anon key) are safe in browser bundles; the service-role
 * key is never exposed to the browser.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

export function getSupabaseEnv(): SupabaseEnv {
  if (!URL || !ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
    );
  }
  return { url: URL, anonKey: ANON_KEY };
}

/**
 * Server-only configuration. The service-role key must NEVER be exposed to the
 * browser. It is only used in server-side privileged operations.
 */
export function getServiceRoleKey(): string {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return SERVICE_ROLE_KEY;
}

export function hasServiceRoleKey(): boolean {
  return Boolean(SERVICE_ROLE_KEY);
}
