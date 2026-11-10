import { describe, expect, it } from "vitest";
import { quotationPrintHtml } from "./quotation-print";
import { quotationPrintModel } from "./document-print-models";
import { DEFAULT_QUOTATION, parseQuotationDefaults } from "./quotation-settings";
import type { BusinessProfile, Quotation } from "@/types/domain";

const business: BusinessProfile = {
  id: "b-1",
  name: "Demo Store",
  legalName: "Demo Store LLP",
  type: "retail",
  logoUrl: "https://example.com/logo.png",
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
  gstRegistrationType: "regular",
  currency: "INR",
  financialYear: "2026-27",
  invoicePrefix: "INV",
  invoiceStartNumber: 1001,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function sample(format: Quotation["format"]): Quotation {
  return {
    id: "q-1",
    businessId: "b-1",
    quotationNo: "QTN-2026-000001",
    customerId: null,
    partyName: "Acme Traders",
    partyGstin: "27BBBBB0000B1Z5",
    partyPhone: "9876543210",
    partyEmail: null,
    quotationDate: "2026-11-09",
    validUntil: "2026-11-24",
    status: "draft",
    format,
    templateId: format === "formal_proposal" ? "default-proposal" : "default-product",
    title: format === "formal_proposal" ? "Warehouse fit-out" : "Quotation",
    intro: "Thank you for the enquiry.",
    scope: "Supply and install racks.",
    timeline: "Four weeks from acceptance.",
    assumptions: "Site access on weekdays.",
    termsAndConditions: "Offer valid until the date shown.",
    notes: null,
    subtotal: 1000,
    discount: 0,
    taxTotal: 180,
    total: 1180,
    intraState: true,
    placeOfSupplyState: "MH",
    gstRegistrationSnapshot: "regular",
    convertedSalesInvoiceId: null,
    items: [
      {
        productId: null,
        name: "Rack install",
        description: null,
        sku: "RACK-01",
        hsn: "9983",
        quantity: 1,
        unit: "JOB",
        unitPrice: 1000,
        gstRate: 18,
        discount: 0,
        taxableAmount: 1000,
        taxAmount: 180,
        amount: 1180,
      },
    ],
    createdAt: "2026-11-09",
    updatedAt: "2026-11-09",
  };
}

describe("quotationPrintHtml", () => {
  it("renders product quotation GST totals and party", () => {
    const html = quotationPrintHtml(
      business,
      quotationPrintModel(sample("product_service"), { settings: DEFAULT_QUOTATION }),
      "INR"
    );
    expect(html).toContain("QTN-2026-000001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Rack install");
    expect(html).toContain("27AAAAA0000A1Z5");
    expect(html).toContain("CGST");
    expect(html).not.toContain("sheet cover");
  });

  it("renders formal proposal cover, scope, timeline and assumptions", () => {
    const html = quotationPrintHtml(
      business,
      quotationPrintModel(sample("formal_proposal"), { settings: DEFAULT_QUOTATION }),
      "INR"
    );
    expect(html).toContain("Warehouse fit-out");
    expect(html).toContain("Scope of work");
    expect(html).toContain("Timeline");
    expect(html).toContain("Assumptions");
    expect(html).toContain("sheet cover");
  });

  it("prints a readable watermark without stretching logos", () => {
    const settings = parseQuotationDefaults({
      ...DEFAULT_QUOTATION,
      showLogo: true,
      watermarkEnabled: true,
      watermarkMode: "text",
      watermarkText: "QUOTATION",
      watermarkOpacity: 0.12,
    });
    const html = quotationPrintHtml(business, quotationPrintModel(sample("product_service"), { settings }), "INR");
    expect(html).toContain("watermark-text");
    expect(html).toContain("QUOTATION");
    expect(html).toContain("object-fit: contain");
    expect(html).toContain("max-height: 48px");
  });

  it("prints A5 paper and bank details only when enabled and filled", () => {
    const emptyBank = quotationPrintHtml(
      business,
      quotationPrintModel(sample("product_service"), {
        settings: { ...DEFAULT_QUOTATION, paperSize: "a5", showBankDetails: true },
      }),
      "INR"
    );
    expect(emptyBank).toContain("size: A5");
    expect(emptyBank).not.toContain("A/c no:");

    const withBank = quotationPrintHtml(
      business,
      quotationPrintModel(sample("product_service"), {
        settings: {
          ...DEFAULT_QUOTATION,
          showBankDetails: true,
          bankDetails: {
            accountName: "Demo Store",
            accountNumber: "123456",
            ifsc: "HDFC0001",
            bankName: "HDFC",
            branch: "Pune",
            upi: "",
          },
        },
      }),
      "INR"
    );
    expect(withBank).toContain("A/c no: 123456");
  });
});
