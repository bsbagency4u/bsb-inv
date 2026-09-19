"use client";

import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseBusinessRepository } from "./business.repository";
import { SupabaseProfileRepository } from "./profile.repository";
import { SupabaseAuditRepository } from "./audit.repository";
import { SupabaseProductRepository } from "./product.repository";
import { SupabaseInventoryRepository } from "./inventory.repository";
import { SupabasePartyRepository } from "./party.repository";
import { SupabaseTransactionRepository } from "./transaction.repository";
import { SupabaseNotificationRepository } from "./notification.repository";
import { SupabaseTeamRepository } from "./team.repository";
import { LocalBusinessRepository } from "./local/business.repository";
import { LocalProfileRepository } from "./local/profile.repository";
import { LocalAuditRepository } from "./local/audit.repository";
import { LocalProductRepository } from "./local/product.repository";
import { LocalInventoryRepository } from "./local/inventory.repository";
import { LocalPartyRepository } from "./local/party.repository";
import { LocalTransactionRepository } from "./local/transaction.repository";
import { LocalNotificationRepository } from "./local/notification.repository";
import { LocalTeamRepository } from "./local/team.repository";
import type { Repositories } from "./types";

let cached: Repositories | null = null;

const buildLocal = (): Repositories => ({
  businesses: new LocalBusinessRepository(),
  profiles: new LocalProfileRepository(),
  audits: new LocalAuditRepository(),
  products: new LocalProductRepository(),
  inventory: new LocalInventoryRepository(),
  parties: new LocalPartyRepository(),
  transactions: new LocalTransactionRepository(),
  notifications: new LocalNotificationRepository(),
  team: new LocalTeamRepository(),
});

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
    cached = buildLocal();
    return cached;
  }

  const client = getBrowserClient();
  if (!client) {
    cached = buildLocal();
    return cached;
  }

  cached = {
    businesses: new SupabaseBusinessRepository(client),
    profiles: new SupabaseProfileRepository(client),
    audits: new SupabaseAuditRepository(client),
    products: new SupabaseProductRepository(client),
    inventory: new SupabaseInventoryRepository(client),
    parties: new SupabasePartyRepository(client),
    transactions: new SupabaseTransactionRepository(client),
    notifications: new SupabaseNotificationRepository(client),
    team: new SupabaseTeamRepository(client),
  };
  return cached;
}
