"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import type { TeamMember } from "@/types/domain";

const ASSIGNABLE_ROLES = ["manager", "staff", "accountant"];

export default function UsersSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [tab, setTab] = React.useState("members");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [roleSlug, setRoleSlug] = React.useState("staff");

  const teamQuery = useQuery({
    queryKey: ["team", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().team.getSnapshot(business.id);
    },
    enabled: Boolean(business),
  });

  const rolesQuery = useQuery({
    queryKey: ["team-roles"],
    queryFn: async () => getClientServices().team.getRolesSnapshot(),
  });

  if (teamQuery.isLoading || rolesQuery.isLoading) {
    return <LoadingState label="Loading team…" />;
  }
  if (teamQuery.isError) {
    return (
      <ErrorState
        error={normalizeError(teamQuery.error).userMessage}
        onRetry={() => teamQuery.refetch()}
        title="Could not load team"
      />
    );
  }
  if (rolesQuery.isError) {
    return (
      <ErrorState
        error={normalizeError(rolesQuery.error).userMessage}
        onRetry={() => rolesQuery.refetch()}
        title="Could not load roles"
      />
    );
  }

  const { members, invitations } = teamQuery.data ?? { members: [], invitations: [] };
  const { roles, permissions, rolePermissions } = rolesQuery.data ?? {
    roles: [],
    permissions: [],
    rolePermissions: [],
  };
  const assignableRoles = roles.filter((role) => ASSIGNABLE_ROLES.includes(role.slug));

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["team"] });
  };

  const openInvite = () => {
    setEmail("");
    setFullName("");
    setRoleSlug(assignableRoles[0]?.slug ?? "staff");
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    if (!business || !user) return;
    setBusy(true);
    try {
      await getClientServices().team.invite(user.id, business.id, {
        email,
        fullName,
        roleSlug,
      });
      toastSuccess("Invitation created", `An invite was recorded for ${email.trim()}.`);
      setInviteOpen(false);
      await invalidate();
    } catch (err) {
      toastError("Could not invite member", normalizeError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (member: TeamMember, nextRoleSlug: string) => {
    if (!business || !user) return;
    try {
      await getClientServices().team.changeRole(user.id, business.id, member.userId, nextRoleSlug);
      toastSuccess("Role updated", `${member.fullName} is now ${nextRoleSlug}.`);
      await invalidate();
    } catch (err) {
      toastError("Could not update role", normalizeError(err).userMessage);
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!business || !user) return;
    try {
      await getClientServices().team.removeMember(user.id, business.id, member.userId);
      toastSuccess("Member removed", `${member.fullName} was removed from the team.`);
      await invalidate();
    } catch (err) {
      toastError("Could not remove member", normalizeError(err).userMessage);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!business || !user) return;
    try {
      await getClientServices().team.cancelInvitation(user.id, business.id, invitationId);
      toastSuccess("Invitation cancelled", "The pending invitation was withdrawn.");
      await invalidate();
    } catch (err) {
      toastError("Could not cancel invitation", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Invite team members, assign roles and review permissions."
        actions={
          <Button onClick={openInvite}>
            <UserPlus className="size-4" />
            Invite member
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: "members", label: "Members", icon: <Users className="size-4" /> },
            { value: "roles", label: "Roles & permissions", icon: <ShieldCheck className="size-4" /> },
          ]}
        />

        {tab === "members" ? (
          members.length === 0 && invitations.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No team members yet"
              description="Invite a manager, staff member or accountant to collaborate."
              action={{ label: "Invite member", onClick: openInvite }}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="font-medium text-foreground">{member.fullName}</div>
                        <div className="text-xs text-muted-foreground">{member.email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {member.isOwner ? (
                          <Badge variant="info">Owner</Badge>
                        ) : (
                          <Select
                            aria-label={`Role for ${member.fullName}`}
                            value={member.roleSlug ?? ""}
                            onChange={(event) => void changeRole(member, event.target.value)}
                          >
                            {member.roleSlug && !ASSIGNABLE_ROLES.includes(member.roleSlug) ? (
                              <option value={member.roleSlug}>{member.roleSlug}</option>
                            ) : null}
                            {assignableRoles.map((role) => (
                              <option key={role.id} value={role.slug}>
                                {role.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {member.isOwner ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void removeMember(member)}
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {invitation.fullName || invitation.email}
                        </div>
                        <div className="text-xs text-muted-foreground">{invitation.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize text-muted-foreground">
                          {invitation.roleSlug}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">Pending</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void cancelInvitation(invitation.id)}
                        >
                          <X className="size-3.5" />
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {roles.map((role) => {
              const granted = new Set(
                rolePermissions
                  .filter((rp) => rp.roleId === role.id)
                  .map((rp) => rp.permissionId)
              );
              const rolePermissionsList = permissions.filter((permission) =>
                granted.has(permission.id)
              );
              return (
                <Card key={role.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {role.name}
                      {role.isSystem ? <Badge variant="secondary">System</Badge> : null}
                    </CardTitle>
                    <CardDescription>{role.description ?? "Custom role."}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5">
                    {rolePermissionsList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No permissions granted.</p>
                    ) : (
                      rolePermissionsList.map((permission) => (
                        <Badge key={permission.id} variant="outline">
                          {permission.name}
                        </Badge>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite team member"
        description="The invitation is recorded against this business. The member gains access when they join."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void sendInvite()} loading={busy}>
              <Mail className="size-4" />
              Send invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email" htmlFor="invite-email" required>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              autoFocus
            />
          </Field>
          <Field label="Full name" htmlFor="invite-name" hint="Optional. Shown in the member list.">
            <Input
              id="invite-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Priya Sharma"
            />
          </Field>
          <Field label="Role" htmlFor="invite-role" required>
            <Select
              id="invite-role"
              value={roleSlug}
              onChange={(event) => setRoleSlug(event.target.value)}
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.slug}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
