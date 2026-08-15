import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type { BusinessProfile, SessionUser, AuditEvent } from "@/types/domain";
import { AuditService } from "./audit.service";
import { BusinessService } from "./business.service";
import { AppError } from "@/lib/errors";

function createMemoryRepositories(): Repositories {
  const businesses = new Map<string, BusinessProfile>();
  const auditLogs: AuditEvent[] = [];

  return {
    businesses: {
      async listForUser() {
        return Array.from(businesses.values());
      },
      async getById(id) {
        return businesses.get(id) ?? null;
      },
      async getByUserAndId(_userId, id) {
        return businesses.get(id) ?? null;
      },
      async create(userId, input) {
        const now = new Date().toISOString();
        const business: BusinessProfile = {
          id: `b-${businesses.size + 1}`,
          name: input.name,
          legalName: input.legalName ?? null,
          type: input.type ?? "retail",
          logoUrl: null,
          address: null,
          city: null,
          state: null,
          country: input.country ?? "India",
          pincode: null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          website: null,
          gstin: input.gstin ?? null,
          pan: null,
          currency: input.currency ?? "INR",
          financialYear: input.financialYear ?? "01-04",
          invoicePrefix: input.invoicePrefix ?? "INV",
          invoiceStartNumber: input.invoiceStartNumber ?? 1001,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        businesses.set(business.id, business);
        return business;
      },
      async update(_userId, id, input) {
        const existing = businesses.get(id);
        if (!existing) throw new Error("not found");
        const updated = { ...existing, ...input, id, updatedAt: new Date().toISOString() };
        businesses.set(id, updated);
        return updated;
      },
    },
    profiles: {
      async getByUserId() {
        return null;
      },
      async update(_userId, input: Partial<SessionUser>) {
        return { id: "u-1", email: "a@b.com", fullName: input.fullName ?? "", isOwner: false, isDemo: false } as SessionUser;
      },
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
    products: {
      async listCategories() { return []; },
      async createCategory() { throw new Error("not used in test"); },
      async listProducts() { return []; },
      async getProduct() { return null; },
      async createProduct() { throw new Error("not used in test"); },
      async updateProduct() { throw new Error("not used in test"); },
      async deleteProduct() {},
      async listBatches() { return []; },
      async createBatch() { throw new Error("not used in test"); },
      async listStock() { return []; },
      async addStockMovement() {},
      async listProductsForSearch() { return []; },
      async listStockForSearch() { return []; },
    },
    parties: {
      async listCustomers() { return []; },
      async getCustomer() { return null; },
      async createCustomer() { throw new Error("not used in test"); },
      async updateCustomer() { throw new Error("not used in test"); },
      async deleteCustomer() {},
      async listSuppliers() { return []; },
      async getSupplier() { return null; },
      async createSupplier() { throw new Error("not used in test"); },
      async updateSupplier() { throw new Error("not used in test"); },
      async deleteSupplier() {},
      async listCustomersForSearch() { return []; },
      async listSuppliersForSearch() { return []; },
    },
    transactions: {
      async listSalesInvoices() { return []; },
      async getSalesInvoice() { return null; },
      async createSalesInvoice() { throw new Error("not used in test"); },
      async updateSalesInvoiceStatus() {},
      async listPurchaseOrders() { return []; },
      async createPurchaseOrder() { throw new Error("not used in test"); },
      async listPurchaseInvoices() { return []; },
      async createPurchaseInvoice() { throw new Error("not used in test"); },
      async listPayments() { return []; },
      async createPayment() { throw new Error("not used in test"); },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
    },
    notifications: {
      async list() { return []; },
      async create() { throw new Error("not used in test"); },
      async markRead() {},
      async markAllRead() {},
    },
  };
}

describe("BusinessService", () => {
  let repos: Repositories;
  let audits: AuditService;
  let businesses: BusinessService;

  beforeEach(() => {
    repos = createMemoryRepositories();
    audits = new AuditService(repos);
    businesses = new BusinessService(repos, audits);
  });

  it("creates a business and records an audit event", async () => {
    const result = await businesses.createBusiness("u-1", {
      name: "My Store",
      type: "retail",
      country: "India",
      currency: "INR",
    });

    expect(result.name).toBe("My Store");
    expect(result.type).toBe("retail");

    const logs = await audits.listForBusiness(result.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("business.created");
  });

  it("rejects invalid business data with a VALIDATION error", async () => {
    await expect(
      businesses.createBusiness("u-1", {
        name: "X",
        type: "retail",
        country: "India",
        currency: "INR",
        gstin: "NOT-A-GSTIN",
      })
    ).rejects.toThrow(AppError);

    try {
      await businesses.createBusiness("u-1", {
        name: "X",
        type: "retail",
        country: "India",
        currency: "INR",
        gstin: "NOT-A-GSTIN",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION");
    }
  });

  it("updates an existing business", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "My Store",
      type: "retail",
      country: "India",
      currency: "INR",
    });

    const updated = await businesses.updateBusiness("u-1", created.id, {
      name: "My Renamed Store",
      type: "pharmacy",
      country: "India",
      currency: "INR",
    });

    expect(updated.name).toBe("My Renamed Store");
    expect(updated.type).toBe("pharmacy");
  });

  it("selects the first business as the active one", async () => {
    await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const active = await businesses.getActiveBusiness("u-1");
    expect(active?.name).toBe("Store A");
  });
});
