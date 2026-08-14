import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AuditEvent } from "@/types/domain";

export interface AuditLogInput {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditRepository {
  create(input: AuditLogInput): Promise<AuditEvent>;
  list(businessId: string, limit?: number): Promise<AuditEvent[]>;
}

export class SupabaseAuditRepository implements AuditRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async create(input: AuditLogInput): Promise<AuditEvent> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert({
        business_id: input.businessId,
        user_id: input.userId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        metadata: input.metadata ?? {},
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      })
      .select()
      .single();

    if (error) throw error;
    return mapAuditRow(data);
  }

  async list(businessId: string, limit = 50): Promise<AuditEvent[]> {
    const { data, error } = await this.client
      .from("audit_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapAuditRow);
  }
}

export function mapAuditRow(row: {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AuditEvent {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}
