import type { Repositories } from "@/repositories/types";
import { AppError } from "@/lib/errors";

/** Wildcard permission granted to business owners. */
const OWNER_WILDCARD = "*";

/**
 * Service-layer authorization. RLS already gates raw table access and is the
 * last line of defence; this layer enforces role permissions on business
 * operations so a signed-in staff member cannot, for example, cancel an
 * invoice or change settings through the UI.
 *
 * Owners always pass (their stored membership is flagged `is_owner`), which
 * keeps the single-user / demo experience frictionless.
 */
export class AuthorizationService {
  constructor(private repos: Repositories) {}

  /** Permission slugs granted to a member. `["*"]` means full access. */
  async getPermissions(businessId: string, userId: string): Promise<string[]> {
    return this.repos.team.getMemberPermissions(businessId, userId);
  }

  async can(businessId: string, userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(businessId, userId);
    return permissions.includes(OWNER_WILDCARD) || permissions.includes(permission);
  }

  /**
   * Throws a 403 AppError unless the member holds the permission (or owns the
   * business). Call this at the top of every privileged mutation.
   */
  async requirePermission(
    businessId: string,
    userId: string,
    permission: string
  ): Promise<void> {
    if (!(await this.can(businessId, userId, permission))) {
      throw AppError.authorization(
        `You do not have permission to do this (requires "${permission}").`
      );
    }
  }
}
