"use client";

import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseBusinessRepository } from "./business.repository";
import { SupabaseProfileRepository } from "./profile.repository";
import { SupabaseAuditRepository } from "./audit.repository";
import { LocalBusinessRepository } from "./local/business.repository";
import { LocalProfileRepository } from "./local/profile.repository";
import { LocalAuditRepository } from "./local/audit.repository";
import type { Repositories } from "./types";

let cached: Repositories | null = null;

/**
 * Returns the repository set for the browser runtime.
 *
 * - Supabase configured → Supabase repositories
 * - otherwise → local (demo/offline) repositories
 *
 * UI code must consume repositories through services, never via Supabase
 * directly.
 */
export function getClientRepositories(): Repositories {
  if (cached) return cached;

  if (!isSupabaseConfigured()) {
    cached = {
      businesses: new LocalBusinessRepository(),
      profiles: new LocalProfileRepository(),
      audits: new LocalAuditRepository(),
    };
    return cached;
  }

  const client = getBrowserClient();
  if (!client) {
    cached = {
      businesses: new LocalBusinessRepository(),
      profiles: new LocalProfileRepository(),
      audits: new LocalAuditRepository(),
    };
    return cached;
  }

  cached = {
    businesses: new SupabaseBusinessRepository(client),
    profiles: new SupabaseProfileRepository(client),
    audits: new SupabaseAuditRepository(client),
  };
  return cached;
}
