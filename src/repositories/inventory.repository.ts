import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  Brand,
  ProductSerial,
  ProductSerialStatus,
  StockAdjustment,
  StockAdjustmentItem,
  StockAdjustmentReasonCode,
  StockAdjustmentStatus,
  StockCountItem,
  StockCountSession,
  StockCountStatus,
  StockLocation,
  StockLocationKind,
  StockReservation,
  StockReservationStatus,
  StockTransfer,
  StockTransferItem,
  StockTransferStatus,
  Unit,
  Warehouse,
  WarehouseAssignment,
} from "@/types/domain";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabase/missing-column";
import {
  mapBrand,
  mapProductSerial,
  mapStockAdjustment,
  mapStockCount,
  mapStockLocation,
  mapStockReservation,
  mapStockTransfer,
  mapUnit,
  mapWarehouse,
} from "./mappers";

export interface WarehouseWriteInput {
  name: string;
  code: string;
  address?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface WarehouseUpdateInput {
  name?: string;
  code?: string;
  address?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

export interface LocationWriteInput {
  warehouseId: string;
  name: string;
  code: string;
  parentId?: string | null;
  kind?: StockLocationKind;
}

export interface LocationUpdateInput {
  name?: string;
  code?: string;
  parentId?: string | null;
  kind?: StockLocationKind;
  isActive?: boolean;
}

export interface StockTransferWriteInput {
  transferNo: string;
  status?: StockTransferStatus;
  fromWarehouseId: string;
  fromLocationId?: string | null;
  toWarehouseId: string;
  toLocationId?: string | null;
  requestedBy?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    batchId?: string | null;
    quantity: number;
    unit?: string | null;
    notes?: string | null;
  }>;
}

export interface StockTransferPatch {
  status?: StockTransferStatus;
  dispatchedBy?: string | null;
  dispatchedAt?: string | null;
  receivedBy?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
  shortageReason?: string | null;
  items?: StockTransferItem[];
}

export interface StockAdjustmentWriteInput {
  adjustmentNo: string;
  status?: StockAdjustmentStatus;
  reason: StockAdjustmentReasonCode;
  warehouseId?: string | null;
  locationId?: string | null;
  notes?: string | null;
  requestedBy?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    batchId?: string | null;
    change: number;
    unit?: string | null;
    notes?: string | null;
  }>;
}

export interface StockAdjustmentPatch {
  status?: StockAdjustmentStatus;
  approvedBy?: string | null;
  postedAt?: string | null;
  notes?: string | null;
  items?: StockAdjustmentItem[];
}

export interface StockCountWriteInput {
  countNo: string;
  status?: StockCountStatus;
  warehouseId: string;
  locationId?: string | null;
  notes?: string | null;
  countedBy?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    batchId?: string | null;
    systemQuantity: number;
    countedQuantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  }>;
}

export interface StockCountPatch {
  status?: StockCountStatus;
  countedBy?: string | null;
  approvedBy?: string | null;
  postedAt?: string | null;
  notes?: string | null;
  items?: StockCountItem[];
}

export interface StockReservationWriteInput {
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  quantity: number;
  status?: StockReservationStatus;
  referenceType: string;
  referenceId: string;
  notes?: string | null;
}

export interface ProductSerialWriteInput {
  productId: string;
  variantId?: string | null;
  serialNo: string;
  imei?: string | null;
  warrantyMonths?: number | null;
  warrantyExpiresOn?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  batchId?: string | null;
  status?: ProductSerialStatus;
  referenceType?: string | null;
  referenceId?: string | null;
}

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
  createWarehouse(businessId: string, input: WarehouseWriteInput): Promise<Warehouse>;
  updateWarehouse(businessId: string, warehouseId: string, input: WarehouseUpdateInput): Promise<Warehouse>;
  deleteWarehouse(businessId: string, warehouseId: string): Promise<void>;

  listLocations(businessId: string, warehouseId?: string): Promise<StockLocation[]>;
  createLocation(businessId: string, input: LocationWriteInput): Promise<StockLocation>;
  updateLocation(businessId: string, locationId: string, input: LocationUpdateInput): Promise<StockLocation>;
  deleteLocation(businessId: string, locationId: string): Promise<void>;

  listWarehouseAssignments(businessId: string, warehouseId?: string): Promise<WarehouseAssignment[]>;
  setWarehouseAssignments(businessId: string, warehouseId: string, userIds: string[]): Promise<WarehouseAssignment[]>;

  listTransfers(businessId: string): Promise<StockTransfer[]>;
  getTransfer(businessId: string, transferId: string): Promise<StockTransfer | null>;
  createTransfer(businessId: string, input: StockTransferWriteInput): Promise<StockTransfer>;
  updateTransfer(businessId: string, transferId: string, input: StockTransferPatch): Promise<StockTransfer>;

  listAdjustments(businessId: string): Promise<StockAdjustment[]>;
  getAdjustment(businessId: string, adjustmentId: string): Promise<StockAdjustment | null>;
  createAdjustment(businessId: string, input: StockAdjustmentWriteInput): Promise<StockAdjustment>;
  updateAdjustment(businessId: string, adjustmentId: string, input: StockAdjustmentPatch): Promise<StockAdjustment>;

  listCounts(businessId: string): Promise<StockCountSession[]>;
  getCount(businessId: string, countId: string): Promise<StockCountSession | null>;
  createCount(businessId: string, input: StockCountWriteInput): Promise<StockCountSession>;
  updateCount(businessId: string, countId: string, input: StockCountPatch): Promise<StockCountSession>;

  listReservations(businessId: string, filter?: { productId?: string; status?: StockReservationStatus; referenceId?: string }): Promise<StockReservation[]>;
  createReservation(businessId: string, input: StockReservationWriteInput): Promise<StockReservation>;
  updateReservationStatus(businessId: string, reservationId: string, status: StockReservationStatus): Promise<StockReservation>;

  listSerials(businessId: string, productId?: string): Promise<ProductSerial[]>;
  createSerial(businessId: string, input: ProductSerialWriteInput): Promise<ProductSerial>;
  updateSerial(businessId: string, serialId: string, input: Partial<ProductSerialWriteInput>): Promise<ProductSerial>;
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

  async createWarehouse(businessId: string, input: WarehouseWriteInput): Promise<Warehouse> {
    const payload = {
      business_id: businessId,
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    };
    const first = await this.client.from("warehouses").insert(payload).select().single();
    if (!first.error) return mapWarehouse(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
      .from("warehouses")
      .insert({
        business_id: businessId,
        name: input.name,
        code: input.code,
        address: input.address ?? null,
      })
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return mapWarehouse(fallback.data);
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: WarehouseUpdateInput
  ): Promise<Warehouse> {
    const payload: Database["public"]["Tables"]["warehouses"]["Update"] = {
      name: input.name,
      code: input.code,
      address: input.address === undefined ? undefined : input.address,
      state: input.state === undefined ? undefined : input.state,
      pincode: input.pincode === undefined ? undefined : input.pincode,
      phone: input.phone === undefined ? undefined : input.phone,
      email: input.email === undefined ? undefined : input.email,
      is_active: input.isActive,
    };
    const first = await this.client
      .from("warehouses")
      .update(payload)
      .eq("business_id", businessId)
      .eq("id", warehouseId)
      .select()
      .single();
    if (!first.error) return mapWarehouse(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
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
    if (fallback.error) throw fallback.error;
    return mapWarehouse(fallback.data);
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

  async createLocation(businessId: string, input: LocationWriteInput): Promise<StockLocation> {
    const payload = {
      business_id: businessId,
      warehouse_id: input.warehouseId,
      name: input.name,
      code: input.code,
      parent_id: input.parentId ?? null,
      kind: input.kind ?? "main_store",
    };
    const first = await this.client.from("stock_locations").insert(payload).select().single();
    if (!first.error) return mapStockLocation(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
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
    if (fallback.error) throw fallback.error;
    return mapStockLocation(fallback.data);
  }

  async updateLocation(
    businessId: string,
    locationId: string,
    input: LocationUpdateInput
  ): Promise<StockLocation> {
    const patch: Database["public"]["Tables"]["stock_locations"]["Update"] = {
      name: input.name,
      code: input.code,
      parent_id: input.parentId === undefined ? undefined : input.parentId,
      kind: input.kind,
      is_active: input.isActive,
    };
    const first = await this.client
      .from("stock_locations")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", locationId)
      .select()
      .single();
    if (!first.error) return mapStockLocation(first.data);
    if (!isMissingColumnError(first.error)) throw first.error;
    const fallback = await this.client
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
    if (fallback.error) throw fallback.error;
    return mapStockLocation(fallback.data);
  }

  async deleteLocation(businessId: string, locationId: string): Promise<void> {
    const { error } = await this.client
      .from("stock_locations")
      .delete()
      .eq("business_id", businessId)
      .eq("id", locationId);
    if (error) throw error;
  }

  async listWarehouseAssignments(businessId: string, warehouseId?: string): Promise<WarehouseAssignment[]> {
    let query = this.client.from("warehouse_users").select("warehouse_id, user_id, created_at");
    if (warehouseId) query = query.eq("warehouse_id", warehouseId);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) return [];
      throw error;
    }
    const warehouseIds = [...new Set((data ?? []).map((row) => row.warehouse_id))];
    if (warehouseIds.length === 0) return [];
    const warehouses = await this.listWarehouses(businessId);
    const allowed = new Set(warehouses.map((w) => w.id));
    const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
    const { data: profiles } = await this.client
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? [])
      .filter((row) => allowed.has(row.warehouse_id))
      .map((row) => {
        const profile = profileById.get(row.user_id);
        return {
          warehouseId: row.warehouse_id,
          userId: row.user_id,
          fullName: profile?.full_name ?? null,
          email: profile?.email ?? null,
        };
      });
  }

  async setWarehouseAssignments(
    businessId: string,
    warehouseId: string,
    userIds: string[]
  ): Promise<WarehouseAssignment[]> {
    const warehouses = await this.listWarehouses(businessId);
    if (!warehouses.some((w) => w.id === warehouseId)) throw new Error("Warehouse not found.");
    const { error: delError } = await this.client.from("warehouse_users").delete().eq("warehouse_id", warehouseId);
    if (delError) {
      if (isMissingRelationError(delError)) return [];
      throw delError;
    }
    if (userIds.length > 0) {
      const { error: insError } = await this.client
        .from("warehouse_users")
        .insert(userIds.map((userId) => ({ warehouse_id: warehouseId, user_id: userId })));
      if (insError) throw insError;
    }
    return this.listWarehouseAssignments(businessId, warehouseId);
  }

  private async loadTransferItems(transferIds: string[]) {
    if (transferIds.length === 0) return [];
    const { data, error } = await this.client.from("stock_transfer_items").select("*").in("transfer_id", transferIds);
    if (error) throw error;
    return data ?? [];
  }

  async listTransfers(businessId: string): Promise<StockTransfer[]> {
    const { data, error } = await this.client
      .from("stock_transfers")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    const rows = data ?? [];
    const items = await this.loadTransferItems(rows.map((row) => row.id));
    return rows.map((row) => mapStockTransfer(row, items.filter((item) => item.transfer_id === row.id)));
  }

  async getTransfer(businessId: string, transferId: string): Promise<StockTransfer | null> {
    const { data, error } = await this.client
      .from("stock_transfers")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", transferId)
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) return null;
      throw error;
    }
    if (!data) return null;
    const items = await this.loadTransferItems([data.id]);
    return mapStockTransfer(data, items);
  }

  async createTransfer(businessId: string, input: StockTransferWriteInput): Promise<StockTransfer> {
    const { data, error } = await this.client
      .from("stock_transfers")
      .insert({
        business_id: businessId,
        transfer_no: input.transferNo,
        status: input.status ?? "draft",
        from_warehouse_id: input.fromWarehouseId,
        from_location_id: input.fromLocationId ?? null,
        to_warehouse_id: input.toWarehouseId,
        to_location_id: input.toLocationId ?? null,
        requested_by: input.requestedBy ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    if (input.items.length > 0) {
      const { error: itemError } = await this.client.from("stock_transfer_items").insert(
        input.items.map((item) => ({
          transfer_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          batch_id: item.batchId ?? null,
          quantity: item.quantity,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        }))
      );
      if (itemError) throw itemError;
    }
    const created = await this.getTransfer(businessId, data.id);
    if (!created) throw new Error("Transfer not found after create.");
    return created;
  }

  async updateTransfer(businessId: string, transferId: string, input: StockTransferPatch): Promise<StockTransfer> {
    const patch: Database["public"]["Tables"]["stock_transfers"]["Update"] = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.dispatchedBy !== undefined) patch.dispatched_by = input.dispatchedBy;
    if (input.dispatchedAt !== undefined) patch.dispatched_at = input.dispatchedAt;
    if (input.receivedBy !== undefined) patch.received_by = input.receivedBy;
    if (input.receivedAt !== undefined) patch.received_at = input.receivedAt;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.shortageReason !== undefined) patch.shortage_reason = input.shortageReason;
    if (Object.keys(patch).length > 0) {
      const { error } = await this.client
        .from("stock_transfers")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", transferId);
      if (error) throw error;
    }
    if (input.items) {
      for (const item of input.items) {
        const { error } = await this.client
          .from("stock_transfer_items")
          .update({
            dispatched_quantity: item.dispatchedQuantity,
            received_quantity: item.receivedQuantity,
            shortage_quantity: item.shortageQuantity,
            notes: item.notes,
          })
          .eq("id", item.id)
          .eq("transfer_id", transferId);
        if (error) throw error;
      }
    }
    const updated = await this.getTransfer(businessId, transferId);
    if (!updated) throw new Error("Transfer not found.");
    return updated;
  }

  private async loadAdjustmentItems(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from("stock_adjustment_items").select("*").in("adjustment_id", ids);
    if (error) throw error;
    return data ?? [];
  }

  async listAdjustments(businessId: string): Promise<StockAdjustment[]> {
    const { data, error } = await this.client
      .from("stock_adjustments")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    const rows = data ?? [];
    const items = await this.loadAdjustmentItems(rows.map((row) => row.id));
    return rows.map((row) => mapStockAdjustment(row, items.filter((item) => item.adjustment_id === row.id)));
  }

  async getAdjustment(businessId: string, adjustmentId: string): Promise<StockAdjustment | null> {
    const { data, error } = await this.client
      .from("stock_adjustments")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", adjustmentId)
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) return null;
      throw error;
    }
    if (!data) return null;
    const items = await this.loadAdjustmentItems([data.id]);
    return mapStockAdjustment(data, items);
  }

  async createAdjustment(businessId: string, input: StockAdjustmentWriteInput): Promise<StockAdjustment> {
    const { data, error } = await this.client
      .from("stock_adjustments")
      .insert({
        business_id: businessId,
        adjustment_no: input.adjustmentNo,
        status: input.status ?? "draft",
        reason: input.reason,
        warehouse_id: input.warehouseId ?? null,
        location_id: input.locationId ?? null,
        notes: input.notes ?? null,
        requested_by: input.requestedBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    if (input.items.length > 0) {
      const { error: itemError } = await this.client.from("stock_adjustment_items").insert(
        input.items.map((item) => ({
          adjustment_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          batch_id: item.batchId ?? null,
          change: item.change,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        }))
      );
      if (itemError) throw itemError;
    }
    const created = await this.getAdjustment(businessId, data.id);
    if (!created) throw new Error("Adjustment not found after create.");
    return created;
  }

  async updateAdjustment(businessId: string, adjustmentId: string, input: StockAdjustmentPatch): Promise<StockAdjustment> {
    const patch: Database["public"]["Tables"]["stock_adjustments"]["Update"] = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.approvedBy !== undefined) patch.approved_by = input.approvedBy;
    if (input.postedAt !== undefined) patch.posted_at = input.postedAt;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (Object.keys(patch).length > 0) {
      const { error } = await this.client
        .from("stock_adjustments")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", adjustmentId);
      if (error) throw error;
    }
    const updated = await this.getAdjustment(businessId, adjustmentId);
    if (!updated) throw new Error("Adjustment not found.");
    return updated;
  }

  private async loadCountItems(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from("stock_count_items").select("*").in("count_id", ids);
    if (error) throw error;
    return data ?? [];
  }

  async listCounts(businessId: string): Promise<StockCountSession[]> {
    const { data, error } = await this.client
      .from("stock_counts")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    const rows = data ?? [];
    const items = await this.loadCountItems(rows.map((row) => row.id));
    return rows.map((row) => mapStockCount(row, items.filter((item) => item.count_id === row.id)));
  }

  async getCount(businessId: string, countId: string): Promise<StockCountSession | null> {
    const { data, error } = await this.client
      .from("stock_counts")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", countId)
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) return null;
      throw error;
    }
    if (!data) return null;
    const items = await this.loadCountItems([data.id]);
    return mapStockCount(data, items);
  }

  async createCount(businessId: string, input: StockCountWriteInput): Promise<StockCountSession> {
    const { data, error } = await this.client
      .from("stock_counts")
      .insert({
        business_id: businessId,
        count_no: input.countNo,
        status: input.status ?? "draft",
        warehouse_id: input.warehouseId,
        location_id: input.locationId ?? null,
        notes: input.notes ?? null,
        counted_by: input.countedBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    if (input.items.length > 0) {
      const { error: itemError } = await this.client.from("stock_count_items").insert(
        input.items.map((item) => ({
          count_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          batch_id: item.batchId ?? null,
          system_quantity: item.systemQuantity,
          counted_quantity: item.countedQuantity ?? null,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        }))
      );
      if (itemError) throw itemError;
    }
    const created = await this.getCount(businessId, data.id);
    if (!created) throw new Error("Count not found after create.");
    return created;
  }

  async updateCount(businessId: string, countId: string, input: StockCountPatch): Promise<StockCountSession> {
    const patch: Database["public"]["Tables"]["stock_counts"]["Update"] = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.countedBy !== undefined) patch.counted_by = input.countedBy;
    if (input.approvedBy !== undefined) patch.approved_by = input.approvedBy;
    if (input.postedAt !== undefined) patch.posted_at = input.postedAt;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (Object.keys(patch).length > 0) {
      const { error } = await this.client
        .from("stock_counts")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", countId);
      if (error) throw error;
    }
    if (input.items) {
      for (const item of input.items) {
        const { error } = await this.client
          .from("stock_count_items")
          .update({
            counted_quantity: item.countedQuantity,
            notes: item.notes,
            system_quantity: item.systemQuantity,
          })
          .eq("id", item.id)
          .eq("count_id", countId);
        if (error) throw error;
      }
    }
    const updated = await this.getCount(businessId, countId);
    if (!updated) throw new Error("Count not found.");
    return updated;
  }

  async listReservations(
    businessId: string,
    filter?: { productId?: string; status?: StockReservationStatus; referenceId?: string }
  ): Promise<StockReservation[]> {
    let query = this.client.from("stock_reservations").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
    if (filter?.productId) query = query.eq("product_id", filter.productId);
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.referenceId) query = query.eq("reference_id", filter.referenceId);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return (data ?? []).map(mapStockReservation);
  }

  async createReservation(businessId: string, input: StockReservationWriteInput): Promise<StockReservation> {
    const { data, error } = await this.client
      .from("stock_reservations")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        batch_id: input.batchId ?? null,
        warehouse_id: input.warehouseId ?? null,
        location_id: input.locationId ?? null,
        quantity: input.quantity,
        status: input.status ?? "open",
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapStockReservation(data);
  }

  async updateReservationStatus(
    businessId: string,
    reservationId: string,
    status: StockReservationStatus
  ): Promise<StockReservation> {
    const { data, error } = await this.client
      .from("stock_reservations")
      .update({ status })
      .eq("business_id", businessId)
      .eq("id", reservationId)
      .select()
      .single();
    if (error) throw error;
    return mapStockReservation(data);
  }

  async listSerials(businessId: string, productId?: string): Promise<ProductSerial[]> {
    let query = this.client.from("product_serials").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return (data ?? []).map(mapProductSerial);
  }

  async createSerial(businessId: string, input: ProductSerialWriteInput): Promise<ProductSerial> {
    const { data, error } = await this.client
      .from("product_serials")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        serial_no: input.serialNo,
        imei: input.imei ?? null,
        warranty_months: input.warrantyMonths ?? null,
        warranty_expires_on: input.warrantyExpiresOn ?? null,
        warehouse_id: input.warehouseId ?? null,
        location_id: input.locationId ?? null,
        batch_id: input.batchId ?? null,
        status: input.status ?? "in_stock",
        reference_type: input.referenceType ?? null,
        reference_id: input.referenceId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProductSerial(data);
  }

  async updateSerial(
    businessId: string,
    serialId: string,
    input: Partial<ProductSerialWriteInput>
  ): Promise<ProductSerial> {
    const patch: Database["public"]["Tables"]["product_serials"]["Update"] = {};
    if (input.serialNo !== undefined) patch.serial_no = input.serialNo;
    if (input.imei !== undefined) patch.imei = input.imei;
    if (input.warrantyMonths !== undefined) patch.warranty_months = input.warrantyMonths;
    if (input.warrantyExpiresOn !== undefined) patch.warranty_expires_on = input.warrantyExpiresOn;
    if (input.warehouseId !== undefined) patch.warehouse_id = input.warehouseId;
    if (input.locationId !== undefined) patch.location_id = input.locationId;
    if (input.batchId !== undefined) patch.batch_id = input.batchId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.referenceType !== undefined) patch.reference_type = input.referenceType;
    if (input.referenceId !== undefined) patch.reference_id = input.referenceId;
    const { data, error } = await this.client
      .from("product_serials")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", serialId)
      .select()
      .single();
    if (error) throw error;
    return mapProductSerial(data);
  }
}
