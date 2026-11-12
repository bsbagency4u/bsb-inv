import { describe, expect, it } from "vitest";
import { paperMetrics, quotationPrintHtml, QUOTATION_DESIGNER_CREDIT } from "./quotation-print";
import { quotationPrintModel } from "./document-print-models";
import { DEFAULT_QUOTATION, parseQuotationDefaults } from "./quotation-settings";
import type { BusinessProfile, Quotation, QuotationDefaults } from "@/types/domain";

const business: BusinessProfile = {
  id: "b-1",
  name: "BSB Agency",
  legalName: "BSB Agency",
  type: "retail",
  logoUrl: "https://example.com/logo.png",
  address: "1 Market Road",
  city: "Pune",
  state: "MH",
  country: "India",
  pincode: "411001",
  phone: "9999999999",
  email: "hello@bsbagency.example",
  website: "https://bsbagency.example",
  gstin: "27AAAAA0000A1Z5",
  pan: "ABCDE1234F",
  gstRegistrationType: "regular",
  currency: "INR",
  financialYear: "2026-27",
  invoicePrefix: "INV",
  invoiceStartNumber: 1001,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function sample(format: Quotation["format"], overrides: Partial<Quotation> = {}): Quotation {
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
    ...overrides,
  };
}

function ramaHospital(): Quotation {
  return sample("product_service", {
    partyName: "RAMA HOSPITAL AZAMGARH",
    partyPhone: "Durga Prasad",
    partyEmail: null,
    title: "Proposal for Online Stock Publication",
    intro: "Proposal for Online Stock Publication",
    scope: null,
    timeline: null,
    assumptions: null,
    termsAndConditions: "Payment Terms: In Advance.",
    notes: "From next year ₹3,000 plus GST is chargeable.",
    subtotal: 10000,
    discount: 0,
    taxTotal: 0,
    total: 10000,
    items: [
      {
        productId: null,
        name: "Online Stock Publication",
        description: "Proposal for Online Stock Publication",
        sku: null,
        hsn: null,
        quantity: 1,
        unit: "PCS",
        unitPrice: 10000,
        gstRate: 0,
        discount: 0,
        taxableAmount: 10000,
        taxAmount: 0,
        amount: 10000,
      },
    ],
  });
}

const brandedSettings: QuotationDefaults = parseQuotationDefaults({
  ...DEFAULT_QUOTATION,
  showLogo: true,
  showBankDetails: true,
  showSignature: true,
  showStamp: true,
  watermarkEnabled: true,
  watermarkMode: "text",
  watermarkText: "QUOTATION",
  watermarkOpacity: 0.12,
  signatureImageUrl: "https://example.com/sign.png",
  stampImageUrl: "https://example.com/stamp.png",
  bankDetails: {
    accountName: "BSB Agency",
    accountNumber: "123456789012",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
    branch: "Pune",
    upi: "bsb@hdfc",
  },
});

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
    expect(html).toContain("Grand Total");
    expect(html).toContain(QUOTATION_DESIGNER_CREDIT);
    expect(html).not.toContain("sheet cover");
  });

  it("renders formal proposal cover, scope, timeline and assumptions", () => {
    const html = quotationPrintHtml(
      business,
      quotationPrintModel(sample("formal_proposal"), { settings: DEFAULT_QUOTATION }),
      "INR"
    );
    expect(html).toContain("Warehouse fit-out");
    expect(html).toContain("Scope of Work");
    expect(html).toContain("Timeline");
    expect(html).toContain("Assumptions");
    expect(html).toContain("sheet cover");
    expect((html.match(/Designed by BSB Agency/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("prints a readable watermark without stretching logos", () => {
    const html = quotationPrintHtml(
      business,
      quotationPrintModel(sample("product_service"), { settings: brandedSettings }),
      "INR"
    );
    expect(html).toContain("watermark-text");
    expect(html).toContain("QUOTATION");
    expect(html).toContain("object-fit: contain");
    expect(html).toContain("max-height: 56px");
    expect(html).toContain("position: fixed");
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
    expect(emptyBank).not.toContain("Account Number");

    const withBank = quotationPrintHtml(
      business,
      quotationPrintModel(sample("product_service"), { settings: brandedSettings }),
      "INR"
    );
    expect(withBank).toContain("Account Number");
    expect(withBank).toContain("123456789012");
    expect(withBank).toContain("HDFC0001234");
    expect(withBank).toContain("bsb@hdfc");
    expect(withBank).not.toContain("A/c no:");
  });

  it("renders the RAMA HOSPITAL regression quotation on a single A4 sheet", () => {
    const html = quotationPrintHtml(
      business,
      quotationPrintModel(ramaHospital(), { settings: brandedSettings }),
      "INR"
    );
    expect(html).toContain("RAMA HOSPITAL AZAMGARH");
    expect(html).toContain("Durga Prasad");
    expect(html).toContain("Proposal for Online Stock Publication");
    expect(html).toContain("QTN-2026-000001");
    expect(html).toContain("10,000.00");
    expect(html).toContain("0%");
    expect(html).toContain("From next year");
    expect(html).toContain("In Advance");
    expect(html).toContain("Designed by BSB Agency");
    expect(html).toContain("hello@bsbagency.example");
    expect(html).toContain("https://bsbagency.example");
    expect(html).toContain("size: A4 portrait");
    expect((html.match(/class="sheet"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("sheet cover");
  });

  it("paginates long quotations without dropping line items", () => {
    const long = sample("product_service", {
      items: Array.from({ length: 24 }, (_, index) => ({
        productId: null,
        name: `Item ${index + 1}`,
        description: "Long description ".repeat(8),
        sku: `SKU-${index + 1}`,
        hsn: "9983",
        quantity: 1,
        unit: "PCS",
        unitPrice: 100,
        gstRate: 18,
        discount: 0,
        taxableAmount: 100,
        taxAmount: 18,
        amount: 118,
      })),
      termsAndConditions: "Terms paragraph. ".repeat(40),
    });
    const html = quotationPrintHtml(business, quotationPrintModel(long, { settings: brandedSettings }), "INR");
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 24");
    expect(html).toContain("thead");
    expect(html).toContain("display: table-header-group");
    expect(html).toContain("keep-together");
  });

  it("omits missing logo and bank fields instead of inventing them", () => {
    const html = quotationPrintHtml(
      { ...business, logoUrl: null, email: null, website: null, pan: null },
      quotationPrintModel(sample("product_service"), {
        settings: parseQuotationDefaults({
          ...DEFAULT_QUOTATION,
          showLogo: true,
          showBankDetails: true,
          logoUrl: null,
          bankDetails: {
            accountName: "",
            accountNumber: "",
            ifsc: "",
            bankName: "",
            branch: "",
            upi: "",
          },
        }),
      }),
      "INR"
    );
    expect(html).not.toContain("<img class=\"logo\"");
    expect(html).not.toContain("Bank Details");
  });
});

describe("paperMetrics", () => {
  it("supports A4, A5, landscape and custom sizes", () => {
    expect(paperMetrics({ ...DEFAULT_QUOTATION, paperSize: "a4", orientation: "portrait" }).label).toBe("A4");
    expect(paperMetrics({ ...DEFAULT_QUOTATION, paperSize: "a5", orientation: "portrait" })).toMatchObject({
      widthMm: 148,
      heightMm: 210,
    });
    expect(paperMetrics({ ...DEFAULT_QUOTATION, paperSize: "a4", orientation: "landscape" })).toMatchObject({
      widthMm: 297,
      heightMm: 210,
    });
    expect(
      paperMetrics({
        ...DEFAULT_QUOTATION,
        paperSize: "custom",
        customWidthMm: 180,
        customHeightMm: 250,
        orientation: "portrait",
      }).sizeCss
    ).toBe("180mm 250mm");
  });
});
