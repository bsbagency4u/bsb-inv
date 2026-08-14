import type { Business, BusinessMember, Profile } from "@/lib/supabase/types";
import type {
  BusinessMembership,
  BusinessProfile,
  SessionUser,
} from "@/types/domain";

export function mapBusiness(row: Business): BusinessProfile {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    type: row.type,
    logoUrl: row.logo_url,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    phone: row.phone,
    email: row.email,
    website: row.website,
    gstin: row.gstin,
    pan: row.pan,
    currency: row.currency,
    financialYear: row.financial_year,
    invoicePrefix: row.invoice_prefix,
    invoiceStartNumber: row.invoice_start_number,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMembership(row: BusinessMember): BusinessMembership {
  return {
    businessId: row.business_id,
    userId: row.user_id,
    roleSlug: row.role_id,
    isOwner: row.is_owner,
  };
}

export function mapProfile(row: Profile): SessionUser {
  return {
    id: row.id,
    email: "",
    fullName: row.full_name ?? "User",
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: null,
    isOwner: false,
    isDemo: false,
  };
}
