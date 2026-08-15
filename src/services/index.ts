import { getClientRepositories } from "@/repositories/client";
import type { Repositories } from "@/repositories/types";
import { AuthService } from "./auth.service";
import { AuditService } from "./audit.service";
import { BusinessService } from "./business.service";
import { ProfileService } from "./profile.service";
import { DashboardService } from "./dashboard.service";
import { SearchService } from "./search.service";
import { ProductService } from "./product.service";
import { PartyService } from "./party.service";
import { TransactionService } from "./transaction.service";
import { ReportService } from "./report.service";
import { NotificationService } from "./notification.service";
import { GstEngine } from "./gst.service";

export interface Services {
  repos: Repositories;
  auth: AuthService;
  audits: AuditService;
  businesses: BusinessService;
  profiles: ProfileService;
  dashboard: DashboardService;
  search: SearchService;
  products: ProductService;
  parties: PartyService;
  transactions: TransactionService;
  reports: ReportService;
  notifications: NotificationService;
  gst: GstEngine;
}

function buildServices(repos: Repositories): Services {
  const audits = new AuditService(repos);
  const businesses = new BusinessService(repos, audits);
  const profiles = new ProfileService(repos, audits);
  const notifications = new NotificationService(repos);
  const products = new ProductService(repos, audits, notifications);
  const parties = new PartyService(repos, audits);
  const transactions = new TransactionService(repos, audits, notifications);
  return {
    repos,
    auth: new AuthService(),
    audits,
    businesses,
    profiles,
    dashboard: new DashboardService(repos),
    search: new SearchService(repos),
    products,
    parties,
    transactions,
    reports: new ReportService(repos),
    notifications,
    gst: new GstEngine(),
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
