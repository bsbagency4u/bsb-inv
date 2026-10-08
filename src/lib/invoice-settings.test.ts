import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVOICE,
  formatShareMessage,
  isPrintDocumentEnabled,
  normalizeWhatsAppPhone,
  parseInvoiceDefaults,
} from "./invoice-settings";

describe("parseInvoiceDefaults", () => {
  it("fills new print fields from legacy stored settings", () => {
    const parsed = parseInvoiceDefaults({
      showLogo: false,
      showGstin: true,
      showHsn: true,
      showBankDetails: true,
      bankDetails: "HDFC 1234",
      termsAndConditions: "No returns.",
      footerNote: "Thanks",
      paperSize: "thermal",
    });
    expect(parsed.showLogo).toBe(false);
    expect(parsed.paperSize).toBe("thermal");
    expect(parsed.orientation).toBe("portrait");
    expect(parsed.copies).toBe(1);
    expect(parsed.autoPrintOnSave).toBe(true);
    expect(parsed.documentTypes.sales_invoice.enabled).toBe(true);
    expect(parsed.documentTypes.quotation.enabled).toBe(false);
  });

  it("keeps custom paper size and copies per stored value", () => {
    const parsed = parseInvoiceDefaults({
      ...DEFAULT_INVOICE,
      paperSize: "custom",
      customWidthMm: 72,
      customHeightMm: 200,
      copies: 3,
      defaultOutput: "pdf",
    });
    expect(parsed.paperSize).toBe("custom");
    expect(parsed.customWidthMm).toBe(72);
    expect(parsed.copies).toBe(3);
    expect(parsed.defaultOutput).toBe("pdf");
  });

  it("isolates document-type flags without rewriting tax totals", () => {
    const a = parseInvoiceDefaults({
      ...DEFAULT_INVOICE,
      documentTypes: { ...DEFAULT_INVOICE.documentTypes, purchase_invoice: { enabled: false } },
    });
    const b = parseInvoiceDefaults({
      ...DEFAULT_INVOICE,
      documentTypes: { ...DEFAULT_INVOICE.documentTypes, sales_invoice: { enabled: false } },
    });
    expect(isPrintDocumentEnabled(a, "purchase_invoice")).toBe(false);
    expect(isPrintDocumentEnabled(a, "sales_invoice")).toBe(true);
    expect(isPrintDocumentEnabled(b, "sales_invoice")).toBe(false);
  });
});

describe("share helpers", () => {
  it("formats a WhatsApp message from the template", () => {
    const message = formatShareMessage("{party} / {docTitle} {docNo} / {total}", {
      party: "Ravi",
      docTitle: "Sales invoice",
      docNo: "INV-1",
      business: "Demo",
      date: "04 Oct 2026",
      total: "₹118.00",
    });
    expect(message).toBe("Ravi / Sales invoice INV-1 / ₹118.00");
  });

  it("normalizes 10-digit Indian numbers for WhatsApp", () => {
    expect(normalizeWhatsAppPhone("98765 43210")).toBe("919876543210");
  });
});
