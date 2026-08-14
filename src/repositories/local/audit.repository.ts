import type { AuditEvent } from "@/types/domain";
import type { AuditLogInput, AuditRepository } from "../audit.repository";
import { readStorage, writeStorage } from "./local-data";

const KEY = "demo-audit-logs";

export class LocalAuditRepository implements AuditRepository {
  private all(): AuditEvent[] {
    return readStorage<AuditEvent[]>(KEY, []);
  }

  async create(input: AuditLogInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: `audit-${crypto.randomUUID()}`,
      businessId: input.businessId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    const logs = this.all();
    logs.unshift(event);
    this.save(logs.slice(0, 200));
    return event;
  }

  async list(businessId: string, limit = 50): Promise<AuditEvent[]> {
    return this.all()
      .filter((log) => log.businessId === businessId)
      .slice(0, limit);
  }

  private save(logs: AuditEvent[]): void {
    writeStorage(KEY, logs);
  }
}
