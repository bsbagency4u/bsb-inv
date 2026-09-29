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
import { InventoryService } from "./inventory.service";
import { AuthorizationService } from "./authorization.service";

export interface StockAdjustmentInput {
  productId: string;
  change: number;
  reason: StockMovementReason;
  notes?: string | null;
  batchId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
}

export class ProductService {
  private inventory: InventoryService;
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
    this.inventory = new InventoryService(repos, audits, notifications, this.auth);
  }

  private requireProductManage(businessId: string, userId: string): Promise<void> {
    return this.auth.requirePermission(businessId, userId, "product.manage");
  }

  async listCategories(businessId: string): Promise<Category[]> {
    return this.repos.products.listCategories(businessId);
  }

  async updateCategory(
    businessId: string,
    userId: string,
    categoryId: string,
    input: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }
  ): Promise<Category> {
    await this.requireProductManage(businessId, userId);
    const category = await this.repos.products.updateCategory(businessId, categoryId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "category.updated",
      entityType: "category",
      entityId: categoryId,
      metadata: { name: category.name },
    });
    return category;
  }

  async deleteCategory(businessId: string, userId: string, categoryId: string): Promise<void> {
    await this.requireProductManage(businessId, userId);
    await this.repos.products.deleteCategory(businessId, categoryId);
    await this.audits.log({
      businessId,
      userId,
      action: "category.deleted",
      entityType: "category",
      entityId: categoryId,
    });
  }

  async listUnits(businessId: string) {
    return this.repos.inventory.listUnits(businessId);
  }

  async createUnit(businessId: string, userId: string, input: { name: string; code: string }) {
    await this.requireProductManage(businessId, userId);
    const unit = await this.repos.inventory.createUnit(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "unit.created",
      entityType: "unit",
      entityId: unit.id,
      metadata: { name: unit.name, code: unit.code },
    });
    return unit;
  }

  async updateUnit(
    businessId: string,
    userId: string,
    unitId: string,
    input: { name?: string; code?: string; isActive?: boolean }
  ) {
    await this.requireProductManage(businessId, userId);
    const unit = await this.repos.inventory.updateUnit(businessId, unitId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "unit.updated",
      entityType: "unit",
      entityId: unitId,
      metadata: { name: unit.name },
    });
    return unit;
  }

  async deleteUnit(businessId: string, userId: string, unitId: string): Promise<void> {
    await this.requireProductManage(businessId, userId);
    await this.repos.inventory.deleteUnit(businessId, unitId);
    await this.audits.log({
      businessId,
      userId,
      action: "unit.deleted",
      entityType: "unit",
      entityId: unitId,
    });
  }

  async listBrands(businessId: string) {
    return this.repos.inventory.listBrands(businessId);
  }

  async createBrand(
    businessId: string,
    userId: string,
    input: { name: string; description?: string | null; logoUrl?: string | null }
  ) {
    await this.requireProductManage(businessId, userId);
    const brand = await this.repos.inventory.createBrand(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "brand.created",
      entityType: "brand",
      entityId: brand.id,
      metadata: { name: brand.name },
    });
    return brand;
  }

  async updateBrand(
    businessId: string,
    userId: string,
    brandId: string,
    input: { name?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }
  ) {
    await this.requireProductManage(businessId, userId);
    const brand = await this.repos.inventory.updateBrand(businessId, brandId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "brand.updated",
      entityType: "brand",
      entityId: brandId,
      metadata: { name: brand.name },
    });
    return brand;
  }

  async deleteBrand(businessId: string, userId: string, brandId: string): Promise<void> {
    await this.requireProductManage(businessId, userId);
    await this.repos.inventory.deleteBrand(businessId, brandId);
    await this.audits.log({
      businessId,
      userId,
      action: "brand.deleted",
      entityType: "brand",
      entityId: brandId,
    });
  }

  async listVariants(businessId: string, productId?: string) {
    return this.repos.products.listVariants(businessId, productId);
  }

  async createVariant(
    businessId: string,
    userId: string,
    input: {
      productId: string;
      sku?: string | null;
      barcode?: string | null;
      attributes?: Record<string, string | number | boolean | null>;
      salePrice?: number | null;
      purchasePrice?: number | null;
      mrp?: number | null;
    }
  ) {
    await this.requireProductManage(businessId, userId);
    const variant = await this.repos.products.createVariant(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "variant.created",
      entityType: "product_variant",
      entityId: variant.id,
      metadata: { productId: input.productId, sku: variant.sku },
    });
    return variant;
  }

  async updateVariant(
    businessId: string,
    userId: string,
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
  ) {
    await this.requireProductManage(businessId, userId);
    const variant = await this.repos.products.updateVariant(businessId, variantId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "variant.updated",
      entityType: "product_variant",
      entityId: variantId,
      metadata: { sku: variant.sku },
    });
    return variant;
  }

  async deleteVariant(businessId: string, userId: string, variantId: string): Promise<void> {
    await this.requireProductManage(businessId, userId);
    await this.repos.products.deleteVariant(businessId, variantId);
    await this.audits.log({
      businessId,
      userId,
      action: "variant.deleted",
      entityType: "product_variant",
      entityId: variantId,
    });
  }

  async listImages(businessId: string, productId?: string) {
    return this.repos.products.listImages(businessId, productId);
  }

  async addImage(
    businessId: string,
    userId: string,
    input: {
      productId: string;
      variantId?: string | null;
      storagePath: string;
      url: string;
      position?: number;
      isPrimary?: boolean;
    }
  ) {
    await this.requireProductManage(businessId, userId);
    const image = await this.repos.products.addImage(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "product_image.added",
      entityType: "product_image",
      entityId: image.id,
      metadata: { productId: input.productId },
    });
    return image;
  }

  async removeImage(businessId: string, userId: string, imageId: string): Promise<void> {
    await this.requireProductManage(businessId, userId);
    await this.repos.products.removeImage(businessId, imageId);
    await this.audits.log({
      businessId,
      userId,
      action: "product_image.removed",
      entityType: "product_image",
      entityId: imageId,
    });
  }

  async createCategory(
    businessId: string,
    userId: string,
    input: { name: string; description?: string | null; parentId?: string | null }
  ): Promise<Category> {
    await this.requireProductManage(businessId, userId);
    if (!input.name.trim()) {
      throw AppError.validation("Category name is required.");
    }
    const category = await this.repos.products.createCategory(businessId, {
      name: input.name.trim(),
      description: input.description || null,
      parentId: input.parentId || null,
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
    await this.requireProductManage(businessId, userId);
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
      description: data.description || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId || null,
      brandId: data.brandId || null,
      unitId: data.unitId || null,
      unit: data.unit || "pcs",
      packUnitId: data.packUnitId || null,
      packUnit: data.packUnit || null,
      unitsPerPack: data.unitsPerPack ?? 1,
      minSaleQty: data.minSaleQty ?? 1,
      maxSaleQty: data.maxSaleQty ?? null,
      allowBaseSale: data.allowBaseSale ?? true,
      allowPackSale: data.allowPackSale ?? false,
      allowPackPurchase: data.allowPackPurchase ?? true,
      fixedPacking: data.fixedPacking ?? true,
      attributes: data.attributes ?? {},
      gstRate: data.gstRate ?? 0,
      hsn: data.hsn || null,
      purchasePrice: data.purchasePrice ?? 0,
      salePrice: data.salePrice ?? 0,
      mrp: null,
      lowStockThreshold: data.lowStockThreshold ?? 0,
      minStock: data.minStock ?? 0,
      maxStock: data.maxStock ?? null,
      reorderLevel: data.reorderLevel ?? 0,
      trackInventory: data.trackInventory ?? true,
      taxable: data.taxable ?? true,
      productStatus: data.productStatus ?? "active",
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
    await this.requireProductManage(businessId, userId);
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
      description: data.description || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId || null,
      brandId: data.brandId || null,
      unitId: data.unitId || null,
      unit: data.unit || "pcs",
      packUnitId: data.packUnitId || null,
      packUnit: data.packUnit || null,
      unitsPerPack: data.unitsPerPack ?? 1,
      minSaleQty: data.minSaleQty ?? 1,
      maxSaleQty: data.maxSaleQty ?? null,
      allowBaseSale: data.allowBaseSale ?? true,
      allowPackSale: data.allowPackSale ?? false,
      allowPackPurchase: data.allowPackPurchase ?? true,
      fixedPacking: data.fixedPacking ?? true,
      attributes: data.attributes ?? {},
      gstRate: data.gstRate ?? 0,
      hsn: data.hsn || null,
      purchasePrice: data.purchasePrice ?? 0,
      salePrice: data.salePrice ?? 0,
      mrp: null,
      lowStockThreshold: data.lowStockThreshold ?? 0,
      minStock: data.minStock ?? 0,
      maxStock: data.maxStock ?? null,
      reorderLevel: data.reorderLevel ?? 0,
      trackInventory: data.trackInventory ?? true,
      taxable: data.taxable ?? true,
      productStatus: data.productStatus ?? "active",
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
    await this.requireProductManage(businessId, userId);
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
   * Records a stock movement. Delegates to the InventoryService so there is a
   * single authoritative business-logic layer for stock calculations.
   */
  async adjustStock(businessId: string, userId: string, input: StockAdjustmentInput): Promise<void> {
    await this.inventory.adjustStock(businessId, userId, {
      productId: input.productId,
      change: input.change,
      reason: input.reason,
      notes: input.notes ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
    });
  }
}
