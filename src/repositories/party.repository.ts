import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Customer, Supplier } from "@/types/domain";
import { isMissingColumnError, omitColumns } from "@/lib/supabase/missing-column";
import { mapCustomer, mapSupplier } from "./mappers";

export interface PartyInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  customerType?: Customer["customerType"];
  gstRegistrationType?: Customer["gstRegistrationType"];
  placeOfSupplyState?: string | null;
  creditLimit?: number | null;
  paymentTerms?: string | null;
  notes?: string | null;
  openingBalance?: number;
  isActive?: boolean;
}

export interface PartyRepository {
  listCustomers(businessId: string): Promise<Customer[]>;
  getCustomer(businessId: string, customerId: string): Promise<Customer | null>;
  createCustomer(businessId: string, userId: string, input: PartyInput): Promise<Customer>;
  updateCustomer(businessId: string, customerId: string, input: Partial<PartyInput>): Promise<Customer>;
  deleteCustomer(businessId: string, customerId: string): Promise<void>;
  listSuppliers(businessId: string): Promise<Supplier[]>;
  getSupplier(businessId: string, supplierId: string): Promise<Supplier | null>;
  createSupplier(businessId: string, userId: string, input: PartyInput): Promise<Supplier>;
  updateSupplier(businessId: string, supplierId: string, input: Partial<PartyInput>): Promise<Supplier>;
  deleteSupplier(businessId: string, supplierId: string): Promise<void>;
  listCustomersForSearch(businessId: string, query: string): Promise<Array<{ id: string; name: string; phone: string | null }>>;
  listSuppliersForSearch(businessId: string, query: string): Promise<Array<{ id: string; name: string; phone: string | null }>>;
}

export class SupabasePartyRepository implements PartyRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listCustomers(businessId: string): Promise<Customer[]> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapCustomer);
  }

  async getCustomer(businessId: string, customerId: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCustomer(data) : null;
  }

  async createCustomer(businessId: string, userId: string, input: PartyInput): Promise<Customer> {
    const payload = {
      business_id: businessId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      customer_type: input.customerType ?? "regular",
      gst_registration_type: input.gstRegistrationType ?? "unregistered",
      place_of_supply_state: input.placeOfSupplyState ?? null,
      credit_limit: input.creditLimit ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      country: input.country ?? null,
      notes: input.notes ?? null,
      opening_balance: input.openingBalance ?? 0,
      is_active: input.isActive ?? true,
      created_by: userId,
    };
    const first = await this.client.from("customers").insert(payload).select().single();
    if (!first.error) return mapCustomer(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
      .from("customers")
      .insert(omitColumns(payload, ["gst_registration_type", "place_of_supply_state"]))
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return mapCustomer(fallback.data);
  }

  async updateCustomer(businessId: string, customerId: string, input: Partial<PartyInput>): Promise<Customer> {
    const payload = {
      name: input.name,
      phone: input.phone === undefined ? undefined : input.phone,
      email: input.email === undefined ? undefined : input.email,
      gstin: input.gstin === undefined ? undefined : input.gstin,
      pan: input.pan === undefined ? undefined : input.pan,
      customer_type: input.customerType,
      gst_registration_type: input.gstRegistrationType,
      place_of_supply_state:
        input.placeOfSupplyState === undefined ? undefined : input.placeOfSupplyState,
      credit_limit: input.creditLimit === undefined ? undefined : input.creditLimit,
      address: input.address === undefined ? undefined : input.address,
      city: input.city === undefined ? undefined : input.city,
      state: input.state === undefined ? undefined : input.state,
      pincode: input.pincode === undefined ? undefined : input.pincode,
      country: input.country === undefined ? undefined : input.country,
      notes: input.notes === undefined ? undefined : input.notes,
      opening_balance: input.openingBalance,
      is_active: input.isActive,
    };
    const first = await this.client
      .from("customers")
      .update(payload)
      .eq("business_id", businessId)
      .eq("id", customerId)
      .select()
      .single();
    if (!first.error) return mapCustomer(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
      .from("customers")
      .update(omitColumns(payload, ["gst_registration_type", "place_of_supply_state"]))
      .eq("business_id", businessId)
      .eq("id", customerId)
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return mapCustomer(fallback.data);
  }

  async deleteCustomer(businessId: string, customerId: string): Promise<void> {
    const { error } = await this.client
      .from("customers")
      .delete()
      .eq("business_id", businessId)
      .eq("id", customerId);
    if (error) throw error;
  }

  async listSuppliers(businessId: string): Promise<Supplier[]> {
    const { data, error } = await this.client
      .from("suppliers")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapSupplier);
  }

  async getSupplier(businessId: string, supplierId: string): Promise<Supplier | null> {
    const { data, error } = await this.client
      .from("suppliers")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", supplierId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSupplier(data) : null;
  }

  async createSupplier(businessId: string, userId: string, input: PartyInput): Promise<Supplier> {
    const payload = {
      business_id: businessId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      gst_registration_type: input.gstRegistrationType ?? "unregistered",
      place_of_supply_state: input.placeOfSupplyState ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      country: input.country ?? null,
      payment_terms: input.paymentTerms ?? null,
      notes: input.notes ?? null,
      opening_balance: input.openingBalance ?? 0,
      is_active: input.isActive ?? true,
      created_by: userId,
    };
    const first = await this.client.from("suppliers").insert(payload).select().single();
    if (!first.error) return mapSupplier(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
      .from("suppliers")
      .insert(omitColumns(payload, ["gst_registration_type", "place_of_supply_state"]))
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return mapSupplier(fallback.data);
  }

  async updateSupplier(businessId: string, supplierId: string, input: Partial<PartyInput>): Promise<Supplier> {
    const payload = {
      name: input.name,
      phone: input.phone === undefined ? undefined : input.phone,
      email: input.email === undefined ? undefined : input.email,
      gstin: input.gstin === undefined ? undefined : input.gstin,
      pan: input.pan === undefined ? undefined : input.pan,
      gst_registration_type: input.gstRegistrationType,
      place_of_supply_state:
        input.placeOfSupplyState === undefined ? undefined : input.placeOfSupplyState,
      address: input.address === undefined ? undefined : input.address,
      city: input.city === undefined ? undefined : input.city,
      state: input.state === undefined ? undefined : input.state,
      pincode: input.pincode === undefined ? undefined : input.pincode,
      country: input.country === undefined ? undefined : input.country,
      payment_terms: input.paymentTerms === undefined ? undefined : input.paymentTerms,
      notes: input.notes === undefined ? undefined : input.notes,
      opening_balance: input.openingBalance,
      is_active: input.isActive,
    };
    const first = await this.client
      .from("suppliers")
      .update(payload)
      .eq("business_id", businessId)
      .eq("id", supplierId)
      .select()
      .single();
    if (!first.error) return mapSupplier(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
      .from("suppliers")
      .update(omitColumns(payload, ["gst_registration_type", "place_of_supply_state"]))
      .eq("business_id", businessId)
      .eq("id", supplierId)
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return mapSupplier(fallback.data);
  }

  async deleteSupplier(businessId: string, supplierId: string): Promise<void> {
    const { error } = await this.client
      .from("suppliers")
      .delete()
      .eq("business_id", businessId)
      .eq("id", supplierId);
    if (error) throw error;
  }

  async listCustomersForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; phone: string | null }>> {
    const customers = await this.listCustomers(businessId);
    return customers
      .filter(
        (c) => c.name.toLowerCase().includes(query) || (c.phone ?? "").includes(query)
      )
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  }

  async listSuppliersForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; phone: string | null }>> {
    const suppliers = await this.listSuppliers(businessId);
    return suppliers
      .filter(
        (s) => s.name.toLowerCase().includes(query) || (s.phone ?? "").includes(query)
      )
      .slice(0, 10)
      .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }
}
