import { describe, expect, it } from "vitest";
import type {
  Customer,
  Payment,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
  Supplier,
} from "@/types/domain";
import {
  advanceTotals,
  cashMovement,
  customerReconSummaries,
  outstandingTotal,
  periodPaymentRows,
  supplierReconSummaries,
} from "./finance";

function sale(partial: Partial<SalesInvoice> & Pick<SalesInvoice, "id" | "total">): SalesInvoice {
  return {
    businessId: "b-1",
    invoiceNo: partial.invoiceNo ?? partial.id,
    customerId: "c-1",
    invoiceDate: "2026-10-01",
    dueDate: "2026-09-01",
    status: "completed",
    subtotal: partial.total,
    discount: 0,
    taxTotal: 0,
    paidAmount: 0,
    paymentMode: null,
    notes: null,
    items: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

function bill(partial: Partial<PurchaseInvoice> & Pick<PurchaseInvoice, "id" | "total">): PurchaseInvoice {
  return {
    businessId: "b-1",
    billNo: partial.billNo ?? partial.id,
    supplierId: "s-1",
    purchaseOrderId: null,
    invoiceDate: "2026-10-01",
    dueDate: "2026-09-01",
    status: "unpaid",
    subtotal: partial.total,
    discount: 0,
    taxTotal: 0,
    paidAmount: 0,
    notes: null,
    items: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

function payment(partial: Partial<Payment> & Pick<Payment, "id" | "amount">): Payment {
  return {
    businessId: "b-1",
    direction: "in",
    partyType: "customer",
    partyId: "c-1",
    salesInvoiceId: null,
    purchaseInvoiceId: null,
    mode: "cash",
    reference: null,
    paymentDate: "2026-10-05",
    notes: null,
    status: "posted",
    allocations: [],
    createdAt: "2026-10-05T00:00:00.000Z",
    ...partial,
  };
}

const period = { from: "2026-10-01", to: "2026-10-31" };

describe("cash movement", () => {
  it("nets receipts and payouts by mode and ignores cancelled vouchers", () => {
    const rows = [
      payment({ id: "r1", amount: 100, direction: "in", mode: "cash" }),
      payment({ id: "r2", amount: 40, direction: "in", mode: "upi" }),
      payment({ id: "p1", amount: 25, direction: "out", partyType: "supplier", partyId: "s-1", mode: "cash" }),
      payment({ id: "x1", amount: 999, direction: "in", status: "cancelled" }),
    ];
    const cash = cashMovement(rows, period);
    expect(cash.receipts).toBe(140);
    expect(cash.payouts).toBe(25);
    expect(cash.net).toBe(115);
    expect(cash.cancelledCount).toBe(1);
    expect(cash.byMode.find((row) => row.mode === "cash")?.net).toBe(75);
  });

  it("keeps unallocated advances separate from allocated receipts", () => {
    const rows = [
      payment({ id: "adv", amount: 200, allocations: [] }),
      payment({ id: "alloc", amount: 50, salesInvoiceId: "inv-1" }),
    ];
    const totals = advanceTotals(rows);
    expect(totals.customer).toBe(200);
    expect(totals.customerCount).toBe(1);
  });

  it("lists cancelled vouchers in the period register without counting them as cash", () => {
    const rows = periodPaymentRows(
      [payment({ id: "x1", amount: 10, status: "cancelled", paymentDate: "2026-10-09" })],
      period
    );
    expect(rows).toHaveLength(1);
    expect(cashMovement(rows, period).receipts).toBe(0);
  });
});

describe("party reconciliation", () => {
  const customer: Customer = {
    id: "c-1",
    businessId: "b-1",
    name: "Ada",
    phone: null,
    email: null,
    gstin: "27AAAAA0000A1Z5",
    pan: null,
    customerType: "regular",
    gstRegistrationType: "registered",
    placeOfSupplyState: "Maharashtra",
    creditLimit: null,
    address: null,
    city: null,
    state: "Maharashtra",
    pincode: null,
    country: null,
    notes: null,
    openingBalance: 50,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("reduces customer outstanding by partial receipt, return and opening", () => {
    const invoices = [sale({ id: "inv-1", total: 236, invoiceNo: "INV-1" })];
    const returns: SalesReturn[] = [
      {
        id: "sr-1",
        businessId: "b-1",
        salesInvoiceId: "inv-1",
        customerId: "c-1",
        returnNo: "SRT-1",
        returnDate: "2026-10-03",
        reason: null,
        total: 36,
        notes: null,
        items: [],
        createdAt: "2026-10-03T00:00:00.000Z",
      },
    ];
    const payments = [payment({ id: "p1", amount: 100, salesInvoiceId: "inv-1" })];
    const rows = customerReconSummaries([customer], invoices, returns, payments, "2026-10-21");
    expect(rows[0].balance.opening).toBe(50);
    expect(rows[0].balance.invoiced).toBe(236);
    expect(rows[0].balance.returned).toBe(36);
    expect(rows[0].balance.paid).toBe(100);
    expect(rows[0].balance.outstanding).toBe(150);
    expect(rows[0].outstandingTotal).toBe(100);
    expect(rows[0].overdueCount).toBe(1);
  });

  it("keeps supplier advances and purchase returns in the same ledger math", () => {
    const supplier: Supplier = {
      id: "s-1",
      businessId: "b-1",
      name: "Acme",
      phone: null,
      email: null,
      gstin: "27BBBBB0000B1Z5",
      pan: null,
      address: null,
      city: null,
      state: "Maharashtra",
      pincode: null,
      country: null,
      gstRegistrationType: "registered",
      placeOfSupplyState: "Maharashtra",
      paymentTerms: null,
      notes: null,
      openingBalance: 0,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const invoices = [bill({ id: "bill-1", total: 500, billNo: "BILL-1" })];
    const returns: PurchaseReturn[] = [
      {
        id: "pr-1",
        businessId: "b-1",
        purchaseInvoiceId: "bill-1",
        supplierId: "s-1",
        returnNo: "PRT-1",
        returnDate: "2026-10-04",
        reason: null,
        total: 50,
        notes: null,
        items: [],
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    ];
    const payments = [
      payment({
        id: "p-out",
        amount: 200,
        direction: "out",
        partyType: "supplier",
        partyId: "s-1",
        purchaseInvoiceId: "bill-1",
      }),
      payment({
        id: "adv",
        amount: 30,
        direction: "out",
        partyType: "supplier",
        partyId: "s-1",
        allocations: [],
      }),
    ];
    const rows = supplierReconSummaries([supplier], invoices, returns, payments, "2026-10-21");
    expect(rows[0].balance.invoiced).toBe(500);
    expect(rows[0].balance.returned).toBe(50);
    expect(rows[0].balance.paid).toBe(230);
    expect(rows[0].balance.advance).toBe(30);
    expect(rows[0].balance.outstanding).toBe(220);
    expect(rows[0].outstandingTotal).toBe(250);
  });

  it("does not convert an empty ledger into a fabricated zero when there are no parties", () => {
    expect(outstandingTotal([])).toBe(0);
    expect(customerReconSummaries([], [], [], [])).toEqual([]);
  });
});
