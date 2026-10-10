import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  Permission,
  Role,
  RolePermissionMap,
  TeamInvitation,
  TeamMember,
} from "@/types/domain";
import { mapInvitation, mapPermission, mapRole } from "./mappers";

export interface InvitationInput {
  email: string;
  fullName: string;
  roleSlug: string;
}

export interface TeamRepository {
  listMembers(businessId: string): Promise<TeamMember[]>;
  getMemberPermissions(businessId: string, userId: string): Promise<string[]>;
  listRoles(): Promise<Role[]>;
  listPermissions(): Promise<Permission[]>;
  listRolePermissions(): Promise<RolePermissionMap[]>;
  listInvitations(businessId: string): Promise<TeamInvitation[]>;
  createInvitation(
    businessId: string,
    invitedBy: string,
    input: InvitationInput
  ): Promise<TeamInvitation>;
  cancelInvitation(businessId: string, invitationId: string): Promise<void>;
  updateMemberRole(businessId: string, userId: string, roleId: string | null): Promise<void>;
  removeMember(businessId: string, userId: string): Promise<void>;
}

export class SupabaseTeamRepository implements TeamRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listMembers(businessId: string): Promise<TeamMember[]> {
    const { data: members, error } = await this.client
      .from("business_members")
      .select("business_id, user_id, role_id, is_owner, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = members ?? [];
    if (rows.length === 0) return [];

    const userIds = rows.map((row) => row.user_id);
    const [{ data: profiles, error: profileError }, roles] = await Promise.all([
      this.client.from("profiles").select("id, full_name, email").in("id", userIds),
      this.listRoles(),
    ]);
    if (profileError) throw profileError;

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleMap = new Map(roles.map((role) => [role.id, role]));

    return rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      const role = row.role_id ? roleMap.get(row.role_id) ?? null : null;
      return {
        businessId: row.business_id,
        userId: row.user_id,
        email: profile?.email ?? "",
        fullName: profile?.full_name?.trim() || profile?.email || "Member",
        roleId: row.role_id,
        roleSlug: role?.slug ?? (row.is_owner ? "owner" : null),
        roleName: role?.name ?? (row.is_owner ? "Owner" : null),
        isOwner: row.is_owner,
        status: "active" as const,
        createdAt: row.created_at,
      };
    });
  }

  async getMemberPermissions(businessId: string, userId: string): Promise<string[]> {
    const { data: member, error } = await this.client
      .from("business_members")
      .select("role_id, is_owner")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!member) return [];
    if (member.is_owner) return ["*"];
    if (!member.role_id) return [];

    const { data: links, error: linkError } = await this.client
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", member.role_id);
    if (linkError) throw linkError;

    const permissionIds = (links ?? []).map((row) => row.permission_id);
    if (permissionIds.length === 0) return [];

    const { data: permissions, error: permissionError } = await this.client
      .from("permissions")
      .select("slug")
      .in("id", permissionIds);
    if (permissionError) throw permissionError;
    return (permissions ?? []).map((row) => row.slug);
  }

  async listRoles(): Promise<Role[]> {
    const { data, error } = await this.client
      .from("roles")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRole);
  }

  async listPermissions(): Promise<Permission[]> {
    const { data, error } = await this.client
      .from("permissions")
      .select("*")
      .order("slug", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapPermission);
  }

  async listRolePermissions(): Promise<RolePermissionMap[]> {
    const { data, error } = await this.client
      .from("role_permissions")
      .select("role_id, permission_id");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      roleId: row.role_id,
      permissionId: row.permission_id,
    }));
  }

  async listInvitations(businessId: string): Promise<TeamInvitation[]> {
    const { data, error } = await this.client
      .from("business_invitations")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInvitation);
  }

  async createInvitation(
    businessId: string,
    invitedBy: string,
    input: InvitationInput
  ): Promise<TeamInvitation> {
    const { data, error } = await this.client
      .from("business_invitations")
      .insert({
        business_id: businessId,
        email: input.email,
        full_name: input.fullName,
        role_slug: input.roleSlug,
        invited_by: invitedBy,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return mapInvitation(data);
  }

  async cancelInvitation(businessId: string, invitationId: string): Promise<void> {
    const { error } = await this.client
      .from("business_invitations")
      .update({ status: "cancelled" })
      .eq("business_id", businessId)
      .eq("id", invitationId);
    if (error) throw error;
  }

  async updateMemberRole(
    businessId: string,
    userId: string,
    roleId: string | null
  ): Promise<void> {
    const { error } = await this.client
      .from("business_members")
      .update({ role_id: roleId })
      .eq("business_id", businessId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  async removeMember(businessId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("business_members")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}
