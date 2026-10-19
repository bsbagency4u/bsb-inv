import { describe, expect, it } from "vitest";
import {
  canIssueTaxInvoice,
  classifyGstDocument,
  gstDocumentHeading,
  isTaxableSupplyType,
  normalizeGstPartyRegistrationType,
  normalizeGstRegistrationType,
  normalizeGstSupplyType,
  resolveIntraState,
} from "./gst";

describe("GST registration normalization", () => {
  it("keeps known registration types", () => {
    expect(normalizeGstRegistrationType("composition")).toBe("composition");
    expect(normalizeGstRegistrationType("sez")).toBe("sez");
  });

  it("falls back to unregistered for unknown values", () => {
    expect(normalizeGstRegistrationType(undefined)).toBe("unregistered");
    expect(normalizeGstRegistrationType("bogus")).toBe("unregistered");
  });

  it("normalizes party status and supply type", () => {
    expect(normalizeGstPartyRegistrationType("consumer")).toBe("consumer");
    expect(normalizeGstPartyRegistrationType(null)).toBe("unregistered");
    expect(normalizeGstSupplyType("exempt")).toBe("exempt");
    expect(normalizeGstSupplyType("nonsense")).toBe("taxable");
  });

  it("only regular statuses may issue tax invoices", () => {
    expect(canIssueTaxInvoice("regular")).toBe(true);
    expect(canIssueTaxInvoice("sez")).toBe(true);
    expect(canIssueTaxInvoice("composition")).toBe(false);
    expect(canIssueTaxInvoice("unregistered")).toBe(false);
  });
});

describe("isTaxableSupplyType", () => {
  it("treats taxable and zero-rated as taxable supplies", () => {
    expect(isTaxableSupplyType("taxable")).toBe(true);
    expect(isTaxableSupplyType("zero_rated")).toBe(true);
    expect(isTaxableSupplyType("exempt")).toBe(false);
    expect(isTaxableSupplyType("nil_rated")).toBe(false);
    expect(isTaxableSupplyType("out_of_scope")).toBe(false);
  });
});

describe("resolveIntraState", () => {
  it("matches states case-insensitively", () => {
    expect(resolveIntraState("Karnataka", "karnataka")).toBe(true);
    expect(resolveIntraState("Karnataka", "Maharashtra")).toBe(false);
  });

  it("falls back when a state is missing", () => {
    expect(resolveIntraState("Karnataka", null, true)).toBe(true);
    expect(resolveIntraState("Karnataka", null, false)).toBe(false);
    expect(resolveIntraState(null, null, false)).toBe(false);
  });
});

describe("classifyGstDocument — sales", () => {
  const taxableLine = { supplyType: "taxable" as const, rate: 18 };

  it("issues a tax invoice for a registered intra-state sale", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      partyState: "Karnataka",
      lines: [taxableLine],
    });
    expect(decision.documentType).toBe("tax_invoice");
    expect(decision.chargeTax).toBe(true);
    expect(decision.intraState).toBe(true);
    expect(decision.taxInvoiceAllowed).toBe(true);
  });

  it("switches to IGST for an inter-state sale", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      partyState: "Maharashtra",
      lines: [taxableLine],
    });
    expect(decision.intraState).toBe(false);
    expect(decision.documentType).toBe("tax_invoice");
  });

  it("issues a bill of supply for a composition dealer", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "composition",
      businessState: "Karnataka",
      partyState: "Karnataka",
      lines: [taxableLine],
    });
    expect(decision.documentType).toBe("bill_of_supply");
    expect(decision.chargeTax).toBe(false);
    expect(decision.taxInvoiceAllowed).toBe(false);
  });

  it("issues a commercial invoice when the business is unregistered", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "unregistered",
      businessState: "Karnataka",
      partyState: "Karnataka",
      lines: [taxableLine],
    });
    expect(decision.documentType).toBe("commercial_invoice");
    expect(decision.chargeTax).toBe(false);
  });

  it("issues a bill of supply when every line is exempt", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      partyState: "Karnataka",
      lines: [
        { supplyType: "exempt", rate: 0 },
        { supplyType: "nil_rated", rate: 0 },
      ],
    });
    expect(decision.documentType).toBe("bill_of_supply");
    expect(decision.chargeTax).toBe(false);
  });

  it("issues an export invoice for an overseas customer", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      partyRegistrationType: "overseas",
      lines: [{ supplyType: "zero_rated", rate: 0 }],
    });
    expect(decision.documentType).toBe("export_invoice");
    expect(decision.chargeTax).toBe(false);
    expect(decision.intraState).toBe(false);
  });

  it("does not zero tax just because the customer is unregistered", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      partyState: "Karnataka",
      partyRegistrationType: "unregistered",
      lines: [taxableLine],
    });
    expect(decision.documentType).toBe("tax_invoice");
    expect(decision.chargeTax).toBe(true);
  });

  it("uses the default treatment when party state is unknown", () => {
    const decision = classifyGstDocument({
      side: "sale",
      registrationType: "regular",
      businessState: "Karnataka",
      lines: [taxableLine],
      defaultIntraState: false,
    });
    expect(decision.intraState).toBe(false);
  });
});

describe("classifyGstDocument — purchases", () => {
  it("expects a tax invoice from a registered supplier", () => {
    const decision = classifyGstDocument({
      side: "purchase",
      registrationType: "regular",
      businessState: "Karnataka",
      partyState: "Maharashtra",
      partyRegistrationType: "registered",
      lines: [{ supplyType: "taxable", rate: 18 }],
    });
    expect(decision.documentType).toBe("tax_invoice");
    expect(decision.chargeTax).toBe(true);
    expect(decision.intraState).toBe(false);
  });

  it("expects a bill of supply from an unregistered supplier", () => {
    const decision = classifyGstDocument({
      side: "purchase",
      registrationType: "regular",
      partyState: "Karnataka",
      partyRegistrationType: "unregistered",
      lines: [{ supplyType: "taxable", rate: 18 }],
    });
    expect(decision.documentType).toBe("bill_of_supply");
    expect(decision.chargeTax).toBe(false);
  });
});

describe("gstDocumentHeading", () => {
  it("returns the legal heading", () => {
    expect(gstDocumentHeading("bill_of_supply")).toBe("Bill of Supply");
    expect(gstDocumentHeading("commercial_invoice")).toBe("Commercial Invoice");
  });
});
