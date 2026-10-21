import type {
  Customer,
  Payment,
  PurchaseInvoice,
  PurchaseReturn,
  ReportPeriod,
  SalesInvoice,
  SalesReturn,
  Supplier,
} from "@/types/domain";
import { countsAsPurchase, countsAsSale, isWithin, toIsoDate } from "@/lib/dashboard";
import {
  agingTotals,
  buildCustomerLedger,
  buildSupplierLedger,
  customerOutstanding,
  isActivePayment,
  roundMoney,
  summarizeCustomer,
  summarizeSupplier,
  supplierOutstanding,
  unallocatedAmount,
  type OutstandingRow,
  type PartyBalance,
} from "@/lib/party-ledger";

export interface CashModeRow {
  mode: string;
  inward: number;
  outward: number;
  net: number;
  count: number;
}

export interface CashMovement {
  receipts: number;
  payouts: number;
  net: number;
  receiptCount: number;
  paymentCount: number;
  cancelledCount: number;
  byMode: CashModeRow[];
}

export interface AdvanceTotals {
  customer: number;
  supplier: number;
  customerCount: number;
  supplierCount: number;
  rows: Payment[];
}

export interface PartyReconSummary {
  kind: "customer" | "supplier";
  partyId: string;
  partyName: string;
  gstin: string | null;
  balance: PartyBalance;
  outstandingTotal: number;
  overdueTotal: number;
  openInvoiceCount: number;
  overdueCount: number;
}

function periodPayments(payments: Payment[], period: ReportPeriod, activeOnly: boolean): Payment[] {
  return payments.filter((payment) => {
    if (activeOnly && !isActivePayment(payment)) return false;
    return isWithin(payment.paymentDate, period.from, period.to);
  });
}

export function cashMovement(payments: Payment[], period: ReportPeriod): CashMovement {
  const inPeriod = periodPayments(payments, period, false);
  const cancelledCount = inPeriod.filter((payment) => !isActivePayment(payment)).length;
  const active = inPeriod.filter(isActivePayment);
  const receipts = roundMoney(
    active.filter((payment) => payment.direction === "in").reduce((sum, payment) => sum + payment.amount, 0)
  );
  const payouts = roundMoney(
    active.filter((payment) => payment.direction === "out").reduce((sum, payment) => sum + payment.amount, 0)
  );
  const modes = new Map<string, CashModeRow>();
  for (const payment of active) {
    const mode = payment.mode?.trim() || "other";
    const row = modes.get(mode) ?? { mode, inward: 0, outward: 0, net: 0, count: 0 };
    if (payment.direction === "in") row.inward = roundMoney(row.inward + payment.amount);
    else row.outward = roundMoney(row.outward + payment.amount);
    row.count += 1;
    row.net = roundMoney(row.inward - row.outward);
    modes.set(mode, row);
  }
  return {
    receipts,
    payouts,
    net: roundMoney(receipts - payouts),
    receiptCount: active.filter((payment) => payment.direction === "in").length,
    paymentCount: active.filter((payment) => payment.direction === "out").length,
    cancelledCount,
    byMode: Array.from(modes.values()).sort((a, b) => a.mode.localeCompare(b.mode)),
  };
}

export function periodPaymentRows(payments: Payment[], period: ReportPeriod): Payment[] {
  return periodPayments(payments, period, false).sort((a, b) => {
    const date = toIsoDate(b.paymentDate).localeCompare(toIsoDate(a.paymentDate));
    if (date !== 0) return date;
    return (b.documentNo ?? b.id).localeCompare(a.documentNo ?? a.id);
  });
}

export function advanceTotals(payments: Payment[]): AdvanceTotals {
  const rows = payments.filter((payment) => isActivePayment(payment) && unallocatedAmount(payment) > 0);
  const customerRows = rows.filter((payment) => payment.partyType === "customer");
  const supplierRows = rows.filter((payment) => payment.partyType === "supplier");
  return {
    customer: roundMoney(customerRows.reduce((sum, payment) => sum + unallocatedAmount(payment), 0)),
    supplier: roundMoney(supplierRows.reduce((sum, payment) => sum + unallocatedAmount(payment), 0)),
    customerCount: customerRows.length,
    supplierCount: supplierRows.length,
    rows,
  };
}

export function overdueFromRows(rows: OutstandingRow[]): { total: number; count: number } {
  const overdue = rows.filter((row) => row.daysOverdue > 0);
  return {
    total: roundMoney(overdue.reduce((sum, row) => sum + row.balance, 0)),
    count: overdue.length,
  };
}

export function outstandingTotal(rows: OutstandingRow[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));
}

export function customerReconSummaries(
  customers: Customer[],
  invoices: SalesInvoice[],
  returns: SalesReturn[],
  payments: Payment[],
  today?: string
): PartyReconSummary[] {
  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  const outstanding = customerOutstanding(invoices, payments, returns, names, today);
  return customers
    .map((customer) => {
      const lines = buildCustomerLedger({
        partyId: customer.id,
        openingBalance: customer.openingBalance,
        invoices,
        returns,
        payments,
      });
      const open = outstanding.filter((row) => row.partyId === customer.id);
      const overdue = overdueFromRows(open);
      return {
        kind: "customer" as const,
        partyId: customer.id,
        partyName: customer.name,
        gstin: customer.gstin,
        balance: summarizeCustomer(customer.id, customer.openingBalance, lines),
        outstandingTotal: outstandingTotal(open),
        overdueTotal: overdue.total,
        openInvoiceCount: open.length,
        overdueCount: overdue.count,
      };
    })
    .sort((a, b) => b.outstandingTotal - a.outstandingTotal || a.partyName.localeCompare(b.partyName));
}

export function supplierReconSummaries(
  suppliers: Supplier[],
  invoices: PurchaseInvoice[],
  returns: PurchaseReturn[],
  payments: Payment[],
  today?: string
): PartyReconSummary[] {
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const outstanding = supplierOutstanding(invoices, payments, returns, names, today);
  return suppliers
    .map((supplier) => {
      const lines = buildSupplierLedger({
        partyId: supplier.id,
        openingBalance: supplier.openingBalance,
        invoices,
        returns,
        payments,
      });
      const open = outstanding.filter((row) => row.partyId === supplier.id);
      const overdue = overdueFromRows(open);
      return {
        kind: "supplier" as const,
        partyId: supplier.id,
        partyName: supplier.name,
        gstin: supplier.gstin,
        balance: summarizeSupplier(supplier.id, supplier.openingBalance, lines),
        outstandingTotal: outstandingTotal(open),
        overdueTotal: overdue.total,
        openInvoiceCount: open.length,
        overdueCount: overdue.count,
      };
    })
    .sort((a, b) => b.outstandingTotal - a.outstandingTotal || a.partyName.localeCompare(b.partyName));
}

export function postedPeriodSales(invoices: SalesInvoice[], period: ReportPeriod): SalesInvoice[] {
  return invoices.filter(
    (invoice) => countsAsSale(invoice) && isWithin(invoice.invoiceDate, period.from, period.to)
  );
}

export function postedPeriodPurchases(invoices: PurchaseInvoice[], period: ReportPeriod): PurchaseInvoice[] {
  return invoices.filter(
    (invoice) => countsAsPurchase(invoice) && isWithin(invoice.invoiceDate, period.from, period.to)
  );
}

export { agingTotals, roundMoney };
