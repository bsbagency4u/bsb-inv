import { describe, expect, it } from "vitest";
import type { Product, ProductBatch, StockMovement } from "@/types/domain";
import { runStockReport, type ReportCatalog } from "./engine";
import { accumulateFlow } from "./stock-math";
import type { StockReportQuery } from "./types";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    businessId: "b-1",
    name: "Paracetamol",
    description: null,
    sku: "PARA-500",
    barcode: null,
    categoryId: "c-1",
    brandId: "br-1",
    unitId: null,
    unit: "tab",
    packUnit: null,
    packUnitId: null,
    unitsPerPack: 1,
    minSaleQty: 1,
    maxSaleQty: null,
    allowBaseSale: true,
    allowPackSale: false,
    attributes: {},
    gstRate: 12,
    hsn: null,
    purchasePrice: 10,
    salePrice: 15,
    mrp: 20,
    lowStockThreshold: 20,
    minStock: 10,
    maxStock: null,
    reorderLevel: 25,
    trackInventory: true,
    taxable: true,
    productStatus: "active",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function movement(overrides: Partial<StockMovement> & Pick<StockMovement, "change" | "movementType" | "createdAt">): StockMovement {
  return {
    id: overrides.id ?? `m-${overrides.createdAt}-${overrides.movementType}`,
    businessId: "b-1",
    productId: "p-1",
    variantId: null,
    batchId: overrides.batchId ?? null,
    warehouseId: overrides.warehouseId ?? "w-1",
    locationId: null,
    toWarehouseId: null,
    toLocationId: null,
    reason: overrides.movementType.toLowerCase(),
    referenceType: null,
    referenceId: overrides.referenceId ?? null,
    notes: null,
    ...overrides,
  };
}

const catalog: ReportCatalog = {
  products: [product()],
  batches: [
    {
      id: "batch-1",
      businessId: "b-1",
      productId: "p-1",
      batchNo: "B001",
      expiryDate: "2026-12-31",
      mrp: 22,
      purchasePrice: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies ProductBatch,
  ],
  warehouses: [
    {
      id: "w-1",
      businessId: "b-1",
      name: "Main",
      code: "MAIN",
      address: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  locations: [],
  categories: [],
  brands: [],
  movements: [
    movement({ change: 100, movementType: "PURCHASE", createdAt: "2026-03-01T10:00:00.000Z", batchId: "batch-1" }),
    movement({ change: -20, movementType: "SALE", createdAt: "2026-03-05T10:00:00.000Z", batchId: "batch-1" }),
    movement({ change: -10, movementType: "PURCHASE_RETURN", createdAt: "2026-03-06T10:00:00.000Z", batchId: "batch-1" }),
    movement({ change: 5, movementType: "SALE_RETURN", createdAt: "2026-03-07T10:00:00.000Z", batchId: "batch-1" }),
    movement({ change: 3, movementType: "ADJUSTMENT", createdAt: "2026-03-08T10:00:00.000Z", batchId: "batch-1" }),
  ],
};

function query(reportId: string, extra: Partial<StockReportQuery> = {}): StockReportQuery {
  return {
    reportId,
    from: "2026-03-01",
    to: "2026-03-31",
    page: 1,
    pageSize: 50,
    ...extra,
  };
}

describe("stock report engine", () => {
  it("closes stock as Opening + In - Out + PosAdj - NegAdj", () => {
    const flow = accumulateFlow(catalog.movements, "2026-03-01", "2026-03-31");
    expect(flow.opening).toBe(0);
    expect(flow.inward).toBe(105);
    expect(flow.outward).toBe(30);
    expect(flow.positiveAdj).toBe(3);
    expect(flow.negativeAdj).toBe(0);
    expect(flow.closing).toBe(78);
  });

  it("matches sample flow purchase 100, sale 20, PR 10, SR 5, adj +3", () => {
    const result = runStockReport(catalog, query("stock-summary"));
    expect(result.rows[0]).toMatchObject({
      opening: 0,
      inward: 105,
      outward: 30,
      positiveAdj: 3,
      negativeAdj: 0,
      closing: 78,
    });
  });

  it("values current stock from the same closing quantity", () => {
    const result = runStockReport(catalog, query("stock-valuation"));
    expect(result.rows[0]).toMatchObject({ quantity: 78, costPrice: 10, stockValue: 780 });
  });

  it("flags low stock from product threshold", () => {
    const low = runStockReport(
      { ...catalog, products: [product({ lowStockThreshold: 80 })] },
      query("low-stock")
    );
    expect(low.rows).toHaveLength(1);
    expect(low.rows[0].status).toBe("low");
  });

  it("keeps batch as identity, not quantity", () => {
    const result = runStockReport(catalog, query("batch-wise-stock"));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ batchNo: "B001", quantity: 78 });
  });

  it("paginates ledger rows", () => {
    const result = runStockReport(catalog, query("stock-ledger", { page: 1, pageSize: 2 }));
    expect(result.totalCount).toBe(5);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].inQty).toBe(100);
  });

  it("returns empty rows when a product filter has no match", () => {
    const result = runStockReport(catalog, query("current-stock", { productId: "missing" }));
    expect(result.rows).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});
