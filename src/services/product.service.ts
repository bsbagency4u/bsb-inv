import type { Repositories } from "@/repositories/types";
import type {
  Category,
  Product,
  ProductBatch,
  ProductStock,
  ProductWithStock,
  StockMovementReason,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import { productSchema, type ProductValues } from "@/lib/validation/schemas";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";

export interface StockAdjustmentInput {
  productId: string;
  change: number;
  reason: StockMovementReason;
  notes?: string | null;
  batchId?: string | null;
}

export class ProductService {
  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService
  ) {}

  async listCategories(businessId: string): Promise<Category[]> {
    return this.repos.products.listCategories(businessId);
  }

  async createCategory(
    businessId: string,
    userId: string,
    input: { name: string; description?: string | null }
  ): Promise<Category> {
    if (!input.name.trim()) {
      throw AppError.validation("Category name is required.");
    }
    const category = await this.repos.products.createCategory(businessId, {
      name: input.name.trim(),
      description: input.description || null,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "category.created",
      entityType: "category",
      entityId: category.id,
      metadata: { name: category.name },
    });
    return category;
  }

  async listProducts(businessId: string): Promise<Product[]> {
    return this.repos.products.listProducts(businessId);
  }

  /** Products joined with current stock levels. */
  async listProductsWithStock(businessId: string): Promise<ProductWithStock[]> {
    const [products, stock] = await Promise.all([
      this.repos.products.listProducts(businessId),
      this.repos.products.listStock(businessId),
    ]);
    const byProduct = new Map(stock.map((s) => [s.productId, s]));
    return products.map((product) => {
      const level = byProduct.get(product.id);
      const quantity = level?.quantity ?? 0;
      return {
        ...product,
        stockQuantity: quantity,
        stockValue: quantity * product.purchasePrice,
      };
    });
  }

  async getProduct(businessId: string, productId: string): Promise<Product | null> {
    return this.repos.products.getProduct(businessId, productId);
  }

  async createProduct(
    businessId: string,
    userId: string,
    input: ProductValues
  ): Promise<Product> {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const product = await this.repos.products.createProduct(businessId, userId, {
      name: data.name,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId || null,
      unit: data.unit || "pcs",
      attributes: data.attributes ?? {},
      gstRate: data.gstRate ?? 0,
      hsn: data.hsn || null,
      purchasePrice: data.purchasePrice ?? 0,
      salePrice: data.salePrice ?? 0,
      mrp: data.mrp ?? null,
      lowStockThreshold: data.lowStockThreshold ?? 0,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      metadata: { name: product.name, sku: product.sku },
    });
    return product;
  }

  async updateProduct(
    businessId: string,
    userId: string,
    productId: string,
    input: ProductValues
  ): Promise<Product> {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const product = await this.repos.products.updateProduct(businessId, productId, {
      name: data.name,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId || null,
      unit: data.unit || "pcs",
      attributes: data.attributes ?? {},
      gstRate: data.gstRate ?? 0,
      hsn: data.hsn || null,
      purchasePrice: data.purchasePrice ?? 0,
      salePrice: data.salePrice ?? 0,
      mrp: data.mrp ?? null,
      lowStockThreshold: data.lowStockThreshold ?? 0,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "product.updated",
      entityType: "product",
      entityId: productId,
      metadata: { name: product.name },
    });
    return product;
  }

  async deleteProduct(businessId: string, userId: string, productId: string): Promise<void> {
    const product = await this.repos.products.getProduct(businessId, productId);
    if (!product) throw AppError.notFound("Product not found.");
    await this.repos.products.deleteProduct(businessId, productId);
    await this.audits.log({
      businessId,
      userId,
      action: "product.deleted",
      entityType: "product",
      entityId: productId,
      metadata: { name: product.name },
    });
  }

  async listBatches(businessId: string, productId?: string): Promise<ProductBatch[]> {
    return this.repos.products.listBatches(businessId, productId);
  }

  async listStock(businessId: string): Promise<ProductStock[]> {
    return this.repos.products.listStock(businessId);
  }

  /**
   * Records a stock movement. Changes are signed: positive = stock-in,
   * negative = stock-out. After a negative adjustment that would drop a product
   * at or below its low-stock threshold, a low-stock notification is raised.
   */
  async adjustStock(businessId: string, userId: string, input: StockAdjustmentInput): Promise<void> {
    const product = await this.repos.products.getProduct(businessId, input.productId);
    if (!product) throw AppError.notFound("Product not found.");
    if (!Number.isFinite(input.change) || input.change === 0) {
      throw AppError.validation("Adjustment quantity must be non-zero.");
    }

    await this.repos.products.addStockMovement({
      businessId,
      productId: input.productId,
      batchId: input.batchId ?? null,
      change: input.change,
      reason: input.reason,
      referenceType: "adjustment",
      notes: input.notes ?? null,
      userId,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "stock.adjusted",
      entityType: "product",
      entityId: input.productId,
      metadata: { change: input.change, reason: input.reason, notes: input.notes },
    });

    if (input.change < 0) {
      const stock = await this.repos.products.listStock(businessId);
      const level = stock.find((s) => s.productId === input.productId);
      const quantity = level?.quantity ?? 0;
      if (product.lowStockThreshold > 0 && quantity <= product.lowStockThreshold) {
        await this.notifications.create(businessId, {
          title: `Low stock: ${product.name}`,
          description: `Only ${quantity} ${product.unit} remaining (threshold ${product.lowStockThreshold}).`,
          type: "warning",
          href: "/inventory/stock",
        });
      }
    }
  }
}
