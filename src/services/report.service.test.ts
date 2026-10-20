import { describe, expect, it } from "vitest";
import { ReportService } from "./report.service";
import type { Repositories } from "@/repositories/types";
import type { SalesInvoice } from "@/types/domain";

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
