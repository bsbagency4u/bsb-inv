import type { Repositories, AuditLogInput } from "@/repositories/types";
import type { AuditEvent } from "@/types/domain";

/**
 * Audit-log service. Centralizes how actions are recorded so later phases
 * (stock adjustments, sales, settings changes) can log without touching
 * repositories or Supabase directly.
 */
export class AuditService {
  constructor(private repos: Repositories) {}

  async log(input: AuditLogInput): Promise<AuditEvent> {
    return this.repos.audits.create(input);
  }

  async listForBusiness(businessId: string, limit = 50): Promise<AuditEvent[]> {
    return this.repos.audits.list(businessId, limit);
  }
}
