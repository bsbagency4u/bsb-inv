import type { Repositories } from "@/repositories/types";
import type { StockBalance, StockMovement } from "@/types/domain";
import { AppError } from "@/lib/errors";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";
import { AuthorizationService } from "./authorization.service";

export interface OpeningStockInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  costPrice: number;
  warehouseId?: string | null;
  locationId?: string | null;
  date?: string;
  notes?: string | null;
}

export interface StockAdjustmentInput {
  productId: string;
  variantId?: string | null;
  change: number;
  reason?: string;
  warehouseId?: string | null;
  locationId?: string | null;
  notes?: string | null;
}

export interface StockTransferInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  fromWarehouseId: string;
  fromLocationId?: string | null;
  toWarehouseId: string;
  toLocationId?: string | null;
  notes?: string | null;
}

export interface ScrapInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  warehouseId?: string | null;
  locationId?: string | null;
  reason?: string;
  notes?: string | null;
}

export interface StockValuationRow {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  costPrice: number;
  stockValue: number;
}

/**
 * Inventory business logic — the single authoritative layer for stock
 * calculations. UI components never compute stock directly; every stock
 * movement (opening, adjustment, transfer, scrap) is written through this
 * service as an append-only ledger entry, and current stock is always
 * derived by summing the ledger.
 */
export class InventoryService {
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
  }

  private requireInventoryManage(businessId: string, userId: string): Promise<void> {
    return this.auth.requirePermission(businessId, userId, "inventory.manage");
  }

  async listBalances(businessId: string, productId?: string): Promise<StockBalance[]> {
    return this.repos.products.listBalances(businessId, productId);
  }

  async listMovements(businessId: string, productId?: string, limit = 100): Promise<StockMovement[]> {
    return this.repos.products.listMovements(businessId, productId, limit);
  }

  async listWarehouses(businessId: string) {
    return this.repos.inventory.listWarehouses(businessId);
  }

  async createWarehouse(businessId: string, userId: string, input: { name: string; code: string; address?: string | null }) {
    await this.requireInventoryManage(businessId, userId);
    const warehouse = await this.repos.inventory.createWarehouse(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "warehouse.created",
      entityType: "warehouse",
      entityId: warehouse.id,
      metadata: { name: warehouse.name, code: warehouse.code },
    });
    return warehouse;
  }

  async updateWarehouse(
    businessId: string,
    userId: string,
    warehouseId: string,
    input: { name?: string; code?: string; address?: string | null; isActive?: boolean }
  ) {
    await this.requireInventoryManage(businessId, userId);
    const warehouse = await this.repos.inventory.updateWarehouse(businessId, warehouseId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "warehouse.updated",
      entityType: "warehouse",
      entityId: warehouseId,
      metadata: { name: warehouse.name },
    });
    return warehouse;
  }

  async deleteWarehouse(businessId: string, userId: string, warehouseId: string): Promise<void> {
    await this.requireInventoryManage(businessId, userId);
    await this.repos.inventory.deleteWarehouse(businessId, warehouseId);
    await this.audits.log({
      businessId,
      userId,
      action: "warehouse.deleted",
      entityType: "warehouse",
      entityId: warehouseId,
    });
  }

  async listLocations(businessId: string, warehouseId?: string) {
    return this.repos.inventory.listLocations(businessId, warehouseId);
  }

  async createLocation(
    businessId: string,
    userId: string,
    input: { warehouseId: string; name: string; code: string; parentId?: string | null }
  ) {
    await this.requireInventoryManage(businessId, userId);
    const location = await this.repos.inventory.createLocation(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "location.created",
      entityType: "stock_location",
      entityId: location.id,
      metadata: { name: location.name, warehouseId: input.warehouseId },
    });
    return location;
  }

  async updateLocation(
    businessId: string,
    userId: string,
    locationId: string,
    input: { name?: string; code?: string; parentId?: string | null; isActive?: boolean }
  ) {
    await this.requireInventoryManage(businessId, userId);
    const location = await this.repos.inventory.updateLocation(businessId, locationId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "location.updated",
      entityType: "stock_location",
      entityId: locationId,
      metadata: { name: location.name },
    });
    return location;
  }

  async deleteLocation(businessId: string, userId: string, locationId: string): Promise<void> {
    await this.requireInventoryManage(businessId, userId);
    await this.repos.inventory.deleteLocation(businessId, locationId);
    await this.audits.log({
      businessId,
      userId,
      action: "location.deleted",
      entityType: "stock_location",
      entityId: locationId,
    });
  }

  private async ensureProduct(businessId: string, productId: string) {
    const product = await this.repos.products.getProduct(businessId, productId);
    if (!product) throw AppError.notFound("Product not found.");
    return product;
  }

  /** Opening stock: records an OPENING ledger entry with the cost basis. */
  async recordOpeningStock(
    businessId: string,
    userId: string,
    input: OpeningStockInput
  ): Promise<StockMovement> {
    await this.requireInventoryManage(businessId, userId);
    const product = await this.ensureProduct(businessId, input.productId);
    if (input.quantity < 0) {
      throw AppError.validation("Opening stock quantity cannot be negative.");
    }

    const movement = await this.addLedgerEntry(businessId, userId, {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity,
      movementType: "OPENING",
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      notes:
        input.notes ??
        `Opening stock${input.costPrice > 0 ? ` at cost ${input.costPrice}` : ""}`,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "stock.opening",
      entityType: "product",
      entityId: input.productId,
      metadata: {
        quantity: input.quantity,
        costPrice: input.costPrice,
        product: product.name,
      },
    });
    return movement;
  }

  /** Adjusts current stock up or down (ADJUSTMENT movement). */
  async adjustStock(
    businessId: string,
    userId: string,
    input: StockAdjustmentInput
  ): Promise<StockMovement> {
    await this.requireInventoryManage(businessId, userId);
    const product = await this.ensureProduct(businessId, input.productId);
    if (!Number.isFinite(input.change) || input.change === 0) {
      throw AppError.validation("Adjustment quantity must be a non-zero number.");
    }

    const movement = await this.addLedgerEntry(businessId, userId, {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.change,
      movementType: "ADJUSTMENT",
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      notes: input.notes ?? undefined,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "stock.adjusted",
      entityType: "product",
      entityId: input.productId,
      metadata: { change: input.change, reason: input.reason, product: product.name },
    });

    if (input.change < 0) {
      await this.notifyIfLow(businessId, input.productId);
    }
    return movement;
  }

  /** Transfers stock between warehouses/locations: TRANSFER_OUT + TRANSFER_IN. */
  async transferStock(
    businessId: string,
    userId: string,
    input: StockTransferInput
  ): Promise<StockMovement[]> {
    await this.requireInventoryManage(businessId, userId);
    const product = await this.ensureProduct(businessId, input.productId);
    if (input.quantity <= 0) {
      throw AppError.validation("Transfer quantity must be positive.");
    }
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw AppError.validation("Source and destination warehouses must differ.");
    }

    const referenceId = `transfer-${Date.now()}`;
    const out = await this.addLedgerEntry(businessId, userId, {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: -input.quantity,
      movementType: "TRANSFER_OUT",
      warehouseId: input.fromWarehouseId,
      locationId: input.fromLocationId ?? null,
      referenceType: "transfer",
      referenceId,
      notes: input.notes ?? undefined,
    });
    const inMovement = await this.addLedgerEntry(businessId, userId, {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity,
      movementType: "TRANSFER_IN",
      warehouseId: input.toWarehouseId,
      locationId: input.toLocationId ?? null,
      referenceType: "transfer",
      referenceId,
      notes: input.notes ?? undefined,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "stock.transferred",
      entityType: "product",
      entityId: input.productId,
      metadata: {
        quantity: input.quantity,
        from: input.fromWarehouseId,
        to: input.toWarehouseId,
        product: product.name,
      },
    });
    return [out, inMovement];
  }

  /** Writes off damaged/waste stock as a SCRAP movement. */
  async scrapStock(businessId: string, userId: string, input: ScrapInput): Promise<StockMovement> {
    await this.requireInventoryManage(businessId, userId);
    const product = await this.ensureProduct(businessId, input.productId);
    if (input.quantity <= 0) {
      throw AppError.validation("Scrap quantity must be positive.");
    }

    const movement = await this.addLedgerEntry(businessId, userId, {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: -input.quantity,
      movementType: "SCRAP",
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      notes: input.notes ?? input.reason ?? undefined,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "stock.scrapped",
      entityType: "product",
      entityId: input.productId,
      metadata: { quantity: input.quantity, reason: input.reason, product: product.name },
    });
    await this.notifyIfLow(businessId, input.productId);
    return movement;
  }

  /** Inventory valuation by cost price. */
  async valuation(businessId: string): Promise<StockValuationRow[]> {
    const [products, stock] = await Promise.all([
      this.repos.products.listProducts(businessId),
      this.repos.products.listStock(businessId),
    ]);
    const byProduct = new Map(stock.map((s) => [s.productId, s.quantity]));
    return products
      .map((product) => {
        const quantity = byProduct.get(product.id) ?? 0;
        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          costPrice: product.purchasePrice,
          stockValue: quantity * product.purchasePrice,
        };
      })
      .sort((a, b) => b.stockValue - a.stockValue);
  }

  private async addLedgerEntry(
    businessId: string,
    userId: string,
    input: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      movementType: "OPENING" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "SCRAP";
      warehouseId?: string | null;
      locationId?: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
      notes?: string | null;
    }
  ): Promise<StockMovement> {
    const movement: StockMovement = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      batchId: null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      toWarehouseId: null,
      toLocationId: null,
      change: input.quantity,
      movementType: input.movementType,
      reason: input.movementType.toLowerCase(),
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.repos.products.addStockMovement({
      businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      change: input.quantity,
      movementType: input.movementType,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      userId,
    });
    return movement;
  }

  private async notifyIfLow(businessId: string, productId: string): Promise<void> {
    const product = await this.repos.products.getProduct(businessId, productId);
    if (!product || product.lowStockThreshold <= 0) return;
    const balances = await this.repos.products.listBalances(businessId, productId);
    const total = balances.reduce((sum, b) => sum + b.quantity, 0);
    if (total <= product.lowStockThreshold) {
      await this.notifications.create(businessId, {
        title: `Low stock: ${product.name}`,
        description: `Only ${total} ${product.unit} remaining (threshold ${product.lowStockThreshold}).`,
        type: "warning",
        href: "/inventory/stock",
      });
    }
  }

  /** Stock OUT on a completed sale (SALE movement). */
  async recordSaleMovement(
    businessId: string,
    userId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    referenceId?: string | null
  ): Promise<void> {
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      change: -quantity,
      movementType: "SALE",
      reason: "sale",
      referenceType: "sales_invoice",
      referenceId: referenceId ?? null,
      userId,
    });
    await this.notifyIfLow(businessId, productId);
  }

  /** Stock IN when goods are received / a purchase bill is recorded. */
  async recordPurchaseMovement(
    businessId: string,
    userId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    referenceId?: string | null,
    referenceType?: "purchase_receipt" | "purchase_invoice"
  ): Promise<void> {
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      change: quantity,
      movementType: "PURCHASE",
      reason: "purchase",
      referenceType: referenceType ?? "purchase_invoice",
      referenceId: referenceId ?? null,
      userId,
    });
  }

  /** Stock movement for returns: +quantity restores stock, -quantity removes it. */
  async recordReturnMovement(
    businessId: string,
    userId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    referenceId?: string | null
  ): Promise<void> {
    // Sale returns and cancelled sales restore stock (+), purchase returns
    // send stock back to the supplier (-). The sign is decided by the caller
    // through the sign of quantity.
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      change: quantity,
      movementType: quantity < 0 ? "PURCHASE_RETURN" : "SALE_RETURN",
      reason: "return",
      referenceType: "return",
      referenceId: referenceId ?? null,
      userId,
    });
    await this.notifyIfLow(businessId, productId);
  }
}
