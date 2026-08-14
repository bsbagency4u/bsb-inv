import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SessionUser } from "@/types/domain";
import { mapProfile } from "./mappers";

export interface ProfileRepository {
  getByUserId(userId: string): Promise<SessionUser | null>;
  update(userId: string, input: Partial<SessionUser>): Promise<SessionUser>;
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
        phone: input.phone ?? null,
        avatar_url: input.avatarUrl ?? null,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  }
}
