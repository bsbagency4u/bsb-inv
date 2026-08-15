import type {
  Category,
  Product,
  ProductBatch,
  ProductStock,
} from "@/types/domain";
import type {
  ProductCreateInput,
  ProductRepository,
  ProductUpdateInput,
} from "../product.repository";
import { readStorage, writeStorage } from "./local-data";

const CATEGORIES_KEY = "demo-categories";
const PRODUCTS_KEY = "demo-products";
const BATCHES_KEY = "demo-batches";
const LEDGER_KEY = "demo-stock-ledger";

interface LedgerEntry {
  businessId: string;
  productId: string;
  batchId: string | null;
  change: number;
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
    return readStorage<Product[]>(PRODUCTS_KEY, []);
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
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readCategories();
    all.push(category);
    this.saveCategories(all);
    return category;
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
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      categoryId: input.categoryId ?? null,
      unit: input.unit ?? "pcs",
      attributes: input.attributes ?? {},
      gstRate: input.gstRate ?? 0,
      hsn: input.hsn ?? null,
      purchasePrice: input.purchasePrice ?? 0,
      salePrice: input.salePrice ?? 0,
      mrp: input.mrp ?? null,
      lowStockThreshold: input.lowStockThreshold ?? 0,
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
  }

  async listBatches(businessId: string, productId?: string): Promise<ProductBatch[]> {
    return this.readBatches()
      .filter((b) => b.businessId === businessId && (!productId || b.productId === productId))
      .sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  }

  async createBatch(
    businessId: string,
    input: { productId: string; batchNo: string; expiryDate?: string | null; mrp?: number | null }
  ): Promise<ProductBatch> {
    const now = new Date().toISOString();
    const batch: ProductBatch = {
      id: `batch-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      batchNo: input.batchNo,
      expiryDate: input.expiryDate ?? null,
      mrp: input.mrp ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readBatches();
    all.push(batch);
    this.saveBatches(all);
    return batch;
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
    const ledger = this.readLedger();
    ledger.push({
      businessId: input.businessId,
      productId: input.productId,
      batchId: input.batchId ?? null,
      change: input.change,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    });
    this.saveLedger(ledger);
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
