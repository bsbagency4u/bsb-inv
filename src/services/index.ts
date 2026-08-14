import { getClientRepositories } from "@/repositories/client";
import type { Repositories } from "@/repositories/types";
import { AuthService } from "./auth.service";
import { AuditService } from "./audit.service";
import { BusinessService } from "./business.service";
import { ProfileService } from "./profile.service";
import { DashboardService } from "./dashboard.service";
import { SearchService } from "./search.service";

export interface Services {
  repos: Repositories;
  auth: AuthService;
  audits: AuditService;
  businesses: BusinessService;
  profiles: ProfileService;
  dashboard: DashboardService;
  search: SearchService;
}

function buildServices(repos: Repositories): Services {
  const audits = new AuditService(repos);
  const businesses = new BusinessService(repos, audits);
  const profiles = new ProfileService(repos, audits);
  return {
    repos,
    auth: new AuthService(),
    audits,
    businesses,
    profiles,
    dashboard: new DashboardService(),
    search: new SearchService(),
  };
}

let clientServices: Services | null = null;

/** Client-side service container (singleton per runtime). */
export function getClientServices(): Services {
  if (!clientServices) {
    clientServices = buildServices(getClientRepositories());
  }
  return clientServices;
}

/** Build a fresh service container bound to explicit repositories (server, tests). */
export function createServices(repos: Repositories): Services {
  return buildServices(repos);
}
