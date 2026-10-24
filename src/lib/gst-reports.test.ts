import { describe, expect, it } from "vitest";
import type { LineItem, SalesInvoice } from "@/types/domain";
import { booksPurchaseRegister, booksSalesRegister, filingCapability, gstTotals, salesReturnCreditNotes } from "./gst-recon";
import {
  buildGstr3b,
  buildGstr4,
  gstReportVisible,
  hsnFromInvoices,
  rateWiseFromInvoices,
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
    expect(result.rows.find((row) => row.key === "intra")?.taxAmount).toBe(36);
    expect(result.rows.find((row) => row.key === "credit")?.taxAmount).toBe(18);
    expect(result.rows.find((row) => row.key === "itc")?.taxAmount).toBe(18);
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
    expect(gstReportVisible({ id: "gstr-1", title: "", description: "", category: "return", requires: "gstr1Allowed" }, composition)).toBe(false);
    expect(gstReportVisible({ id: "gstr-4", title: "", description: "", category: "return", requires: "gstr4Allowed" }, composition)).toBe(true);
    expect(gstReportVisible({ id: "gstr-3b", title: "", description: "", category: "return", requires: "gstr3bAllowed" }, filingCapability("regular"))).toBe(true);
  });
});
