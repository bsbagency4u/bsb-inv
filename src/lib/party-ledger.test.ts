import { describe, expect, it } from "vitest";
import type {
  Payment,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import {
  agingBucketFor,
  agingTotals,
  allocatedAmount,
  buildCustomerLedger,
  buildSupplierLedger,
  customerOutstanding,
  filterOutstanding,
  settlePurchaseInvoice,
  settleSalesInvoice,
  summarizeCustomer,
  summarizeSupplier,
  unallocatedAmount,
  validateAllocations,
} from "./party-ledger";

function sale(partial: Partial<SalesInvoice> & Pick<SalesInvoice, "id" | "total">): SalesInvoice {
  return {
    businessId: "b-1",
    invoiceNo: partial.invoiceNo ?? partial.id,
    customerId: "c-1",
    invoiceDate: "2026-10-01",
    dueDate: "2026-10-01",
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
    dueDate: "2026-10-01",
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
    paymentDate: "2026-10-02",
    notes: null,
    status: "posted",
    allocations: [],
    createdAt: "2026-10-02T00:00:00.000Z",
    ...partial,
  };
}

describe("party ledger allocations", () => {
  it("treats a 1:1 payment as fully allocated", () => {
    const row = payment({ id: "p1", amount: 100, salesInvoiceId: "inv-1" });
    expect(allocatedAmount(row)).toBe(100);
    expect(unallocatedAmount(row)).toBe(0);
  });

  it("keeps unallocated advances identifiable", () => {
    const row = payment({ id: "p2", amount: 250, allocations: [] });
    expect(allocatedAmount(row)).toBe(0);
    expect(unallocatedAmount(row)).toBe(250);
  });

  it("ignores cancelled payments in invoice settlement", () => {
    const invoice = sale({ id: "inv-1", total: 236 });
    const payments = [
      payment({ id: "p1", amount: 100, salesInvoiceId: "inv-1", status: "cancelled" }),
      payment({ id: "p2", amount: 50, salesInvoiceId: "inv-1" }),
    ];
    const settled = settleSalesInvoice(invoice, payments, []);
    expect(settled.paid).toBe(50);
    expect(settled.balance).toBe(186);
    expect(settled.status).toBe("partial");
  });

  it("does not allow paying a remaining balance twice", () => {
    expect(() =>
      validateAllocations({
        paymentAmount: 100,
        allocations: [{ salesInvoiceId: "inv-1", amount: 80 }],
        remainingByInvoice: new Map([["inv-1", 50]]),
      })
    ).toThrow(/outstanding balance/);
  });

  it("allows a payment larger than one invoice when the surplus stays unallocated", () => {
    validateAllocations({
      paymentAmount: 300,
      allocations: [{ salesInvoiceId: "inv-1", amount: 236 }],
      remainingByInvoice: new Map([["inv-1", 236]]),
    });
  });

  it("rejects allocations that exceed the payment amount", () => {
    expect(() =>
      validateAllocations({
        paymentAmount: 100,
        allocations: [
          { salesInvoiceId: "inv-1", amount: 80 },
          { salesInvoiceId: "inv-2", amount: 40 },
        ],
        remainingByInvoice: new Map([
          ["inv-1", 80],
          ["inv-2", 40],
        ]),
      })
    ).toThrow(/exceed the payment amount/);
  });
});

describe("sales outstanding", () => {
  it("reduces invoice balance by returns then receipts", () => {
    const invoice = sale({ id: "inv-1", total: 236, invoiceNo: "INV-1" });
    const returns: SalesReturn[] = [{
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
    }];
    const payments = [payment({ id: "p1", amount: 100, salesInvoiceId: "inv-1" })];
    const settled = settleSalesInvoice(invoice, payments, returns);
    expect(settled.adjustments).toBe(36);
    expect(settled.paid).toBe(100);
    expect(settled.balance).toBe(100);
    expect(settled.status).toBe("partial");
  });

  it("marks a fully returned invoice as returned, not unpaid", () => {
    const invoice = sale({ id: "inv-1", total: 236 });
    const returns: SalesReturn[] = [{
      id: "sr-1",
      businessId: "b-1",
      salesInvoiceId: "inv-1",
      customerId: "c-1",
      returnNo: "SRT-1",
      returnDate: "2026-10-03",
      reason: null,
      total: 236,
      notes: null,
      items: [],
      createdAt: "2026-10-03T00:00:00.000Z",
    }];
    expect(settleSalesInvoice(invoice, [], returns).status).toBe("returned");
    expect(customerOutstanding([invoice], [], returns, new Map([["c-1", "Ada"]]))).toHaveLength(0);
  });

  it("skips draft and cancelled invoices from outstanding", () => {
    const rows = customerOutstanding(
      [
        sale({ id: "d1", total: 100, status: "draft" }),
        sale({ id: "c1", total: 100, status: "cancelled" }),
        sale({ id: "open", total: 100, invoiceNo: "INV-OPEN" }),
      ],
      [],
      [],
      new Map([["c-1", "Ada"]])
    );
    expect(rows.map((row) => row.invoiceNo)).toEqual(["INV-OPEN"]);
  });

  it("ages overdue invoices from the due date", () => {
    expect(agingBucketFor(0)).toBe("0-30");
    expect(agingBucketFor(31)).toBe("31-60");
    expect(agingBucketFor(90)).toBe("61-90");
    expect(agingBucketFor(91)).toBe("90+");
  });

  it("filters and totals aging buckets from outstanding rows", () => {
    const invoice = sale({
      id: "open",
      total: 100,
      invoiceNo: "INV-OPEN",
      invoiceDate: "2026-01-01",
      dueDate: "2026-01-01",
    });
    const rows = customerOutstanding(
      [invoice],
      [],
      [],
      new Map([["c-1", "Ada"]]),
      "2026-04-15"
    );
    expect(rows[0]?.agingBucket).toBe("90+");
    expect(filterOutstanding(rows, { overdueOnly: true })).toHaveLength(1);
    expect(filterOutstanding(rows, { search: "missing" })).toHaveLength(0);
    expect(agingTotals(rows)["90+"]).toBe(100);
  });
});

describe("customer and supplier ledgers", () => {
  it("keeps a running customer balance from opening, invoice, return and receipt", () => {
    const invoice = sale({ id: "inv-1", total: 236, invoiceNo: "INV-1" });
    const returns: SalesReturn[] = [{
      id: "sr-1",
      businessId: "b-1",
      salesInvoiceId: "inv-1",
      customerId: "c-1",
      returnNo: "SRT-1",
      returnDate: "2026-10-03",
      reason: "damaged",
      total: 36,
      notes: null,
      items: [],
      createdAt: "2026-10-03T00:00:00.000Z",
    }];
    const payments = [payment({ id: "p1", amount: 200, salesInvoiceId: "inv-1", paymentDate: "2026-10-04", documentNo: "PAY-1" })];
    const lines = buildCustomerLedger({
      partyId: "c-1",
      openingBalance: 50,
      invoices: [invoice],
      returns,
      payments,
    });
    expect(lines[0]?.type).toBe("opening");
    expect(lines.at(-1)?.balance).toBe(50);
    const summary = summarizeCustomer("c-1", 50, lines);
    expect(summary.outstanding).toBe(50);
    expect(summary.invoiced).toBe(236);
    expect(summary.returned).toBe(36);
    expect(summary.paid).toBe(200);
  });

  it("does not count cancelled receipts in the customer ledger", () => {
    const lines = buildCustomerLedger({
      partyId: "c-1",
      openingBalance: 0,
      invoices: [sale({ id: "inv-1", total: 100, invoiceNo: "INV-1" })],
      returns: [],
      payments: [payment({ id: "p1", amount: 100, salesInvoiceId: "inv-1", status: "cancelled" })],
    });
    expect(lines.some((line) => line.type === "receipt")).toBe(false);
    expect(lines.at(-1)?.balance).toBe(100);
  });

  it("records supplier bills as credit and payments as debit", () => {
    const invoice = bill({ id: "bill-1", total: 500, billNo: "BILL-1" });
    const returns: PurchaseReturn[] = [{
      id: "pr-1",
      businessId: "b-1",
      purchaseInvoiceId: "bill-1",
      supplierId: "s-1",
      returnNo: "PRT-1",
      returnDate: "2026-10-03",
      reason: null,
      total: 50,
      notes: null,
      items: [],
      createdAt: "2026-10-03T00:00:00.000Z",
    }];
    const payments = [payment({
      id: "p1",
      amount: 200,
      direction: "out",
      partyType: "supplier",
      partyId: "s-1",
      purchaseInvoiceId: "bill-1",
      paymentDate: "2026-10-04",
      documentNo: "PAY-9",
    })];
    const lines = buildSupplierLedger({
      partyId: "s-1",
      openingBalance: 20,
      invoices: [invoice],
      returns,
      payments,
    });
    expect(settlePurchaseInvoice(invoice, payments, returns).balance).toBe(250);
    expect(summarizeSupplier("s-1", 20, lines).outstanding).toBe(270);
  });
});
