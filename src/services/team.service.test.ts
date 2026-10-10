import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories, TeamRepository } from "@/repositories/types";
import type { AuditEvent, TeamInvitation, TeamMember } from "@/types/domain";
import type { AuditRepository } from "@/repositories/audit.repository";
import {
  DEMO_PERMISSIONS,
  DEMO_ROLE_PERMISSIONS,
  DEMO_ROLES,
} from "@/repositories/local/local-data";
import { AuditService } from "./audit.service";
import { TeamService } from "./team.service";

function memoryRepositories() {
  const members: TeamMember[] = [
    {
      businessId: "b-1",
      userId: "u-owner",
      email: "owner@example.com",
      fullName: "Owner",
      roleId: "role-owner",
      roleSlug: "owner",
      roleName: "Owner",
      isOwner: true,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      businessId: "b-1",
      userId: "u-staff",
      email: "staff@example.com",
      fullName: "Staff",
      roleId: "role-staff",
      roleSlug: "staff",
      roleName: "Staff",
      isOwner: false,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];
  const invitations: TeamInvitation[] = [];
  const auditLogs: AuditEvent[] = [];

  const team: TeamRepository = {
    async listMembers(businessId) {
      return members.filter((member) => member.businessId === businessId);
    },
    async listRoles() {
      return DEMO_ROLES;
    },
    async listPermissions() {
      return DEMO_PERMISSIONS;
    },
    async listRolePermissions() {
      return DEMO_ROLE_PERMISSIONS;
    },
    async listInvitations(businessId) {
      return invitations.filter((invite) => invite.businessId === businessId);
    },
    async createInvitation(businessId, invitedBy, input) {
      const invite: TeamInvitation = {
        id: `inv-${invitations.length + 1}`,
        businessId,
        email: input.email,
        fullName: input.fullName,
        roleSlug: input.roleSlug,
        invitedBy,
        createdAt: new Date().toISOString(),
      };
      invitations.push(invite);
      return invite;
    },
    async cancelInvitation(businessId, invitationId) {
      const index = invitations.findIndex(
        (invite) => invite.businessId === businessId && invite.id === invitationId
      );
      if (index >= 0) invitations.splice(index, 1);
    },
    async updateMemberRole(businessId, userId, roleId) {
      const role = DEMO_ROLES.find((r) => r.id === roleId) ?? null;
      const member = members.find(
        (m) => m.businessId === businessId && m.userId === userId
      );
      if (member) {
        member.roleId = role?.id ?? null;
        member.roleSlug = role?.slug ?? null;
        member.roleName = role?.name ?? null;
      }
    },
    async removeMember(businessId, userId) {
      const index = members.findIndex(
        (member) => member.businessId === businessId && member.userId === userId
      );
      if (index >= 0) members.splice(index, 1);
    },
    async getMemberPermissions(businessId, userId) {
      const member = members.find(
        (entry) => entry.businessId === businessId && entry.userId === userId
      );
      if (!member) return [];
      if (member.isOwner) return ["*"];
      const role = DEMO_ROLES.find((r) => r.slug === member.roleSlug);
      if (!role) return [];
      const permissionIds = DEMO_ROLE_PERMISSIONS.filter(
        (rp) => rp.roleId === role.id
      ).map((rp) => rp.permissionId);
      return DEMO_PERMISSIONS.filter((permission) =>
        permissionIds.includes(permission.id)
      ).map((permission) => permission.slug);
    },
  };

  const audits: AuditRepository = {
    async create(input) {
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
    async list(businessId) {
      return auditLogs.filter((log) => log.businessId === businessId);
    },
  };

  const repos = { team, audits } as unknown as Repositories;
  return { repos, members, invitations, auditLogs };
}

describe("TeamService", () => {
  let memory: ReturnType<typeof memoryRepositories>;
  let team: TeamService;

  beforeEach(() => {
    memory = memoryRepositories();
    team = new TeamService(memory.repos, new AuditService(memory.repos));
  });

  it("creates an invitation and records an audit event", async () => {
    const invite = await team.invite("u-owner", "b-1", {
      email: "new@example.com",
      fullName: "New Person",
      roleSlug: "manager",
    });

    expect(invite.email).toBe("new@example.com");
    expect(memory.invitations).toHaveLength(1);
    expect(memory.auditLogs[0].action).toBe("team.member.invited");
  });

  it("rejects inviting an existing member", async () => {
    await expect(
      team.invite("u-owner", "b-1", {
        email: "staff@example.com",
        fullName: "Staff",
        roleSlug: "staff",
      })
    ).rejects.toThrow();
  });

  it("rejects the Owner role", async () => {
    await expect(
      team.invite("u-owner", "b-1", {
        email: "another@example.com",
        fullName: "",
        roleSlug: "owner",
      })
    ).rejects.toThrow();
  });

  it("blocks non-owners from managing the team", async () => {
    await expect(
      team.invite("u-staff", "b-1", {
        email: "x@example.com",
        fullName: "",
        roleSlug: "staff",
      })
    ).rejects.toThrow();
  });

  it("changes a member role and logs it", async () => {
    await team.changeRole("u-owner", "b-1", "u-staff", "manager");
    const member = memory.members.find((m) => m.userId === "u-staff");
    expect(member?.roleSlug).toBe("manager");
    expect(memory.auditLogs[0].action).toBe("team.member.role_changed");
  });

  it("refuses to remove yourself", async () => {
    await expect(team.removeMember("u-owner", "b-1", "u-owner")).rejects.toThrow();
    expect(memory.members).toHaveLength(2);
  });

  it("refuses to change the owner's role", async () => {
    await expect(team.changeRole("u-owner", "b-1", "u-owner", "manager")).rejects.toThrow();
  });

  it("removes a member", async () => {
    await team.removeMember("u-owner", "b-1", "u-staff");
    expect(memory.members.map((m) => m.userId)).toEqual(["u-owner"]);
    expect(memory.auditLogs[0].action).toBe("team.member.removed");
  });

  it("cancels a pending invitation", async () => {
    await team.invite("u-owner", "b-1", {
      email: "pending@example.com",
      fullName: "",
      roleSlug: "staff",
    });
    const invitationId = memory.invitations[0].id;
    await team.cancelInvitation("u-owner", "b-1", invitationId);
    expect(memory.invitations).toHaveLength(0);
  });
});
