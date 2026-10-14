import type { Repositories } from "@/repositories/types";
import type { BusinessProfile } from "@/types/domain";
import { formatCurrency } from "@/lib/utils";
import { todayIsoDate } from "@/lib/document-control";
import {
  buildActivity,
  buildInventoryOverview,
  buildSalesPurchaseSeries,
  comparison,
  countsAsPurchase,
  countsAsSale,
  previousRange,
  purchaseSummary,
  resolveRange,
  salesSummary,
  setupComplete,
  summarizeOutstanding,
  sumPurchases,
  sumSales,
  type DashboardKpi,
  type DashboardRangePreset,
  type DashboardSnapshot,
  type DashboardOutstandingSummary,
} from "@/lib/dashboard";
import { AuthorizationService } from "./authorization.service";
import type { BusinessService } from "./business.service";
import { LedgerService } from "./ledger.service";
import type { InventoryService } from "./inventory.service";

export interface DashboardQuery {
  preset: DashboardRangePreset;
  customFrom?: string | null;
  customTo?: string | null;
}

export interface DashboardDependencies {
  inventory: InventoryService;
  businesses: BusinessService;
  authorization: AuthorizationService;
}

function outstandingHint(summary: DashboardOutstandingSummary, currency: string): string {
  if (summary.overdueCount > 0) {
    return `${summary.overdueCount} overdue · ${formatCurrency(summary.overdue, currency)}`;
  }
  return "Nothing overdue";
}

/**
 * Dashboard service — aggregates real repository data into a single snapshot.
 *
 * All figures come from the same transaction records, ledger service and
 * inventory valuation that the rest of the app uses, so the dashboard never
 * computes a conflicting balance. A failed query throws and surfaces an error
 * state rather than silently rendering zeros.
 */
export class DashboardService {
  private ledger: LedgerService;
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    private deps: DashboardDependencies
  ) {
    this.auth = deps.authorization;
    this.ledger = new LedgerService(repos, deps.authorization);
  }

  async getSnapshot(
    business: BusinessProfile,
    userId: string | null,
    query: DashboardQuery
  ): Promise<DashboardSnapshot> {
    if (userId) {
      await this.auth.requirePermission(business.id, userId, "dashboard.view");
    }

    const [
      sales,
      purchases,
      payments,
      salesReturns,
      purchaseReturns,
      customers,
      suppliers,
      products,
      valuation,
      balances,
      warehouses,
      tax,
    ] = await Promise.all([
      this.repos.transactions.listSalesInvoices(business.id),
      this.repos.transactions.listPurchaseInvoices(business.id),
      this.repos.transactions.listPayments(business.id),
      this.repos.transactions.listSalesReturns(business.id),
      this.repos.transactions.listPurchaseReturns(business.id),
      this.repos.parties.listCustomers(business.id),
      this.repos.parties.listSuppliers(business.id),
      this.repos.products.listProducts(business.id),
      this.deps.inventory.valuation(business.id),
      this.deps.inventory.listBalances(business.id),
      this.deps.inventory.listWarehouses(business.id),
      this.deps.businesses.getTaxDefaults(business.id),
    ]);

    const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
    const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

    const warehouseNameById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
    const warehousesByProduct = new Map<string, Set<string | null>>();
    for (const balance of balances) {
      const set = warehousesByProduct.get(balance.productId) ?? new Set<string | null>();
      set.add(balance.warehouseId);
      warehousesByProduct.set(balance.productId, set);
    }
    const warehouseByProduct = new Map<string, string | null>();
    for (const [productId, warehouseIds] of warehousesByProduct) {
      const ids = Array.from(warehouseIds);
      warehouseByProduct.set(
        productId,
        ids.length === 1 ? (ids[0] ? warehouseNameById.get(ids[0]) ?? null : null) : null
      );
    }

    const today = todayIsoDate();
    const range = resolveRange(query.preset, today, {
      from: query.customFrom,
      to: query.customTo,
    });
    const monthRange = resolveRange("month", today);
    const yesterday = previousRange(resolveRange("today", today));
    const previousMonth = previousRange(monthRange);

    const salesToday = sumSales(sales, today, today);
    const salesYesterday = sumSales(sales, yesterday.from, yesterday.to);
    const purchasesToday = sumPurchases(purchases, today, today);
    const purchasesYesterday = sumPurchases(purchases, yesterday.from, yesterday.to);
    const salesMonth = sumSales(sales, monthRange.from, monthRange.to);
    const salesPrevMonth = sumSales(sales, previousMonth.from, previousMonth.to);
    const purchasesMonth = sumPurchases(purchases, monthRange.from, monthRange.to);
    const purchasesPrevMonth = sumPurchases(purchases, previousMonth.from, previousMonth.to);

    const [receivableRows, payableRows] = await Promise.all([
      this.ledger.receivables(business.id, {}, today),
      this.ledger.payables(business.id, {}, today),
    ]);
    const receivables = summarizeOutstanding(receivableRows, "receivable");
    const payables = summarizeOutstanding(payableRows, "payable");

    const inventory = buildInventoryOverview({ products, valuation, warehouseByProduct });
    const currency = business.currency;

    const kpis: DashboardKpi[] = [
      {
        key: "sales_today",
        label: "Sales Today",
        value: salesToday,
        format: "currency",
        href: "/sales/invoices",
        tone: "success",
        comparison: comparison(salesToday, salesYesterday, "vs yesterday"),
      },
      {
        key: "purchases_today",
        label: "Purchases Today",
        value: purchasesToday,
        format: "currency",
        href: "/purchase/invoices",
        tone: "info",
        comparison: comparison(purchasesToday, purchasesYesterday, "vs yesterday"),
      },
      {
        key: "sales_month",
        label: "Sales This Month",
        value: salesMonth,
        format: "currency",
        href: "/reports",
        tone: "success",
        comparison: comparison(salesMonth, salesPrevMonth, "vs last month"),
      },
      {
        key: "purchases_month",
        label: "Purchases This Month",
        value: purchasesMonth,
        format: "currency",
        href: "/reports",
        tone: "info",
        comparison: comparison(purchasesMonth, purchasesPrevMonth, "vs last month"),
      },
      {
        key: "stock_value",
        label: "Stock Value",
        value: inventory.totalStockValue,
        format: "currency",
        href: "/inventory/stock",
        tone: "default",
        hint: `${inventory.trackedProducts} tracked products`,
      },
      {
        key: "receivables",
        label: "Receivables",
        value: receivables.total,
        format: "currency",
        href: "/outstanding",
        tone: "info",
        hint: outstandingHint(receivables, currency),
      },
      {
        key: "payables",
        label: "Payables",
        value: payables.total,
        format: "currency",
        href: "/outstanding",
        tone: "warning",
        hint: outstandingHint(payables, currency),
      },
      {
        key: "low_stock",
        label: "Low Stock Items",
        value: inventory.lowStock,
        format: "number",
        href: "/inventory/stock",
        tone: "warning",
        hint: "Need attention",
      },
      {
        key: "out_of_stock",
        label: "Out of Stock Items",
        value: inventory.outOfStock,
        format: "number",
        href: "/inventory/stock",
        tone: "destructive",
        hint: inventory.negative > 0 ? `${inventory.negative} negative` : "Nothing out",
      },
      {
        key: "overdue_invoices",
        label: "Overdue Invoices",
        value: receivables.overdueCount,
        format: "number",
        href: "/outstanding",
        tone: "destructive",
        hint: `${formatCurrency(receivables.overdue, currency)} overdue`,
      },
    ];

    const checklist = {
      businessProfile: Boolean(business.name.trim()),
      businessType: Boolean(business.type),
      taxSettings: tax.gstEnabled ? Boolean(business.gstin) : true,
      products: products.length > 0,
      customers: customers.length > 0,
      suppliers: suppliers.length > 0,
      warehouse: warehouses.length > 0,
      firstSale: sales.some(countsAsSale),
      firstPurchase: purchases.some(countsAsPurchase),
    };

    return {
      currency,
      generatedAt: new Date().toISOString(),
      range,
      kpis,
      series: buildSalesPurchaseSeries(sales, purchases, range),
      sales: salesSummary(sales, range, customerNames),
      purchases: purchaseSummary(purchases, range, supplierNames),
      inventory,
      receivables,
      payables,
      activity: buildActivity(
        { sales, purchases, salesReturns, purchaseReturns, payments, customerNames, supplierNames },
        range,
        8
      ),
      setup: checklist,
      setupComplete: setupComplete(checklist),
    };
  }
}
