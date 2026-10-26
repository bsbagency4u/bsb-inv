import { describe, expect, it } from "vitest";
import type { LineItem, SalesInvoice } from "@/types/domain";
import { booksPurchaseRegister, booksSalesRegister, filingCapability, gstTotals, salesReturnCreditNotes } from "./gst-recon";
import {
  B2CL_INVOICE_THRESHOLD,
  buildCmp08,
  buildGstr1Prep,
  buildGstr3b,
  buildGstr3bPrep,
  buildGstr4,
  classifyGstr1Invoice,
  documentSeriesFromInvoices,
  gstReportVisible,
  hsnFromInvoices,
  nilExemptFromInvoices,
  placeOfSupplyFromLines,
  rateWiseFromInvoices,
  rcmLines,
  splitB2bB2c,
} from "./gst-reports";
import { DEFAULT_DOCUMENT_CONTROL } from "@/lib/document-control";
import type { PurchaseInvoice, SalesReturn } from "@/types/domain";

function item(partial: Partial<LineItem> & Pick<LineItem, "gstRate" | "taxableAmount" | "taxAmount">): LineItem {
  return {
    productId: partial.productId ?? "p-1",
    quantity: partial.quantity ?? 1,
    unitPrice: partial.unitPrice ?? partial.taxableAmount,
    gstRate: partial.gstRate,
    discount: 0,
    taxableAmount: partial.taxableAmount,
    taxAmount: partial.taxAmount,
    amount: partial.taxableAmount + partial.taxAmount,
    hsn: partial.hsn ?? "3004",
    gstSupplyType: partial.gstSupplyType,
  };
}

function sale(partial: Partial<SalesInvoice> & Pick<SalesInvoice, "id" | "total" | "taxTotal">): SalesInvoice {
  return {
    businessId: "b-1",
    invoiceNo: partial.invoiceNo ?? partial.id,
    customerId: "c-1",
    invoiceDate: "2026-10-10",
    dueDate: null,
    status: "completed",
    subtotal: partial.total - partial.taxTotal,
    discount: 0,
    paidAmount: 0,
    paymentMode: null,
    notes: null,
    items: [],
    gstDocumentType: "tax_invoice",
    intraState: true,
    reverseCharge: false,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    ...partial,
  };
}

function bill(partial: Partial<PurchaseInvoice> & Pick<PurchaseInvoice, "id" | "total" | "taxTotal">): PurchaseInvoice {
  return {
    businessId: "b-1",
    billNo: partial.billNo ?? partial.id,
    supplierId: "s-1",
    purchaseOrderId: null,
    invoiceDate: "2026-10-10",
    dueDate: null,
    status: "unpaid",
    subtotal: partial.total - partial.taxTotal,
    discount: 0,
    paidAmount: 0,
    notes: null,
    items: [],
    gstDocumentType: "tax_invoice",
    intraState: true,
    reverseCharge: false,
    itcEligible: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    ...partial,
  };
}

const period = { from: "2026-10-01", to: "2026-10-31" };
const names = new Map([["c-1", "Ada"], ["s-1", "Acme"]]);
const gstin = new Map([["c-1", "27AAAAA0000A1Z5"], ["s-1", "27BBBBB0000B1Z5"]]);

describe("GST report aggregations", () => {
  it("groups HSN and rate-wise totals from stored line snapshots", () => {
    const invoices = [
      sale({
        id: "inv-1",
        total: 236,
        taxTotal: 36,
        items: [
          item({ gstRate: 12, taxableAmount: 100, taxAmount: 12, quantity: 2, hsn: "3004" }),
          item({ gstRate: 18, taxableAmount: 100, taxAmount: 18, quantity: 1, hsn: "3004" }),
        ],
      }),
    ];
    const hsn = hsnFromInvoices(invoices, period);
    expect(hsn).toHaveLength(2);
    expect(hsn.find((row) => row.rate === 12)).toMatchObject({ hsn: "3004", quantity: 2, taxableAmount: 100, taxAmount: 12 });
    const rates = rateWiseFromInvoices(invoices, period);
    expect(rates.map((row) => row.rate)).toEqual([12, 18]);
    expect(rates.reduce((sum, row) => sum + row.taxableAmount, 0)).toBe(200);
  });

  it("splits B2B vs B2C from stored GSTIN, not a live master rewrite", () => {
    const sales = booksSalesRegister(
      [
        sale({ id: "b2b", total: 118, taxTotal: 18, customerId: "c-1" }),
        sale({ id: "b2c", total: 100, taxTotal: 0, customerId: null }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const split = splitB2bB2c(sales);
    expect(split.b2b).toHaveLength(1);
    expect(split.b2c).toHaveLength(1);
    expect(split.b2bTotals.taxable).toBe(100);
    expect(split.b2cTotals.taxable).toBe(100);
  });

  it("builds GSTR-3B net tax as outward - credit - ITC + RCM without treating it as liability", () => {
    const sales = booksSalesRegister(
      [sale({ id: "inv-1", total: 236, taxTotal: 36 })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const purchases = booksPurchaseRegister(
      [bill({ id: "bill-1", total: 118, taxTotal: 18, itcEligible: true })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const returns: SalesReturn[] = [
      {
        id: "sr-1",
        businessId: "b-1",
        salesInvoiceId: "inv-1",
        customerId: "c-1",
        returnNo: "SRT-1",
        returnDate: "2026-10-12",
        reason: null,
        total: 118,
        notes: null,
        items: [],
        createdAt: "2026-10-12T00:00:00.000Z",
      },
    ];
    const creditNotes = salesReturnCreditNotes(returns, [sale({ id: "inv-1", total: 236, taxTotal: 36 })], period, names);
    const result = buildGstr3b({
      sales,
      creditNotes,
      purchaseTotals: gstTotals(purchases),
      itcAllowed: true,
    });
    expect(result.rows.find((row) => row.key === "3_1_a")?.taxAmount).toBe(36);
    expect(result.rows.find((row) => row.key === "credit")?.taxAmount).toBe(18);
    expect(result.rows.find((row) => row.key === "4_a")?.taxAmount).toBe(18);
    expect(result.netTaxEstimate).toBe(0);
  });

  it("keeps GSTR-4 as composition books turnover", () => {
    const sales = booksSalesRegister(
      [sale({ id: "bos", total: 500, taxTotal: 0, gstDocumentType: "bill_of_supply" })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const result = buildGstr4({ sales, purchases: [] });
    expect(result.outwardTurnover).toBe(500);
    expect(result.taxCollected).toBe(0);
  });

  it("hides return-prep reports that are invalid for the registration", () => {
    const composition = filingCapability("composition");
    const unregistered = filingCapability("unregistered");
    expect(gstReportVisible({ id: "gstr-1", title: "", description: "", category: "return", requires: "gstr1Allowed" }, composition)).toBe(false);
    expect(gstReportVisible({ id: "gstr-4", title: "", description: "", category: "return", requires: "gstr4Allowed" }, composition)).toBe(true);
    expect(gstReportVisible({ id: "cmp-08", title: "", description: "", category: "return", requires: "gstr4Allowed" }, composition)).toBe(true);
    expect(gstReportVisible({ id: "gstr-3b", title: "", description: "", category: "return", requires: "gstr3bAllowed" }, filingCapability("regular"))).toBe(true);
    expect(gstReportVisible({ id: "gstr-1", title: "", description: "", category: "return", requires: "gstr1Allowed" }, unregistered)).toBe(false);
    expect(gstReportVisible({ id: "cmp-08", title: "", description: "", category: "return", requires: "gstr4Allowed" }, unregistered)).toBe(false);
    expect(gstReportVisible({ id: "tax-estimate", title: "", description: "", category: "analysis", requires: "gstr3bAllowed" }, unregistered)).toBe(false);
  });

  it("classifies GSTR-1 B2B, B2CL, B2CS and export from stored snapshots", () => {
    const sales = booksSalesRegister(
      [
        sale({ id: "b2b", total: 118, taxTotal: 18, customerId: "c-1", placeOfSupplyState: "Maharashtra" }),
        sale({
          id: "b2cl",
          total: B2CL_INVOICE_THRESHOLD + 18000,
          taxTotal: 18000,
          customerId: null,
          intraState: false,
          placeOfSupplyState: "Karnataka",
        }),
        sale({ id: "b2cs", total: 118, taxTotal: 18, customerId: null, intraState: true, placeOfSupplyState: "Maharashtra" }),
        sale({
          id: "exp",
          total: 500,
          taxTotal: 0,
          customerId: null,
          gstDocumentType: "export_invoice",
          intraState: false,
          placeOfSupplyState: "Export",
        }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(sales.map(classifyGstr1Invoice)).toEqual(["b2b", "b2cl", "b2cs", "exp"]);
    const prep = buildGstr1Prep({ sales, creditNotes: [], debitNotes: [], hsn: [], docs: [] });
    expect(prep.b2b).toHaveLength(1);
    expect(prep.b2cl).toHaveLength(1);
    expect(prep.b2cs).toHaveLength(1);
    expect(prep.exp).toHaveLength(1);
    expect(prep.tables.find((row) => row.id === "b2b")?.taxableAmount).toBe(100);
    expect(prep.issues.some((issue) => issue.key === "pos")).toBe(false);
  });

  it("splits credit notes into CDNR/CDNUR from stored GSTIN on the original party", () => {
    const invoices = [
      sale({ id: "inv-1", total: 236, taxTotal: 36, customerId: "c-1" }),
      sale({ id: "inv-2", total: 118, taxTotal: 18, customerId: null }),
    ];
    const returns: SalesReturn[] = [
      {
        id: "sr-1",
        businessId: "b-1",
        salesInvoiceId: "inv-1",
        customerId: "c-1",
        returnNo: "SRT-1",
        returnDate: "2026-10-12",
        reason: null,
        total: 118,
        notes: null,
        items: [],
        createdAt: "2026-10-12T00:00:00.000Z",
      },
      {
        id: "sr-2",
        businessId: "b-1",
        salesInvoiceId: "inv-2",
        customerId: null,
        returnNo: "SRT-2",
        returnDate: "2026-10-13",
        reason: null,
        total: 118,
        notes: null,
        items: [],
        createdAt: "2026-10-13T00:00:00.000Z",
      },
    ];
    const creditNotes = salesReturnCreditNotes(returns, invoices, period, names, gstin);
    const prep = buildGstr1Prep({ sales: [], creditNotes, debitNotes: [], hsn: [], docs: [] });
    expect(prep.cdnr).toHaveLength(1);
    expect(prep.cdnur).toHaveLength(1);
    expect(prep.cdnr[0].gstin).toBe("27AAAAA0000A1Z5");
  });

  it("keeps CMP-08 as books turnover without inventing a composition levy", () => {
    const sales = booksSalesRegister(
      [sale({ id: "bos", total: 800, taxTotal: 0, gstDocumentType: "bill_of_supply" })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const purchases = booksPurchaseRegister(
      [bill({ id: "rcm", total: 118, taxTotal: 18, reverseCharge: true, itcEligible: false })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const result = buildCmp08({ sales, purchases });
    expect(result.outwardTurnover).toBe(800);
    expect(result.taxCollected).toBe(0);
    expect(result.rcmTax).toBe(18);
  });

  it("puts only inter-state unregistered taxable supplies in GSTR-3B 3.2", () => {
    const sales = booksSalesRegister(
      [
        sale({ id: "b2b-inter", total: 118, taxTotal: 18, customerId: "c-1", intraState: false }),
        sale({ id: "b2c-inter", total: 118, taxTotal: 18, customerId: null, intraState: false }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const result = buildGstr3b({
      sales,
      creditNotes: [],
      purchaseTotals: gstTotals([]),
      itcAllowed: true,
    });
    expect(result.rows.find((row) => row.key === "3_1_a")?.taxAmount).toBe(36);
    expect(result.rows.find((row) => row.key === "3_2")?.taxAmount).toBe(18);
  });

  it("flags GSTR-1 vs GSTR-3B outward tax mismatch without inventing liability", () => {
    const sales = booksSalesRegister(
      [sale({ id: "inv-1", total: 236, taxTotal: 36 })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const gstr1 = buildGstr1Prep({
      sales: [],
      creditNotes: [],
      debitNotes: [],
      hsn: [],
      docs: [],
    });
    const result = buildGstr3bPrep({
      sales,
      creditNotes: [],
      purchaseTotals: gstTotals([]),
      itcAllowed: true,
      gstr1,
    });
    expect(result.mismatches.some((row) => row.key === "outward-tax")).toBe(true);
    expect(result.netTaxEstimate).toBe(36);
  });

  it("builds document series from stored numbers including cancelled, excluding drafts", () => {
    const rows = documentSeriesFromInvoices(
      [
        { invoiceNo: "INV-1", invoiceDate: "2026-10-01", status: "paid" },
        { invoiceNo: "INV-3", invoiceDate: "2026-10-03", status: "cancelled" },
        { invoiceNo: "INV-2", invoiceDate: "2026-10-02", status: "draft" },
        { invoiceNo: "BILL-9", invoiceDate: "2026-10-04", status: "completed" },
      ],
      period
    );
    const inv = rows.find((row) => row.prefix === "INV");
    expect(inv).toMatchObject({ fromNo: "INV-1", toNo: "INV-3", total: 2, cancelled: 1, netIssued: 1 });
  });

  it("groups place of supply and RCM from stored document flags", () => {
    const sales = booksSalesRegister(
      [
        sale({ id: "a", total: 118, taxTotal: 18, placeOfSupplyState: "Maharashtra" }),
        sale({ id: "b", total: 118, taxTotal: 18, intraState: false, placeOfSupplyState: "Karnataka" }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const pos = placeOfSupplyFromLines(sales);
    expect(pos.map((row) => row.placeOfSupplyState)).toEqual(["Karnataka", "Maharashtra"]);
    const purchases = booksPurchaseRegister(
      [bill({ id: "rcm", total: 118, taxTotal: 18, reverseCharge: true })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(rcmLines(purchases)).toHaveLength(1);
  });

  it("groups nil/exempt from stored supply type, not a live master rewrite", () => {
    const invoices = [
      sale({
        id: "ex",
        total: 80,
        taxTotal: 0,
        gstDocumentType: "bill_of_supply",
        items: [item({ gstRate: 0, taxableAmount: 80, taxAmount: 0, gstSupplyType: "exempt", hsn: "3004" })],
      }),
    ];
    const rows = nilExemptFromInvoices(invoices, period);
    expect(rows).toHaveLength(1);
    expect(rows[0].supplyType).toBe("Exempt");
    expect(rows[0].taxableAmount).toBe(80);
  });
});
