import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type { BusinessProfile, SessionUser, AuditEvent } from "@/types/domain";
import { AuditService } from "./audit.service";
import { BusinessService } from "./business.service";
import { AppError } from "@/lib/errors";

function createMemoryRepositories(): Repositories {
  const businesses = new Map<string, BusinessProfile>();
  const auditLogs: AuditEvent[] = [];
  const settings = new Map<string, unknown>();

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
      async getSetting(businessId, key) {
        return settings.get(`${businessId}:${key}`) ?? null;
      },
      async setSetting(businessId, key, value) {
        settings.set(`${businessId}:${key}`, value);
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
        return {
          id: "u-1",
          email: "a@b.com",
          fullName: input.fullName ?? "",
          username: input.username ?? "user1",
          isOwner: false,
          isDemo: false,
          role: null,
        } as SessionUser;
      },
      async isUsernameAvailable() {
        return true;
      },
      async upsertOwnProfile(_userId, input) {
        return {
          id: "u-1",
          email: input.email ?? "a@b.com",
          fullName: input.fullName ?? "",
          username: input.username ?? "user1",
          isOwner: false,
          isDemo: false,
          role: null,
        } as SessionUser;
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
      async updateCategory() { throw new Error("not used in test"); },
      async deleteCategory() {},
      async createCategory() { throw new Error("not used in test"); },
      async listProducts() { return []; },
      async getProduct() { return null; },
      async createProduct() { throw new Error("not used in test"); },
      async updateProduct() { throw new Error("not used in test"); },
      async deleteProduct() {},
      async listBatches() { return []; },
      async createBatch() { throw new Error("not used in test"); },
      async updateBatch() { throw new Error("not used in test"); },
      async listStock() { return []; },
      async addStockMovement() {},
      async listBalances() { return []; },
      async listMovements() { return []; },
      async listVariants() { return []; },
      async createVariant() { throw new Error("not used in test"); },
      async updateVariant() { throw new Error("not used in test"); },
      async deleteVariant() {},
      async listImages() { return []; },
      async addImage() { throw new Error("not used in test"); },
      async removeImage() {},
      async listProductsForSearch() { return []; },
      async listStockForSearch() { return []; },
    },
    inventory: {
      async listUnits() { return []; },
      async createUnit() { throw new Error("not used in test"); },
      async updateUnit() { throw new Error("not used in test"); },
      async deleteUnit() {},
      async listBrands() { return []; },
      async createBrand() { throw new Error("not used in test"); },
      async updateBrand() { throw new Error("not used in test"); },
      async deleteBrand() {},
      async listWarehouses() { return []; },
      async createWarehouse() { throw new Error("not used in test"); },
      async updateWarehouse() { throw new Error("not used in test"); },
      async deleteWarehouse() {},
      async listLocations() { return []; },
      async createLocation() { throw new Error("not used in test"); },
      async updateLocation() { throw new Error("not used in test"); },
      async deleteLocation() {},
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
      async getPurchaseInvoice() { return null; },
      async createPurchaseInvoice() { throw new Error("not used in test"); },
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
      async create() { throw new Error("not used in test"); },
      async markRead() {},
      async markAllRead() {},
    },
    team: {
      async listMembers() { return []; },
      async listRoles() { return []; },
      async listPermissions() { return []; },
      async listRolePermissions() { return []; },
      async listInvitations() { return []; },
      async createInvitation() { throw new Error("not used in test"); },
      async cancelInvitation() {},
      async updateMemberRole() {},
      async removeMember() {},
      async getMemberPermissions() { return ["*"]; },
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

  it("returns default sales and purchase settings when none are stored", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const sales = await businesses.getSalesDefaults(created.id);
    const purchase = await businesses.getPurchaseDefaults(created.id);
    expect(sales.defaultPaymentMode).toBe("cash");
    expect(purchase.defaultWarehouseId).toBeNull();
  });

  it("persists sales and purchase defaults", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const sales = await businesses.updateSalesDefaults("u-1", created.id, {
      defaultPaymentMode: "upi",
      defaultIntraState: false,
      defaultDiscountPercent: 5,
      allowLineDiscount: false,
    });
    const purchase = await businesses.updatePurchaseDefaults("u-1", created.id, {
      defaultWarehouseId: "wh-1",
      defaultPaymentTerms: "Net 30",
      defaultIntraState: false,
    });
    expect(sales.defaultPaymentMode).toBe("upi");
    expect(await businesses.getSalesDefaults(created.id)).toEqual(sales);
    expect(purchase.defaultPaymentTerms).toBe("Net 30");
    expect((await businesses.getPurchaseDefaults(created.id)).defaultWarehouseId).toBe("wh-1");
  });

  it("returns default tax settings when none are stored", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const tax = await businesses.getTaxDefaults(created.id);
    expect(tax.gstEnabled).toBe(true);
    expect(tax.defaultGstRate).toBe(18);
  });

  it("persists tax defaults and records an audit event", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const tax = await businesses.updateTaxDefaults("u-1", created.id, {
      gstEnabled: true,
      defaultGstRate: 12,
      defaultIntraState: false,
      defaultHsnCode: "1006",
      pricesIncludeTax: true,
    });
    expect(tax.defaultGstRate).toBe(12);
    expect(tax.defaultHsnCode).toBe("1006");
    expect(await businesses.getTaxDefaults(created.id)).toEqual(tax);

    const logs = await audits.listForBusiness(created.id);
    expect(logs.some((log) => log.action === "settings.tax.updated")).toBe(true);
  });

  it("returns default invoice settings when none are stored", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const invoice = await businesses.getInvoiceDefaults(created.id);
    expect(invoice.showLogo).toBe(true);
    expect(invoice.paperSize).toBe("a4");
  });

  it("persists invoice layout defaults", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const invoice = await businesses.updateInvoiceDefaults("u-1", created.id, {
      showLogo: false,
      showGstin: true,
      showHsn: true,
      showBankDetails: true,
      bankDetails: "HDFC 1234",
      termsAndConditions: "No returns.",
      footerNote: "Thanks!",
      paperSize: "thermal",
    });
    expect(invoice.paperSize).toBe("thermal");
    expect(invoice.showHsn).toBe(true);
    expect(await businesses.getInvoiceDefaults(created.id)).toEqual(invoice);
  });

  it("updates invoice numbering on the business profile", async () => {
    const created = await businesses.createBusiness("u-1", {
      name: "Store A",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    const updated = await businesses.updateInvoiceNumbering("u-1", created.id, {
      invoicePrefix: "bill",
      invoiceStartNumber: 2000,
    });
    expect(updated.invoicePrefix).toBe("BILL");
    expect(updated.invoiceStartNumber).toBe(2000);
    expect((await repos.businesses.getById(created.id))?.invoicePrefix).toBe("BILL");
  });
});
