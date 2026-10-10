import { describe, expect, it } from "vitest";
import type { Repositories } from "@/repositories/types";
import type { AuditEvent, SessionUser } from "@/types/domain";
import { AuditService } from "./audit.service";
import { ProfileService } from "./profile.service";

function memory() {
  const taken = new Map<string, string>([["taken", "u-other"]]);
  const rows = new Map<string, SessionUser>([
    [
      "u-1",
      {
        id: "u-1",
        email: "a@b.com",
        fullName: "Ada",
        username: "ada",
        phone: null,
        avatarUrl: null,
        role: null,
        isOwner: false,
        isDemo: false,
      },
    ],
  ]);
  const auditLogs: AuditEvent[] = [];
  const repos = {
    profiles: {
      async getByUserId(userId: string) {
        return rows.get(userId) ?? null;
      },
      async update(userId: string, input: Partial<SessionUser>) {
        const current = rows.get(userId)!;
        const next = { ...current, ...input, id: userId };
        rows.set(userId, next);
        return next;
      },
      async isUsernameAvailable(username: string, excludeUserId?: string) {
        const owner = taken.get(username.trim().toLowerCase());
        if (!owner) return true;
        return Boolean(excludeUserId && owner === excludeUserId);
      },
      async upsertOwnProfile() {
        throw new Error("not used");
      },
    },
    audits: {
      async create(input: Omit<AuditEvent, "id" | "createdAt">) {
        const event: AuditEvent = {
          id: `a-${auditLogs.length + 1}`,
          businessId: input.businessId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? {},
          createdAt: new Date().toISOString(),
        };
        auditLogs.unshift(event);
        return event;
      },
      async list() {
        return auditLogs;
      },
    },
  } as unknown as Repositories;
  return { repos, rows, auditLogs };
}

describe("ProfileService", () => {
  it("updates the username when it is free", async () => {
    const { repos, rows } = memory();
    const service = new ProfileService(repos, new AuditService(repos));
    const updated = await service.updateProfile("u-1", {
      fullName: "Ada Lovelace",
      username: "ada_dev",
      phone: "",
      avatarUrl: "",
    });
    expect(updated.username).toBe("ada_dev");
    expect(rows.get("u-1")?.fullName).toBe("Ada Lovelace");
  });

  it("rejects a taken username", async () => {
    const { repos } = memory();
    const service = new ProfileService(repos, new AuditService(repos));
    await expect(
      service.updateProfile("u-1", {
        fullName: "Ada Lovelace",
        username: "taken",
        phone: "",
        avatarUrl: "",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
