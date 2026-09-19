import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SessionUser } from "@/types/domain";
import { mapProfile } from "./mappers";

export interface ProfileRepository {
  getByUserId(userId: string): Promise<SessionUser | null>;
  update(userId: string, input: Partial<SessionUser>): Promise<SessionUser>;
  isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;
  upsertOwnProfile(userId: string, input: Partial<SessionUser> & { email?: string }): Promise<SessionUser>;
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async getByUserId(userId: string): Promise<SessionUser | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProfile(data) : null;
  }

  async update(userId: string, input: Partial<SessionUser>): Promise<SessionUser> {
    const { data, error } = await this.client
      .from("profiles")
      .update({
        full_name: input.fullName,
        username: input.username ?? undefined,
        phone: input.phone ?? null,
        avatar_url: input.avatarUrl ?? null,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return false;
    const { data, error } = await this.client.rpc("is_username_available", {
      p_username: normalized,
    });
    if (error) {
      const { data: existing, error: lookupError } = await this.client
        .from("profiles")
        .select("id")
        .ilike("username", normalized)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return true;
      return Boolean(excludeUserId && existing.id === excludeUserId);
    }
    if (data === true) return true;
    if (excludeUserId) {
      const current = await this.getByUserId(excludeUserId);
      if (current?.username?.toLowerCase() === normalized) return true;
    }
    return false;
  }

  async upsertOwnProfile(
    userId: string,
    input: Partial<SessionUser> & { email?: string }
  ): Promise<SessionUser> {
    const { data, error } = await this.client
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: input.fullName ?? "",
          email: input.email ?? null,
          username: input.username ?? null,
          phone: input.phone ?? null,
          avatar_url: input.avatarUrl ?? null,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  }
}
