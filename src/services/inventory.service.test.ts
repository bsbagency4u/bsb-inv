import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type { AuditEvent, Product, ProductBatch } from "@/types/domain";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";
import { InventoryService } from "./inventory.service";

function memoryRepositories() {
  const products: Product[] = [];
  const ledger: Array<{ productId: string; change: number; businessId: string; movementType: string; batchId: string | null; warehouseId: string | null }> = [];
  const batches: ProductBatch[] = [];
  const auditLogs: AuditEvent[] = [];

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
          expiryDate: input.expiryDate ?? null,
          mrp: input.mrp ?? null,
          purchasePrice: input.purchasePrice ?? null,
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
        const map = new Map<string, { productId: string; batchId: string | null; warehouseId: string | null; quantity: number }>();
        for (const entry of ledger) {
          const key = `${entry.productId}|${entry.batchId ?? ""}|${entry.warehouseId ?? ""}`;
          const current = map.get(key) ?? {
            productId: entry.productId,
            batchId: entry.batchId ?? null,
            warehouseId: entry.warehouseId ?? null,
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
          locationId: null,
          quantity: b.quantity,
          lastMovementAt: null,
        }));
      },
      async listMovements() {
        return ledger.map((entry, index) => ({
          id: `mv-${index}`,
          businessId: entry.businessId,
          productId: entry.productId,
          variantId: null,
          batchId: null,
          warehouseId: null,
          locationId: null,
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
      async listLocations() { return []; },
      async createLocation() { throw new Error("not used"); },
      async updateLocation() { throw new Error("not used"); },
      async deleteLocation() {},
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
      async updateSalesInvoiceStatus() {},
      async listPurchaseOrders() { return []; },
      async createPurchaseOrder() { throw new Error("not used"); },
      async listPurchaseInvoices() { return []; },
      async getPurchaseInvoice() { return null; },
      async createPurchaseInvoice() { throw new Error("not used"); },
      async updatePurchaseInvoiceStatus() {},
      async listPayments() { return []; },
      async createPayment() { throw new Error("not used"); },
      async listPaymentModes() { return []; },
      async createPaymentMode() { throw new Error("not used"); },
      async updatePaymentMode() { throw new Error("not used"); },
      async nextDocumentNumber() { return "X-1"; },
      async createPurchaseReceipt() { throw new Error("not used"); },
      async listPurchaseReceipts() { return []; },
      async createPurchaseReturn() { throw new Error("not used"); },
      async listPurchaseReturns() { return []; },
      async createSalesReturn() { throw new Error("not used"); },
      async listSalesReturns() { return []; },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
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

  return { repos, products, ledger, auditLogs, batches };
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
});
