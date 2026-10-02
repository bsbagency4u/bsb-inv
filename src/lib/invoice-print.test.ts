import { describe, expect, it } from "vitest";
import { salesInvoicePrintHtml } from "./invoice-print";
import type { BusinessProfile, InvoiceDefaults } from "@/types/domain";

const business: BusinessProfile = {
  id: "b-1",
  name: "Demo Store",
  legalName: "Demo Store LLP",
  type: "retail",
  logoUrl: null,
  address: "1 Market Road",
  city: "Pune",
  state: "MH",
  country: "India",
  pincode: "411001",
  phone: "9999999999",
  email: null,
  website: null,
  gstin: "27AAAAA0000A1Z5",
  pan: null,
  currency: "INR",
  financialYear: "2026-27",
  invoicePrefix: "INV",
  invoiceStartNumber: 1001,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const defaults: InvoiceDefaults = {
  showLogo: false,
  showGstin: true,
  showHsn: true,
  showBankDetails: false,
  bankDetails: "",
  termsAndConditions: "Goods once sold are not returnable.",
  footerNote: "Thank you",
  paperSize: "a4",
};

describe("salesInvoicePrintHtml", () => {
  it("renders invoice number, GSTIN and line totals", () => {
    const html = salesInvoicePrintHtml(business, defaults, {
      invoiceNo: "INV-2026-000001",
      invoiceDate: "2026-10-01",
      partyLabel: "Walk-in guest",
      paidAmount: 118,
      lines: [
        {
          name: "Soap",
          hsn: "3401",
          quantity: 1,
          unit: "PCS",
          unitPrice: 100,
          gstRate: 18,
          amount: 118,
        },
      ],
      subtotal: 100,
      discount: 0,
      taxTotal: 18,
      total: 118,
    }, "INR");
    expect(html).toContain("INV-2026-000001");
    expect(html).toContain("27AAAAA0000A1Z5");
    expect(html).toContain("Soap");
    expect(html).toContain("3401");
    expect(html).toContain("Walk-in guest");
    expect(html).toContain("Thank you");
  });
});
