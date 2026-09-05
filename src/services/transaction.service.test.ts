import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type {
  AuditEvent,
  Product,
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
  const ledger: Array<{ productId: string; change: number; movementType: string }> = [];
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
      async listBatches() { return []; },
      async createBatch() { throw new Error("not used"); },
      async listStock() {
        const byProduct = new Map<string, number>();
        for (const entry of ledger) {
          byProduct.set(entry.productId, (byProduct.get(entry.productId) ?? 0) + entry.change);
        }
        return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity, lastMovementAt: null }));
      },
      async listBalances() {
        const map = new Map<string, number>();
        for (const entry of ledger) {
          map.set(entry.productId, (map.get(entry.productId) ?? 0) + entry.change);
        }
        return Array.from(map.entries()).map(([productId, quantity]) => ({
          productId,
          variantId: null,
          warehouseId: null,
          locationId: null,
          quantity,
          lastMovementAt: null,
        }));
      },
      async listMovements() { return []; },
      async addStockMovement(input) {
        ledger.push({ productId: input.productId, change: input.change, movementType: input.movementType });
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
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            discount: item.discount ?? 0,
            taxableAmount: item.quantity * item.unitPrice,
            taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
            amount: item.quantity * item.unitPrice * (1 + item.gstRate / 100),
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
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            discount: 0,
            taxableAmount: item.quantity * item.unitPrice,
            taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
            amount: item.quantity * item.unitPrice,
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
    },
    profiles: {
      async getByUserId() { return null; },
      async update() { throw new Error("not used"); },
    },
  };

  return { repos, products, ledger, salesInvoices, purchaseInvoices, payments, auditLogs };
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
});
