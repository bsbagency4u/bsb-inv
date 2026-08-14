import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Creates a Supabase server client bound to the current request's cookies.
 * Always create a new client per render/request — never share across requests.
 *
 * UI/UI hooks must go through services/repositories. This is only used by
 * server components, route handlers and server actions.
 */
export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component. Safe to ignore if proxy.ts refreshes sessions.
        }
      },
    },
  });
}
