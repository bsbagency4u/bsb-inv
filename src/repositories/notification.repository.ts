import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { NotificationItem } from "@/types/domain";
import { mapNotification } from "./mappers";

export interface NotificationRepository {
  list(businessId: string, userId: string, limit?: number): Promise<NotificationItem[]>;
  create(input: {
    businessId: string;
    userId?: string | null;
    title: string;
    description?: string | null;
    type?: "info" | "success" | "warning" | "error";
    href?: string | null;
  }): Promise<NotificationItem>;
  markRead(businessId: string, userId: string, notificationId: string): Promise<void>;
  markAllRead(businessId: string, userId: string): Promise<void>;
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async list(businessId: string, userId: string, limit = 20): Promise<NotificationItem[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .eq("business_id", businessId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapNotification);
  }

  async create(input: {
    businessId: string;
    userId?: string | null;
    title: string;
    description?: string | null;
    type?: "info" | "success" | "warning" | "error";
    href?: string | null;
  }): Promise<NotificationItem> {
    const { data, error } = await this.client
      .from("notifications")
      .insert({
        business_id: input.businessId,
        user_id: input.userId ?? null,
        title: input.title,
        description: input.description ?? null,
        type: input.type ?? "info",
        href: input.href ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapNotification(data);
  }

  async markRead(businessId: string, userId: string, notificationId: string): Promise<void> {
    const { error } = await this.client
      .from("notifications")
      .update({ read: true })
      .eq("business_id", businessId)
      .eq("id", notificationId)
      .or(`user_id.is.null,user_id.eq.${userId}`);
    if (error) throw error;
  }

  async markAllRead(businessId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("notifications")
      .update({ read: true })
      .eq("business_id", businessId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("read", false);
    if (error) throw error;
  }
}
