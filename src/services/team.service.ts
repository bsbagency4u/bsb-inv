import type { Repositories } from "@/repositories/types";
import { AppError } from "@/lib/errors";
import { inviteMemberSchema, type InviteMemberValues } from "@/lib/validation/schemas";
import type {
  Permission,
  Role,
  RolePermissionMap,
  TeamInvitation,
  TeamMember,
} from "@/types/domain";
import type { AuditService } from "./audit.service";

export interface TeamSnapshot {
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export interface RolesSnapshot {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermissionMap[];
}

/**
 * Team and access service. Owns invite / role-change / removal rules so the
 * UI never talks to repositories directly. Owners-only mutations mirror the
 * RLS policies and record audit events.
 */
export class TeamService {
  constructor(
    private repos: Repositories,
    private audits: AuditService
  ) {}

  async getSnapshot(businessId: string): Promise<TeamSnapshot> {
    const [members, invitations] = await Promise.all([
      this.repos.team.listMembers(businessId),
      this.repos.team.listInvitations(businessId),
    ]);
    return { members, invitations };
  }

  async getRolesSnapshot(): Promise<RolesSnapshot> {
    const [roles, permissions, rolePermissions] = await Promise.all([
      this.repos.team.listRoles(),
      this.repos.team.listPermissions(),
      this.repos.team.listRolePermissions(),
    ]);
    return { roles, permissions, rolePermissions };
  }

  private async requireOwner(businessId: string, actorId: string): Promise<TeamMember> {
    const members = await this.repos.team.listMembers(businessId);
    const actor = members.find((member) => member.userId === actorId);
    if (!actor) {
      throw AppError.authorization("You are not a member of this business.");
    }
    if (!actor.isOwner) {
      throw AppError.authorization("Only the business owner can manage the team.");
    }
    return actor;
  }

  private async resolveRoleId(roleSlug: string): Promise<string> {
    const roles = await this.repos.team.listRoles();
    const role = roles.find((r) => r.slug === roleSlug);
    if (!role) throw AppError.validation("Select a valid role.");
    if (role.slug === "owner") {
      throw AppError.validation("The Owner role cannot be assigned. Transfer ownership instead.");
    }
    return role.id;
  }

  async invite(
    actorId: string,
    businessId: string,
    input: InviteMemberValues
  ): Promise<TeamInvitation> {
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    await this.requireOwner(businessId, actorId);

    const { members, invitations } = await this.getSnapshot(businessId);
    const alreadyMember = members.some(
      (member) => member.email.toLowerCase() === data.email
    );
    if (alreadyMember) {
      throw AppError.conflict("That email already belongs to a team member.");
    }
    const alreadyInvited = invitations.some(
      (invite) => invite.email.toLowerCase() === data.email
    );
    if (alreadyInvited) {
      throw AppError.conflict("An invitation is already pending for that email.");
    }

    await this.resolveRoleId(data.roleSlug);
    const invitation = await this.repos.team.createInvitation(businessId, actorId, {
      email: data.email,
      fullName: (data.fullName ?? "").trim(),
      roleSlug: data.roleSlug,
    });

    await this.audits.log({
      businessId,
      userId: actorId,
      action: "team.member.invited",
      entityType: "team_invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.roleSlug },
    });
    return invitation;
  }

  async cancelInvitation(
    actorId: string,
    businessId: string,
    invitationId: string
  ): Promise<void> {
    await this.requireOwner(businessId, actorId);
    const invitations = await this.repos.team.listInvitations(businessId);
    const invitation = invitations.find((invite) => invite.id === invitationId);
    if (!invitation) throw AppError.notFound("That invitation no longer exists.");

    await this.repos.team.cancelInvitation(businessId, invitationId);
    await this.audits.log({
      businessId,
      userId: actorId,
      action: "team.invitation.cancelled",
      entityType: "team_invitation",
      entityId: invitationId,
      metadata: { email: invitation.email },
    });
  }

  async changeRole(
    actorId: string,
    businessId: string,
    userId: string,
    roleSlug: string
  ): Promise<void> {
    await this.requireOwner(businessId, actorId);
    if (roleSlug === "owner") {
      throw AppError.validation("The Owner role cannot be assigned.");
    }
    const roleId = await this.resolveRoleId(roleSlug);

    const members = await this.repos.team.listMembers(businessId);
    const member = members.find((m) => m.userId === userId);
    if (!member) throw AppError.notFound("That member no longer exists.");
    if (member.isOwner) {
      throw AppError.validation("The owner's role cannot be changed.");
    }

    await this.repos.team.updateMemberRole(businessId, userId, roleId);
    await this.audits.log({
      businessId,
      userId: actorId,
      action: "team.member.role_changed",
      entityType: "business_member",
      entityId: userId,
      metadata: { role: roleSlug, previousRole: member.roleSlug },
    });
  }

  async removeMember(actorId: string, businessId: string, userId: string): Promise<void> {
    await this.requireOwner(businessId, actorId);
    if (actorId === userId) {
      throw AppError.validation("You cannot remove yourself from the business.");
    }

    const members = await this.repos.team.listMembers(businessId);
    const member = members.find((m) => m.userId === userId);
    if (!member) throw AppError.notFound("That member no longer exists.");
    if (member.isOwner) {
      throw AppError.validation("The business owner cannot be removed.");
    }

    await this.repos.team.removeMember(businessId, userId);
    await this.audits.log({
      businessId,
      userId: actorId,
      action: "team.member.removed",
      entityType: "business_member",
      entityId: userId,
      metadata: { email: member.email },
    });
  }
}
