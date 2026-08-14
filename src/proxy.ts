import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

/**
 * Next.js 16 renamed Middleware to Proxy. This file runs before every request
 * and performs optimistic session checks + cookie refresh.
 *
 * NOTE: In demo mode (Supabase not configured) the session is stored on the
 * client and this proxy passes everything through.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
