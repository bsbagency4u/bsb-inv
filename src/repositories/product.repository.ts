import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  Category,
  Product,
  ProductBatch,
  ProductStock,
} from "@/types/domain";
import {
  mapCategory,
  mapProduct,
  mapProductBatch,
  mapProductStock,
} from "./mappers";

export interface ProductCreateInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  unit?: string;
  attributes?: Record<string, string | number | boolean | null>;
  gstRate?: number;
  hsn?: string | null;
  purchasePrice?: number;
  salePrice?: number;
  mrp?: number | null;
  lowStockThreshold?: number;
  isActive?: boolean;
}

export type ProductUpdateInput = Partial<ProductCreateInput>;

export interface ProductRepository {
  listCategories(businessId: string): Promise<Category[]>;
  createCategory(businessId: string, input: { name: string; description?: string | null; parentId?: string | null }): Promise<Category>;
  listProducts(businessId: string): Promise<Product[]>;
  getProduct(businessId: string, productId: string): Promise<Product | null>;
  createProduct(businessId: string, userId: string, input: ProductCreateInput): Promise<Product>;
  updateProduct(businessId: string, productId: string, input: ProductUpdateInput): Promise<Product>;
  deleteProduct(businessId: string, productId: string): Promise<void>;
  listBatches(businessId: string, productId?: string): Promise<ProductBatch[]>;
  createBatch(businessId: string, input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null }): Promise<ProductBatch>;
  listStock(businessId: string): Promise<ProductStock[]>;
  addStockMovement(input: {
    businessId: string;
    productId: string;
    batchId?: string | null;
    change: number;
    reason: string;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    userId?: string | null;
  }): Promise<void>;
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
        sku: input.sku ?? null,
        barcode: input.barcode ?? null,
        category_id: input.categoryId ?? null,
        unit: input.unit ?? "pcs",
        attributes: input.attributes ?? {},
        gst_rate: input.gstRate ?? 0,
        hsn: input.hsn ?? null,
        purchase_price: input.purchasePrice ?? 0,
        sale_price: input.salePrice ?? 0,
        mrp: input.mrp ?? null,
        low_stock_threshold: input.lowStockThreshold ?? 0,
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
        sku: input.sku === undefined ? undefined : input.sku,
        barcode: input.barcode === undefined ? undefined : input.barcode,
        category_id: input.categoryId === undefined ? undefined : input.categoryId,
        unit: input.unit,
        attributes: input.attributes,
        gst_rate: input.gstRate,
        hsn: input.hsn === undefined ? undefined : input.hsn,
        purchase_price: input.purchasePrice,
        sale_price: input.salePrice,
        mrp: input.mrp === undefined ? undefined : input.mrp,
        low_stock_threshold: input.lowStockThreshold,
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
    input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null }
  ): Promise<ProductBatch> {
    const { data, error } = await this.client
      .from("product_batches")
      .insert({
        business_id: businessId,
        product_id: input.productId,
        batch_no: input.batchNo,
        expiry_date: input.expiryDate ?? null,
        mrp: input.mrp ?? null,
      })
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

  async addStockMovement(input: {
    businessId: string;
    productId: string;
    batchId?: string | null;
    change: number;
    reason: string;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    userId?: string | null;
  }): Promise<void> {
    const { error } = await this.client.from("stock_ledger").insert({
      business_id: input.businessId,
      product_id: input.productId,
      batch_id: input.batchId ?? null,
      change: input.change,
      reason: input.reason,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      notes: input.notes ?? null,
      created_by: input.userId ?? null,
    });
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
