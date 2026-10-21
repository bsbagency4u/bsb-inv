import { describe, expect, it } from "vitest";
import { ReportService } from "./report.service";
import { GST_RECON_NOTES_KEY } from "@/lib/gst-recon";
import type { Repositories } from "@/repositories/types";
import type { BusinessProfile, Payment, SalesInvoice } from "@/types/domain";

function invoice(overrides: Partial<SalesInvoice>): SalesInvoice {
  return {
    id: "inv-1",
    businessId: "b-1",
    invoiceNo: "SAL-1",
    customerId: null,
    invoiceDate: "2026-10-01",
    dueDate: null,
    status: "paid",
    subtotal: 500,
    discount: 50,
    taxTotal: 81,
    total: 531,
    paidAmount: 531,
    paymentMode: "cash",
    notes: null,
    items: [],
    gstDocumentType: "tax_invoice",
    placeOfSupplyState: "Maharashtra",
    intraState: true,
    reverseCharge: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReportService.gstReport", () => {
  it("uses net taxable value after discounts, not gross subtotal", async () => {
    const repos = {
      transactions: {
        async listSalesInvoices() {
          return [invoice({})];
        },
      },
      parties: {
        async listCustomers() {
          return [];
        },
      },
    } as unknown as Repositories;
    const reports = new ReportService(repos);
    const rows = await reports.gstReport("b-1", { from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toHaveLength(1);
    expect(rows[0].taxableAmount).toBe(450);
    expect(rows[0].taxAmount).toBe(81);
    expect(rows[0].cgst).toBe(40.5);
    expect(rows[0].sgst).toBe(40.5);
  });

  it("excludes cancelled invoices", async () => {
    const repos = {
      transactions: {
        async listSalesInvoices() {
          return [invoice({ status: "cancelled", invoiceNo: "SAL-X" })];
        },
      },
      parties: {
        async listCustomers() {
          return [];
        },
      },
    } as unknown as Repositories;
    const reports = new ReportService(repos);
    const rows = await reports.gstReport("b-1", { from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toHaveLength(0);
  });
});

function business(id: string, registration: BusinessProfile["gstRegistrationType"] = "regular"): BusinessProfile {
  return {
    id,
    name: id,
    legalName: null,
    type: "retail",
    logoUrl: null,
    address: null,
    city: null,
    state: "Maharashtra",
    country: "India",
    pincode: null,
    phone: null,
    email: null,
    website: null,
    gstin: "27AAAAA0000A1Z5",
    pan: null,
    gstRegistrationType: registration,
    currency: "INR",
    financialYear: "2026-27",
    invoicePrefix: "INV",
    invoiceStartNumber: 1,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function financeRepos(options: {
  invoices?: SalesInvoice[];
  payments?: Payment[];
  registration?: BusinessProfile["gstRegistrationType"];
  notes?: unknown;
  otherBusinessInvoices?: SalesInvoice[];
}): Repositories {
  const invoices = options.invoices ?? [];
  const payments = options.payments ?? [];
  const other = options.otherBusinessInvoices ?? [];
  return {
    businesses: {
      async getById(businessId: string) {
        return business(businessId, options.registration);
      },
      async getSetting(_businessId: string, key: string) {
        if (key === GST_RECON_NOTES_KEY) return options.notes ?? [];
        return null;
      },
      async setSetting() {},
    },
    parties: {
      async listCustomers() {
        return [];
      },
      async listSuppliers() {
        return [];
      },
    },
    transactions: {
      async listSalesInvoices(businessId: string) {
        return [...invoices, ...other].filter((row) => row.businessId === businessId);
      },
      async listPurchaseInvoices() {
        return [];
      },
      async listPayments(businessId: string) {
        return payments.filter((row) => row.businessId === businessId);
      },
      async listSalesReturns() {
        return [];
      },
      async listPurchaseReturns() {
        return [];
      },
    },
  } as unknown as Repositories;
}

describe("ReportService.financeSnapshot", () => {
  it("does not mix another tenant's sales into the snapshot", async () => {
    const reports = new ReportService(
      financeRepos({
        invoices: [invoice({ businessId: "b-1", total: 531, taxTotal: 81 })],
        otherBusinessInvoices: [invoice({ id: "inv-2", businessId: "b-2", invoiceNo: "OTHER", total: 9999, taxTotal: 0 })],
      })
    );
    const snapshot = await reports.financeSnapshot("b-1", { from: "2026-10-01", to: "2026-10-31" });
    expect(snapshot.salesCount).toBe(1);
    expect(snapshot.salesTotal).toBe(531);
    expect(snapshot.salesGst).toHaveLength(1);
  });

  it("hides GSTR-1 prep for composition dealers", async () => {
    const reports = new ReportService(financeRepos({ registration: "composition" }));
    const snapshot = await reports.financeSnapshot("b-1", { from: "2026-10-01", to: "2026-10-31" });
    expect(snapshot.filing.gstr1Allowed).toBe(false);
    expect(snapshot.filing.itcAllowed).toBe(false);
  });

  it("throws when the business record cannot be loaded instead of showing zero balances", async () => {
    const repos = financeRepos({});
    repos.businesses.getById = async () => null;
    const reports = new ReportService(repos);
    await expect(reports.financeSnapshot("missing", { from: "2026-10-01", to: "2026-10-31" })).rejects.toThrow(
      /Business not found/
    );
  });

  it("stores recon notes on the business without changing invoices", async () => {
    const stored: unknown[] = [];
    const repos = financeRepos({});
    repos.businesses.getSetting = async () => stored;
    repos.businesses.setSetting = async (_businessId, _key, value) => {
      stored.splice(0, stored.length, ...(value as unknown[]));
    };
    const reports = new ReportService(repos);
    const note = await reports.saveGstReconNote("b-1", "u-1", { from: "2026-10-01", to: "2026-10-31" }, "BILL-1", "2B missing");
    expect(note.documentNo).toBe("BILL-1");
    expect(stored).toHaveLength(1);
  });
});
