import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type { AuditEvent, Product } from "@/types/domain";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";
import { ProductService } from "./product.service";
import { AppError } from "@/lib/errors";

function memoryRepositories() {
  const products: Product[] = [];
  const ledger: Array<{ productId: string; change: number; businessId: string }> = [];
  const auditLogs: AuditEvent[] = [];
  const notifications: Array<{ businessId: string; title: string }> = [];

  const repos: Repositories = {
    products: {
      async listCategories() { return []; },
      async createCategory() { throw new Error("not used"); },
      async listProducts() { return products; },
      async getProduct(_b, id) { return products.find((p) => p.id === id) ?? null; },
      async createProduct(businessId, _u, input) {
        const product: Product = {
          id: `p-${products.length + 1}`,
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
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        products.push(product);
        return product;
      },
      async updateProduct(_b, id, input) {
        const index = products.findIndex((p) => p.id === id);
        if (index === -1) throw new Error("not found");
        products[index] = { ...products[index], ...input };
        return products[index];
      },
      async deleteProduct(_b, id) {
        const index = products.findIndex((p) => p.id === id);
        if (index !== -1) products.splice(index, 1);
      },
      async listBatches() { return []; },
      async createBatch() { throw new Error("not used"); },
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
      async addStockMovement(input) {
        ledger.push({ productId: input.productId, change: input.change, businessId: input.businessId });
      },
      async listProductsForSearch() { return []; },
      async listStockForSearch() { return []; },
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
      async createPurchaseInvoice() { throw new Error("not used"); },
      async listPayments() { return []; },
      async createPayment() { throw new Error("not used"); },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
    },
    notifications: {
      async list() { return []; },
      async create(input) {
        notifications.push({ businessId: input.businessId, title: input.title });
        return {
          id: `n-${notifications.length}`,
          businessId: input.businessId,
          userId: input.userId ?? null,
          title: input.title,
          description: input.description ?? undefined,
          type: input.type ?? "info",
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
    },
    profiles: {
      async getByUserId() { return null; },
      async update() { throw new Error("not used"); },
    },
  };

  return { repos, products, ledger, auditLogs, notifications };
}

describe("ProductService", () => {
  let services: ReturnType<typeof memoryRepositories>;
  let products: ProductService;

  beforeEach(() => {
    services = memoryRepositories();
    products = new ProductService(
      services.repos,
      new AuditService(services.repos),
      new NotificationService(services.repos)
    );
  });

  it("creates a product and records an audit event", async () => {
    const product = await products.createProduct("b-1", "u-1", {
      name: "Cotton T-Shirt",
      sku: "TS-WHT-M",
      gstRate: 18,
      salePrice: 499,
      purchasePrice: 250,
    });
    expect(product.name).toBe("Cotton T-Shirt");
    expect(services.products).toHaveLength(1);
    expect(services.auditLogs[0].action).toBe("product.created");
  });

  it("rejects invalid product data", async () => {
    await expect(
      products.createProduct("b-1", "u-1", { name: "X", gstRate: -5 })
    ).rejects.toThrow(AppError);
  });

  it("adjusts stock and writes a ledger movement", async () => {
    await products.createProduct("b-1", "u-1", { name: "Pen", gstRate: 0 });
    const product = services.products[0];
    await products.adjustStock("b-1", "u-1", {
      productId: product.id,
      change: 50,
      reason: "opening",
    });
    expect(services.ledger).toHaveLength(1);
    expect(services.ledger[0].change).toBe(50);
    expect(services.auditLogs[0].action).toBe("stock.adjusted");
  });

  it("raises a low-stock notification when stock drops to threshold", async () => {
    await products.createProduct("b-1", "u-1", {
      name: "Low Stock Item",
      gstRate: 0,
      lowStockThreshold: 5,
    });
    const product = services.products[0];
    await products.adjustStock("b-1", "u-1", { productId: product.id, change: 10, reason: "opening" });
    await products.adjustStock("b-1", "u-1", { productId: product.id, change: -8, reason: "sale" });
    expect(services.notifications.some((n) => n.title.includes("Low stock"))).toBe(true);
  });

  it("lists products joined with stock levels", async () => {
    await products.createProduct("b-1", "u-1", { name: "Box", gstRate: 0, purchasePrice: 100 });
    await products.adjustStock("b-1", "u-1", { productId: services.products[0].id, change: 4, reason: "opening" });
    const rows = await products.listProductsWithStock("b-1");
    expect(rows[0].stockQuantity).toBe(4);
    expect(rows[0].stockValue).toBe(400);
  });

  it("deletes a product", async () => {
    await products.createProduct("b-1", "u-1", { name: "Temp", gstRate: 0 });
    const product = services.products[0];
    await products.deleteProduct("b-1", "u-1", product.id);
    expect(services.products).toHaveLength(0);
  });
});
