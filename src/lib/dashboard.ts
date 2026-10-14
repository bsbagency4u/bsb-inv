import type {
  Payment,
  Product,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import { isActivePayment, roundMoney, type OutstandingRow } from "@/lib/party-ledger";

/**
 * Dashboard view models and pure aggregation helpers.
 *
 * Everything here is derived from real domain records. The service layer is
 * responsible for fetching; these functions never call the network and never
 * invent values — a figure is only shown when the underlying records exist.
 */

export type DashboardRangePreset = "today" | "7d" | "30d" | "month" | "custom";

export interface DashboardRange {
  preset: DashboardRangePreset;
  from: string;
  to: string;
  /** Human date span, e.g. "14 Oct 2026". */
  label: string;
}

export type DashboardTone = "default" | "success" | "warning" | "destructive" | "info";

export interface DashboardComparison {
  direction: "up" | "down" | "flat";
  /** Absolute percentage change, one decimal place. */
  percent: number;
  label: string;
}

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number";
  href: string;
  tone: DashboardTone;
  comparison?: DashboardComparison | null;
  hint?: string | null;
}

export interface DashboardSeriesPoint {
  date: string;
  label: string;
  sales: number;
  purchases: number;
}

export interface PeriodSummary {
  total: number;
  count: number;
  average: number;
  items: number;
  topParty: string | null;
}

export interface DashboardInventoryOverview {
  totalProducts: number;
  trackedProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  negative: number;
  inactive: number;
  totalStockValue: number;
  alerts: DashboardStockAlert[];
}

export interface DashboardStockAlert {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  threshold: number;
  warehouseName: string | null;
  status: "low" | "out" | "negative";
}

export interface DashboardOutstandingSummary {
  total: number;
  overdue: number;
  count: number;
  overdueCount: number;
  rows: DashboardDueInvoice[];
}

export interface DashboardDueInvoice {
  partyId: string;
  partyName: string;
  documentNo: string;
  dueDate: string | null;
  balance: number;
  daysOverdue: number;
  href: string;
}

export type DashboardActivityType =
  | "sale"
  | "purchase"
  | "sales_return"
  | "purchase_return"
  | "receipt"
  | "payment";

export interface DashboardActivityRow {
  id: string;
  date: string;
  documentNo: string;
  type: DashboardActivityType;
  typeLabel: string;
  partyName: string;
  amount: number;
  status: string;
  href: string | null;
}

export interface DashboardSetupChecklist {
  businessProfile: boolean;
  businessType: boolean;
  taxSettings: boolean;
  products: boolean;
  customers: boolean;
  suppliers: boolean;
  warehouse: boolean;
  firstSale: boolean;
  firstPurchase: boolean;
}

export interface DashboardSnapshot {
  currency: string;
  generatedAt: string;
  range: DashboardRange;
  kpis: DashboardKpi[];
  series: DashboardSeriesPoint[];
  sales: PeriodSummary;
  purchases: PeriodSummary;
  inventory: DashboardInventoryOverview;
  receivables: DashboardOutstandingSummary;
  payables: DashboardOutstandingSummary;
  activity: DashboardActivityRow[];
  setup: DashboardSetupChecklist;
  setupComplete: boolean;
}

const MS_PER_DAY = 86_400_000;

export function toIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().slice(0, 10);
}

export function isoAddDays(iso: string, days: number): string {
  const base = toIsoDate(iso);
  const date = new Date(`${base}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return base;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${toIsoDate(fromIso)}T00:00:00.000Z`);
  const to = Date.parse(`${toIsoDate(toIso)}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

function startOfMonth(iso: string): string {
  return `${toIsoDate(iso).slice(0, 7)}-01`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(`${toIsoDate(iso)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatRangeLabel(from: string, to: string): string {
  if (from === to) {
    const date = new Date(`${from}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return from;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${from} – ${to}`;
  const startLabel = start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const endLabel = end.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export const RANGE_PRESET_LABELS: Record<DashboardRangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  custom: "Custom range",
};

export function resolveRange(
  preset: DashboardRangePreset,
  today: string,
  custom?: { from?: string | null; to?: string | null }
): DashboardRange {
  const current = toIsoDate(today);
  let from = current;
  let to = current;
  switch (preset) {
    case "7d":
      from = isoAddDays(current, -6);
      break;
    case "30d":
      from = isoAddDays(current, -29);
      break;
    case "month":
      from = startOfMonth(current);
      break;
    case "custom": {
      const customFrom = toIsoDate(custom?.from) || current;
      const customTo = toIsoDate(custom?.to) || current;
      from = customFrom <= customTo ? customFrom : customTo;
      to = customFrom <= customTo ? customTo : customFrom;
      break;
    }
    default:
      break;
  }
  return { preset, from, to, label: formatRangeLabel(from, to) };
}

/** The immediately preceding window of the same length (inclusive). */
export function previousRange(range: DashboardRange): { from: string; to: string } {
  const length = Math.max(1, daysBetween(range.from, range.to) + 1);
  const to = isoAddDays(range.from, -1);
  const from = isoAddDays(to, -(length - 1));
  return { from, to };
}

export function isWithin(dateIso: string | null | undefined, from: string, to: string): boolean {
  const iso = toIsoDate(dateIso);
  return Boolean(iso) && iso >= from && iso <= to;
}

/** A sale counts once it leaves draft and is not cancelled. */
export function countsAsSale(invoice: Pick<SalesInvoice, "status">): boolean {
  return invoice.status !== "draft" && invoice.status !== "cancelled";
}

export function countsAsPurchase(invoice: Pick<PurchaseInvoice, "status">): boolean {
  return invoice.status !== "draft" && invoice.status !== "cancelled";
}

export function sumSales(invoices: SalesInvoice[], from: string, to: string): number {
  return roundMoney(
    invoices
      .filter((invoice) => countsAsSale(invoice) && isWithin(invoice.invoiceDate, from, to))
      .reduce((sum, invoice) => sum + invoice.total, 0)
  );
}

export function sumPurchases(invoices: PurchaseInvoice[], from: string, to: string): number {
  return roundMoney(
    invoices
      .filter((invoice) => countsAsPurchase(invoice) && isWithin(invoice.invoiceDate, from, to))
      .reduce((sum, invoice) => sum + invoice.total, 0)
  );
}

export function buildSalesPurchaseSeries(
  invoices: SalesInvoice[],
  purchases: PurchaseInvoice[],
  range: { from: string; to: string }
): DashboardSeriesPoint[] {
  const byDate = new Map<string, DashboardSeriesPoint>();
  for (let iso = range.from, guard = 0; iso && iso <= range.to && guard < 400; iso = isoAddDays(iso, 1), guard += 1) {
    byDate.set(iso, { date: iso, label: formatShortDate(iso), sales: 0, purchases: 0 });
  }
  for (const invoice of invoices) {
    if (!countsAsSale(invoice)) continue;
    const point = byDate.get(toIsoDate(invoice.invoiceDate));
    if (point) point.sales = roundMoney(point.sales + invoice.total);
  }
  for (const invoice of purchases) {
    if (!countsAsPurchase(invoice)) continue;
    const point = byDate.get(toIsoDate(invoice.invoiceDate));
    if (point) point.purchases = roundMoney(point.purchases + invoice.total);
  }
  return Array.from(byDate.values());
}

function lineItems(invoice: { items: Array<{ quantity: number; baseQuantity?: number | null }> }): number {
  return invoice.items.reduce(
    (sum, item) => sum + (typeof item.baseQuantity === "number" ? item.baseQuantity : item.quantity),
    0
  );
}

function topParty(entries: Array<{ name: string; total: number }>): string | null {
  if (entries.length === 0) return null;
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.name, roundMoney((totals.get(entry.name) ?? 0) + entry.total));
  }
  let bestName: string | null = null;
  let bestTotal = -1;
  for (const [name, total] of totals) {
    if (total > bestTotal) {
      bestTotal = total;
      bestName = name;
    }
  }
  return bestName;
}

export function salesSummary(
  invoices: SalesInvoice[],
  range: { from: string; to: string },
  customerNames: Map<string, string>
): PeriodSummary {
  const rows = invoices.filter(
    (invoice) => countsAsSale(invoice) && isWithin(invoice.invoiceDate, range.from, range.to)
  );
  const total = roundMoney(rows.reduce((sum, invoice) => sum + invoice.total, 0));
  const items = rows.reduce((sum, invoice) => sum + lineItems(invoice), 0);
  return {
    total,
    count: rows.length,
    average: rows.length > 0 ? roundMoney(total / rows.length) : 0,
    items,
    topParty: topParty(
      rows.map((invoice) => ({
        name: invoice.customerId ? customerNames.get(invoice.customerId) ?? "Unknown" : "Walk-in",
        total: invoice.total,
      }))
    ),
  };
}

export function purchaseSummary(
  invoices: PurchaseInvoice[],
  range: { from: string; to: string },
  supplierNames: Map<string, string>
): PeriodSummary {
  const rows = invoices.filter(
    (invoice) => countsAsPurchase(invoice) && isWithin(invoice.invoiceDate, range.from, range.to)
  );
  const total = roundMoney(rows.reduce((sum, invoice) => sum + invoice.total, 0));
  const items = rows.reduce((sum, invoice) => sum + lineItems(invoice), 0);
  return {
    total,
    count: rows.length,
    average: rows.length > 0 ? roundMoney(total / rows.length) : 0,
    items,
    topParty: topParty(
      rows.map((invoice) => ({
        name: invoice.supplierId ? supplierNames.get(invoice.supplierId) ?? "Unknown" : "Unknown",
        total: invoice.total,
      }))
    ),
  };
}

export interface InventoryValuationLike {
  productId: string;
  quantity: number;
  stockValue: number;
}

export function buildInventoryOverview(input: {
  products: Product[];
  valuation: InventoryValuationLike[];
  warehouseByProduct?: Map<string, string | null>;
}): DashboardInventoryOverview {
  const quantityByProduct = new Map(input.valuation.map((row) => [row.productId, row.quantity]));
  const valueByProduct = new Map(input.valuation.map((row) => [row.productId, row.stockValue]));

  let trackedProducts = 0;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let negative = 0;
  let inactive = 0;
  let totalStockValue = 0;
  const alerts: DashboardStockAlert[] = [];

  for (const product of input.products) {
    totalStockValue = roundMoney(totalStockValue + (valueByProduct.get(product.id) ?? 0));
    if (!product.isActive || product.productStatus !== "active") inactive += 1;
    if (!product.trackInventory) continue;
    trackedProducts += 1;
    const quantity = quantityByProduct.get(product.id) ?? 0;
    const threshold = product.lowStockThreshold;
    if (quantity < 0) {
      negative += 1;
      outOfStock += 1;
      alerts.push(alertFor(product, quantity, threshold, "negative", input.warehouseByProduct));
    } else if (quantity === 0) {
      outOfStock += 1;
      alerts.push(alertFor(product, quantity, threshold, "out", input.warehouseByProduct));
    } else if (threshold > 0 && quantity <= threshold) {
      lowStock += 1;
      alerts.push(alertFor(product, quantity, threshold, "low", input.warehouseByProduct));
    } else {
      inStock += 1;
    }
  }

  const severity: Record<DashboardStockAlert["status"], number> = { negative: 0, out: 1, low: 2 };
  alerts.sort(
    (a, b) =>
      severity[a.status] - severity[b.status] ||
      a.quantity - b.quantity ||
      a.productName.localeCompare(b.productName)
  );

  return {
    totalProducts: input.products.length,
    trackedProducts,
    inStock,
    lowStock,
    outOfStock,
    negative,
    inactive,
    totalStockValue,
    alerts,
  };
}

function alertFor(
  product: Product,
  quantity: number,
  threshold: number,
  status: DashboardStockAlert["status"],
  warehouseByProduct?: Map<string, string | null>
): DashboardStockAlert {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantity,
    threshold,
    warehouseName: warehouseByProduct?.get(product.id) ?? null,
    status,
  };
}

export function summarizeOutstanding(
  rows: OutstandingRow[],
  kind: "receivable" | "payable",
  limit = 6
): DashboardOutstandingSummary {
  const total = roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));
  const overdueRows = rows.filter((row) => row.daysOverdue > 0);
  const overdue = roundMoney(overdueRows.reduce((sum, row) => sum + row.balance, 0));
  const hrefBase = kind === "receivable" ? "/customers" : "/suppliers";
  return {
    total,
    overdue,
    count: rows.length,
    overdueCount: overdueRows.length,
    rows: rows.slice(0, limit).map((row) => ({
      partyId: row.partyId,
      partyName: row.partyName,
      documentNo: row.invoiceNo,
      dueDate: row.dueDate,
      balance: row.balance,
      daysOverdue: row.daysOverdue,
      href: `${hrefBase}/${row.partyId}`,
    })),
  };
}

export function comparison(
  current: number,
  previous: number,
  label: string
): DashboardComparison | null {
  if (previous <= 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const percent = Math.round(Math.abs(delta) * 10) / 10;
  const direction: DashboardComparison["direction"] =
    delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
  return { direction, percent, label };
}

export function buildActivity(input: {
  sales: SalesInvoice[];
  purchases: PurchaseInvoice[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  payments: Payment[];
  customerNames: Map<string, string>;
  supplierNames: Map<string, string>;
}, range: { from: string; to: string }, limit = 8): DashboardActivityRow[] {
  const rows: Array<DashboardActivityRow & { sortKey: string }> = [];

  for (const invoice of input.sales) {
    if (!countsAsSale(invoice) || !isWithin(invoice.invoiceDate, range.from, range.to)) continue;
    rows.push({
      id: invoice.id,
      date: toIsoDate(invoice.invoiceDate),
      documentNo: invoice.invoiceNo,
      type: "sale",
      typeLabel: "Sale",
      partyName: invoice.customerId
        ? input.customerNames.get(invoice.customerId) ?? "Unknown"
        : "Walk-in",
      amount: invoice.total,
      status: invoice.status,
      href: `/sales/invoices/${invoice.id}/edit`,
      sortKey: `${toIsoDate(invoice.invoiceDate)}-${invoice.createdAt}`,
    });
  }

  for (const invoice of input.purchases) {
    if (!countsAsPurchase(invoice) || !isWithin(invoice.invoiceDate, range.from, range.to)) continue;
    rows.push({
      id: invoice.id,
      date: toIsoDate(invoice.invoiceDate),
      documentNo: invoice.billNo,
      type: "purchase",
      typeLabel: "Purchase",
      partyName: invoice.supplierId
        ? input.supplierNames.get(invoice.supplierId) ?? "Unknown"
        : "Unknown",
      amount: invoice.total,
      status: invoice.status,
      href: `/purchase/invoices/${invoice.id}/edit`,
      sortKey: `${toIsoDate(invoice.invoiceDate)}-${invoice.createdAt}`,
    });
  }

  for (const item of input.salesReturns) {
    if (!isWithin(item.returnDate, range.from, range.to)) continue;
    rows.push({
      id: item.id,
      date: toIsoDate(item.returnDate),
      documentNo: item.returnNo,
      type: "sales_return",
      typeLabel: "Sales return",
      partyName: item.customerId
        ? input.customerNames.get(item.customerId) ?? "Unknown"
        : "Walk-in",
      amount: item.total,
      status: "posted",
      href: "/sales/returns",
      sortKey: `${toIsoDate(item.returnDate)}-${item.createdAt}`,
    });
  }

  for (const item of input.purchaseReturns) {
    if (!isWithin(item.returnDate, range.from, range.to)) continue;
    rows.push({
      id: item.id,
      date: toIsoDate(item.returnDate),
      documentNo: item.returnNo,
      type: "purchase_return",
      typeLabel: "Purchase return",
      partyName: item.supplierId
        ? input.supplierNames.get(item.supplierId) ?? "Unknown"
        : "Unknown",
      amount: item.total,
      status: "posted",
      href: "/purchase/returns",
      sortKey: `${toIsoDate(item.returnDate)}-${item.createdAt}`,
    });
  }

  for (const payment of input.payments) {
    if (!isActivePayment(payment) || !isWithin(payment.paymentDate, range.from, range.to)) continue;
    const isReceipt = payment.direction === "in";
    const names = payment.partyType === "customer" ? input.customerNames : input.supplierNames;
    rows.push({
      id: payment.id,
      date: toIsoDate(payment.paymentDate),
      documentNo: payment.documentNo ?? payment.id.slice(0, 8),
      type: isReceipt ? "receipt" : "payment",
      typeLabel: isReceipt ? "Receipt" : "Payment",
      partyName: payment.partyId ? names.get(payment.partyId) ?? "Unknown" : "Unknown",
      amount: payment.amount,
      status: payment.status ?? "posted",
      href: "/payments",
      sortKey: `${toIsoDate(payment.paymentDate)}-${payment.createdAt}`,
    });
  }

  return rows
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, limit)
    .map(({ sortKey: _sortKey, ...row }) => row);
}

export function setupComplete(checklist: DashboardSetupChecklist): boolean {
  return Object.values(checklist).every(Boolean);
}
