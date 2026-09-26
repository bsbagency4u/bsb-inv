import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  Category,
  Product,
  ProductBatch,
  ProductImage,
  ProductStock,
  ProductVariant,
  StockBalance,
  StockMovement,
  StockMovementType,
} from "@/types/domain";
import {
  mapCategory,
  mapProduct,
  mapProductBatch,
  mapProductImage,
  mapProductStock,
  mapProductVariant,
  mapStockBalance,
  mapStockMovement,
} from "./mappers";

export interface ProductCreateInput {
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  unit?: string;
  packUnitId?: string | null;
  packUnit?: string | null;
  unitsPerPack?: number;
  minSaleQty?: number;
  maxSaleQty?: number | null;
  allowBaseSale?: boolean;
  allowPackSale?: boolean;
  attributes?: Record<string, string | number | boolean | null>;
  gstRate?: number;
  hsn?: string | null;
  purchasePrice?: number;
  salePrice?: number;
  mrp?: number | null;
  lowStockThreshold?: number;
  minStock?: number;
  maxStock?: number | null;
  reorderLevel?: number;
  trackInventory?: boolean;
  taxable?: boolean;
  productStatus?: Product["productStatus"];
  isActive?: boolean;
}

export type ProductUpdateInput = Partial<ProductCreateInput>;

export interface StockMovementInput {
  businessId: string;
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  toWarehouseId?: string | null;
  toLocationId?: string | null;
  change: number;
  movementType: StockMovementType;
  reason?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export interface ProductRepository {
  listCategories(businessId: string): Promise<Category[]>;
  createCategory(businessId: string, input: { name: string; description?: string | null; parentId?: string | null }): Promise<Category>;
  updateCategory(businessId: string, categoryId: string, input: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }): Promise<Category>;
  deleteCategory(businessId: string, categoryId: string): Promise<void>;
  listProducts(businessId: string): Promise<Product[]>;
  getProduct(businessId: string, productId: string): Promise<Product | null>;
  createProduct(businessId: string, userId: string, input: ProductCreateInput): Promise<Product>;
  updateProduct(businessId: string, productId: string, input: ProductUpdateInput): Promise<Product>;
  deleteProduct(businessId: string, productId: string): Promise<void>;
  listBatches(businessId: string, productId?: string): Promise<ProductBatch[]>;
  createBatch(businessId: string, input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }): Promise<ProductBatch>;
  updateBatch(businessId: string, batchId: string, input: { expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }): Promise<ProductBatch>;
  listStock(businessId: string): Promise<ProductStock[]>;
  listBalances(businessId: string, productId?: string): Promise<StockBalance[]>;
  listMovements(businessId: string, productId?: string, limit?: number): Promise<StockMovement[]>;
  addStockMovement(input: StockMovementInput): Promise<void>;
  listVariants(businessId: string, productId?: string): Promise<ProductVariant[]>;
  createVariant(businessId: string, input: { productId: string; sku?: string | null; barcode?: string | null; attributes?: Record<string, string | number | boolean | null>; salePrice?: number | null; purchasePrice?: number | null; mrp?: number | null }): Promise<ProductVariant>;
  updateVariant(businessId: string, variantId: string, input: Partial<{ sku: string | null; barcode: string | null; attributes: Record<string, string | number | boolean | null>; salePrice: number | null; purchasePrice: number | null; mrp: number | null; isActive: boolean }>): Promise<ProductVariant>;
  deleteVariant(businessId: string, variantId: string): Promise<void>;
  listImages(businessId: string, productId?: string): Promise<ProductImage[]>;
  addImage(businessId: string, input: { productId: string; variantId?: string | null; storagePath: string; url: string; position?: number; isPrimary?: boolean }): Promise<ProductImage>;
  removeImage(businessId: string, imageId: string): Promise<void>;
  listProductsForSearch(businessId: string, query: string): Promise<Array<{ id: string; name: string; sku: string | null; category: string | null; hsn: string | null }>>;
  listStockForSearch(businessId: string, query: string): Promise<Array<{ productId: string; name: string; unit: string; quantity: number }>>;
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listCategories(businessId: string): Promise<Category[]> {
    const { data, error } = await this.client
      .from("categories")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapCategory);
  }

  async createCategory(
    businessId: string,
    input: { name: string; description?: string | null; parentId?: string | null }
  ): Promise<Category> {
    const { data, error } = await this.client
      .from("categories")
      .insert({
        business_id: businessId,
        name: input.name,
        description: input.description ?? null,
        parent_id: input.parentId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data);
  }

  async updateCategory(
    businessId: string,
    categoryId: string,
    input: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }
  ): Promise<Category> {
    const { data, error } = await this.client
      .from("categories")
      .update({
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        parent_id: input.parentId === undefined ? undefined : input.parentId,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", categoryId)
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data);
  }

  async deleteCategory(businessId: string, categoryId: string): Promise<void> {
    const { error } = await this.client
      .from("categories")
      .delete()
      .eq("business_id", businessId)
      .eq("id", categoryId);
    if (error) throw error;
  }

  async listProducts(businessId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapProduct);
  }

  async getProduct(businessId: string, productId: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", productId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data) : null;
  }

  async createProduct(
    businessId: string,
    userId: string,
    input: ProductCreateInput
  ): Promise<Product> {
    const { data, error } = await this.client
      .from("products")
      .insert({
        business_id: businessId,
        name: input.name,
        description: input.description ?? null,
        sku: input.sku ?? null,
        barcode: input.barcode ?? null,
        category_id: input.categoryId ?? null,
        brand_id: input.brandId ?? null,
        unit_id: input.unitId ?? null,
        unit: input.unit ?? "pcs",
        pack_unit_id: input.packUnitId ?? null,
        pack_unit: input.packUnit ?? null,
        units_per_pack: input.unitsPerPack ?? 1,
        min_sale_qty: input.minSaleQty ?? 1,
        max_sale_qty: input.maxSaleQty ?? null,
        allow_base_sale: input.allowBaseSale ?? true,
        allow_pack_sale: input.allowPackSale ?? false,
        attributes: input.attributes ?? {},
        gst_rate: input.gstRate ?? 0,
        hsn: input.hsn ?? null,
        purchase_price: input.purchasePrice ?? 0,
        sale_price: input.salePrice ?? 0,
        mrp: input.mrp ?? null,
        low_stock_threshold: input.lowStockThreshold ?? 0,
        min_stock: input.minStock ?? 0,
        max_stock: input.maxStock ?? null,
        reorder_level: input.reorderLevel ?? 0,
        track_inventory: input.trackInventory ?? true,
        taxable: input.taxable ?? true,
        product_status: input.productStatus ?? "active",
        is_active: input.isActive ?? true,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProduct(data);
  }

  async updateProduct(
    businessId: string,
    productId: string,
    input: ProductUpdateInput
  ): Promise<Product> {
    const { data, error } = await this.client
      .from("products")
      .update({
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        sku: input.sku === undefined ? undefined : input.sku,
        barcode: input.barcode === undefined ? undefined : input.barcode,
        category_id: input.categoryId === undefined ? undefined : input.categoryId,
        brand_id: input.brandId === undefined ? undefined : input.brandId,
        unit_id: input.unitId === undefined ? undefined : input.unitId,
        unit: input.unit,
        pack_unit_id: input.packUnitId === undefined ? undefined : input.packUnitId,
        pack_unit: input.packUnit === undefined ? undefined : input.packUnit,
        units_per_pack: input.unitsPerPack,
        min_sale_qty: input.minSaleQty,
        max_sale_qty: input.maxSaleQty === undefined ? undefined : input.maxSaleQty,
        allow_base_sale: input.allowBaseSale,
        allow_pack_sale: input.allowPackSale,
        attributes: input.attributes,
        gst_rate: input.gstRate,
        hsn: input.hsn === undefined ? undefined : input.hsn,
        purchase_price: input.purchasePrice,
        sale_price: input.salePrice,
        mrp: input.mrp === undefined ? undefined : input.mrp,
        low_stock_threshold: input.lowStockThreshold,
        min_stock: input.minStock,
        max_stock: input.maxStock === undefined ? undefined : input.maxStock,
        reorder_level: input.reorderLevel,
        track_inventory: input.trackInventory,
        taxable: input.taxable,
        product_status: input.productStatus,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", productId)
      .select()
      .single();
    if (error) throw error;
    return mapProduct(data);
  }

  async deleteProduct(businessId: string, productId: string): Promise<void> {
    const { error } = await this.client
      .from("products")
      .delete()
      .eq("business_id", businessId)
      .eq("id", productId);
    if (error) throw error;
  }

  async listBatches(businessId: string, productId?: string): Promise<ProductBatch[]> {
    let query = this.client
      .from("product_batches")
      .select("*")
      .eq("business_id", businessId)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapProductBatch);
  }

  async createBatch(
    businessId: string,
    input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }
  ): Promise<ProductBatch> {
    const { data, error } = await this.client
      .from("product_batches")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        batch_no: input.batchNo,
        expiry_date: input.expiryDate ?? null,
        mrp: input.mrp ?? null,
        purchase_price: input.purchasePrice ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProductBatch(data);
  }

  async updateBatch(
    businessId: string,
    batchId: string,
    input: { expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }
  ): Promise<ProductBatch> {
    const patch: Database["public"]["Tables"]["product_batches"]["Update"] = {};
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
    if (input.mrp !== undefined) patch.mrp = input.mrp;
    if (input.purchasePrice !== undefined) patch.purchase_price = input.purchasePrice;
    const { data, error } = await this.client
      .from("product_batches")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", batchId)
      .select()
      .single();
    if (error) throw error;
    return mapProductBatch(data);
  }

  async listStock(businessId: string): Promise<ProductStock[]> {
    const { data, error } = await this.client
      .from("product_stock")
      .select("*")
      .eq("business_id", businessId);
    if (error) throw error;
    return (data ?? []).map(mapProductStock);
  }

  async addStockMovement(input: StockMovementInput): Promise<void> {
    const { error } = await this.client.from("stock_ledger").insert({
      business_id: input.businessId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      batch_id: input.batchId ?? null,
      warehouse_id: input.warehouseId ?? null,
      location_id: input.locationId ?? null,
      to_warehouse_id: input.toWarehouseId ?? null,
      to_location_id: input.toLocationId ?? null,
      change: input.change,
      movement_type: input.movementType,
      reason: input.reason ?? input.movementType.toLowerCase(),
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      notes: input.notes ?? null,
      created_by: input.userId ?? null,
    });
    if (error) throw error;
  }

  async listBalances(businessId: string, productId?: string): Promise<StockBalance[]> {
    let query = this.client
      .from("stock_balances")
      .select("*")
      .eq("business_id", businessId)
      .order("product_id", { ascending: true });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapStockBalance);
  }

  async listMovements(businessId: string, productId?: string, limit = 100): Promise<StockMovement[]> {
    let query = this.client
      .from("stock_ledger")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapStockMovement);
  }

  async listVariants(businessId: string, productId?: string): Promise<ProductVariant[]> {
    let query = this.client
      .from("product_variants")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapProductVariant);
  }

  async createVariant(
    businessId: string,
    input: {
      productId: string;
      sku?: string | null;
      barcode?: string | null;
      attributes?: Record<string, string | number | boolean | null>;
      salePrice?: number | null;
      purchasePrice?: number | null;
      mrp?: number | null;
    }
  ): Promise<ProductVariant> {
    const { data, error } = await this.client
      .from("product_variants")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        sku: input.sku ?? null,
        barcode: input.barcode ?? null,
        attributes: input.attributes ?? {},
        sale_price: input.salePrice ?? null,
        purchase_price: input.purchasePrice ?? null,
        mrp: input.mrp ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProductVariant(data);
  }

  async updateVariant(
    businessId: string,
    variantId: string,
    input: Partial<{
      sku: string | null;
      barcode: string | null;
      attributes: Record<string, string | number | boolean | null>;
      salePrice: number | null;
      purchasePrice: number | null;
      mrp: number | null;
      isActive: boolean;
    }>
  ): Promise<ProductVariant> {
    const { data, error } = await this.client
      .from("product_variants")
      .update({
        sku: input.sku === undefined ? undefined : input.sku,
        barcode: input.barcode === undefined ? undefined : input.barcode,
        attributes: input.attributes,
        sale_price: input.salePrice === undefined ? undefined : input.salePrice,
        purchase_price: input.purchasePrice === undefined ? undefined : input.purchasePrice,
        mrp: input.mrp === undefined ? undefined : input.mrp,
        is_active: input.isActive,
      })
      .eq("business_id", businessId)
      .eq("id", variantId)
      .select()
      .single();
    if (error) throw error;
    return mapProductVariant(data);
  }

  async deleteVariant(businessId: string, variantId: string): Promise<void> {
    const { error } = await this.client
      .from("product_variants")
      .delete()
      .eq("business_id", businessId)
      .eq("id", variantId);
    if (error) throw error;
  }

  async listImages(businessId: string, productId?: string): Promise<ProductImage[]> {
    let query = this.client
      .from("product_images")
      .select("*")
      .eq("business_id", businessId)
      .order("position", { ascending: true });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapProductImage);
  }

  async addImage(
    businessId: string,
    input: {
      productId: string;
      variantId?: string | null;
      storagePath: string;
      url: string;
      position?: number;
      isPrimary?: boolean;
    }
  ): Promise<ProductImage> {
    const { data, error } = await this.client
      .from("product_images")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        storage_path: input.storagePath,
        url: input.url,
        position: input.position ?? 0,
        is_primary: input.isPrimary ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProductImage(data);
  }

  async removeImage(businessId: string, imageId: string): Promise<void> {
    const { error } = await this.client
      .from("product_images")
      .delete()
      .eq("business_id", businessId)
      .eq("id", imageId);
    if (error) throw error;
  }

  async listProductsForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; sku: string | null; category: string | null; hsn: string | null }>> {
    const products = await this.listProducts(businessId);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.sku ?? "").toLowerCase().includes(query) ||
          (p.barcode ?? "").toLowerCase().includes(query)
      )
      .slice(0, 10)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, category: p.categoryId ?? null, hsn: p.hsn }));
  }

  async listStockForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ productId: string; name: string; unit: string; quantity: number }>> {
    const [products, stock] = await Promise.all([
      this.listProducts(businessId),
      this.listStock(businessId),
    ]);
    const byProduct = new Map(stock.map((s) => [s.productId, s.quantity]));
    return products
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 10)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        unit: p.unit,
        quantity: byProduct.get(p.id) ?? 0,
      }));
  }
}
