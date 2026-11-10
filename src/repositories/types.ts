import type { BusinessRepository } from "./business.repository";
import type { ProfileRepository } from "./profile.repository";
import type { AuditRepository } from "./audit.repository";
import type { ProductRepository } from "./product.repository";
import type { InventoryRepository } from "./inventory.repository";
import type { PartyRepository } from "./party.repository";
import type { TransactionRepository } from "./transaction.repository";
import type { NotificationRepository } from "./notification.repository";
import type { TeamRepository } from "./team.repository";
import type { ComplianceRepository } from "./compliance.repository";

export interface Repositories {
  businesses: BusinessRepository;
  profiles: ProfileRepository;
  audits: AuditRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  parties: PartyRepository;
  transactions: TransactionRepository;
  notifications: NotificationRepository;
  team: TeamRepository;
  /** Optional so product/inventory/transaction test stubs stay valid. */
  compliance?: ComplianceRepository;
}

export type {
  BusinessRepository,
  ProfileRepository,
  AuditRepository,
  ProductRepository,
  InventoryRepository,
  PartyRepository,
  TransactionRepository,
  NotificationRepository,
  TeamRepository,
  ComplianceRepository,
};
export type { BusinessProfile } from "@/types/domain";
export type { AuditLogInput } from "./audit.repository";
export type {
  ProductCreateInput,
  ProductUpdateInput,
  StockMovementInput,
} from "./product.repository";
export type {
  SalesHeaderInput,
  PurchaseOrderHeaderInput,
  PurchaseInvoiceHeaderInput,
  PaymentInput,
  LineItemInput,
  QuotationHeaderInput,
  QuotationLineInput,
} from "./transaction.repository";
export type { InvitationInput } from "./team.repository";
