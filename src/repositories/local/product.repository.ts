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
import type {
  ProductCreateInput,
  ProductRepository,
  ProductUpdateInput,
  StockMovementInput,
} from "../product.repository";
import { readStorage, writeStorage } from "./local-data";

const CATEGORIES_KEY = "demo-categories";
const PRODUCTS_KEY = "demo-products";
const BATCHES_KEY = "demo-batches";
const LEDGER_KEY = "demo-stock-ledger";
const VARIANTS_KEY = "demo-product-variants";
const IMAGES_KEY = "demo-product-images";

interface LedgerEntry {
  id: string;
  businessId: string;
  productId: string;
  variantId: string | null;
  batchId: string | null;
  warehouseId: string | null;
  locationId: string | null;
  toWarehouseId: string | null;
  toLocationId: string | null;
  change: number;
  movementType: StockMovementType;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

export class LocalProductRepository implements ProductRepository {
  private readCategories(): Category[] {
    return readStorage<Category[]>(CATEGORIES_KEY, []);
  }
  private saveCategories(categories: Category[]): void {
    writeStorage(CATEGORIES_KEY, categories);
  }
  private readProducts(): Product[] {
    return readStorage<Product[]>(PRODUCTS_KEY, []).map((product) => ({
      ...product,
      packUnit: product.packUnit ?? null,
      packUnitId: product.packUnitId ?? null,
      unitsPerPack: product.unitsPerPack ?? 1,
      minSaleQty: product.minSaleQty ?? 1,
      maxSaleQty: product.maxSaleQty ?? null,
      allowBaseSale: product.allowBaseSale ?? true,
      allowPackSale: product.allowPackSale ?? false,
    }));
  }
  private saveProducts(products: Product[]): void {
    writeStorage(PRODUCTS_KEY, products);
  }
  private readBatches(): ProductBatch[] {
    return readStorage<ProductBatch[]>(BATCHES_KEY, []);
  }
  private saveBatches(batches: ProductBatch[]): void {
    writeStorage(BATCHES_KEY, batches);
  }
  private readLedger(): LedgerEntry[] {
    return readStorage<LedgerEntry[]>(LEDGER_KEY, []);
  }
  private saveLedger(ledger: LedgerEntry[]): void {
    writeStorage(LEDGER_KEY, ledger);
  }
  private readVariants(): ProductVariant[] {
    return readStorage<ProductVariant[]>(VARIANTS_KEY, []);
  }
  private saveVariants(variants: ProductVariant[]): void {
    writeStorage(VARIANTS_KEY, variants);
  }
  private readImages(): ProductImage[] {
    return readStorage<ProductImage[]>(IMAGES_KEY, []);
  }
  private saveImages(images: ProductImage[]): void {
    writeStorage(IMAGES_KEY, images);
  }

  async listCategories(businessId: string): Promise<Category[]> {
    return this.readCategories().filter((c) => c.businessId === businessId);
  }

  async createCategory(
    businessId: string,
    input: { name: string; description?: string | null; parentId?: string | null }
  ): Promise<Category> {
    const now = new Date().toISOString();
    const category: Category = {
      id: `cat-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readCategories();
    all.push(category);
    this.saveCategories(all);
    return category;
  }

  async updateCategory(
    businessId: string,
    categoryId: string,
    input: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }
  ): Promise<Category> {
    const all = this.readCategories();
    const index = all.findIndex((c) => c.businessId === businessId && c.id === categoryId);
    if (index === -1) throw new Error("Category not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      description: input.description === undefined ? all[index].description : input.description,
      parentId: input.parentId === undefined ? all[index].parentId : input.parentId,
      isActive: input.isActive ?? all[index].isActive,
      updatedAt: new Date().toISOString(),
    };
    this.saveCategories(all);
    return all[index];
  }

  async deleteCategory(businessId: string, categoryId: string): Promise<void> {
    this.saveCategories(
      this.readCategories().filter((c) => !(c.businessId === businessId && c.id === categoryId))
    );
  }

  async listProducts(businessId: string): Promise<Product[]> {
    return this.readProducts().filter((p) => p.businessId === businessId);
  }

  async getProduct(businessId: string, productId: string): Promise<Product | null> {
    return (
      this.readProducts().find((p) => p.businessId === businessId && p.id === productId) ??
      null
    );
  }

  async createProduct(
    businessId: string,
    userId: string,
    input: ProductCreateInput
  ): Promise<Product> {
    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      description: input.description ?? null,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      unitId: input.unitId ?? null,
      unit: input.unit ?? "pcs",
      packUnit: input.packUnit ?? null,
      packUnitId: input.packUnitId ?? null,
      unitsPerPack: input.unitsPerPack ?? 1,
      minSaleQty: input.minSaleQty ?? 1,
      maxSaleQty: input.maxSaleQty ?? null,
      allowBaseSale: input.allowBaseSale ?? true,
      allowPackSale: input.allowPackSale ?? false,
      attributes: input.attributes ?? {},
      gstRate: input.gstRate ?? 0,
      hsn: input.hsn ?? null,
      purchasePrice: input.purchasePrice ?? 0,
      salePrice: input.salePrice ?? 0,
      mrp: input.mrp ?? null,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      minStock: input.minStock ?? 0,
      maxStock: input.maxStock ?? null,
      reorderLevel: input.reorderLevel ?? 0,
      trackInventory: input.trackInventory ?? true,
      taxable: input.taxable ?? true,
      productStatus: input.productStatus ?? "active",
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readProducts();
    all.push(product);
    this.saveProducts(all);
    return product;
  }

  async updateProduct(
    businessId: string,
    productId: string,
    input: ProductUpdateInput
  ): Promise<Product> {
    const all = this.readProducts();
    const index = all.findIndex((p) => p.businessId === businessId && p.id === productId);
    if (index === -1) throw new Error("Product not found.");
    all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
    this.saveProducts(all);
    return all[index];
  }

  async deleteProduct(businessId: string, productId: string): Promise<void> {
    this.saveProducts(
      this.readProducts().filter((p) => !(p.businessId === businessId && p.id === productId))
    );
    this.saveVariants(
      this.readVariants().filter((v) => !(v.businessId === businessId && v.productId === productId))
    );
  }

  async listBatches(businessId: string, productId?: string): Promise<ProductBatch[]> {
    return this.readBatches()
      .filter((b) => b.businessId === businessId && (!productId || b.productId === productId))
      .sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  }

  async createBatch(
    businessId: string,
    input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }
  ): Promise<ProductBatch> {
    const now = new Date().toISOString();
    const batch: ProductBatch = {
      id: `batch-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      batchNo: input.batchNo,
      expiryDate: input.expiryDate ?? null,
      mrp: input.mrp ?? null,
      purchasePrice: input.purchasePrice ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readBatches();
    all.push(batch);
    this.saveBatches(all);
    return batch;
  }

  async updateBatch(
    businessId: string,
    batchId: string,
    input: { expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null }
  ): Promise<ProductBatch> {
    const all = this.readBatches();
    const index = all.findIndex((batch) => batch.businessId === businessId && batch.id === batchId);
    if (index === -1) throw new Error("Batch not found.");
    const current = all[index];
    const updated: ProductBatch = {
      ...current,
      expiryDate: input.expiryDate === undefined ? current.expiryDate : input.expiryDate,
      mrp: input.mrp === undefined ? current.mrp : input.mrp,
      purchasePrice: input.purchasePrice === undefined ? current.purchasePrice : input.purchasePrice,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    this.saveBatches(all);
    return updated;
  }

  async listStock(businessId: string): Promise<ProductStock[]> {
    const byProduct = new Map<string, { quantity: number; last: string | null }>();
    for (const entry of this.readLedger()) {
      if (entry.businessId !== businessId) continue;
      const current = byProduct.get(entry.productId) ?? { quantity: 0, last: null };
      current.quantity += entry.change;
      if (!current.last || entry.createdAt > current.last) current.last = entry.createdAt;
      byProduct.set(entry.productId, current);
    }
    return Array.from(byProduct.entries()).map(([productId, value]) => ({
      productId,
      quantity: value.quantity,
      lastMovementAt: value.last,
    }));
  }

  async listBalances(businessId: string, productId?: string): Promise<StockBalance[]> {
    const balances = new Map<string, StockBalance>();
    for (const entry of this.readLedger()) {
      if (entry.businessId !== businessId) continue;
      if (productId && entry.productId !== productId) continue;
      const key = `${entry.productId}|${entry.variantId ?? ""}|${entry.batchId ?? ""}|${entry.warehouseId ?? ""}|${entry.locationId ?? ""}`;
      const current = balances.get(key) ?? {
        productId: entry.productId,
        variantId: entry.variantId,
        batchId: entry.batchId,
        warehouseId: entry.warehouseId,
        locationId: entry.locationId,
        quantity: 0,
        lastMovementAt: null,
      };
      current.quantity += entry.change;
      if (!current.lastMovementAt || entry.createdAt > current.lastMovementAt) {
        current.lastMovementAt = entry.createdAt;
      }
      balances.set(key, current);
    }
    return Array.from(balances.values());
  }

  async listMovements(businessId: string, productId?: string, limit = 100): Promise<StockMovement[]> {
    return this.readLedger()
      .filter((entry) => entry.businessId === businessId && (!productId || entry.productId === productId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((entry) => ({ ...entry, id: entry.id }));
  }

  async addStockMovement(input: StockMovementInput): Promise<void> {
    const ledger = this.readLedger();
    ledger.push({
      id: `mv-${crypto.randomUUID()}`,
      businessId: input.businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      batchId: input.batchId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      toWarehouseId: input.toWarehouseId ?? null,
      toLocationId: input.toLocationId ?? null,
      change: input.change,
      movementType: input.movementType,
      reason: input.reason ?? input.movementType.toLowerCase(),
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    });
    this.saveLedger(ledger);
  }

  async listVariants(businessId: string, productId?: string): Promise<ProductVariant[]> {
    return this.readVariants().filter(
      (v) => v.businessId === businessId && (!productId || v.productId === productId)
    );
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
    const now = new Date().toISOString();
    const variant: ProductVariant = {
      id: `var-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      attributes: input.attributes ?? {},
      salePrice: input.salePrice ?? null,
      purchasePrice: input.purchasePrice ?? null,
      mrp: input.mrp ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readVariants();
    all.push(variant);
    this.saveVariants(all);
    return variant;
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
    const all = this.readVariants();
    const index = all.findIndex((v) => v.businessId === businessId && v.id === variantId);
    if (index === -1) throw new Error("Variant not found.");
    all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
    this.saveVariants(all);
    return all[index];
  }

  async deleteVariant(businessId: string, variantId: string): Promise<void> {
    this.saveVariants(
      this.readVariants().filter((v) => !(v.businessId === businessId && v.id === variantId))
    );
  }

  async listImages(businessId: string, productId?: string): Promise<ProductImage[]> {
    return this.readImages().filter(
      (i) => i.businessId === businessId && (!productId || i.productId === productId)
    );
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
    const image: ProductImage = {
      id: `img-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      storagePath: input.storagePath,
      url: input.url,
      position: input.position ?? 0,
      isPrimary: input.isPrimary ?? false,
      createdAt: new Date().toISOString(),
    };
    const all = this.readImages();
    all.push(image);
    this.saveImages(all);
    return image;
  }

  async removeImage(businessId: string, imageId: string): Promise<void> {
    this.saveImages(
      this.readImages().filter((i) => !(i.businessId === businessId && i.id === imageId))
    );
  }

  async listProductsForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; sku: string | null; category: string | null; hsn: string | null }>> {
    return (await this.listProducts(businessId))
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
