import type { BusinessRepository } from "./business.repository";
import type { ProfileRepository } from "./profile.repository";
import type { AuditRepository } from "./audit.repository";
import type { ProductRepository } from "./product.repository";
import type { InventoryRepository } from "./inventory.repository";
import type { PartyRepository } from "./party.repository";
import type { TransactionRepository } from "./transaction.repository";
import type { NotificationRepository } from "./notification.repository";

export interface Repositories {
  businesses: BusinessRepository;
  profiles: ProfileRepository;
  audits: AuditRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  parties: PartyRepository;
  transactions: TransactionRepository;
  notifications: NotificationRepository;
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
} from "./transaction.repository";
