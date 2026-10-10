import { describe, expect, it } from "vitest";
import { documentPrintHtml, salesInvoicePrintHtml, shouldAutoPrint } from "./invoice-print";
import { DEFAULT_INVOICE, parseInvoiceDefaults } from "./invoice-settings";
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

const defaults: InvoiceDefaults = parseInvoiceDefaults({
  showLogo: false,
  showGstin: true,
  showHsn: true,
  showBankDetails: false,
  bankDetails: "",
  termsAndConditions: "Goods once sold are not returnable.",
  footerNote: "Thank you",
  paperSize: "a4",
});

const lineModel = {
  invoiceNo: "INV-2026-000001",
  invoiceDate: "2026-10-01",
  partyLabel: "Walk-in guest",
  paidAmount: 118,
  lines: [
    {
      name: "Soap",
      hsn: "3401",
      sku: "SOAP-01",
      batchNo: "B-100",
      quantity: 1,
      unit: "PCS",
      unitPrice: 100,
      gstRate: 18,
      amount: 118,
      mrp: 120,
    },
  ],
  subtotal: 100,
  discount: 0,
  taxTotal: 18,
  total: 118,
  intraState: true,
  cgst: 9,
  sgst: 9,
  igst: 0,
};

describe("salesInvoicePrintHtml", () => {
  it("renders invoice number, GSTIN and line totals", () => {
    const html = salesInvoicePrintHtml(business, defaults, lineModel, "INR");
    expect(html).toContain("INV-2026-000001");
    expect(html).toContain("27AAAAA0000A1Z5");
    expect(html).toContain("Soap");
    expect(html).toContain("3401");
    expect(html).toContain("Walk-in guest");
    expect(html).toContain("Thank you");
  });
});

describe("documentPrintHtml", () => {
  it("uses A5 landscape page size", () => {
    const html = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, paperSize: "a5", orientation: "landscape" },
      {
        kind: "sales_invoice",
        docNo: "INV-1",
        docDate: "2026-10-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
      },
      "INR"
    );
    expect(html).toContain("size: A5 landscape");
  });

  it("uses thermal 80mm receipt layout", () => {
    const html = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, paperSize: "thermal", showHsn: true, showBatch: true },
      {
        kind: "sales_invoice",
        docNo: "INV-1",
        docDate: "2026-10-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
      },
      "INR"
    );
    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("HSN 3401");
    expect(html).toContain("Batch B-100");
  });

  it("prints custom paper size and multiple copies", () => {
    const html = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, paperSize: "custom", customWidthMm: 72, customHeightMm: 200, copies: 2 },
      {
        kind: "sales_invoice",
        docNo: "INV-1",
        docDate: "2026-10-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
      },
      "INR"
    );
    expect(html).toContain("size: 72mm 200mm");
    expect(html).toContain("Copy 1 of 2");
    expect(html).toContain("Copy 2 of 2");
  });

  it("omits HSN when the field is off and still prints saved totals", () => {
    const html = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, showHsn: false, showTaxBreakup: true },
      {
        kind: "sales_invoice",
        docNo: "INV-1",
        docDate: "2026-10-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
        intraState: true,
        cgst: 9,
        sgst: 9,
      },
      "INR"
    );
    expect(html).not.toContain("<th>HSN</th>");
    expect(html).toContain("CGST");
    expect(html).toContain("118.00");
  });

  it("does not rewrite stored tax when later settings hide tax breakup", () => {
    const original = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, showTaxBreakup: true },
      {
        kind: "sales_invoice",
        docNo: "INV-OLD",
        docDate: "2026-09-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
        intraState: true,
        cgst: 9,
        sgst: 9,
      },
      "INR"
    );
    const reprint = documentPrintHtml(
      business,
      { ...DEFAULT_INVOICE, showTaxBreakup: false, showHsn: false },
      {
        kind: "sales_invoice",
        docNo: "INV-OLD",
        docDate: "2026-09-01",
        partyLabel: "Ravi",
        lines: lineModel.lines,
        subtotal: 100,
        discount: 0,
        taxTotal: 18,
        total: 118,
        paidAmount: 118,
        intraState: true,
        cgst: 9,
        sgst: 9,
      },
      "INR"
    );
    expect(original).toContain("118.00");
    expect(reprint).toContain("118.00");
    expect(reprint).toContain(">Tax<");
  });

  it("keeps two businesses' print settings independent", () => {
    const a = parseInvoiceDefaults({ ...DEFAULT_INVOICE, paperSize: "thermal", copies: 2 });
    const b = parseInvoiceDefaults({ ...DEFAULT_INVOICE, paperSize: "a5", copies: 1 });
    expect(a.paperSize).toBe("thermal");
    expect(b.paperSize).toBe("a5");
    expect(a.copies).not.toBe(b.copies);
  });

  it("auto-prints only when enabled for that document type", () => {
    const off = parseInvoiceDefaults({
      ...DEFAULT_INVOICE,
      autoPrintOnSave: true,
      documentTypes: { ...DEFAULT_INVOICE.documentTypes, sales_invoice: { enabled: false } },
    });
    expect(shouldAutoPrint(DEFAULT_INVOICE, "sales_invoice")).toBe(true);
    expect(shouldAutoPrint(off, "sales_invoice")).toBe(false);
    expect(shouldAutoPrint({ ...DEFAULT_INVOICE, autoPrintOnSave: false }, "sales_invoice")).toBe(false);
  });
});
