import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type {
  AuditEvent,
  Product,
  ProductBatch,
  StockAdjustment,
  StockCountSession,
  StockLocation,
  StockReservation,
  StockTransfer,
} from "@/types/domain";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";
import { InventoryService } from "./inventory.service";

function memoryRepositories() {
  const products: Product[] = [];
  const ledger: Array<{ productId: string; change: number; businessId: string; movementType: string; batchId: string | null; warehouseId: string | null; locationId: string | null }> = [];
  const batches: ProductBatch[] = [];
  const auditLogs: AuditEvent[] = [];
  const locations: StockLocation[] = [];
  const transfers: StockTransfer[] = [];
  const adjustments: StockAdjustment[] = [];
  const counts: StockCountSession[] = [];
  const reservations: StockReservation[] = [];
  let docSeq = 0;

  const repos: Repositories = {
    products: {
      async listCategories() { return []; },
      async updateCategory() { throw new Error("not used"); },
      async deleteCategory() {},
      async createCategory() { throw new Error("not used"); },
      async listProducts() { return products; },
      async getProduct(_b, id) { return products.find((p) => p.id === id) ?? null; },
      async createProduct(businessId, _u, input) {
        const product: Product = {
          id: `p-${products.length + 1}`,
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
          allowPackPurchase: input.allowPackPurchase ?? true,
          fixedPacking: input.fixedPacking ?? true,
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
          gstSupplyType: input.gstSupplyType ?? "taxable",
          reverseCharge: input.reverseCharge ?? false,
          productStatus: input.productStatus ?? "active",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        products.push(product);
        return product;
      },
      async updateProduct() { throw new Error("not used"); },
      async deleteProduct() {},
      async listBatches(_b, productId) {
        return batches.filter((batch) => !productId || batch.productId === productId);
      },
      async createBatch(businessId, input) {
        const now = new Date().toISOString();
        const batch: ProductBatch = {
          id: `batch-${batches.length + 1}`,
          businessId,
          productId: input.productId,
          batchNo: input.batchNo,
          manufacturingDate: null,
          expiryDate: input.expiryDate ?? null,
          mrp: input.mrp ?? null,
          purchasePrice: input.purchasePrice ?? null,
          supplierId: null,
          purchaseInvoiceId: null,
          createdAt: now,
          updatedAt: now,
        };
        batches.push(batch);
        return batch;
      },
      async updateBatch() { throw new Error("not used"); },
      async listStock() {
        const byProduct = new Map<string, number>();
        for (const entry of ledger) {
          byProduct.set(entry.productId, (byProduct.get(entry.productId) ?? 0) + entry.change);
        }
        return Array.from(byProduct.entries()).map(([productId, quantity]) => ({
          productId,
          quantity,
          lastMovementAt: null,
        }));
      },
      async listBalances() {
        const map = new Map<string, { productId: string; batchId: string | null; warehouseId: string | null; locationId: string | null; quantity: number }>();
        for (const entry of ledger) {
          const key = `${entry.productId}|${entry.batchId ?? ""}|${entry.warehouseId ?? ""}|${entry.locationId ?? ""}`;
          const current = map.get(key) ?? {
            productId: entry.productId,
            batchId: entry.batchId ?? null,
            warehouseId: entry.warehouseId ?? null,
            locationId: entry.locationId ?? null,
            quantity: 0,
          };
          current.quantity += entry.change;
          map.set(key, current);
        }
        return Array.from(map.values()).map((b) => ({
          productId: b.productId,
          variantId: null,
          batchId: b.batchId,
          warehouseId: b.warehouseId,
          locationId: b.locationId,
          quantity: b.quantity,
          lastMovementAt: null,
        }));
      },
      async listMovementsByReference() { return []; },
      async listMovements() {
        return ledger.map((entry, index) => ({
          id: `mv-${index}`,
          businessId: entry.businessId,
          productId: entry.productId,
          variantId: null,
          batchId: null,
          warehouseId: null,
          locationId: entry.locationId,
          toWarehouseId: null,
          toLocationId: null,
          change: entry.change,
          movementType: entry.movementType as never,
          reason: entry.movementType.toLowerCase(),
          referenceType: null,
          referenceId: null,
          notes: null,
          createdAt: new Date().toISOString(),
        }));
      },
      async addStockMovement(input) {
        ledger.push({
          productId: input.productId,
          change: input.change,
          businessId: input.businessId,
          movementType: input.movementType,
          batchId: input.batchId ?? null,
          warehouseId: input.warehouseId ?? null,
          locationId: input.locationId ?? null,
        });
      },
      async listVariants() { return []; },
      async createVariant() { throw new Error("not used"); },
      async updateVariant() { throw new Error("not used"); },
      async deleteVariant() {},
      async listImages() { return []; },
      async addImage() { throw new Error("not used"); },
      async removeImage() {},
      async listProductsForSearch() { return []; },
      async listStockForSearch() { return []; },
    },
    inventory: {
      async listUnits() { return []; },
      async createUnit() { throw new Error("not used"); },
      async updateUnit() { throw new Error("not used"); },
      async deleteUnit() {},
      async listBrands() { return []; },
      async createBrand() { throw new Error("not used"); },
      async updateBrand() { throw new Error("not used"); },
      async deleteBrand() {},
      async listWarehouses() { return []; },
      async createWarehouse() { throw new Error("not used"); },
      async updateWarehouse() { throw new Error("not used"); },
      async deleteWarehouse() {},
      async listLocations() { return locations; },
      async createLocation() { throw new Error("not used"); },
      async updateLocation() { throw new Error("not used"); },
      async deleteLocation() {},
      async listWarehouseAssignments() { return []; },
      async setWarehouseAssignments() { return []; },
      async listTransfers() { return transfers; },
      async getTransfer(_b, id) { return transfers.find((row) => row.id === id) ?? null; },
      async createTransfer(businessId, input) {
        const now = new Date().toISOString();
        const transfer: StockTransfer = {
          id: `tr-${transfers.length + 1}`,
          businessId,
          transferNo: input.transferNo,
          status: input.status ?? "draft",
          fromWarehouseId: input.fromWarehouseId,
          fromLocationId: input.fromLocationId ?? null,
          toWarehouseId: input.toWarehouseId,
          toLocationId: input.toLocationId ?? null,
          requestedBy: input.requestedBy ?? null,
          dispatchedBy: null,
          receivedBy: null,
          requestedAt: now,
          dispatchedAt: null,
          receivedAt: null,
          notes: input.notes ?? null,
          shortageReason: null,
          items: input.items.map((item, index) => ({
            id: `tri-${index + 1}`,
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            quantity: item.quantity,
            dispatchedQuantity: 0,
            receivedQuantity: 0,
            shortageQuantity: 0,
            unit: item.unit ?? null,
            notes: item.notes ?? null,
          })),
          createdAt: now,
          updatedAt: now,
        };
        transfers.push(transfer);
        return transfer;
      },
      async updateTransfer(_b, transferId, input) {
        const index = transfers.findIndex((row) => row.id === transferId);
        const current = transfers[index];
        transfers[index] = {
          ...current,
          status: input.status ?? current.status,
          dispatchedBy: input.dispatchedBy === undefined ? current.dispatchedBy : input.dispatchedBy,
          dispatchedAt: input.dispatchedAt === undefined ? current.dispatchedAt : input.dispatchedAt,
          receivedBy: input.receivedBy === undefined ? current.receivedBy : input.receivedBy,
          receivedAt: input.receivedAt === undefined ? current.receivedAt : input.receivedAt,
          shortageReason: input.shortageReason === undefined ? current.shortageReason : input.shortageReason,
          items: input.items ?? current.items,
          updatedAt: new Date().toISOString(),
        };
        return transfers[index];
      },
      async listAdjustments() { return adjustments; },
      async getAdjustment(_b, id) { return adjustments.find((row) => row.id === id) ?? null; },
      async createAdjustment(businessId, input) {
        const now = new Date().toISOString();
        const adjustment: StockAdjustment = {
          id: `adj-${adjustments.length + 1}`,
          businessId,
          adjustmentNo: input.adjustmentNo,
          status: input.status ?? "draft",
          reason: input.reason,
          warehouseId: input.warehouseId ?? null,
          locationId: input.locationId ?? null,
          notes: input.notes ?? null,
          requestedBy: input.requestedBy ?? null,
          approvedBy: null,
          postedAt: null,
          items: input.items.map((item, index) => ({
            id: `adji-${index + 1}`,
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            change: item.change,
            unit: item.unit ?? null,
            notes: item.notes ?? null,
          })),
          createdAt: now,
          updatedAt: now,
        };
        adjustments.push(adjustment);
        return adjustment;
      },
      async updateAdjustment(_b, adjustmentId, input) {
        const index = adjustments.findIndex((row) => row.id === adjustmentId);
        const current = adjustments[index];
        adjustments[index] = {
          ...current,
          status: input.status ?? current.status,
          approvedBy: input.approvedBy === undefined ? current.approvedBy : input.approvedBy,
          postedAt: input.postedAt === undefined ? current.postedAt : input.postedAt,
          items: input.items ?? current.items,
          updatedAt: new Date().toISOString(),
        };
        return adjustments[index];
      },
      async listCounts() { return counts; },
      async getCount(_b, id) { return counts.find((row) => row.id === id) ?? null; },
      async createCount(businessId, input) {
        const now = new Date().toISOString();
        const session: StockCountSession = {
          id: `cnt-${counts.length + 1}`,
          businessId,
          countNo: input.countNo,
          status: input.status ?? "draft",
          warehouseId: input.warehouseId,
          locationId: input.locationId ?? null,
          notes: input.notes ?? null,
          countedBy: input.countedBy ?? null,
          approvedBy: null,
          postedAt: null,
          items: input.items.map((item, index) => ({
            id: `cnti-${index + 1}`,
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            systemQuantity: item.systemQuantity,
            countedQuantity: item.countedQuantity ?? null,
            unit: item.unit ?? null,
            notes: item.notes ?? null,
          })),
          createdAt: now,
          updatedAt: now,
        };
        counts.push(session);
        return session;
      },
      async updateCount(_b, countId, input) {
        const index = counts.findIndex((row) => row.id === countId);
        const current = counts[index];
        counts[index] = {
          ...current,
          status: input.status ?? current.status,
          countedBy: input.countedBy === undefined ? current.countedBy : input.countedBy,
          approvedBy: input.approvedBy === undefined ? current.approvedBy : input.approvedBy,
          postedAt: input.postedAt === undefined ? current.postedAt : input.postedAt,
          items: input.items ?? current.items,
          updatedAt: new Date().toISOString(),
        };
        return counts[index];
      },
      async listReservations(_b, filter) {
        return reservations.filter((row) => {
          if (filter?.productId && row.productId !== filter.productId) return false;
          if (filter?.status && row.status !== filter.status) return false;
          return true;
        });
      },
      async createReservation(businessId, input) {
        const now = new Date().toISOString();
        const reservation: StockReservation = {
          id: `rsv-${reservations.length + 1}`,
          businessId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          batchId: input.batchId ?? null,
          warehouseId: input.warehouseId ?? null,
          locationId: input.locationId ?? null,
          quantity: input.quantity,
          status: input.status ?? "open",
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        };
        reservations.push(reservation);
        return reservation;
      },
      async updateReservationStatus(_b, reservationId, status) {
        const row = reservations.find((item) => item.id === reservationId);
        if (!row) throw new Error("not found");
        row.status = status;
        return row;
      },
      async listSerials() { return []; },
      async createSerial() { throw new Error("not used"); },
      async updateSerial() { throw new Error("not used"); },
    },
    parties: {
      async listCustomers() { return []; },
      async getCustomer() { return null; },
      async createCustomer() { throw new Error("not used"); },
      async updateCustomer() { throw new Error("not used"); },
      async deleteCustomer() {},
      async listSuppliers() { return []; },
      async getSupplier() { return null; },
      async createSupplier() { throw new Error("not used"); },
      async updateSupplier() { throw new Error("not used"); },
      async deleteSupplier() {},
      async listCustomersForSearch() { return []; },
      async listSuppliersForSearch() { return []; },
    },
    transactions: {
      async listSalesInvoices() { return []; },
      async getSalesInvoice() { return null; },
      async createSalesInvoice() { throw new Error("not used"); },
      async updateSalesInvoice() { throw new Error("not used"); },
      async updateSalesInvoiceStatus() {},
      async deleteSalesInvoice() {},
      async listPurchaseOrders() { return []; },
      async getPurchaseOrder() { return null; },
      async createPurchaseOrder() { throw new Error("not used"); },
      async applyPurchaseReceiptQuantities() { throw new Error("not used"); },
      async listPurchaseInvoices() { return []; },
      async getPurchaseInvoice() { return null; },
      async createPurchaseInvoice() { throw new Error("not used"); },
      async updatePurchaseInvoice() { throw new Error("not used"); },
      async updatePurchaseInvoiceStatus() {},
      async deletePurchaseInvoice() {},
      async listPayments() { return []; },
      async getPayment() { return null; },
      async createPayment() { throw new Error("not used"); },
      async cancelPayment() { throw new Error("not used"); },
      async deletePaymentsForDocument() {},
      async cancelPaymentsForDocument() {},
      async listPaymentModes() { return []; },
      async createPaymentMode() { throw new Error("not used"); },
      async updatePaymentMode() { throw new Error("not used"); },
      async nextDocumentNumber(_b, _kind, prefix) {
        docSeq += 1;
        return `${prefix}-${docSeq}`;
      },
      async createPurchaseReceipt() { throw new Error("not used"); },
      async listPurchaseReceipts() { return []; },
      async createPurchaseReturn() { throw new Error("not used"); },
      async listPurchaseReturns() { return []; },
      async createSalesReturn() { throw new Error("not used"); },
      async listSalesReturns() { return []; },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
      async listQuotations() { return []; },
      async getQuotation() { return null; },
      async createQuotation() { throw new Error("not used"); },
      async updateQuotation() { throw new Error("not used"); },
      async updateQuotationStatus() {},
      async deleteQuotation() {},
    },
    notifications: {
      async list() { return []; },
      async create() {
        return {
          id: "n-1",
          businessId: "b-1",
          userId: null,
          title: "Low stock",
          type: "warning",
          read: false,
          timestamp: new Date().toISOString(),
        };
      },
      async markRead() {},
      async markAllRead() {},
    },
    audits: {
      async create(input) {
        const event: AuditEvent = {
          id: `a-${auditLogs.length + 1}`,
          businessId: input.businessId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? {},
          createdAt: new Date().toISOString(),
        };
        auditLogs.unshift(event);
        return event;
      },
      async list(businessId) {
        return auditLogs.filter((log) => log.businessId === businessId);
      },
    },
    businesses: {
      async listForUser() { return []; },
      async getById() { return null; },
      async getByUserAndId() { return null; },
      async create() { throw new Error("not used"); },
      async update() { throw new Error("not used"); },
      async getSetting() { return null; },
      async setSetting() {},
    },
    profiles: {
      async getByUserId() { return null; },
      async update() { throw new Error("not used"); },
      async isUsernameAvailable() { return true; },
      async upsertOwnProfile() { throw new Error("not used"); },
    },
    team: {
      async listMembers() { return []; },
      async listRoles() { return []; },
      async listPermissions() { return []; },
      async listRolePermissions() { return []; },
      async listInvitations() { return []; },
      async createInvitation() { throw new Error("not used"); },
      async cancelInvitation() {},
      async updateMemberRole() {},
      async removeMember() {},
      async getMemberPermissions() { return ["*"]; },
    },
  };

  return { repos, products, ledger, auditLogs, batches, locations, transfers, adjustments, counts, reservations };
}

async function seedProduct(services: ReturnType<typeof memoryRepositories>) {
  const repo = services.repos.products;
  const product = await repo.createProduct("b-1", "u-1", {
    name: "Item",
    gstRate: 18,
    purchasePrice: 100,
    lowStockThreshold: 5,
  });
  return product;
}

describe("InventoryService", () => {
  let services: ReturnType<typeof memoryRepositories>;
  let inventory: InventoryService;

  beforeEach(() => {
    services = memoryRepositories();
    inventory = new InventoryService(
      services.repos,
      new AuditService(services.repos),
      new NotificationService(services.repos)
    );
  });

  it("records opening stock as an OPENING ledger entry", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", {
      productId: product.id,
      quantity: 50,
      costPrice: 100,
    });

    expect(services.ledger).toHaveLength(1);
    expect(services.ledger[0]).toMatchObject({ change: 50, movementType: "OPENING" });
    expect(services.auditLogs[0].action).toBe("stock.opening");

    const stock = await inventory.listBalances("b-1");
    expect(stock[0].quantity).toBe(50);
  });

  it("adjusts stock and derives the balance from the ledger", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 10, costPrice: 100 });
    await inventory.adjustStock("b-1", "u-1", { productId: product.id, change: -3 });

    const stock = await inventory.listBalances("b-1");
    expect(stock[0].quantity).toBe(7);
    expect(services.ledger.map((l) => l.movementType)).toEqual(["OPENING", "ADJUSTMENT"]);
  });

  it("rejects zero adjustments", async () => {
    const product = await seedProduct(services);
    await expect(
      inventory.adjustStock("b-1", "u-1", { productId: product.id, change: 0 })
    ).rejects.toThrow();
  });

  it("transfers stock between warehouses with a matched pair of movements", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 20, costPrice: 100 });

    await inventory.transferStock("b-1", "u-1", {
      productId: product.id,
      quantity: 5,
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
    });

    expect(services.ledger.map((l) => l.movementType).sort()).toEqual([
      "OPENING",
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ]);
    const stock = await inventory.listBalances("b-1");
    expect(stock[0].quantity).toBe(20);
  });

  it("rejects transfers to the same warehouse", async () => {
    const product = await seedProduct(services);
    await expect(
      inventory.transferStock("b-1", "u-1", {
        productId: product.id,
        quantity: 5,
        fromWarehouseId: "wh-1",
        toWarehouseId: "wh-1",
      })
    ).rejects.toThrow();
  });

  it("scraps stock as a negative SCRAP movement", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 10, costPrice: 100 });
    await inventory.scrapStock("b-1", "u-1", { productId: product.id, quantity: 2, reason: "damaged" });

    const stock = await inventory.listBalances("b-1");
    expect(stock[0].quantity).toBe(8);
    expect(services.ledger[1].movementType).toBe("SCRAP");
    expect(services.auditLogs[0].action).toBe("stock.scrapped");
  });

  it("computes inventory valuation by cost price", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 10, costPrice: 100 });
    const valuation = await inventory.valuation("b-1");
    expect(valuation[0]).toMatchObject({
      productName: "Item",
      quantity: 10,
      costPrice: 100,
      stockValue: 1000,
    });
  });

  it("resolves sellable lots FEFO and prefers batch MRP over product MRP", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Medicine",
      gstRate: 12,
      purchasePrice: 80,
      salePrice: 120,
      mrp: 99,
    });
    const later = await services.repos.products.createBatch("b-1", {
      productId: product.id,
      batchNo: "LOT-B",
      expiryDate: "2028-12-01",
      mrp: 180,
      purchasePrice: 90,
    });
    const sooner = await services.repos.products.createBatch("b-1", {
      productId: product.id,
      batchNo: "LOT-A",
      expiryDate: "2027-01-15",
      mrp: 150,
      purchasePrice: 70,
    });
    await inventory.recordPurchaseMovement("b-1", "u-1", product.id, null, 4, "inv-1", "purchase_invoice", "wh-1", later.id);
    await inventory.recordPurchaseMovement("b-1", "u-1", product.id, null, 8, "inv-2", "purchase_invoice", "wh-1", sooner.id);

    const lots = await inventory.listSellableLots("b-1", { productId: product.id });
    expect(lots).toHaveLength(2);
    expect(lots[0]).toMatchObject({ batchId: sooner.id, batchNo: "LOT-A", mrp: 150, quantity: 8 });
    expect(lots[1]).toMatchObject({ batchId: later.id, batchNo: "LOT-B", mrp: 180, quantity: 4 });
  });

  it("falls back to product MRP when a lot has no batch MRP", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Soap",
      gstRate: 18,
      purchasePrice: 40,
      salePrice: 55,
      mrp: 60,
    });
    const batch = await services.repos.products.createBatch("b-1", {
      productId: product.id,
      batchNo: "OPEN",
      mrp: null,
    });
    await inventory.recordPurchaseMovement("b-1", "u-1", product.id, null, 5, "inv-3", "purchase_invoice", null, batch.id);
    const lots = await inventory.listSellableLots("b-1", { productId: product.id });
    expect(lots[0].mrp).toBe(60);
  });

  it("dispatches a transfer then receives the full quantity", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", {
      productId: product.id,
      quantity: 20,
      costPrice: 100,
      warehouseId: "wh-1",
    });
    const transfer = await inventory.requestTransfer("b-1", "u-1", {
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      items: [{ productId: product.id, quantity: 8 }],
    });
    expect(transfer.status).toBe("approved");
    const dispatched = await inventory.dispatchTransfer("b-1", "u-1", transfer.id);
    expect(dispatched.status).toBe("in_transit");
    expect(services.ledger.map((row) => row.movementType)).toContain("TRANSFER_OUT");
    const received = await inventory.receiveTransfer("b-1", "u-1", transfer.id, {
      items: [{ itemId: dispatched.items[0].id, receivedQuantity: 8 }],
    });
    expect(received.status).toBe("completed");
    expect(services.ledger.map((row) => row.movementType)).toEqual([
      "OPENING",
      "TRANSFER_OUT",
      "TRANSFER_IN",
    ]);
  });

  it("allows partial receive and blocks cancel while in transit", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", {
      productId: product.id,
      quantity: 10,
      costPrice: 100,
      warehouseId: "wh-1",
    });
    const transfer = await inventory.requestTransfer("b-1", "u-1", {
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      items: [{ productId: product.id, quantity: 6 }],
    });
    await inventory.dispatchTransfer("b-1", "u-1", transfer.id);
    await expect(inventory.cancelTransfer("b-1", "u-1", transfer.id)).rejects.toThrow();
    const partial = await inventory.receiveTransfer("b-1", "u-1", transfer.id, {
      items: [{ itemId: transfer.items[0].id, receivedQuantity: 4 }],
      shortageReason: "short loaded",
    });
    expect(partial.status).toBe("partially_received");
    expect(partial.items[0].receivedQuantity).toBe(4);
  });

  it("posts adjustments through the ledger", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 12, costPrice: 100 });
    const adjustment = await inventory.requestAdjustment("b-1", "u-1", {
      reason: "damage",
      warehouseId: "wh-1",
      items: [{ productId: product.id, change: -2 }],
    });
    expect(adjustment.status).toBe("posted");
    const stock = await inventory.listBalances("b-1");
    expect(stock.reduce((sum, row) => sum + row.quantity, 0)).toBe(10);
  });

  it("does not change stock until a count is posted", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", {
      productId: product.id,
      quantity: 10,
      costPrice: 100,
      warehouseId: "wh-1",
    });
    const session = await inventory.createCountSession("b-1", "u-1", {
      warehouseId: "wh-1",
      items: [{ productId: product.id, systemQuantity: 10, countedQuantity: 7 }],
    });
    expect(session.status).toBe("counting");
    expect(services.ledger.filter((row) => row.movementType === "COUNT")).toHaveLength(0);
    const posted = await inventory.postCount("b-1", "u-1", session.id);
    expect(posted.status).toBe("posted");
    expect(services.ledger.map((row) => row.movementType)).toContain("COUNT");
    const stock = await inventory.listBalances("b-1");
    expect(stock.reduce((sum, row) => sum + row.quantity, 0)).toBe(7);
  });

  it("reserves available stock and hides it from sellable lots", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", {
      productId: product.id,
      quantity: 10,
      costPrice: 100,
      warehouseId: "wh-1",
    });
    await inventory.reserveStock("b-1", "u-1", {
      productId: product.id,
      warehouseId: "wh-1",
      quantity: 4,
      referenceType: "sales_invoice",
      referenceId: "inv-r1",
    });
    const availability = await inventory.listAvailability("b-1", { productId: product.id });
    expect(availability[0].available).toBe(6);
    const lots = await inventory.listSellableLots("b-1", { productId: product.id });
    expect(lots[0].quantity).toBe(6);
  });

  it("rejects reservations that exceed available quantity", async () => {
    const product = await seedProduct(services);
    await inventory.recordOpeningStock("b-1", "u-1", { productId: product.id, quantity: 2, costPrice: 100 });
    await expect(
      inventory.reserveStock("b-1", "u-1", {
        productId: product.id,
        quantity: 5,
        referenceType: "sales_invoice",
        referenceId: "inv-r2",
      })
    ).rejects.toThrow();
  });
});
