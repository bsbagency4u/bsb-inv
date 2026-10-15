import { describe, expect, it } from "vitest";
import type {
  Payment,
  Product,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import type { OutstandingRow } from "@/lib/party-ledger";
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
  toIsoDate,
} from "./dashboard";

const TODAY = "2026-10-14";

function product(overrides: Partial<Product> & { id: string; name: string }): Product {
  return {
    businessId: "b-1",
    description: null,
    sku: null,
    barcode: null,
    categoryId: null,
    brandId: null,
    unitId: null,
    unit: "pcs",
    packUnit: null,
    packUnitId: null,
    unitsPerPack: 1,
    minSaleQty: 1,
    maxSaleQty: null,
    allowBaseSale: true,
    allowPackSale: false,
    allowPackPurchase: true,
    fixedPacking: true,
    attributes: {},
    gstRate: 0,
    hsn: null,
    purchasePrice: 0,
    salePrice: 0,
    mrp: null,
    lowStockThreshold: 0,
    minStock: 0,
    maxStock: null,
    reorderLevel: 0,
    trackInventory: true,
    taxable: true,
    productStatus: "active",
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function sale(
  overrides: Partial<SalesInvoice> & { id: string; invoiceNo: string; invoiceDate: string; total: number }
): SalesInvoice {
  return {
    businessId: "b-1",
    customerId: "c-1",
    dueDate: null,
    status: "paid",
    subtotal: overrides.total,
    discount: 0,
    taxTotal: 0,
    paidAmount: 0,
    paymentMode: null,
    notes: null,
    items: [
      {
        productId: "p-1",
        quantity: 1,
        unitPrice: overrides.total,
        gstRate: 0,
        discount: 0,
        taxableAmount: overrides.total,
        taxAmount: 0,
        amount: overrides.total,
        baseQuantity: 1,
      },
    ],
    createdAt: `${overrides.invoiceDate}T10:00:00.000Z`,
    updatedAt: `${overrides.invoiceDate}T10:00:00.000Z`,
    ...overrides,
  };
}

function purchase(
  overrides: Partial<PurchaseInvoice> & { id: string; billNo: string; invoiceDate: string; total: number }
): PurchaseInvoice {
  return {
    businessId: "b-1",
    supplierId: "s-1",
    purchaseOrderId: null,
    dueDate: null,
    status: "paid",
    subtotal: overrides.total,
    discount: 0,
    taxTotal: 0,
    paidAmount: 0,
    notes: null,
    items: [
      {
        productId: "p-1",
        quantity: 1,
        unitPrice: overrides.total,
        gstRate: 0,
        discount: 0,
        taxableAmount: overrides.total,
        taxAmount: 0,
        amount: overrides.total,
        baseQuantity: 1,
      },
    ],
    createdAt: `${overrides.invoiceDate}T10:00:00.000Z`,
    updatedAt: `${overrides.invoiceDate}T10:00:00.000Z`,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> & { id: string; paymentDate: string; amount: number }): Payment {
  return {
    businessId: "b-1",
    direction: "in",
    partyType: "customer",
    partyId: "c-1",
    salesInvoiceId: null,
    purchaseInvoiceId: null,
    mode: "cash",
    reference: null,
    notes: null,
    createdAt: `${overrides.paymentDate}T09:00:00.000Z`,
    ...overrides,
  };
}

describe("resolveRange", () => {
  it("resolves each preset relative to today", () => {
    expect(resolveRange("today", TODAY)).toMatchObject({ from: TODAY, to: TODAY });
    expect(resolveRange("7d", TODAY)).toMatchObject({ from: "2026-10-08", to: TODAY });
    expect(resolveRange("30d", TODAY)).toMatchObject({ from: "2026-09-15", to: TODAY });
    expect(resolveRange("month", TODAY)).toMatchObject({ from: "2026-10-01", to: TODAY });
  });

  it("normalises a reversed custom range", () => {
    const range = resolveRange("custom", TODAY, { from: "2026-10-10", to: "2026-10-01" });
    expect(range.from).toBe("2026-10-01");
    expect(range.to).toBe("2026-10-10");
  });
});

describe("previousRange", () => {
  it("returns the same-length window immediately before the range", () => {
    const range = resolveRange("7d", TODAY);
    expect(previousRange(range)).toEqual({ from: "2026-10-01", to: "2026-10-07" });
  });

  it("returns the previous day for a single-day range", () => {
    expect(previousRange(resolveRange("today", TODAY))).toEqual({
      from: "2026-10-13",
      to: "2026-10-13",
    });
  });
});

describe("invoice counting rules", () => {
  it("excludes drafts and cancelled documents", () => {
    expect(countsAsSale({ status: "draft" })).toBe(false);
    expect(countsAsSale({ status: "cancelled" })).toBe(false);
    expect(countsAsSale({ status: "paid" })).toBe(true);
    expect(countsAsPurchase({ status: "draft" })).toBe(false);
    expect(countsAsPurchase({ status: "partial" })).toBe(true);
  });

  it("sums only counted documents inside the range", () => {
    const invoices = [
      sale({ id: "1", invoiceNo: "A", invoiceDate: "2026-10-14", total: 100 }),
      sale({ id: "2", invoiceNo: "B", invoiceDate: "2026-10-14", total: 50, status: "draft" }),
      sale({ id: "3", invoiceNo: "C", invoiceDate: "2026-10-01", total: 999 }),
    ];
    expect(sumSales(invoices, TODAY, TODAY)).toBe(100);
  });

  it("sums purchases inside the range", () => {
    const bills = [
      purchase({ id: "1", billNo: "P1", invoiceDate: "2026-10-14", total: 200 }),
      purchase({ id: "2", billNo: "P2", invoiceDate: "2026-10-14", total: 100, status: "cancelled" }),
    ];
    expect(sumPurchases(bills, TODAY, TODAY)).toBe(200);
  });
});

describe("buildSalesPurchaseSeries", () => {
  it("creates one point per day and buckets totals", () => {
    const range = resolveRange("7d", TODAY);
    const series = buildSalesPurchaseSeries(
      [sale({ id: "1", invoiceNo: "A", invoiceDate: "2026-10-14", total: 120 })],
      [purchase({ id: "2", billNo: "B", invoiceDate: "2026-10-12", total: 80 })],
      range
    );
    expect(series).toHaveLength(7);
    expect(series[series.length - 1]).toMatchObject({ date: "2026-10-14", sales: 120, purchases: 0 });
    expect(series.find((point) => point.date === "2026-10-12")).toMatchObject({
      sales: 0,
      purchases: 80,
    });
  });
});

describe("summaries", () => {
  it("summarises sales with counts, average and top party", () => {
    const range = resolveRange("7d", TODAY);
    const customerNames = new Map([
      ["c-1", "Acme"],
      ["c-2", "Beta"],
    ]);
    const summary = salesSummary(
      [
        sale({ id: "1", invoiceNo: "A", invoiceDate: "2026-10-14", total: 100, customerId: "c-1" }),
        sale({ id: "2", invoiceNo: "B", invoiceDate: "2026-10-13", total: 300, customerId: "c-2" }),
        sale({ id: "3", invoiceNo: "C", invoiceDate: "2026-10-10", total: 50, customerId: "c-2" }),
      ],
      range,
      customerNames
    );
    expect(summary.total).toBe(450);
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(150);
    expect(summary.items).toBe(3);
    expect(summary.topParty).toBe("Beta");
  });

  it("summarises purchases", () => {
    const range = resolveRange("7d", TODAY);
    const summary = purchaseSummary(
      [purchase({ id: "1", billNo: "B1", invoiceDate: "2026-10-14", total: 500 })],
      range,
      new Map([["s-1", "Suppliex"]])
    );
    expect(summary.total).toBe(500);
    expect(summary.topParty).toBe("Suppliex");
  });
});

describe("buildInventoryOverview", () => {
  it("classifies tracked products and derives alerts", () => {
    const products = [
      product({ id: "p1", name: "In stock" }),
      product({ id: "p2", name: "Low", lowStockThreshold: 5 }),
      product({ id: "p3", name: "Out", lowStockThreshold: 5 }),
      product({ id: "p4", name: "Negative" }),
      product({ id: "p5", name: "Untracked", trackInventory: false }),
      product({ id: "p6", name: "Inactive", isActive: false, productStatus: "inactive" }),
    ];
    const valuation = [
      { productId: "p1", quantity: 5, stockValue: 50 },
      { productId: "p2", quantity: 2, stockValue: 20 },
      { productId: "p3", quantity: 0, stockValue: 0 },
      { productId: "p4", quantity: -1, stockValue: -10 },
      { productId: "p5", quantity: 100, stockValue: 1000 },
      { productId: "p6", quantity: 5, stockValue: 50 },
    ];
    const overview = buildInventoryOverview({ products, valuation });
    expect(overview.totalProducts).toBe(6);
    expect(overview.trackedProducts).toBe(5);
    expect(overview.inStock).toBe(2);
    expect(overview.lowStock).toBe(1);
    expect(overview.outOfStock).toBe(2);
    expect(overview.negative).toBe(1);
    expect(overview.inactive).toBe(1);
    expect(overview.totalStockValue).toBe(1110);
    expect(overview.alerts.map((alert) => alert.productId)).toEqual(["p4", "p3", "p2"]);
    expect(overview.alerts[0].status).toBe("negative");
  });

  it("attaches a warehouse when a product sits in one location", () => {
    const overview = buildInventoryOverview({
      products: [product({ id: "p1", name: "Only", lowStockThreshold: 5 })],
      valuation: [{ productId: "p1", quantity: 1, stockValue: 10 }],
      warehouseByProduct: new Map([["p1", "Main Warehouse"]]),
    });
    expect(overview.alerts[0].warehouseName).toBe("Main Warehouse");
  });
});

describe("summarizeOutstanding", () => {
  it("totals balances and isolates overdue rows", () => {
    const rows: OutstandingRow[] = [
      {
        partyId: "c-1",
        partyName: "Acme",
        invoiceId: "i-1",
        invoiceNo: "S-1",
        invoiceDate: "2026-09-01",
        dueDate: "2026-09-10",
        total: 500,
        paid: 0,
        adjustments: 0,
        balance: 500,
        daysOverdue: 34,
        agingBucket: "31-60",
      },
      {
        partyId: "c-2",
        partyName: "Beta",
        invoiceId: "i-2",
        invoiceNo: "S-2",
        invoiceDate: "2026-10-12",
        dueDate: "2026-10-20",
        total: 300,
        paid: 0,
        adjustments: 0,
        balance: 300,
        daysOverdue: 0,
        agingBucket: "0-30",
      },
    ];
    const summary = summarizeOutstanding(rows, "receivable");
    expect(summary.total).toBe(800);
    expect(summary.overdue).toBe(500);
    expect(summary.count).toBe(2);
    expect(summary.overdueCount).toBe(1);
    expect(summary.rows[0].href).toBe("/customers/c-1");
  });
});

describe("comparison", () => {
  it("computes percentage change against a previous period", () => {
    expect(comparison(120, 100, "vs yesterday")).toMatchObject({
      direction: "up",
      percent: 20,
      label: "vs yesterday",
    });
    expect(comparison(80, 100, "vs yesterday")).toMatchObject({ direction: "down", percent: 20 });
  });

  it("returns null when there is no comparable baseline", () => {
    expect(comparison(100, 0, "vs yesterday")).toBeNull();
  });
});

describe("buildActivity", () => {
  it("merges documents, excludes cancelled payments and sorts newest first", () => {
    const range = resolveRange("7d", TODAY);
    const rows = buildActivity(
      {
        sales: [sale({ id: "s1", invoiceNo: "S-1", invoiceDate: "2026-10-14", total: 100 })],
        purchases: [
          purchase({ id: "p1", billNo: "P-1", invoiceDate: "2026-10-13", total: 200 }),
        ],
        salesReturns: [
          {
            id: "r1",
            businessId: "b-1",
            salesInvoiceId: "s1",
            customerId: "c-1",
            returnNo: "SR-1",
            returnDate: "2026-10-12",
            reason: null,
            total: 30,
            notes: null,
            items: [],
            createdAt: "2026-10-12T10:00:00.000Z",
          } satisfies SalesReturn,
        ],
        purchaseReturns: [] as PurchaseReturn[],
        payments: [
          payment({ id: "pay1", paymentDate: "2026-10-14", amount: 100, status: "posted" }),
          payment({ id: "pay2", paymentDate: "2026-10-14", amount: 50, status: "cancelled" }),
        ],
        customerNames: new Map([["c-1", "Acme"]]),
        supplierNames: new Map([["s-1", "Suppliex"]]),
      },
      range,
      10
    );

    expect(rows.map((row) => row.type)).toEqual([
      "sale",
      "receipt",
      "purchase",
      "sales_return",
    ]);
    expect(rows.some((row) => row.id === "pay2")).toBe(false);
    expect(rows[0].partyName).toBe("Acme");
  });
});

describe("setupComplete", () => {
  it("requires every task to be satisfied", () => {
    expect(
      setupComplete({
        businessProfile: true,
        businessType: true,
        taxSettings: true,
        products: true,
        customers: true,
        suppliers: true,
        warehouse: true,
        firstSale: true,
        firstPurchase: true,
      })
    ).toBe(true);
    expect(
      setupComplete({
        businessProfile: true,
        businessType: true,
        taxSettings: true,
        products: true,
        customers: true,
        suppliers: true,
        warehouse: true,
        firstSale: false,
        firstPurchase: true,
      })
    ).toBe(false);
  });
});

describe("toIsoDate", () => {
  it("trims timestamps to a date and falls back to empty", () => {
    expect(toIsoDate("2026-10-14T10:00:00.000Z")).toBe("2026-10-14");
    expect(toIsoDate(null)).toBe("");
  });
});
