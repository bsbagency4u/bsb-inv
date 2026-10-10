import type {
  Permission,
  Role,
  RolePermissionMap,
  TeamInvitation,
  TeamMember,
} from "@/types/domain";
import type { InvitationInput, TeamRepository } from "../team.repository";
import {
  DEMO_PERMISSIONS,
  DEMO_ROLE_PERMISSIONS,
  DEMO_ROLES,
  DEMO_USER,
  readStorage,
  writeStorage,
} from "./local-data";

const MEMBERS_KEY = "demo-team-members";
const INVITATIONS_KEY = "demo-team-invitations";

interface StoredMember {
  businessId: string;
  userId: string;
  email: string;
  fullName: string;
  roleSlug: string | null;
  isOwner: boolean;
  createdAt: string;
}

interface StoredInvitation {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  roleSlug: string;
  invitedBy: string;
  status: string;
  createdAt: string;
}

const SEED_MEMBERS: StoredMember[] = [
  {
    businessId: "demo-business",
    userId: "demo-user",
    email: "demo@bsb-stockflow.local",
    fullName: "Demo User",
    roleSlug: "owner",
    isOwner: true,
    createdAt: new Date().toISOString(),
  },
  {
    businessId: "demo-business",
    userId: "demo-member-priya",
    email: "priya@example.com",
    fullName: "Priya Sharma",
    roleSlug: "manager",
    isOwner: false,
    createdAt: new Date().toISOString(),
  },
  {
    businessId: "demo-business",
    userId: "demo-member-arun",
    email: "arun@example.com",
    fullName: "Arun Verma",
    roleSlug: "staff",
    isOwner: false,
    createdAt: new Date().toISOString(),
  },
  {
    businessId: "demo-business",
    userId: "demo-member-meera",
    email: "meera@example.com",
    fullName: "Meera Iyer",
    roleSlug: "accountant",
    isOwner: false,
    createdAt: new Date().toISOString(),
  },
];

const SEED_INVITATIONS: StoredInvitation[] = [
  {
    id: "demo-invite-rahul",
    businessId: "demo-business",
    email: "rahul@example.com",
    fullName: "Rahul Nair",
    roleSlug: "manager",
    invitedBy: "demo-user",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
];

export class LocalTeamRepository implements TeamRepository {
  private readMembers(): StoredMember[] {
    return readStorage<StoredMember[]>(MEMBERS_KEY, SEED_MEMBERS);
  }

  private saveMembers(members: StoredMember[]): void {
    writeStorage(MEMBERS_KEY, members);
  }

  private readInvitations(): StoredInvitation[] {
    return readStorage<StoredInvitation[]>(INVITATIONS_KEY, SEED_INVITATIONS);
  }

  private saveInvitations(invitations: StoredInvitation[]): void {
    writeStorage(INVITATIONS_KEY, invitations);
  }

  private toTeamMember(member: StoredMember, roles: Role[]): TeamMember {
    const role = roles.find((r) => r.slug === member.roleSlug) ?? null;
    return {
      businessId: member.businessId,
      userId: member.userId,
      email: member.email,
      fullName: member.fullName || member.email,
      roleId: role?.id ?? null,
      roleSlug: role?.slug ?? null,
      roleName: role?.name ?? null,
      isOwner: member.isOwner,
      status: "active",
      createdAt: member.createdAt,
    };
  }

  async listMembers(businessId: string): Promise<TeamMember[]> {
    const roles = await this.listRoles();
    const members = this.readMembers().filter(
      (member) => member.businessId === businessId
    );
    if (members.length === 0) {
      return [
        this.toTeamMember(
          {
            businessId,
            userId: DEMO_USER.id,
            email: DEMO_USER.email,
            fullName: DEMO_USER.fullName,
            roleSlug: "owner",
            isOwner: true,
            createdAt: new Date().toISOString(),
          },
          roles
        ),
      ];
    }
    return members.map((member) => this.toTeamMember(member, roles));
  }

  async getMemberPermissions(businessId: string, userId: string): Promise<string[]> {
    const members = this.readMembers().filter(
      (entry) => entry.businessId === businessId
    );
    // Demo bootstrap: a business with no stored members is owned by the demo user
    // (mirrors the synthetic owner returned by listMembers).
    if (members.length === 0) return userId === DEMO_USER.id ? ["*"] : [];
    const member = members.find((entry) => entry.userId === userId);
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
  }

  async listRoles(): Promise<Role[]> {
    return DEMO_ROLES;
  }

  async listPermissions(): Promise<Permission[]> {
    return DEMO_PERMISSIONS;
  }

  async listRolePermissions(): Promise<RolePermissionMap[]> {
    return DEMO_ROLE_PERMISSIONS;
  }

  async listInvitations(businessId: string): Promise<TeamInvitation[]> {
    return this.readInvitations()
      .filter((invite) => invite.businessId === businessId && invite.status === "pending")
      .map((invite) => ({
        id: invite.id,
        businessId: invite.businessId,
        email: invite.email,
        fullName: invite.fullName,
        roleSlug: invite.roleSlug,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
      }));
  }

  async createInvitation(
    businessId: string,
    invitedBy: string,
    input: InvitationInput
  ): Promise<TeamInvitation> {
    const invite: StoredInvitation = {
      id: `inv-${crypto.randomUUID()}`,
      businessId,
      email: input.email,
      fullName: input.fullName,
      roleSlug: input.roleSlug,
      invitedBy,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const invites = this.readInvitations();
    invites.unshift(invite);
    this.saveInvitations(invites);
    return {
      id: invite.id,
      businessId: invite.businessId,
      email: invite.email,
      fullName: invite.fullName,
      roleSlug: invite.roleSlug,
      invitedBy: invite.invitedBy,
      createdAt: invite.createdAt,
    };
  }

  async cancelInvitation(businessId: string, invitationId: string): Promise<void> {
    this.saveInvitations(
      this.readInvitations().map((invite) =>
        invite.businessId === businessId && invite.id === invitationId
          ? { ...invite, status: "cancelled" }
          : invite
      )
    );
  }

  async updateMemberRole(
    businessId: string,
    userId: string,
    roleId: string | null
  ): Promise<void> {
    const roleSlug = roleId ? DEMO_ROLES.find((role) => role.id === roleId)?.slug ?? null : null;
    this.saveMembers(
      this.readMembers().map((member) =>
        member.businessId === businessId && member.userId === userId
          ? { ...member, roleSlug }
          : member
      )
    );
  }

  async removeMember(businessId: string, userId: string): Promise<void> {
    this.saveMembers(
      this.readMembers().filter(
        (member) => !(member.businessId === businessId && member.userId === userId)
      )
    );
  }
}
