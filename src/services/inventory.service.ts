import type { Repositories } from "@/repositories/types";
import type {
  LocationUpdateInput,
  LocationWriteInput,
  ProductSerialWriteInput,
  WarehouseUpdateInput,
  WarehouseWriteInput,
} from "@/repositories/inventory.repository";
import type {
  InventoryDefaults,
  ProductSerial,
  SellableLot,
  StockAdjustment,
  StockAdjustmentReasonCode,
  StockAvailability,
  StockBalance,
  StockCountItem,
  StockCountSession,
  StockLocationKind,
  StockMovement,
  StockReservation,
  StockTransfer,
  StockTransferItem,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import { INVENTORY_SETTINGS_KEY, isBlockedLocationKind, parseInventoryDefaults } from "@/lib/inventory-settings";
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

export interface TransferRequestInput {
  fromWarehouseId: string;
  fromLocationId?: string | null;
  toWarehouseId: string;
  toLocationId?: string | null;
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

export interface TransferReceiveInput {
  items: Array<{ itemId: string; receivedQuantity: number }>;
  shortageReason?: string | null;
}

export interface AdjustmentRequestInput {
  reason: StockAdjustmentReasonCode;
  warehouseId?: string | null;
  locationId?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    batchId?: string | null;
    change: number;
    unit?: string | null;
    notes?: string | null;
  }>;
}

export interface CountSessionInput {
  warehouseId: string;
  locationId?: string | null;
  notes?: string | null;
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

export interface ReservationInput {
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  quantity: number;
  referenceType: string;
  referenceId: string;
  notes?: string | null;
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

  /**
   * On-hand lots with MRP resolved from batch, then variant, then product master.
   * FEFO (earliest expiry) then FIFO (batch number / oldest lot).
   */
  async listSellableLots(
    businessId: string,
    filter?: { productId?: string; variantId?: string | null; warehouseId?: string | null }
  ): Promise<SellableLot[]> {
    const [balances, batches, products, variants, availability] = await Promise.all([
      this.repos.products.listBalances(businessId, filter?.productId),
      this.repos.products.listBatches(businessId, filter?.productId),
      filter?.productId
        ? this.repos.products.getProduct(businessId, filter.productId).then((product) => (product ? [product] : []))
        : this.repos.products.listProducts(businessId),
      this.repos.products.listVariants(businessId, filter?.productId),
      this.listAvailability(businessId, { productId: filter?.productId, warehouseId: filter?.warehouseId }),
    ]);
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const availableByKey = new Map(
      availability.map((row) => [
        `${row.productId}|${row.warehouseId ?? ""}|${row.locationId ?? ""}|${row.batchId ?? ""}`,
        row.available,
      ])
    );

    const lots: SellableLot[] = [];
    for (const balance of balances) {
      if (balance.quantity <= 0) continue;
      if (filter?.variantId !== undefined && (balance.variantId ?? null) !== (filter.variantId ?? null)) continue;
      if (filter?.warehouseId && balance.warehouseId && balance.warehouseId !== filter.warehouseId) continue;
      const available =
        availableByKey.get(
          `${balance.productId}|${balance.warehouseId ?? ""}|${balance.locationId ?? ""}|${balance.batchId ?? ""}`
        ) ?? Math.max(0, balance.quantity);
      if (available <= 0) continue;
      const batch = balance.batchId ? batchById.get(balance.batchId) : undefined;
      const product = productById.get(balance.productId);
      const variant = balance.variantId ? variantById.get(balance.variantId) : undefined;
      lots.push({
        productId: balance.productId,
        variantId: balance.variantId,
        batchId: balance.batchId,
        batchNo: batch?.batchNo ?? null,
        expiryDate: batch?.expiryDate ?? null,
        mrp: batch?.mrp ?? variant?.mrp ?? product?.mrp ?? null,
        purchasePrice: batch?.purchasePrice ?? variant?.purchasePrice ?? product?.purchasePrice ?? null,
        quantity: available,
        warehouseId: balance.warehouseId,
        locationId: balance.locationId,
      });
    }

    lots.sort((a, b) => {
      const expiryA = a.expiryDate || "9999-99-99";
      const expiryB = b.expiryDate || "9999-99-99";
      if (expiryA !== expiryB) return expiryA.localeCompare(expiryB);
      return (a.batchNo || "").localeCompare(b.batchNo || "");
    });
    return lots;
  }

  async listWarehouses(businessId: string) {
    return this.repos.inventory.listWarehouses(businessId);
  }

  async getInventoryDefaults(businessId: string): Promise<InventoryDefaults> {
    const stored = await this.repos.businesses.getSetting(businessId, INVENTORY_SETTINGS_KEY);
    return parseInventoryDefaults(stored);
  }

  async createWarehouse(businessId: string, userId: string, input: WarehouseWriteInput) {
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
    input: WarehouseUpdateInput
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

  async createLocation(businessId: string, userId: string, input: LocationWriteInput) {
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
    input: LocationUpdateInput
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

  async listWarehouseAssignments(businessId: string, warehouseId?: string) {
    return this.repos.inventory.listWarehouseAssignments(businessId, warehouseId);
  }

  async setWarehouseAssignments(businessId: string, userId: string, warehouseId: string, memberIds: string[]) {
    await this.requireInventoryManage(businessId, userId);
    return this.repos.inventory.setWarehouseAssignments(businessId, warehouseId, memberIds);
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

  async listAvailability(
    businessId: string,
    filter?: { productId?: string; warehouseId?: string | null }
  ): Promise<StockAvailability[]> {
    const [balances, reservations, locations, transfers] = await Promise.all([
      this.repos.products.listBalances(businessId, filter?.productId),
      this.repos.inventory.listReservations(businessId, { productId: filter?.productId, status: "open" }),
      this.repos.inventory.listLocations(businessId),
      this.repos.inventory.listTransfers(businessId),
    ]);
    const blockedIds = new Set(locations.filter((l) => isBlockedLocationKind(l.kind as StockLocationKind)).map((l) => l.id));
    const rows = new Map<string, StockAvailability>();
    const keyOf = (productId: string, warehouseId: string | null, locationId: string | null, batchId: string | null) =>
      `${productId}|${warehouseId ?? ""}|${locationId ?? ""}|${batchId ?? ""}`;
    const ensure = (productId: string, warehouseId: string | null, locationId: string | null, batchId: string | null) => {
      const key = keyOf(productId, warehouseId, locationId, batchId);
      const current = rows.get(key);
      if (current) return current;
      const next: StockAvailability = {
        productId,
        warehouseId,
        locationId,
        batchId,
        physical: 0,
        reserved: 0,
        inTransit: 0,
        blocked: 0,
        available: 0,
      };
      rows.set(key, next);
      return next;
    };
    for (const balance of balances) {
      if (filter?.warehouseId && balance.warehouseId && balance.warehouseId !== filter.warehouseId) continue;
      const row = ensure(balance.productId, balance.warehouseId, balance.locationId, balance.batchId);
      row.physical += balance.quantity;
      if (balance.locationId && blockedIds.has(balance.locationId)) row.blocked += Math.max(0, balance.quantity);
    }
    for (const reservation of reservations) {
      if (filter?.warehouseId && reservation.warehouseId && reservation.warehouseId !== filter.warehouseId) continue;
      const row = ensure(reservation.productId, reservation.warehouseId, reservation.locationId, reservation.batchId);
      row.reserved += reservation.quantity;
    }
    for (const transfer of transfers) {
      if (transfer.status !== "dispatched" && transfer.status !== "in_transit" && transfer.status !== "partially_received") continue;
      for (const item of transfer.items) {
        if (filter?.productId && item.productId !== filter.productId) continue;
        const outstanding = Math.max(0, item.dispatchedQuantity - item.receivedQuantity - item.shortageQuantity);
        if (outstanding <= 0) continue;
        const row = ensure(item.productId, transfer.fromWarehouseId, transfer.fromLocationId, item.batchId);
        row.inTransit += outstanding;
      }
    }
    for (const row of rows.values()) {
      const sellable = Math.max(0, row.physical - row.blocked);
      row.available = Math.max(0, sellable - row.reserved);
    }
    return Array.from(rows.values());
  }

  async listTransfers(businessId: string): Promise<StockTransfer[]> {
    return this.repos.inventory.listTransfers(businessId);
  }

  async getTransfer(businessId: string, transferId: string): Promise<StockTransfer> {
    const transfer = await this.repos.inventory.getTransfer(businessId, transferId);
    if (!transfer) throw AppError.notFound("Transfer not found.");
    return transfer;
  }

  async requestTransfer(businessId: string, userId: string, input: TransferRequestInput): Promise<StockTransfer> {
    await this.requireInventoryManage(businessId, userId);
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw AppError.validation("Source and destination warehouses must differ.");
    }
    if (input.items.length === 0) throw AppError.validation("Add at least one transfer line.");
    for (const item of input.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw AppError.validation("Transfer quantity must be positive.");
      }
      await this.ensureProduct(businessId, item.productId);
    }
    const settings = await this.getInventoryDefaults(businessId);
    const transferNo = await this.repos.transactions.nextDocumentNumber(businessId, "stock_transfer", "TRF");
    const transfer = await this.repos.inventory.createTransfer(businessId, {
      transferNo,
      status: settings.transferApproval ? "requested" : "approved",
      fromWarehouseId: input.fromWarehouseId,
      fromLocationId: input.fromLocationId ?? null,
      toWarehouseId: input.toWarehouseId,
      toLocationId: input.toLocationId ?? null,
      requestedBy: userId,
      notes: input.notes ?? null,
      items: input.items,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.transfer.requested",
      entityType: "stock_transfer",
      entityId: transfer.id,
      metadata: { transferNo, from: input.fromWarehouseId, to: input.toWarehouseId },
    });
    return transfer;
  }

  async approveTransfer(businessId: string, userId: string, transferId: string): Promise<StockTransfer> {
    await this.requireInventoryManage(businessId, userId);
    const transfer = await this.getTransfer(businessId, transferId);
    if (transfer.status !== "requested" && transfer.status !== "draft") {
      throw AppError.validation("Only requested transfers can be approved.");
    }
    const updated = await this.repos.inventory.updateTransfer(businessId, transferId, { status: "approved" });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.transfer.approved",
      entityType: "stock_transfer",
      entityId: transferId,
      metadata: { transferNo: transfer.transferNo },
    });
    return updated;
  }

  async dispatchTransfer(businessId: string, userId: string, transferId: string): Promise<StockTransfer> {
    await this.requireInventoryManage(businessId, userId);
    const transfer = await this.getTransfer(businessId, transferId);
    if (transfer.status !== "approved" && transfer.status !== "requested" && transfer.status !== "draft") {
      throw AppError.validation("This transfer cannot be dispatched.");
    }
    const now = new Date().toISOString();
    const nextItems: StockTransferItem[] = [];
    for (const item of transfer.items) {
      await this.addLedgerEntry(businessId, userId, {
        productId: item.productId,
        variantId: item.variantId,
        batchId: item.batchId,
        quantity: -item.quantity,
        movementType: "TRANSFER_OUT",
        warehouseId: transfer.fromWarehouseId,
        locationId: transfer.fromLocationId,
        toWarehouseId: transfer.toWarehouseId,
        toLocationId: transfer.toLocationId,
        referenceType: "stock_transfer",
        referenceId: transfer.id,
        notes: transfer.notes,
      });
      nextItems.push({ ...item, dispatchedQuantity: item.quantity });
    }
    const updated = await this.repos.inventory.updateTransfer(businessId, transferId, {
      status: "in_transit",
      dispatchedBy: userId,
      dispatchedAt: now,
      items: nextItems,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.transfer.dispatched",
      entityType: "stock_transfer",
      entityId: transferId,
      metadata: { transferNo: transfer.transferNo },
    });
    return updated;
  }

  async receiveTransfer(businessId: string, userId: string, transferId: string, input: TransferReceiveInput): Promise<StockTransfer> {
    await this.requireInventoryManage(businessId, userId);
    const transfer = await this.getTransfer(businessId, transferId);
    if (transfer.status !== "in_transit" && transfer.status !== "dispatched" && transfer.status !== "partially_received") {
      throw AppError.validation("This transfer is not waiting to be received.");
    }
    const receivedById = new Map(input.items.map((row) => [row.itemId, row.receivedQuantity]));
    const now = new Date().toISOString();
    const nextItems: StockTransferItem[] = [];
    let remaining = 0;
    for (const item of transfer.items) {
      const incoming = receivedById.get(item.id);
      const extra = incoming === undefined ? 0 : incoming;
      if (extra < 0) throw AppError.validation("Received quantity cannot be negative.");
      const receivedQuantity = item.receivedQuantity + extra;
      if (receivedQuantity > item.dispatchedQuantity) {
        throw AppError.validation("Cannot receive more than dispatched quantity.");
      }
      if (extra > 0) {
        await this.addLedgerEntry(businessId, userId, {
          productId: item.productId,
          variantId: item.variantId,
          batchId: item.batchId,
          quantity: extra,
          movementType: "TRANSFER_IN",
          warehouseId: transfer.toWarehouseId,
          locationId: transfer.toLocationId,
          referenceType: "stock_transfer",
          referenceId: transfer.id,
          notes: transfer.notes,
        });
      }
      const shortageQuantity = item.dispatchedQuantity - receivedQuantity;
      remaining += shortageQuantity;
      nextItems.push({ ...item, receivedQuantity, shortageQuantity });
    }
    const fullyReceived = remaining === 0;
    const updated = await this.repos.inventory.updateTransfer(businessId, transferId, {
      status: fullyReceived ? "completed" : "partially_received",
      receivedBy: userId,
      receivedAt: fullyReceived ? now : transfer.receivedAt,
      shortageReason: fullyReceived ? transfer.shortageReason : input.shortageReason ?? transfer.shortageReason,
      items: nextItems,
    });
    await this.audits.log({
      businessId,
      userId,
      action: fullyReceived ? "stock.transfer.received" : "stock.transfer.partially_received",
      entityType: "stock_transfer",
      entityId: transferId,
      metadata: { transferNo: transfer.transferNo },
    });
    return updated;
  }

  async cancelTransfer(businessId: string, userId: string, transferId: string): Promise<StockTransfer> {
    await this.requireInventoryManage(businessId, userId);
    const transfer = await this.getTransfer(businessId, transferId);
    if (transfer.status === "completed" || transfer.status === "cancelled") {
      throw AppError.validation("This transfer can no longer be cancelled.");
    }
    if (transfer.status === "in_transit" || transfer.status === "dispatched" || transfer.status === "partially_received") {
      throw AppError.validation("In-transit transfers must be received or shorted, not cancelled.");
    }
    const updated = await this.repos.inventory.updateTransfer(businessId, transferId, { status: "cancelled" });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.transfer.cancelled",
      entityType: "stock_transfer",
      entityId: transferId,
      metadata: { transferNo: transfer.transferNo },
    });
    return updated;
  }

  async listAdjustments(businessId: string): Promise<StockAdjustment[]> {
    return this.repos.inventory.listAdjustments(businessId);
  }

  async requestAdjustment(businessId: string, userId: string, input: AdjustmentRequestInput): Promise<StockAdjustment> {
    await this.requireInventoryManage(businessId, userId);
    if (input.items.length === 0) throw AppError.validation("Add at least one adjustment line.");
    for (const item of input.items) {
      if (!Number.isFinite(item.change) || item.change === 0) {
        throw AppError.validation("Adjustment quantity must be a non-zero number.");
      }
      await this.ensureProduct(businessId, item.productId);
    }
    const settings = await this.getInventoryDefaults(businessId);
    const adjustmentNo = await this.repos.transactions.nextDocumentNumber(businessId, "stock_adjustment", "ADJ");
    const adjustment = await this.repos.inventory.createAdjustment(businessId, {
      adjustmentNo,
      status: settings.adjustmentApproval ? "pending_approval" : "draft",
      reason: input.reason,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
      requestedBy: userId,
      items: input.items,
    });
    if (!settings.adjustmentApproval) {
      return this.postAdjustment(businessId, userId, adjustment.id);
    }
    await this.audits.log({
      businessId,
      userId,
      action: "stock.adjustment.requested",
      entityType: "stock_adjustment",
      entityId: adjustment.id,
      metadata: { adjustmentNo, reason: input.reason },
    });
    return adjustment;
  }

  async postAdjustment(businessId: string, userId: string, adjustmentId: string): Promise<StockAdjustment> {
    await this.requireInventoryManage(businessId, userId);
    const adjustment = await this.repos.inventory.getAdjustment(businessId, adjustmentId);
    if (!adjustment) throw AppError.notFound("Adjustment not found.");
    if (adjustment.status === "posted") return adjustment;
    if (adjustment.status === "cancelled") throw AppError.validation("Cancelled adjustments cannot be posted.");
    for (const item of adjustment.items) {
      await this.addLedgerEntry(businessId, userId, {
        productId: item.productId,
        variantId: item.variantId,
        batchId: item.batchId,
        quantity: item.change,
        movementType: "ADJUSTMENT",
        warehouseId: adjustment.warehouseId,
        locationId: adjustment.locationId,
        referenceType: "stock_adjustment",
        referenceId: adjustment.id,
        notes: item.notes ?? adjustment.notes,
      });
      if (item.change < 0) await this.notifyIfLow(businessId, item.productId);
    }
    const updated = await this.repos.inventory.updateAdjustment(businessId, adjustmentId, {
      status: "posted",
      approvedBy: userId,
      postedAt: new Date().toISOString(),
    });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.adjustment.posted",
      entityType: "stock_adjustment",
      entityId: adjustmentId,
      metadata: { adjustmentNo: adjustment.adjustmentNo, reason: adjustment.reason },
    });
    return updated;
  }

  async listCounts(businessId: string): Promise<StockCountSession[]> {
    return this.repos.inventory.listCounts(businessId);
  }

  async createCountSession(businessId: string, userId: string, input: CountSessionInput): Promise<StockCountSession> {
    await this.requireInventoryManage(businessId, userId);
    if (input.items.length === 0) throw AppError.validation("Add at least one counted item.");
    const countNo = await this.repos.transactions.nextDocumentNumber(businessId, "stock_count", "CNT");
    const session = await this.repos.inventory.createCount(businessId, {
      countNo,
      status: "counting",
      warehouseId: input.warehouseId,
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
      countedBy: userId,
      items: input.items,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.count.created",
      entityType: "stock_count",
      entityId: session.id,
      metadata: { countNo, warehouseId: input.warehouseId },
    });
    return session;
  }

  async saveCountQuantities(
    businessId: string,
    userId: string,
    countId: string,
    items: StockCountItem[]
  ): Promise<StockCountSession> {
    await this.requireInventoryManage(businessId, userId);
    const session = await this.repos.inventory.getCount(businessId, countId);
    if (!session) throw AppError.notFound("Count session not found.");
    if (session.status === "posted" || session.status === "cancelled") {
      throw AppError.validation("Posted counts cannot be edited.");
    }
    return this.repos.inventory.updateCount(businessId, countId, { status: "review", countedBy: userId, items });
  }

  async postCount(businessId: string, userId: string, countId: string): Promise<StockCountSession> {
    await this.requireInventoryManage(businessId, userId);
    const session = await this.repos.inventory.getCount(businessId, countId);
    if (!session) throw AppError.notFound("Count session not found.");
    if (session.status === "posted") return session;
    if (session.status === "cancelled") throw AppError.validation("Cancelled counts cannot be posted.");
    for (const item of session.items) {
      if (item.countedQuantity === null || item.countedQuantity === undefined) {
        throw AppError.validation("Every counted line needs a quantity before posting.");
      }
      const change = item.countedQuantity - item.systemQuantity;
      if (change === 0) continue;
      await this.addLedgerEntry(businessId, userId, {
        productId: item.productId,
        variantId: item.variantId,
        batchId: item.batchId,
        quantity: change,
        movementType: "COUNT",
        warehouseId: session.warehouseId,
        locationId: session.locationId,
        referenceType: "stock_count",
        referenceId: session.id,
        notes: item.notes ?? session.notes,
      });
    }
    const updated = await this.repos.inventory.updateCount(businessId, countId, {
      status: "posted",
      approvedBy: userId,
      postedAt: new Date().toISOString(),
    });
    await this.audits.log({
      businessId,
      userId,
      action: "stock.count.posted",
      entityType: "stock_count",
      entityId: countId,
      metadata: { countNo: session.countNo },
    });
    return updated;
  }

  async listReservations(businessId: string, productId?: string): Promise<StockReservation[]> {
    return this.repos.inventory.listReservations(businessId, { productId });
  }

  async reserveStock(businessId: string, userId: string, input: ReservationInput): Promise<StockReservation> {
    await this.requireInventoryManage(businessId, userId);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw AppError.validation("Reservation quantity must be positive.");
    }
    await this.ensureProduct(businessId, input.productId);
    const availability = await this.listAvailability(businessId, {
      productId: input.productId,
      warehouseId: input.warehouseId,
    });
    const available = availability.reduce((sum, row) => {
      if (input.batchId && row.batchId !== input.batchId) return sum;
      if (input.locationId && row.locationId !== input.locationId) return sum;
      return sum + row.available;
    }, 0);
    const settings = await this.getInventoryDefaults(businessId);
    if (!settings.allowNegativeStock && available < input.quantity) {
      throw AppError.validation("Not enough available stock to reserve.");
    }
    const reservation = await this.repos.inventory.createReservation(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "stock.reserved",
      entityType: "stock_reservation",
      entityId: reservation.id,
      metadata: { productId: input.productId, quantity: input.quantity, referenceId: input.referenceId },
    });
    return reservation;
  }

  async consumeReservation(businessId: string, userId: string, reservationId: string): Promise<StockReservation> {
    await this.requireInventoryManage(businessId, userId);
    return this.repos.inventory.updateReservationStatus(businessId, reservationId, "consumed");
  }

  async releaseReservation(businessId: string, userId: string, reservationId: string): Promise<StockReservation> {
    await this.requireInventoryManage(businessId, userId);
    return this.repos.inventory.updateReservationStatus(businessId, reservationId, "released");
  }

  async listSerials(businessId: string, productId?: string): Promise<ProductSerial[]> {
    return this.repos.inventory.listSerials(businessId, productId);
  }

  async registerSerial(businessId: string, userId: string, input: ProductSerialWriteInput): Promise<ProductSerial> {
    await this.requireInventoryManage(businessId, userId);
    if (!input.serialNo.trim()) throw AppError.validation("Serial number is required.");
    return this.repos.inventory.createSerial(businessId, input);
  }

  private async addLedgerEntry(
    businessId: string,
    userId: string,
    input: {
      productId: string;
      variantId?: string | null;
      batchId?: string | null;
      quantity: number;
      movementType: "OPENING" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "SCRAP" | "COUNT";
      warehouseId?: string | null;
      locationId?: string | null;
      toWarehouseId?: string | null;
      toLocationId?: string | null;
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
      batchId: input.batchId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      toWarehouseId: input.toWarehouseId ?? null,
      toLocationId: input.toLocationId ?? null,
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
      batchId: input.batchId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      toWarehouseId: input.toWarehouseId ?? null,
      toLocationId: input.toLocationId ?? null,
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
    referenceId?: string | null,
    warehouseId?: string | null,
    batchId?: string | null,
    locationId?: string | null
  ): Promise<void> {
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      batchId: batchId ?? null,
      warehouseId: warehouseId ?? null,
      locationId: locationId ?? null,
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
    referenceType?: "purchase_receipt" | "purchase_invoice",
    warehouseId?: string | null,
    batchId?: string | null
  ): Promise<void> {
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      batchId: batchId ?? null,
      warehouseId: warehouseId ?? null,
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
    referenceId?: string | null,
    warehouseId?: string | null,
    batchId?: string | null
  ): Promise<void> {
    await this.repos.products.addStockMovement({
      businessId,
      productId,
      variantId,
      batchId: batchId ?? null,
      warehouseId: warehouseId ?? null,
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
