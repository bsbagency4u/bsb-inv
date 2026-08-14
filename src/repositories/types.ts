import type { BusinessRepository } from "./business.repository";
import type { ProfileRepository } from "./profile.repository";
import type { AuditRepository } from "./audit.repository";

export interface Repositories {
  businesses: BusinessRepository;
  profiles: ProfileRepository;
  audits: AuditRepository;
}

export type { BusinessRepository, ProfileRepository, AuditRepository };
export type { BusinessProfile } from "@/types/domain";
export type { AuditLogInput } from "./audit.repository";
