import type {
  Payment,
  PaymentAllocation,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";

export const DEFAULT_AGING_BUCKETS = [
  { key: "0-30", label: "0-30", minDays: 0, maxDays: 30 },
  { key: "31-60", label: "31-60", minDays: 31, maxDays: 60 },
  { key: "61-90", label: "61-90", minDays: 61, maxDays: 90 },
  { key: "90+", label: "90+", minDays: 91, maxDays: null as number | null },
] as const;

export type AgingBucket = {
  key: string;
  label: string;
  minDays: number;
  maxDays: number | null;
};

export type LedgerEntryType =
  | "opening"
  | "sales_invoice"
  | "sales_return"
  | "purchase_invoice"
  | "purchase_return"
  | "receipt"
  | "payment"
  | "cancellation"
  | "advance";

export interface LedgerLine {
  date: string;
  sortKey: string;
  documentNo: string;
  type: LedgerEntryType;
  typeLabel: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
  paymentMethod: string | null;
  remarks: string | null;
  sourceId: string;
}

export interface InvoiceSettlement {
  invoiceId: string;
  total: number;
  paid: number;
  adjustments: number;
  balance: number;
  status: string;
}

export interface OutstandingRow {
  partyId: string;
  partyName: string;
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  adjustments: number;
  balance: number;
  daysOverdue: number;
  agingBucket: string;
}

export interface PartyBalance {
  partyId: string;
  opening: number;
  invoiced: number;
  returned: number;
  paid: number;
  advance: number;
  outstanding: number;
}

export interface AllocationRequest {
  salesInvoiceId?: string | null;
  purchaseInvoiceId?: string | null;
  amount: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isActivePayment(payment: Pick<Payment, "status">): boolean {
  return payment.status !== "cancelled";
}

function isoDate(value: string | null | undefined, fallback = "1970-01-01"): string {
  if (!value) return fallback;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? fallback;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  const to = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function agingBucketFor(daysOverdue: number, buckets: AgingBucket[] = [...DEFAULT_AGING_BUCKETS]): string {
  const overdue = Math.max(0, daysOverdue);
  for (const bucket of buckets) {
    if (overdue < bucket.minDays) continue;
    if (bucket.maxDays == null || overdue <= bucket.maxDays) return bucket.key;
  }
  return buckets[buckets.length - 1]?.key ?? "90+";
}

function implicitAllocations(payment: Payment): PaymentAllocation[] {
  if ((payment.allocations ?? []).length > 0) return payment.allocations ?? [];
  if (payment.salesInvoiceId) {
    return [{
      id: `${payment.id}-sales`,
      businessId: payment.businessId,
      paymentId: payment.id,
      salesInvoiceId: payment.salesInvoiceId,
      purchaseInvoiceId: null,
      amount: payment.amount,
      createdAt: payment.createdAt,
    }];
  }
  if (payment.purchaseInvoiceId) {
    return [{
      id: `${payment.id}-purchase`,
      businessId: payment.businessId,
      paymentId: payment.id,
      salesInvoiceId: null,
      purchaseInvoiceId: payment.purchaseInvoiceId,
      amount: payment.amount,
      createdAt: payment.createdAt,
    }];
  }
  return [];
}

export function allocatedAmount(payment: Payment): number {
  return roundMoney(implicitAllocations(payment).reduce((sum, row) => sum + row.amount, 0));
}

export function unallocatedAmount(payment: Payment): number {
  if (!isActivePayment(payment)) return 0;
  return roundMoney(Math.max(0, payment.amount - allocatedAmount(payment)));
}

export function paidTowardSalesInvoice(
  invoiceId: string,
  payments: Payment[]
): number {
  return roundMoney(
    payments
      .filter(isActivePayment)
      .flatMap(implicitAllocations)
      .filter((row) => row.salesInvoiceId === invoiceId)
      .reduce((sum, row) => sum + row.amount, 0)
  );
}

export function paidTowardPurchaseInvoice(
  invoiceId: string,
  payments: Payment[]
): number {
  return roundMoney(
    payments
      .filter(isActivePayment)
      .flatMap(implicitAllocations)
      .filter((row) => row.purchaseInvoiceId === invoiceId)
      .reduce((sum, row) => sum + row.amount, 0)
  );
}

export function salesReturnTotal(invoiceId: string, returns: SalesReturn[]): number {
  return roundMoney(
    returns
      .filter((item) => item.salesInvoiceId === invoiceId)
      .reduce((sum, item) => sum + item.total, 0)
  );
}

export function purchaseReturnTotal(invoiceId: string, returns: PurchaseReturn[]): number {
  return roundMoney(
    returns
      .filter((item) => item.purchaseInvoiceId === invoiceId)
      .reduce((sum, item) => sum + item.total, 0)
  );
}

export function settleSalesInvoice(
  invoice: SalesInvoice,
  payments: Payment[],
  returns: SalesReturn[]
): InvoiceSettlement {
  const adjustments = salesReturnTotal(invoice.id, returns);
  const paid = paidTowardSalesInvoice(invoice.id, payments);
  const balance = roundMoney(Math.max(0, invoice.total - adjustments - paid));
  let status = invoice.status;
  if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "returned") {
    status = invoice.status;
  } else if (adjustments >= invoice.total) {
    status = "returned";
  } else if (paid <= 0) {
    status = "completed";
  } else if (balance <= 0) {
    status = "paid";
  } else {
    status = "partial";
  }
  return { invoiceId: invoice.id, total: invoice.total, paid, adjustments, balance, status };
}

export function settlePurchaseInvoice(
  invoice: PurchaseInvoice,
  payments: Payment[],
  returns: PurchaseReturn[]
): InvoiceSettlement {
  const adjustments = purchaseReturnTotal(invoice.id, returns);
  const paid = paidTowardPurchaseInvoice(invoice.id, payments);
  const balance = roundMoney(Math.max(0, invoice.total - adjustments - paid));
  let status = invoice.status;
  if (invoice.status === "draft" || invoice.status === "cancelled") {
    status = invoice.status;
  } else if (paid <= 0) {
    status = "unpaid";
  } else if (balance <= 0) {
    status = "paid";
  } else {
    status = "partial";
  }
  return { invoiceId: invoice.id, total: invoice.total, paid, adjustments, balance, status };
}

export function validateAllocations(input: {
  paymentAmount: number;
  allocations: AllocationRequest[];
  remainingByInvoice: Map<string, number>;
}): void {
  if (input.paymentAmount <= 0) {
    throw new Error("Payment amount must be positive.");
  }
  let allocated = 0;
  for (const row of input.allocations) {
    if (row.amount < 0) throw new Error("Allocation amount cannot be negative.");
    if (row.amount === 0) continue;
    const invoiceId = row.salesInvoiceId || row.purchaseInvoiceId;
    if (!invoiceId) throw new Error("Each allocation must point at an invoice.");
    if (row.salesInvoiceId && row.purchaseInvoiceId) {
      throw new Error("An allocation cannot point at both a sales invoice and a purchase bill.");
    }
    const remaining = input.remainingByInvoice.get(invoiceId) ?? 0;
    if (roundMoney(row.amount - remaining) > 0.009) {
      throw new Error("Allocation cannot exceed the invoice outstanding balance.");
    }
    allocated += row.amount;
  }
  if (roundMoney(allocated - input.paymentAmount) > 0.009) {
    throw new Error("Allocations cannot exceed the payment amount.");
  }
}

function pushLine(
  lines: Omit<LedgerLine, "balance">[],
  line: Omit<LedgerLine, "balance">
) {
  if (roundMoney(line.debit) === 0 && roundMoney(line.credit) === 0) return;
  lines.push({ ...line, debit: roundMoney(line.debit), credit: roundMoney(line.credit) });
}

function withRunningBalance(
  lines: Omit<LedgerLine, "balance">[],
  sign: "customer" | "supplier"
): LedgerLine[] {
  const sorted = [...lines].sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.documentNo.localeCompare(b.documentNo));
  let balance = 0;
  return sorted.map((line) => {
    if (sign === "customer") balance = roundMoney(balance + line.debit - line.credit);
    else balance = roundMoney(balance + line.credit - line.debit);
    return { ...line, balance };
  });
}

export function buildCustomerLedger(input: {
  partyId: string;
  openingBalance: number;
  invoices: SalesInvoice[];
  returns: SalesReturn[];
  payments: Payment[];
}): LedgerLine[] {
  const lines: Omit<LedgerLine, "balance">[] = [];
  if (input.openingBalance !== 0) {
    pushLine(lines, {
      date: "1970-01-01",
      sortKey: "0000-00-00-0",
      documentNo: "OPENING",
      type: "opening",
      typeLabel: "Opening balance",
      reference: null,
      debit: input.openingBalance > 0 ? input.openingBalance : 0,
      credit: input.openingBalance < 0 ? Math.abs(input.openingBalance) : 0,
      paymentMethod: null,
      remarks: "Opening balance",
      sourceId: input.partyId,
    });
  }
  for (const invoice of input.invoices) {
    if (invoice.status === "draft") continue;
    if (invoice.customerId !== input.partyId) continue;
    pushLine(lines, {
      date: isoDate(invoice.invoiceDate),
      sortKey: `${isoDate(invoice.invoiceDate)}-1-${invoice.invoiceNo}`,
      documentNo: invoice.invoiceNo,
      type: "sales_invoice",
      typeLabel: "Sales invoice",
      reference: invoice.invoiceNo,
      debit: invoice.total,
      credit: 0,
      paymentMethod: invoice.paymentMode,
      remarks: invoice.notes,
      sourceId: invoice.id,
    });
    if (invoice.status === "cancelled") {
      pushLine(lines, {
        date: isoDate(invoice.updatedAt || invoice.invoiceDate),
        sortKey: `${isoDate(invoice.updatedAt || invoice.invoiceDate)}-4-${invoice.invoiceNo}`,
        documentNo: invoice.invoiceNo,
        type: "cancellation",
        typeLabel: "Cancelled invoice",
        reference: invoice.invoiceNo,
        debit: 0,
        credit: invoice.total,
        paymentMethod: null,
        remarks: "Invoice cancelled",
        sourceId: invoice.id,
      });
    }
  }
  for (const item of input.returns) {
    if (item.customerId !== input.partyId) continue;
    pushLine(lines, {
      date: isoDate(item.returnDate),
      sortKey: `${isoDate(item.returnDate)}-2-${item.returnNo}`,
      documentNo: item.returnNo,
      type: "sales_return",
      typeLabel: "Sales return",
      reference: item.salesInvoiceId,
      debit: 0,
      credit: item.total,
      paymentMethod: null,
      remarks: item.reason ?? item.notes,
      sourceId: item.id,
    });
  }
  for (const payment of input.payments) {
    if (payment.partyId !== input.partyId || payment.partyType !== "customer") continue;
    if (!isActivePayment(payment)) continue;
    const unallocated = unallocatedAmount(payment);
    pushLine(lines, {
      date: isoDate(payment.paymentDate),
      sortKey: `${isoDate(payment.paymentDate)}-3-${payment.documentNo ?? payment.id}`,
      documentNo: payment.documentNo ?? payment.id.slice(0, 8),
      type: unallocated > 0 && allocatedAmount(payment) === 0 ? "advance" : "receipt",
      typeLabel: unallocated > 0 && allocatedAmount(payment) === 0 ? "Customer advance" : "Receipt",
      reference: payment.reference,
      debit: 0,
      credit: payment.amount,
      paymentMethod: payment.mode,
      remarks: payment.notes,
      sourceId: payment.id,
    });
  }
  return withRunningBalance(lines, "customer");
}

export function buildSupplierLedger(input: {
  partyId: string;
  openingBalance: number;
  invoices: PurchaseInvoice[];
  returns: PurchaseReturn[];
  payments: Payment[];
}): LedgerLine[] {
  const lines: Omit<LedgerLine, "balance">[] = [];
  if (input.openingBalance !== 0) {
    pushLine(lines, {
      date: "1970-01-01",
      sortKey: "0000-00-00-0",
      documentNo: "OPENING",
      type: "opening",
      typeLabel: "Opening balance",
      reference: null,
      debit: input.openingBalance < 0 ? Math.abs(input.openingBalance) : 0,
      credit: input.openingBalance > 0 ? input.openingBalance : 0,
      paymentMethod: null,
      remarks: "Opening balance",
      sourceId: input.partyId,
    });
  }
  for (const invoice of input.invoices) {
    if (invoice.status === "draft") continue;
    if (invoice.supplierId !== input.partyId) continue;
    pushLine(lines, {
      date: isoDate(invoice.invoiceDate),
      sortKey: `${isoDate(invoice.invoiceDate)}-1-${invoice.billNo}`,
      documentNo: invoice.billNo,
      type: "purchase_invoice",
      typeLabel: "Purchase bill",
      reference: invoice.billNo,
      debit: 0,
      credit: invoice.total,
      paymentMethod: null,
      remarks: invoice.notes,
      sourceId: invoice.id,
    });
    if (invoice.status === "cancelled") {
      pushLine(lines, {
        date: isoDate(invoice.updatedAt || invoice.invoiceDate),
        sortKey: `${isoDate(invoice.updatedAt || invoice.invoiceDate)}-4-${invoice.billNo}`,
        documentNo: invoice.billNo,
        type: "cancellation",
        typeLabel: "Cancelled bill",
        reference: invoice.billNo,
        debit: invoice.total,
        credit: 0,
        paymentMethod: null,
        remarks: "Bill cancelled",
        sourceId: invoice.id,
      });
    }
  }
  for (const item of input.returns) {
    if (item.supplierId !== input.partyId) continue;
    pushLine(lines, {
      date: isoDate(item.returnDate),
      sortKey: `${isoDate(item.returnDate)}-2-${item.returnNo}`,
      documentNo: item.returnNo,
      type: "purchase_return",
      typeLabel: "Purchase return",
      reference: item.purchaseInvoiceId,
      debit: item.total,
      credit: 0,
      paymentMethod: null,
      remarks: item.reason ?? item.notes,
      sourceId: item.id,
    });
  }
  for (const payment of input.payments) {
    if (payment.partyId !== input.partyId || payment.partyType !== "supplier") continue;
    if (!isActivePayment(payment)) continue;
    const unallocated = unallocatedAmount(payment);
    pushLine(lines, {
      date: isoDate(payment.paymentDate),
      sortKey: `${isoDate(payment.paymentDate)}-3-${payment.documentNo ?? payment.id}`,
      documentNo: payment.documentNo ?? payment.id.slice(0, 8),
      type: unallocated > 0 && allocatedAmount(payment) === 0 ? "advance" : "payment",
      typeLabel: unallocated > 0 && allocatedAmount(payment) === 0 ? "Supplier advance" : "Payment",
      reference: payment.reference,
      debit: payment.amount,
      credit: 0,
      paymentMethod: payment.mode,
      remarks: payment.notes,
      sourceId: payment.id,
    });
  }
  return withRunningBalance(lines, "supplier");
}

export function summarizeCustomer(
  partyId: string,
  openingBalance: number,
  lines: LedgerLine[]
): PartyBalance {
  const last = lines[lines.length - 1];
  const invoiced = roundMoney(lines.filter((l) => l.type === "sales_invoice").reduce((s, l) => s + l.debit, 0));
  const returned = roundMoney(lines.filter((l) => l.type === "sales_return" || l.type === "cancellation").reduce((s, l) => s + l.credit, 0));
  const paid = roundMoney(lines.filter((l) => l.type === "receipt" || l.type === "advance").reduce((s, l) => s + l.credit, 0));
  const advance = roundMoney(lines.filter((l) => l.type === "advance").reduce((s, l) => s + l.credit, 0));
  return {
    partyId,
    opening: openingBalance,
    invoiced,
    returned,
    paid,
    advance,
    outstanding: last ? last.balance : roundMoney(openingBalance),
  };
}

export function summarizeSupplier(
  partyId: string,
  openingBalance: number,
  lines: LedgerLine[]
): PartyBalance {
  const last = lines[lines.length - 1];
  const invoiced = roundMoney(lines.filter((l) => l.type === "purchase_invoice").reduce((s, l) => s + l.credit, 0));
  const returned = roundMoney(lines.filter((l) => l.type === "purchase_return" || l.type === "cancellation").reduce((s, l) => s + l.debit, 0));
  const paid = roundMoney(lines.filter((l) => l.type === "payment" || l.type === "advance").reduce((s, l) => s + l.debit, 0));
  const advance = roundMoney(lines.filter((l) => l.type === "advance").reduce((s, l) => s + l.debit, 0));
  return {
    partyId,
    opening: openingBalance,
    invoiced,
    returned,
    paid,
    advance,
    outstanding: last ? last.balance : roundMoney(openingBalance),
  };
}

export function customerOutstanding(
  invoices: SalesInvoice[],
  payments: Payment[],
  returns: SalesReturn[],
  partyNameById: Map<string, string>,
  today = new Date().toISOString().slice(0, 10),
  buckets: AgingBucket[] = [...DEFAULT_AGING_BUCKETS]
): OutstandingRow[] {
  const rows: OutstandingRow[] = [];
  for (const invoice of invoices) {
    if (!invoice.customerId) continue;
    if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "returned") continue;
    const settled = settleSalesInvoice(invoice, payments, returns);
    if (settled.balance <= 0) continue;
    const due = isoDate(invoice.dueDate || invoice.invoiceDate);
    const daysOverdue = Math.max(0, daysBetween(due, today));
    rows.push({
      partyId: invoice.customerId,
      partyName: partyNameById.get(invoice.customerId) ?? "Customer",
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      paid: settled.paid,
      adjustments: settled.adjustments,
      balance: settled.balance,
      daysOverdue,
      agingBucket: agingBucketFor(daysOverdue, buckets),
    });
  }
  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue || a.invoiceNo.localeCompare(b.invoiceNo));
}

export function supplierOutstanding(
  invoices: PurchaseInvoice[],
  payments: Payment[],
  returns: PurchaseReturn[],
  partyNameById: Map<string, string>,
  today = new Date().toISOString().slice(0, 10),
  buckets: AgingBucket[] = [...DEFAULT_AGING_BUCKETS]
): OutstandingRow[] {
  const rows: OutstandingRow[] = [];
  for (const invoice of invoices) {
    if (!invoice.supplierId) continue;
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    const settled = settlePurchaseInvoice(invoice, payments, returns);
    if (settled.balance <= 0) continue;
    const due = isoDate(invoice.dueDate || invoice.invoiceDate);
    const daysOverdue = Math.max(0, daysBetween(due, today));
    rows.push({
      partyId: invoice.supplierId,
      partyName: partyNameById.get(invoice.supplierId) ?? "Supplier",
      invoiceId: invoice.id,
      invoiceNo: invoice.billNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      paid: settled.paid,
      adjustments: settled.adjustments,
      balance: settled.balance,
      daysOverdue,
      agingBucket: agingBucketFor(daysOverdue, buckets),
    });
  }
  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue || a.invoiceNo.localeCompare(b.invoiceNo));
}

export function filterOutstanding(
  rows: OutstandingRow[],
  filters: {
    partyId?: string | null;
    overdueOnly?: boolean;
    minBalance?: number | null;
    fromDate?: string | null;
    toDate?: string | null;
    search?: string | null;
  }
): OutstandingRow[] {
  const q = filters.search?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (filters.partyId && row.partyId !== filters.partyId) return false;
    if (filters.overdueOnly && row.daysOverdue <= 0) return false;
    if (filters.minBalance != null && row.balance < filters.minBalance) return false;
    if (filters.fromDate && isoDate(row.invoiceDate) < filters.fromDate) return false;
    if (filters.toDate && isoDate(row.invoiceDate) > filters.toDate) return false;
    if (q && !row.invoiceNo.toLowerCase().includes(q) && !row.partyName.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function agingTotals(rows: OutstandingRow[], buckets: AgingBucket[] = [...DEFAULT_AGING_BUCKETS]) {
  const totals = Object.fromEntries(buckets.map((bucket) => [bucket.key, 0]));
  for (const row of rows) {
    totals[row.agingBucket] = roundMoney((totals[row.agingBucket] ?? 0) + row.balance);
  }
  return totals;
}
