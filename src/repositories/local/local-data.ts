/**
 * Demo / offline data layer.
 *
 * When Supabase is not configured the app runs in clearly-marked demo mode so
 * the Phase 1 shell, forms and states can be exercised. This also demonstrates
 * the repository abstraction that Phase 5 offline sync will build on.
 */
import type { BusinessProfile, SessionUser } from "@/types/domain";

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
