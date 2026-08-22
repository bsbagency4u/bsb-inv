import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Brand, StockLocation, Unit, Warehouse } from "@/types/domain";
import { mapBrand, mapStockLocation, mapUnit, mapWarehouse } from "./mappers";

export interface InventoryRepository {
  listUnits(businessId: string): Promise<Unit[]>;
  createUnit(businessId: string, input: { name: string; code: string }): Promise<Unit>;
  updateUnit(businessId: string, unitId: string, input: { name?: string; code?: string; isActive?: boolean }): Promise<Unit>;
  deleteUnit(businessId: string, unitId: string): Promise<void>;

  listBrands(businessId: string): Promise<Brand[]>;
  createBrand(businessId: string, input: { name: string; description?: string | null; logoUrl?: string | null }): Promise<Brand>;
  updateBrand(businessId: string, brandId: string, input: { name?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }): Promise<Brand>;
  deleteBrand(businessId: string, brandId: string): Promise<void>;

  listWarehouses(businessId: string): Promise<Warehouse[]>;
  createWarehouse(businessId: string, input: { name: string; code: string; address?: string | null }): Promise<Warehouse>;
  updateWarehouse(businessId: string, warehouseId: string, input: { name?: string; code?: string; address?: string | null; isActive?: boolean }): Promise<Warehouse>;
  deleteWarehouse(businessId: string, warehouseId: string): Promise<void>;

  listLocations(businessId: string, warehouseId?: string): Promise<StockLocation[]>;
  createLocation(businessId: string, input: { warehouseId: string; name: string; code: string; parentId?: string | null }): Promise<StockLocation>;
  updateLocation(businessId: string, locationId: string, input: { name?: string; code?: string; parentId?: string | null; isActive?: boolean }): Promise<StockLocation>;
  deleteLocation(businessId: string, locationId: string): Promise<void>;
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listUnits(businessId: string): Promise<Unit[]> {
    const { data, error } = await this.client
      .from("units")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapUnit);
  }

  async createUnit(businessId: string, input: { name: string; code: string }): Promise<Unit> {
    const { data, error } = await this.client
      .from("units")
      .insert({ business_id: businessId, name: input.name, code: input.code })
      .select()
      .single();
    if (error) throw error;
    return mapUnit(data);
  }

  async updateUnit(
    businessId: string,
    unitId: string,
    input: { name?: string; code?: string; isActive?: boolean }
  ): Promise<Unit> {
    const { data, error } = await this.client
      .from("units")
      .update({
        name: input.name,
        code: input.code,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", unitId)
      .select()
      .single();
    if (error) throw error;
    return mapUnit(data);
  }

  async deleteUnit(businessId: string, unitId: string): Promise<void> {
    const { error } = await this.client
      .from("units")
      .delete()
      .eq("business_id", businessId)
      .eq("id", unitId);
    if (error) throw error;
  }

  async listBrands(businessId: string): Promise<Brand[]> {
    const { data, error } = await this.client
      .from("brands")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapBrand);
  }

  async createBrand(
    businessId: string,
    input: { name: string; description?: string | null; logoUrl?: string | null }
  ): Promise<Brand> {
    const { data, error } = await this.client
      .from("brands")
      .insert({
        business_id: businessId,
        name: input.name,
        description: input.description ?? null,
        logo_url: input.logoUrl ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapBrand(data);
  }

  async updateBrand(
    businessId: string,
    brandId: string,
    input: { name?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }
  ): Promise<Brand> {
    const { data, error } = await this.client
      .from("brands")
      .update({
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        logo_url: input.logoUrl === undefined ? undefined : input.logoUrl,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", brandId)
      .select()
      .single();
    if (error) throw error;
    return mapBrand(data);
  }

  async deleteBrand(businessId: string, brandId: string): Promise<void> {
    const { error } = await this.client
      .from("brands")
      .delete()
      .eq("business_id", businessId)
      .eq("id", brandId);
    if (error) throw error;
  }

  async listWarehouses(businessId: string): Promise<Warehouse[]> {
    const { data, error } = await this.client
      .from("warehouses")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapWarehouse);
  }

  async createWarehouse(
    businessId: string,
    input: { name: string; code: string; address?: string | null }
  ): Promise<Warehouse> {
    const { data, error } = await this.client
      .from("warehouses")
      .insert({
        business_id: businessId,
        name: input.name,
        code: input.code,
        address: input.address ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapWarehouse(data);
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: { name?: string; code?: string; address?: string | null; isActive?: boolean }
  ): Promise<Warehouse> {
    const { data, error } = await this.client
      .from("warehouses")
      .update({
        name: input.name,
        code: input.code,
        address: input.address === undefined ? undefined : input.address,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", warehouseId)
      .select()
      .single();
    if (error) throw error;
    return mapWarehouse(data);
  }

  async deleteWarehouse(businessId: string, warehouseId: string): Promise<void> {
    const { error } = await this.client
      .from("warehouses")
      .delete()
      .eq("business_id", businessId)
      .eq("id", warehouseId);
    if (error) throw error;
  }

  async listLocations(businessId: string, warehouseId?: string): Promise<StockLocation[]> {
    let query = this.client
      .from("stock_locations")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (warehouseId) query = query.eq("warehouse_id", warehouseId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapStockLocation);
  }

  async createLocation(
    businessId: string,
    input: { warehouseId: string; name: string; code: string; parentId?: string | null }
  ): Promise<StockLocation> {
    const { data, error } = await this.client
      .from("stock_locations")
      .insert({
        business_id: businessId,
        warehouse_id: input.warehouseId,
        name: input.name,
        code: input.code,
        parent_id: input.parentId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapStockLocation(data);
  }

  async updateLocation(
    businessId: string,
    locationId: string,
    input: { name?: string; code?: string; parentId?: string | null; isActive?: boolean }
  ): Promise<StockLocation> {
    const { data, error } = await this.client
      .from("stock_locations")
      .update({
        name: input.name,
        code: input.code,
        parent_id: input.parentId === undefined ? undefined : input.parentId,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", locationId)
      .select()
      .single();
    if (error) throw error;
    return mapStockLocation(data);
  }

  async deleteLocation(businessId: string, locationId: string): Promise<void> {
    const { error } = await this.client
      .from("stock_locations")
      .delete()
      .eq("business_id", businessId)
      .eq("id", locationId);
    if (error) throw error;
  }
}
