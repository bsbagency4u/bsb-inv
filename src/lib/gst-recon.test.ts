import { describe, expect, it } from "vitest";
import type { PurchaseInvoice, SalesInvoice, SalesReturn } from "@/types/domain";
import { DEFAULT_DOCUMENT_CONTROL } from "@/lib/document-control";
import {
  booksPurchaseRegister,
  booksSalesRegister,
  filingCapability,
  parseGstPortalCsv,
  parseGstReconNotes,
  reconcileGstLines,
  reconSummary,
  salesReturnCreditNotes,
  snapshotTaxable,
} from "./gst-recon";

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
    itcEligible: false,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    ...partial,
  };
}

const period = { from: "2026-10-01", to: "2026-10-31" };
const names = new Map([["c-1", "Ada"], ["s-1", "Acme"]]);
const gstin = new Map([["c-1", "27AAAAA0000A1Z5"], ["s-1", "27BBBBB0000B1Z5"]]);

describe("filingCapability", () => {
  it("hides GSTR-1 for composition and unregistered businesses", () => {
    expect(filingCapability("composition").gstr1Allowed).toBe(false);
    expect(filingCapability("unregistered").gstr1Allowed).toBe(false);
    expect(filingCapability("composition").itcAllowed).toBe(false);
    expect(filingCapability("composition").gstr4Allowed).toBe(true);
    expect(filingCapability("unregistered").gstr4Allowed).toBe(false);
  });

  it("allows GSTR-1 and ITC for regular taxpayers", () => {
    expect(filingCapability("regular").gstr1Allowed).toBe(true);
    expect(filingCapability("regular").itcAllowed).toBe(true);
    expect(filingCapability("sez").itcAllowed).toBe(true);
  });
});

describe("sales and purchase books snapshots", () => {
  it("uses stored invoice totals after discount, not a live re-derivation", () => {
    expect(snapshotTaxable(531, 81)).toBe(450);
    const rows = booksSalesRegister(
      [sale({ id: "inv-1", invoiceNo: "SAL-1", total: 531, taxTotal: 81 })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(rows[0].taxableAmount).toBe(450);
    expect(rows[0].cgst).toBe(40.5);
  });

  it("excludes drafts and cancelled sales", () => {
    const rows = booksSalesRegister(
      [
        sale({ id: "d", total: 100, taxTotal: 0, status: "draft" }),
        sale({ id: "c", total: 100, taxTotal: 0, status: "cancelled" }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(rows).toHaveLength(0);
  });

  it("marks composition / BOS purchases with no ITC even if taxTotal is present", () => {
    const rows = booksPurchaseRegister(
      [
        bill({
          id: "bos",
          billNo: "BOS-1",
          total: 200,
          taxTotal: 0,
          gstDocumentType: "bill_of_supply",
          itcEligible: false,
        }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(rows[0].itcEligible).toBe(false);
    expect(rows[0].taxAmount).toBe(0);
  });

  it("keeps RCM tax on the purchase snapshot without forcing ITC", () => {
    const rows = booksPurchaseRegister(
      [
        bill({
          id: "rcm",
          billNo: "RCM-1",
          total: 118,
          taxTotal: 18,
          reverseCharge: true,
          itcEligible: true,
        }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    expect(rows[0].reverseCharge).toBe(true);
    expect(rows[0].itcEligible).toBe(true);
    expect(rows[0].taxAmount).toBe(18);
  });

  it("flags locked documents using document control without rewriting them", () => {
    const rows = booksSalesRegister(
      [sale({ id: "old", invoiceNo: "OLD-1", invoiceDate: "2026-01-01", total: 100, taxTotal: 0 })],
      { from: "2026-01-01", to: "2026-01-31" },
      names,
      gstin,
      { ...DEFAULT_DOCUMENT_CONTROL, lockEnabled: true, lockAfterDays: 7 },
      new Date("2026-10-21T00:00:00.000Z")
    );
    expect(rows[0].locked).toBe(true);
  });

  it("adds sales-return credit notes from stored return totals", () => {
    const invoices = [sale({ id: "inv-1", total: 236, taxTotal: 36 })];
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
    const notes = salesReturnCreditNotes(returns, invoices, period, names);
    expect(notes[0].documentType).toBe("credit_note");
    expect(notes[0].taxAmount).toBe(18);
    expect(notes[0].taxableAmount).toBe(100);
  });
});

describe("GSTR-2B CSV compare", () => {
  it("matches on GSTIN + document number + date and reports taxable mismatches", () => {
    const books = booksPurchaseRegister(
      [
        bill({
          id: "b1",
          billNo: "BILL-1",
          total: 118,
          taxTotal: 18,
          supplierGstin: "27BBBBB0000B1Z5",
        }),
      ],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const csv = [
      "GSTIN,Supplier name,Invoice number,Invoice date,Invoice value,Taxable value,CGST,SGST,IGST,Reverse charge,Place of supply",
      "27BBBBB0000B1Z5,Acme,BILL-1,2026-10-10,118,90,9,9,0,N,Maharashtra",
    ].join("\n");
    const matches = reconcileGstLines(books, parseGstPortalCsv(csv));
    expect(matches).toHaveLength(1);
    expect(matches[0].status).toBe("mismatch");
    expect(matches[0].differences).toContain("taxable");
  });

  it("keeps books-only and portal-only rows without mutating invoices", () => {
    const books = booksPurchaseRegister(
      [bill({ id: "b1", billNo: "BILL-1", total: 100, taxTotal: 0, supplierGstin: "27BBBBB0000B1Z5" })],
      period,
      names,
      gstin,
      DEFAULT_DOCUMENT_CONTROL
    );
    const csv = [
      "GSTIN,Invoice number,Invoice date,Taxable value",
      "27CCCCC0000C1Z5,PORTAL-9,2026-10-10,50",
    ].join("\n");
    const matches = reconcileGstLines(books, parseGstPortalCsv(csv));
    const summary = reconSummary(matches);
    expect(summary.books_only).toBe(1);
    expect(summary.portal_only).toBe(1);
  });

  it("parses the GSTR-1 style export header used by Reports", () => {
    const csv = [
      '"GSTIN/UIN","Receiver name","Document type","Invoice number","Invoice date","Invoice value","Place of supply","Reverse charge","Taxable value","CGST","SGST","IGST","Total tax"',
      '"27AAAAA0000A1Z5","Ada","Tax Invoice","SAL-1","2026-10-10","531","Maharashtra","N","450","40.5","40.5","0","81"',
    ].join("\n");
    const rows = parseGstPortalCsv(csv);
    expect(rows[0].documentNo).toBe("SAL-1");
    expect(rows[0].taxableAmount).toBe(450);
    expect(rows[0].cgst).toBe(40.5);
  });
});

describe("recon notes", () => {
  it("ignores malformed stored notes instead of throwing", () => {
    expect(parseGstReconNotes(null)).toEqual([]);
    expect(parseGstReconNotes([{ id: "n1", documentNo: "BILL-1", note: "Check 2B" }])[0].note).toBe("Check 2B");
  });
});
