/**
 * Demo / offline data layer.
 *
 * When Supabase is not configured the app runs in clearly-marked demo mode so
 * the Phase 1 shell, forms and states can be exercised. This also demonstrates
 * the repository abstraction that Phase 5 offline sync will build on.
 */
import type {
  BusinessProfile,
  Permission,
  Role,
  RolePermissionMap,
  SessionUser,
} from "@/types/domain";

const PREFIX = "bsb-stockflow:";
const DEMO_USER_ID = "demo-user";
const DEMO_BUSINESS_ID = "demo-business";

export function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota). Demo mode keeps working in-memory.
  }
}

export function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

export function getDemoUserId(): string {
  return DEMO_USER_ID;
}

export function getDemoBusinessId(): string {
  return DEMO_BUSINESS_ID;
}

export const DEMO_USER: SessionUser = {
  id: DEMO_USER_ID,
  email: "demo@bsb-stockflow.local",
  fullName: "Demo User",
  username: "demouser",
  role: "owner",
  isOwner: true,
  isDemo: true,
};

export const DEMO_BUSINESS: BusinessProfile = {
  id: DEMO_BUSINESS_ID,
  name: "Demo Retail Store",
  legalName: "Demo Retail Store LLP",
  type: "retail",
  logoUrl: null,
  address: "42 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  pincode: "560001",
  phone: "+91 98765 43210",
  email: "store@bsb-stockflow.local",
  website: "https://example.com",
  gstin: "27AAPFU0939F1ZV",
  pan: "ABCDE1234F",
  currency: "INR",
  financialYear: "01-04",
  invoicePrefix: "INV",
  invoiceStartNumber: 1001,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Demo mirror of `supabase/seed/0001_roles_permissions.sql` so demo mode can
 * exercise the Users & Roles screen without a database.
 */
export const DEMO_ROLES: Role[] = [
  { id: "role-owner", name: "Owner", slug: "owner", description: "Full access to the business.", isSystem: true },
  { id: "role-manager", name: "Manager", slug: "manager", description: "Manages day-to-day operations.", isSystem: true },
  { id: "role-staff", name: "Staff", slug: "staff", description: "Limited operational access.", isSystem: true },
  { id: "role-accountant", name: "Accountant", slug: "accountant", description: "Financial and reporting access.", isSystem: true },
];

export const DEMO_PERMISSIONS: Permission[] = [
  { id: "perm-business-view", slug: "business.view", name: "View business", description: "View business profile and settings." },
  { id: "perm-business-update", slug: "business.update", name: "Update business", description: "Update business profile and settings." },
  { id: "perm-dashboard-view", slug: "dashboard.view", name: "View dashboard", description: "View the dashboard." },
  { id: "perm-product-view", slug: "product.view", name: "View products", description: "View product catalogue." },
  { id: "perm-product-manage", slug: "product.manage", name: "Manage products", description: "Create and update products." },
  { id: "perm-inventory-view", slug: "inventory.view", name: "View inventory", description: "View stock and inventory." },
  { id: "perm-inventory-manage", slug: "inventory.manage", name: "Manage inventory", description: "Adjust stock and inventory." },
  { id: "perm-sales-view", slug: "sales.view", name: "View sales", description: "View sales and invoices." },
  { id: "perm-sales-manage", slug: "sales.manage", name: "Manage sales", description: "Create and update sales." },
  { id: "perm-purchase-view", slug: "purchase.view", name: "View purchases", description: "View purchase documents." },
  { id: "perm-purchase-manage", slug: "purchase.manage", name: "Manage purchases", description: "Create and update purchases." },
  { id: "perm-customer-view", slug: "customer.view", name: "View customers", description: "View customer records." },
  { id: "perm-customer-manage", slug: "customer.manage", name: "Manage customers", description: "Create and update customers." },
  { id: "perm-supplier-view", slug: "supplier.view", name: "View suppliers", description: "View supplier records." },
  { id: "perm-supplier-manage", slug: "supplier.manage", name: "Manage suppliers", description: "Create and update suppliers." },
  { id: "perm-report-view", slug: "report.view", name: "View reports", description: "View reports." },
  { id: "perm-settings-view", slug: "settings.view", name: "View settings", description: "View settings." },
  { id: "perm-settings-manage", slug: "settings.manage", name: "Manage settings", description: "Modify settings." },
  { id: "perm-users-manage", slug: "users.manage", name: "Manage users", description: "Invite and manage users and roles." },
  { id: "perm-audit-view", slug: "audit.view", name: "View audit logs", description: "View audit logs." },
];

const permId = (slug: string) => DEMO_PERMISSIONS.find((p) => p.slug === slug)?.id ?? "";

const MANAGER_SLUGS = [
  "business.view",
  "dashboard.view",
  "product.view",
  "product.manage",
  "inventory.view",
  "inventory.manage",
  "sales.view",
  "sales.manage",
  "purchase.view",
  "purchase.manage",
  "customer.view",
  "customer.manage",
  "supplier.view",
  "supplier.manage",
  "report.view",
  "settings.view",
];

const STAFF_SLUGS = [
  "dashboard.view",
  "product.view",
  "inventory.view",
  "sales.view",
  "sales.manage",
  "purchase.view",
  "customer.view",
  "customer.manage",
  "supplier.view",
];

const ACCOUNTANT_SLUGS = [
  "dashboard.view",
  "sales.view",
  "purchase.view",
  "report.view",
  "settings.view",
  "audit.view",
];

export const DEMO_ROLE_PERMISSIONS: RolePermissionMap[] = [
  ...DEMO_PERMISSIONS.map((p) => ({ roleId: "role-owner", permissionId: p.id })),
  ...MANAGER_SLUGS.map((slug) => ({ roleId: "role-manager", permissionId: permId(slug) })),
  ...STAFF_SLUGS.map((slug) => ({ roleId: "role-staff", permissionId: permId(slug) })),
  ...ACCOUNTANT_SLUGS.map((slug) => ({ roleId: "role-accountant", permissionId: permId(slug) })),
].filter((entry) => entry.permissionId !== "");
