import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessProfile } from "@/types/domain";
import { mapBusiness } from "./mappers";

export interface BusinessRepository {
  listForUser(userId: string): Promise<BusinessProfile[]>;
  getById(businessId: string): Promise<BusinessProfile | null>;
  getByUserAndId(userId: string, businessId: string): Promise<BusinessProfile | null>;
  create(userId: string, input: Partial<BusinessProfile> & { name: string }): Promise<BusinessProfile>;
  update(userId: string, businessId: string, input: Partial<BusinessProfile>): Promise<BusinessProfile>;
}

export class SupabaseBusinessRepository implements BusinessRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listForUser(userId: string): Promise<BusinessProfile[]> {
    const { data, error } = await this.client
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId);

    if (error) throw error;

    const ids = data?.map((row) => row.business_id) ?? [];
    if (ids.length === 0) return [];

    const { data: businesses, error: businessError } = await this.client
      .from("businesses")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: true });

    if (businessError) throw businessError;
    return (businesses ?? []).map(mapBusiness);
  }

  async getById(businessId: string): Promise<BusinessProfile | null> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapBusiness(data) : null;
  }

  async getByUserAndId(
    userId: string,
    businessId: string
  ): Promise<BusinessProfile | null> {
    const { data: member, error: memberError } = await this.client
      .from("business_members")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return null;

    return this.getById(businessId);
  }

  async create(
    userId: string,
    input: Partial<BusinessProfile> & { name: string }
  ): Promise<BusinessProfile> {
    const { data, error } = await this.client
      .from("businesses")
      .insert({
        name: input.name,
        legal_name: input.legalName,
        type: input.type ?? "retail",
        logo_url: input.logoUrl,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country ?? "India",
        pincode: input.pincode,
        phone: input.phone,
        email: input.email,
        website: input.website,
        gstin: input.gstin,
        pan: input.pan,
        currency: input.currency ?? "INR",
        financial_year: input.financialYear ?? "01-04",
        invoice_prefix: input.invoicePrefix ?? "INV",
        invoice_start_number: input.invoiceStartNumber ?? 1001,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return mapBusiness(data);
  }

  async update(
    userId: string,
    businessId: string,
    input: Partial<BusinessProfile>
  ): Promise<BusinessProfile> {
    const { data, error } = await this.client
      .from("businesses")
      .update({
        name: input.name,
        legal_name: input.legalName,
        type: input.type,
        logo_url: input.logoUrl,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        pincode: input.pincode,
        phone: input.phone,
        email: input.email,
        website: input.website,
        gstin: input.gstin,
        pan: input.pan,
        currency: input.currency,
        financial_year: input.financialYear,
        invoice_prefix: input.invoicePrefix,
        invoice_start_number: input.invoiceStartNumber,
      })
      .eq("id", businessId)
      .eq("created_by", userId)
      .select()
      .single();

    if (error) throw error;
    return mapBusiness(data);
  }
}
