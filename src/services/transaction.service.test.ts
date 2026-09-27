import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type {
  AuditEvent,
  Product,
  ProductBatch,
  PurchaseInvoice,
  SalesInvoice,
} from "@/types/domain";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";
import { TransactionService } from "./transaction.service";
import { AppError } from "@/lib/errors";

function memoryRepositories() {
  const products: Product[] = [];
  const salesInvoices: SalesInvoice[] = [];
  const purchaseInvoices: PurchaseInvoice[] = [];
  const payments: Array<{ direction: string; salesInvoiceId: string | null; purchaseInvoiceId: string | null; amount: number; mode: string }> = [];
  const ledger: Array<{ productId: string; change: number; movementType: string; batchId: string | null; warehouseId: string | null }> = [];
  const batches: ProductBatch[] = [];
  const auditLogs: AuditEvent[] = [];
  const receipts: unknown[] = [];
  const purchaseReturns: unknown[] = [];
  const salesReturns: unknown[] = [];
  const paymentModes: Array<{ id: string; businessId: string; code: string; name: string; isActive: boolean; sortOrder: number; createdAt: string; updatedAt: string }> = [
    { id: "m-cash", businessId: "b-1", code: "cash", name: "Cash", isActive: true, sortOrder: 10, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "m-upi", businessId: "b-1", code: "upi", name: "UPI", isActive: true, sortOrder: 20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

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
      async updateBatch(_b, batchId, input) {
        const index = batches.findIndex((batch) => batch.id === batchId);
        if (index === -1) throw new Error("Batch not found.");
        batches[index] = {
          ...batches[index],
          expiryDate: input.expiryDate === undefined ? batches[index].expiryDate : input.expiryDate,
          mrp: input.mrp === undefined ? batches[index].mrp : input.mrp,
          purchasePrice: input.purchasePrice === undefined ? batches[index].purchasePrice : input.purchasePrice,
          updatedAt: new Date().toISOString(),
        };
        return batches[index];
      },
      async listStock() {
        const byProduct = new Map<string, number>();
        for (const entry of ledger) {
          byProduct.set(entry.productId, (byProduct.get(entry.productId) ?? 0) + entry.change);
        }
        return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity, lastMovementAt: null }));
      },
      async listBalances() {
        const map = new Map<string, { productId: string; batchId: string | null; warehouseId: string | null; quantity: number }>();
        for (const entry of ledger) {
          const key = `${entry.productId}|${entry.batchId ?? ""}|${entry.warehouseId ?? ""}`;
          const current = map.get(key) ?? {
            productId: entry.productId,
            batchId: entry.batchId,
            warehouseId: entry.warehouseId,
            quantity: 0,
          };
          current.quantity += entry.change;
          map.set(key, current);
        }
        return Array.from(map.values()).map((row) => ({
          productId: row.productId,
          variantId: null,
          batchId: row.batchId,
          warehouseId: row.warehouseId,
          locationId: null,
          quantity: row.quantity,
          lastMovementAt: null,
        }));
      },
      async listMovements() { return []; },
      async addStockMovement(input) {
        ledger.push({
          productId: input.productId,
          change: input.change,
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
      async listSalesInvoices() { return salesInvoices; },
      async getSalesInvoice(_b, id) { return salesInvoices.find((i) => i.id === id) ?? null; },
      async createSalesInvoice(businessId, _u, header, items) {
        const invoice: SalesInvoice = {
          id: `inv-${salesInvoices.length + 1}`,
          businessId,
          invoiceNo: header.invoiceNo,
          customerId: header.customerId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          paymentMode: header.paymentMode ?? null,
          notes: header.notes ?? null,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            discount: item.discount ?? 0,
            taxableAmount: item.quantity * item.unitPrice,
            taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
            amount: item.quantity * item.unitPrice * (1 + item.gstRate / 100),
            saleUnit: item.saleUnit ?? null,
            baseQuantity: item.baseQuantity ?? item.quantity,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        salesInvoices.push(invoice);
        return invoice;
      },
      async updateSalesInvoiceStatus(_b, id, status) {
        const index = salesInvoices.findIndex((i) => i.id === id);
        if (index !== -1) salesInvoices[index] = { ...salesInvoices[index], status };
      },
      async listPurchaseOrders() { return []; },
      async createPurchaseOrder() { throw new Error("not used"); },
      async listPurchaseInvoices() { return purchaseInvoices; },
      async getPurchaseInvoice(_b, id) { return purchaseInvoices.find((i) => i.id === id) ?? null; },
      async createPurchaseInvoice(businessId, _u, header, items) {
        const invoice: PurchaseInvoice = {
          id: `purch-${purchaseInvoices.length + 1}`,
          businessId,
          billNo: header.billNo,
          supplierId: header.supplierId ?? null,
          purchaseOrderId: header.purchaseOrderId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          notes: header.notes ?? null,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            discount: 0,
            taxableAmount: item.quantity * item.unitPrice,
            taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
            amount: item.quantity * item.unitPrice,
            saleUnit: item.saleUnit ?? null,
            baseQuantity: item.baseQuantity ?? item.quantity,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        purchaseInvoices.push(invoice);
        return invoice;
      },
      async updatePurchaseInvoiceStatus(_b, id, status) {
        const index = purchaseInvoices.findIndex((i) => i.id === id);
        if (index !== -1) purchaseInvoices[index] = { ...purchaseInvoices[index], status };
      },
      async listPayments() { return payments as never[]; },
      async createPayment(_b, _u, input) {
        payments.push({
          direction: input.direction,
          salesInvoiceId: input.salesInvoiceId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          amount: input.amount,
          mode: input.mode,
        });
        return {
          id: `pay-${payments.length}`,
          businessId: _b,
          direction: input.direction,
          partyType: input.partyType,
          partyId: input.partyId ?? null,
          salesInvoiceId: input.salesInvoiceId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          amount: input.amount,
          mode: input.mode,
          reference: input.reference ?? null,
          paymentDate: input.paymentDate,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
        };
      },
      async listPaymentModes(_b) { return paymentModes.filter((m) => m.businessId === _b); },
      async createPaymentMode(_b, input) {
        const mode = { id: `m-${paymentModes.length + 1}`, businessId: _b, code: input.code, name: input.name, isActive: true, sortOrder: input.sortOrder ?? 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        paymentModes.push(mode);
        return mode;
      },
      async updatePaymentMode(_b, id, input) {
        const index = paymentModes.findIndex((m) => m.id === id);
        if (index !== -1) paymentModes[index] = { ...paymentModes[index], ...input };
        return paymentModes[index];
      },
      async nextDocumentNumber() { return "SAL-2026-000001"; },
      async createPurchaseReceipt(_b, _u, input, items) {
        const receipt = { id: `rcpt-${receipts.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        receipts.push(receipt);
        return receipt as never;
      },
      async listPurchaseReceipts() { return receipts as never[]; },
      async createPurchaseReturn(_b, _u, input, items) {
        const result = { id: `pr-${purchaseReturns.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        purchaseReturns.push(result);
        return result as never;
      },
      async listPurchaseReturns() { return purchaseReturns as never[]; },
      async createSalesReturn(_b, _u, input, items) {
        const result = { id: `sr-${salesReturns.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        salesReturns.push(result);
        return result as never;
      },
      async listSalesReturns() { return salesReturns as never[]; },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
    },
    notifications: {
      async list() { return []; },
      async create() {
        return { id: "n-1", businessId: "b-1", userId: null, title: "Low stock", type: "warning", read: false, timestamp: new Date().toISOString() };
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

  return { repos, products, ledger, salesInvoices, purchaseInvoices, payments, auditLogs, batches };
}

describe("TransactionService", () => {
  let services: ReturnType<typeof memoryRepositories>;
  let transactions: TransactionService;

  beforeEach(() => {
    services = memoryRepositories();
    transactions = new TransactionService(
      services.repos,
      new AuditService(services.repos),
      new NotificationService(services.repos)
    );
  });

  async function seedProduct() {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Item",
      gstRate: 18,
      purchasePrice: 100,
      salePrice: 200,
      lowStockThreshold: 5,
    });
    return product;
  }

  it("creates a fully-paid sales invoice and writes SALE stock movements", async () => {
    const product = await seedProduct();
    const { invoice, totals } = await transactions.createSalesInvoice(
      "b-1",
      "u-1",
      "SAL-2026-000001",
      {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 472 }],
      }
    );

    expect(invoice.status).toBe("paid");
    expect(invoice.paidAmount).toBe(472);
    expect(totals.total).toBe(472);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
    expect(services.payments).toHaveLength(1);
  });

  it("marks a credit sale as completed with zero paid", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000002", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    expect(invoice.status).toBe("completed");
    expect(invoice.paidAmount).toBe(0);
  });

  it("rejects payment above the invoice total", async () => {
    const product = await seedProduct();
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000003", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 9999 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("applies item and invoice discounts before GST on a sale", async () => {
    const product = await seedProduct();
    const { totals, invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000006", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 500, gstRate: 18, discount: 20 }],
      discount: 30,
      payments: [{ mode: "cash", amount: 531 }],
    });
    expect(totals.taxableAmount).toBe(450);
    expect(totals.taxAmount).toBe(81);
    expect(totals.total).toBe(531);
    expect(invoice.total).toBe(531);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -1, movementType: "SALE" })
    );
  });

  it("saves a draft sales invoice without stock movements or payments", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000007", {
      walkInName: "Counter guest",
      asDraft: true,
      items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 472 }],
    });
    expect(invoice.status).toBe("draft");
    expect(invoice.paidAmount).toBe(0);
    expect(invoice.notes).toContain("Walk-in: Counter guest");
    expect(services.ledger).toHaveLength(0);
    expect(services.payments).toHaveLength(0);
  });

  it("completes a draft sales invoice and records stock OUT", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000008", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
    });
    expect(services.ledger).toHaveLength(0);
    const completed = await transactions.completeSalesInvoice("b-1", "u-1", invoice.id);
    expect(completed.status).toBe("completed");
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
  });

  it("does not restore stock when cancelling a draft sale", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000009", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
    });
    await transactions.cancelSalesInvoice("b-1", "u-1", invoice.id);
    expect(services.ledger).toHaveLength(0);
  });

  it("rejects payment against a draft sales invoice", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000010", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
    });
    await expect(
      transactions.createPayment("b-1", "u-1", {
        direction: "in",
        partyType: "customer",
        salesInvoiceId: invoice.id,
        amount: 50,
        mode: "cash",
      })
    ).rejects.toThrow(AppError);
  });

  it("creates a purchase invoice with PURCHASE stock-in", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000001", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 18 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "PURCHASE" })
    );
    expect(services.purchaseInvoices[0].status).toBe("unpaid");
  });

  it("saves a draft purchase invoice without stock movements", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000002", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 18 }],
    });
    expect(services.purchaseInvoices[0].status).toBe("draft");
    expect(services.ledger).toHaveLength(0);
  });

  it("completes a draft purchase invoice and records stock IN", async () => {
    const product = await seedProduct();
    const draft = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000003", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 6, unitPrice: 80, gstRate: 18 }],
    });
    expect(services.ledger).toHaveLength(0);

    const completed = await transactions.completePurchaseInvoice("b-1", "u-1", draft.id, "wh-1");
    expect(completed.status).toBe("unpaid");
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 6, movementType: "PURCHASE" })
    );
  });

  it("does not double-apply stock when completing an already unpaid bill", async () => {
    const product = await seedProduct();
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000004", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 3, unitPrice: 50, gstRate: 5 }],
    });
    expect(services.ledger).toHaveLength(1);
    await transactions.completePurchaseInvoice("b-1", "u-1", invoice.id);
    expect(services.ledger).toHaveLength(1);
  });

  it("rejects payment against a draft purchase invoice", async () => {
    const product = await seedProduct();
    const draft = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000005", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 0 }],
    });
    await expect(
      transactions.createPayment("b-1", "u-1", {
        direction: "out",
        partyType: "supplier",
        partyId: "s-1",
        purchaseInvoiceId: draft.id,
        amount: 50,
        mode: "cash",
      })
    ).rejects.toThrow(AppError);
    expect(services.ledger).toHaveLength(0);
  });

  it("receives goods and increases stock", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000001", {
      warehouseId: "wh-1",
      items: [{ productId: product.id, quantity: 25, unitCost: 90 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 25, movementType: "PURCHASE" })
    );
    expect(services.auditLogs[0].action).toBe("purchase_received");
  });

  it("records a purchase return that sends stock out", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseReturn("b-1", "u-1", "PRT-2026-000001", {
      purchaseInvoiceId: "purch-1",
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 4, unitCost: 100 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -4, movementType: "PURCHASE_RETURN" })
    );
  });

  it("records a sales return that restores stock and marks the invoice returned", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000004", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 236 }],
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000001", {
      salesInvoiceId: invoice.id,
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 1, movementType: "SALE_RETURN" })
    );
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("returned");
  });

  it("applies a payment and reconciles the invoice to partial then paid", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000005", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      salesInvoiceId: invoice.id,
      amount: 100,
      mode: "cash",
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("partial");
    await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      salesInvoiceId: invoice.id,
      amount: 136,
      mode: "upi",
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("paid");
  });

  it("lists and creates payment modes", async () => {
    const modes = await transactions.listPaymentModes("b-1");
    expect(modes).toHaveLength(2);
    await transactions.createPaymentMode("b-1", "u-1", { code: "cheque", name: "Cheque" });
    expect(await transactions.listPaymentModes("b-1")).toHaveLength(3);
  });

  it("persists purchase MRP onto a batch and stocks IN with that batchId", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000010", {
      supplierId: "s-1",
      warehouseId: "wh-1",
      items: [{
        productId: product.id,
        quantity: 12,
        unitPrice: 80,
        gstRate: 12,
        batchNo: "B-LOT-1",
        expiryDate: "2027-01-31",
        mrp: 150,
      }],
    });
    expect(services.batches).toHaveLength(1);
    expect(services.batches[0]).toMatchObject({
      batchNo: "B-LOT-1",
      expiryDate: "2027-01-31",
      mrp: 150,
      purchasePrice: 80,
    });
    expect(services.purchaseInvoices[0].items[0].batchId).toBe(services.batches[0].id);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({
        productId: product.id,
        change: 12,
        movementType: "PURCHASE",
        batchId: services.batches[0].id,
        warehouseId: "wh-1",
      })
    );
  });

  it("sells from the selected batch and writes SALE against that lot", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000011", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 10,
        unitPrice: 90,
        gstRate: 12,
        batchNo: "LOT-A",
        mrp: 200,
      }],
    });
    const batchId = services.batches[0].id;
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000020", {
      warehouseId: "wh-1",
      items: [{
        productId: product.id,
        batchId,
        quantity: 2,
        unitPrice: 180,
        gstRate: 12,
        mrp: 200,
      }],
      payments: [{ mode: "cash", amount: 403.2 }],
    });
    expect(invoice.items[0].batchId).toBe(batchId);
    expect(totals.taxableAmount).toBe(360);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE", batchId })
    );
  });

  it("converts purchase pack qty to base-unit stock IN", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 12,
      purchasePrice: 80,
      salePrice: 100,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000012", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 5,
        unitKind: "pack",
        unitPrice: 80,
        gstRate: 12,
        batchNo: "STRIP-1",
        mrp: 120,
      }],
    });
    expect(services.purchaseInvoices[0].items[0]).toMatchObject({
      quantity: 5,
      saleUnit: "STRIP",
      baseQuantity: 50,
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 50, movementType: "PURCHASE" })
    );
  });

  it("sells pack qty as base-unit stock OUT and GST on sale price", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 12,
      purchasePrice: 80,
      salePrice: 100,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000013", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 20,
        unitKind: "base",
        unitPrice: 8,
        gstRate: 12,
        batchNo: "LOT-P",
        mrp: 15,
      }],
    });
    const batchId = services.batches[0].id;
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000022", {
      items: [{
        productId: product.id,
        batchId,
        quantity: 2,
        unitKind: "pack",
        unitPrice: 100,
        gstRate: 12,
        mrp: 150,
      }],
      payments: [{ mode: "cash", amount: 224 }],
    });
    expect(invoice.items[0]).toMatchObject({ quantity: 2, saleUnit: "STRIP", baseQuantity: 20, batchId });
    expect(totals.taxableAmount).toBe(200);
    expect(totals.taxAmount).toBe(24);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -20, movementType: "SALE", batchId })
    );
  });

  it("rejects selling more than available base units", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 8,
      salePrice: 12,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000014", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 14, unitKind: "base", unitPrice: 8, gstRate: 0 }],
    });
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000023", {
        items: [{ productId: product.id, quantity: 2, unitKind: "pack", unitPrice: 100, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 200 }],
      })
    ).rejects.toThrow(/Only 14 PCS available/);
  });

  it("keeps GST and MRP on commercial sale qty while stock uses base units", async () => {
    const product = await seedProduct();
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000024", {
      items: [{ productId: product.id, quantity: 2, unitPrice: 180, gstRate: 12, mrp: 200 }],
      payments: [{ mode: "cash", amount: 403.2 }],
    });
    expect(invoice.items[0].quantity).toBe(2);
    expect(invoice.items[0].baseQuantity).toBe(2);
    expect(totals.taxableAmount).toBe(360);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
  });

  it("rejects a sale price above MRP", async () => {
    const product = await seedProduct();
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000021", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 250, gstRate: 18, mrp: 200 }],
        payments: [{ mode: "cash", amount: 295 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("purchases 1 STRIP at Rs 5 per PCS as 10 PCS and Rs 50", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000020", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 1,
        unitKind: "pack",
        rateBasis: "base",
        unitPrice: 5,
        gstRate: 0,
        batchNo: "LOT-R5",
        mrp: 12,
      }],
    });
    expect(invoice.subtotal).toBe(50);
    expect(invoice.items[0]).toMatchObject({ quantity: 1, saleUnit: "STRIP", baseQuantity: 10 });
    expect(services.batches[0]).toMatchObject({ mrp: 12, purchasePrice: 5 });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "PURCHASE" })
    );
  });

  it("does not multiply a per-STRIP rate by pack size", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000021", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 1,
        unitKind: "pack",
        rateBasis: "pack",
        unitPrice: 50,
        gstRate: 0,
        batchNo: "LOT-R50",
      }],
    });
    expect(invoice.subtotal).toBe(50);
    expect(invoice.items[0].baseQuantity).toBe(10);
    expect(services.batches[0].purchasePrice).toBe(5);
  });

  it("sells 1 STRIP then 2 PCS from 110 remaining 98", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000022", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 110, unitKind: "base", unitPrice: 5, gstRate: 0, batchNo: "LOT-110" }],
    });
    const batchId = services.batches[0].id;
    await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000030", {
      items: [{ productId: product.id, batchId, quantity: 1, unitKind: "pack", unitPrice: 80, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 80 }],
    });
    await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000031", {
      items: [{ productId: product.id, batchId, quantity: 2, unitKind: "base", unitPrice: 8, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 16 }],
    });
    const remaining = services.ledger
      .filter((entry) => entry.productId === product.id)
      .reduce((sum, entry) => sum + entry.change, 0);
    expect(remaining).toBe(98);
  });

  it("loads batch MRP independently for lot A and lot B", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000023", {
      supplierId: "s-1",
      items: [
        { productId: product.id, quantity: 10, unitPrice: 80, gstRate: 0, batchNo: "A", mrp: 120 },
        { productId: product.id, quantity: 10, unitPrice: 90, gstRate: 0, batchNo: "B", mrp: 150 },
      ],
    });
    expect(services.batches.find((batch) => batch.batchNo === "A")?.mrp).toBe(120);
    expect(services.batches.find((batch) => batch.batchNo === "B")?.mrp).toBe(150);
  });

  it("converts purchase return pack qty to base-unit stock OUT", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    await transactions.createPurchaseReturn("b-1", "u-1", "PRT-2026-000002", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 1, unitCost: 50, unitKind: "pack" }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -10, movementType: "PURCHASE_RETURN" })
    );
  });

  it("converts sales return pack qty to base-unit stock IN", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000002", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 80, unitKind: "pack" }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "SALE_RETURN" })
    );
  });
});
