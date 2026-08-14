import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Session refresh helper for proxy.ts (Next.js 16 "middleware").
 *
 * Re-runs on every request to keep the auth cookie fresh. Runs as close to
 * the edge as possible; it performs only optimistic checks and never touches
 * the database. Real authorization happens in services/repositories.
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const { url, anonKey } = getSupabaseEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
        if (responseHeaders) {
          for (const [key, value] of Object.entries(responseHeaders)) {
            supabaseResponse.headers.set(key, value);
          }
        }
      },
    },
  });

  // Do NOT run any code between the client creation and getUser(); otherwise
  // the session refresh is skipped and stale tokens are returned.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isPublicPath =
    path.startsWith("/login") || path === "/" || path.startsWith("/auth");

  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    if (path !== "/") {
      redirectUrl.searchParams.set("next", path);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicPath && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
