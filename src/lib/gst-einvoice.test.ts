import { describe, expect, it } from "vitest";
import {
  EINVOICE_SCHEME_START,
  EINVOICE_TURNOVER_THRESHOLD,
  EWB_VALUE_THRESHOLD,
  einvoiceLocksDocument,
  evaluateEinvoiceEligibility,
  evaluateEwayBillEligibility,
  formatNicDate,
  nicDocumentType,
  parseEinvoiceSettings,
  parseEwayBillSettings,
  stateCodeFromGstin,
  supplyIncludesGoods,
} from "./gst-einvoice";

const REGULAR_GSTIN = "29AAAAA0000A1Z4";
const BUYER_GSTIN = "27BBBBB0000B1ZX";

describe("evaluateEinvoiceEligibility", () => {
  const base = {
    registrationType: "regular" as const,
    supplierGstin: REGULAR_GSTIN,
    recipientGstin: BUYER_GSTIN,
    recipientRegistrationType: "registered" as const,
    documentType: "tax_invoice" as const,
    documentDate: "2026-04-15",
    documentStatus: "completed",
    aggregateTurnover: EINVOICE_TURNOVER_THRESHOLD,
    optedIn: false,
  };

  it("requires IRN for a posted B2B tax invoice when turnover is at the notified threshold", () => {
    const decision = evaluateEinvoiceEligibility(base);
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(true);
    expect(decision.blockers).toEqual([]);
  });

  it("blocks composition and unregistered businesses from IRN", () => {
    expect(evaluateEinvoiceEligibility({ ...base, registrationType: "composition" }).eligible).toBe(false);
    expect(evaluateEinvoiceEligibility({ ...base, registrationType: "unregistered" }).eligible).toBe(false);
    expect(evaluateEinvoiceEligibility({ ...base, registrationType: "isd" }).eligible).toBe(false);
  });

  it("blocks bills of supply and commercial invoices", () => {
    expect(evaluateEinvoiceEligibility({ ...base, documentType: "bill_of_supply" }).eligible).toBe(false);
    expect(evaluateEinvoiceEligibility({ ...base, documentType: "commercial_invoice" }).eligible).toBe(false);
  });

  it("allows credit notes, debit notes and export invoices", () => {
    expect(evaluateEinvoiceEligibility({ ...base, documentType: "credit_note" }).eligible).toBe(true);
    expect(evaluateEinvoiceEligibility({ ...base, documentType: "debit_note" }).eligible).toBe(true);
    expect(
      evaluateEinvoiceEligibility({
        ...base,
        documentType: "export_invoice",
        recipientGstin: null,
        recipientRegistrationType: "overseas",
      }).eligible
    ).toBe(true);
  });

  it("blocks B2C invoices without a recipient GSTIN", () => {
    const decision = evaluateEinvoiceEligibility({
      ...base,
      recipientGstin: null,
      recipientRegistrationType: "consumer",
    });
    expect(decision.eligible).toBe(false);
    expect(decision.blockers.some((item) => /B2C/i.test(item))).toBe(true);
  });

  it("blocks draft and cancelled documents", () => {
    expect(evaluateEinvoiceEligibility({ ...base, documentStatus: "draft" }).eligible).toBe(false);
    expect(evaluateEinvoiceEligibility({ ...base, documentStatus: "cancelled" }).eligible).toBe(false);
  });

  it("blocks documents dated before the scheme start", () => {
    const decision = evaluateEinvoiceEligibility({ ...base, documentDate: "2020-09-30" });
    expect(decision.eligible).toBe(false);
    expect(decision.blockers.some((item) => item.includes(EINVOICE_SCHEME_START.slice(0, 4)) || /2020/.test(item))).toBe(
      true
    );
  });

  it("keeps IRN optional when turnover is below the threshold and the business has not opted in", () => {
    const decision = evaluateEinvoiceEligibility({
      ...base,
      aggregateTurnover: 1_00_00_000,
      optedIn: false,
    });
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(false);
  });

  it("treats opt-in as required even below the threshold", () => {
    const decision = evaluateEinvoiceEligibility({
      ...base,
      aggregateTurnover: 1_00_00_000,
      optedIn: true,
    });
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(true);
  });

  it("does not mandate IRN when turnover is unknown", () => {
    const decision = evaluateEinvoiceEligibility({ ...base, aggregateTurnover: null });
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(false);
  });
});

describe("evaluateEwayBillEligibility", () => {
  const base = {
    registrationType: "regular" as const,
    supplierGstin: REGULAR_GSTIN,
    documentStatus: "completed",
    documentDate: "2026-04-15",
    invoiceValue: 75_000,
    intraState: false,
    supplyIsGoods: true,
    optedIn: false,
  };

  it("requires an e-way bill when goods value is at or above Rs 50,000", () => {
    const decision = evaluateEwayBillEligibility(base);
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(true);
  });

  it("does not require an e-way bill below the threshold", () => {
    const decision = evaluateEwayBillEligibility({ ...base, invoiceValue: EWB_VALUE_THRESHOLD - 1 });
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(false);
  });

  it("blocks services-only supplies", () => {
    const decision = evaluateEwayBillEligibility({ ...base, supplyIsGoods: false });
    expect(decision.eligible).toBe(false);
  });

  it("blocks unregistered suppliers and drafts", () => {
    expect(evaluateEwayBillEligibility({ ...base, registrationType: "unregistered" }).eligible).toBe(false);
    expect(evaluateEwayBillEligibility({ ...base, documentStatus: "draft" }).eligible).toBe(false);
  });

  it("allows composition dealers to generate e-way bills for goods", () => {
    const decision = evaluateEwayBillEligibility({ ...base, registrationType: "composition" });
    expect(decision.eligible).toBe(true);
    expect(decision.required).toBe(true);
  });
});

describe("helpers", () => {
  it("treats missing HSN as goods and chapter 99 as services", () => {
    expect(supplyIncludesGoods([])).toBe(true);
    expect(supplyIncludesGoods(["998314"])).toBe(false);
    expect(supplyIncludesGoods(["998314", "8708"])).toBe(true);
  });

  it("locks a document only after a generated IRN", () => {
    expect(einvoiceLocksDocument("generated")).toBe(true);
    expect(einvoiceLocksDocument("pending")).toBe(false);
    expect(einvoiceLocksDocument("cancelled")).toBe(false);
    expect(einvoiceLocksDocument(null)).toBe(false);
  });

  it("maps NIC document types and GSTIN state codes", () => {
    expect(nicDocumentType("tax_invoice")).toBe("INV");
    expect(nicDocumentType("credit_note")).toBe("CRN");
    expect(nicDocumentType("debit_note")).toBe("DBN");
    expect(nicDocumentType("bill_of_supply")).toBe(null);
    expect(stateCodeFromGstin(REGULAR_GSTIN)).toBe("29");
    expect(formatNicDate("2026-04-15")).toBe("15/04/2026");
  });

  it("parses stored settings without inventing turnover", () => {
    expect(parseEinvoiceSettings(null).aggregateTurnover).toBeNull();
    expect(parseEinvoiceSettings({ optedIn: true, aggregateTurnover: 60000000 }).optedIn).toBe(true);
    expect(parseEwayBillSettings({ valueThreshold: 100000 }).valueThreshold).toBe(100000);
  });
});
