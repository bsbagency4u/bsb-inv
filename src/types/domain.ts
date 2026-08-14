/**
 * Domain models. UI components consume these — never raw Supabase rows.
 */

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  /** Role slug within the active business. */
  role: string | null;
  /** True when the user owns the active business. */
  isOwner: boolean;
  /** True when running in demo mode (no Supabase configured). */
  isDemo: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  legalName: string | null;
  type: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  currency: string;
  financialYear: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMembership {
  businessId: string;
  userId: string;
  roleSlug: string | null;
  isOwner: boolean;
}

export interface SessionState {
  /** null while the session is still loading. */
  user: SessionUser | null;
  /** Active business, may be null before onboarding completes. */
  business: BusinessProfile | null;
  /** All businesses the user belongs to (for future switcher). */
  businesses: BusinessProfile[];
  status: "loading" | "authenticated" | "unauthenticated";
  isDemo: boolean;
  error: string | null;
}

export interface AuditEvent {
  id: string;
  businessId: string | null;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SearchEntityType = "product" | "customer" | "supplier" | "invoice" | "purchase" | "stock";

export interface SearchResult {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  href?: string;
}

export interface DashboardStats {
  /** Marked as demo/placeholder data so it is never mistaken for real. */
  isDemo: boolean;
  todaySales: number;
  todayPurchase: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  outstanding: number;
  currency: string;
  updatedAt: string;
}
