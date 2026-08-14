/**
 * Supabase database type definitions, matching `supabase/migrations/`.
 * Keep in sync with the migrations when the schema changes.
 */

export type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export type Permission = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type RolePermission = {
  role_id: string;
  permission_id: string;
}

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Business = {
  id: string;
  name: string;
  legal_name: string | null;
  type: string;
  logo_url: string | null;
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
  financial_year: string;
  invoice_prefix: string;
  invoice_start_number: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessMember = {
  business_id: string;
  user_id: string;
  role_id: string | null;
  is_owner: boolean;
  created_at: string;
}

export type BusinessSetting = {
  business_id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLog = {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: Role;
        Insert: Partial<Role> & { name: string; slug: string };
        Update: Partial<Role>;
        Relationships: [];
      };
      permissions: {
        Row: Permission;
        Insert: Partial<Permission> & { slug: string; name: string };
        Update: Partial<Permission>;
        Relationships: [];
      };
      role_permissions: {
        Row: RolePermission;
        Insert: RolePermission;
        Update: Partial<RolePermission>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      businesses: {
        Row: Business;
        Insert: Partial<Business> & { name: string };
        Update: Partial<Business>;
        Relationships: [];
      };
      business_members: {
        Row: BusinessMember;
        Insert: Partial<BusinessMember> & { business_id: string; user_id: string };
        Update: Partial<BusinessMember>;
        Relationships: [];
      };
      business_settings: {
        Row: BusinessSetting;
        Insert: Partial<BusinessSetting> & { business_id: string; key: string };
        Update: Partial<BusinessSetting>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
