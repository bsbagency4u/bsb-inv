import type { Repositories } from "@/repositories/types";
import { AppError } from "@/lib/errors";
import { userProfileSchema, type UserProfileValues } from "@/lib/validation/schemas";
import type { SessionUser } from "@/types/domain";
import type { AuditService } from "./audit.service";

export class ProfileService {
  constructor(
    private repos: Repositories,
    private audits: AuditService
  ) {}

  async getProfile(userId: string): Promise<SessionUser | null> {
    return this.repos.profiles.getByUserId(userId);
  }

  async updateProfile(
    userId: string,
    input: UserProfileValues
  ): Promise<SessionUser> {
    const parsed = userProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    if (!(await this.repos.profiles.isUsernameAvailable(data.username, userId))) {
      throw AppError.conflict("That username is already taken.");
    }
    const profile = await this.repos.profiles.update(userId, {
      fullName: data.fullName,
      username: data.username,
      phone: data.phone || null,
      avatarUrl: data.avatarUrl || null,
    });

    await this.audits.log({
      businessId: null,
      userId,
      action: "profile.updated",
      entityType: "profile",
      entityId: userId,
    });
    return profile;
  }
}
