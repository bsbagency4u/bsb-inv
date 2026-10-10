import type {
  Product,
  ProductBatch,
  StockMovement,
  Warehouse,
  StockLocation,
  Category,
  Brand,
} from "@/types/domain";
import { STOCK_REPORT_DEFINITIONS, getStockReportDefinition } from "./definitions";
import {
  DEFAULT_FAST_THRESHOLD,
  DEFAULT_NEAR_EXPIRY_DAYS,
  DEFAULT_PAGE_SIZE,
  IN_TYPES,
  OUT_TYPES,
  accumulateFlow,
  agingBucket,
  daysBetween,
  lastInboundDate,
  lastMovementDate,
  posAdj,
  qtyIn,
  qtyOut,
  soldQty,
  stockStatus,
  velocityBand,
} from "./stock-math";
import type {
  ReportDefinition,
  ReportResult,
  ReportRow,
  ReportSummaryItem,
  StockReportQuery,
} from "./types";

export interface ReportCatalog {
  products: Product[];
  movements: StockMovement[];
  batches: ProductBatch[];
  warehouses: Warehouse[];
  locations: StockLocation[];
  categories: Category[];
  brands: Brand[];
}

function productMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((product) => [product.id, product]));
}

function warehouseName(warehouses: Warehouse[], id: string | null): string {
  if (!id) return "Unassigned";
  return warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Unknown";
}

function locationName(locations: StockLocation[], id: string | null): string {
  if (!id) return "Unassigned";
  return locations.find((location) => location.id === id)?.name ?? "Unknown";
}

function batchOf(batches: ProductBatch[], id: string | null): ProductBatch | undefined {
  if (!id) return undefined;
  return batches.find((batch) => batch.id === id);
}

function matchesProductFilters(
  product: Product,
  query: StockReportQuery
): boolean {
  if (query.productId && product.id !== query.productId) return false;
  if (query.categoryId && product.categoryId !== query.categoryId) return false;
  if (query.brandId && product.brandId !== query.brandId) return false;
  if (query.sku) {
    const needle = query.sku.trim().toLowerCase();
    if (!(product.sku ?? "").toLowerCase().includes(needle) && !product.name.toLowerCase().includes(needle)) {
      return false;
    }
  }
  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    const hay = `${product.name} ${product.sku ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function movementMatches(movement: StockMovement, query: StockReportQuery): boolean {
  if (query.warehouseId && movement.warehouseId !== query.warehouseId) return false;
  if (query.locationId && movement.locationId !== query.locationId) return false;
  if (query.batchId && movement.batchId !== query.batchId) return false;
  if (query.movementType && movement.movementType !== query.movementType) return false;
  return true;
}

function groupMovements(movements: StockMovement[]): Map<string, StockMovement[]> {
  const map = new Map<string, StockMovement[]>();
  for (const movement of movements) {
    const list = map.get(movement.productId) ?? [];
    list.push(movement);
    map.set(movement.productId, list);
  }
  return map;
}

function paginate(rows: ReportRow[], page: number, pageSize: number): ReportRow[] {
  const start = Math.max(0, (page - 1) * pageSize);
  return rows.slice(start, start + pageSize);
}

function sortRows(rows: ReportRow[], sortBy?: string, sortDir: "asc" | "desc" = "asc"): ReportRow[] {
  if (!sortBy) return rows;
  const dir = sortDir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
    return String(left).localeCompare(String(right)) * dir;
  });
}

function numberTotal(rows: ReportRow[], keys: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const key of keys) totals[key] = 0;
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number") totals[key] += value;
    }
  }
  return totals;
}

function result(
  definition: ReportDefinition,
  rows: ReportRow[],
  query: StockReportQuery,
  totalKeys: string[],
  summary: ReportSummaryItem[]
): ReportResult {
  const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
  const page = query.page || 1;
  const sorted = sortRows(rows, query.sortBy, query.sortDir);
  return {
    reportId: definition.id,
    title: definition.title,
    columns: definition.columns,
    rows: paginate(sorted, page, pageSize),
    totals: numberTotal(sorted, totalKeys),
    summary,
    totalCount: sorted.length,
    page,
    pageSize,
  };
}

function closingQuantity(
  movements: StockMovement[],
  query: StockReportQuery
): number {
  return accumulateFlow(
    movements.filter((movement) => movementMatches(movement, query)),
    query.from,
    query.to
  ).closing;
}

export function runStockReport(catalog: ReportCatalog, query: StockReportQuery): ReportResult {
  const definition = getStockReportDefinition(query.reportId);
  if (!definition) {
    return {
      reportId: query.reportId,
      title: "Unknown report",
      columns: [],
      rows: [],
      totals: {},
      summary: [],
      totalCount: 0,
      page: query.page || 1,
      pageSize: query.pageSize || DEFAULT_PAGE_SIZE,
    };
  }

  const products = catalog.products.filter(
    (product) => product.trackInventory && matchesProductFilters(product, query)
  );
  const byProduct = productMap(catalog.products);
  const movements = catalog.movements.filter((movement) => {
    const product = byProduct.get(movement.productId);
    if (!product || !product.trackInventory) return false;
    if (!matchesProductFilters(product, query)) return false;
    return true;
  });
  const grouped = groupMovements(movements);
  const nearExpiryDays = query.nearExpiryDays ?? DEFAULT_NEAR_EXPIRY_DAYS;
  const fastThreshold = query.fastThreshold ?? DEFAULT_FAST_THRESHOLD;

  switch (definition.id) {
    case "stock-summary": {
      const rows: ReportRow[] = products.map((product) => {
        const flow = accumulateFlow(
          (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query)),
          query.from,
          query.to
        );
        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          opening: flow.opening,
          inward: flow.inward,
          outward: flow.outward,
          positiveAdj: flow.positiveAdj,
          negativeAdj: flow.negativeAdj,
          closing: flow.closing,
        };
      });
      return result(definition, rows, query, ["opening", "inward", "outward", "positiveAdj", "negativeAdj", "closing"], [
        { key: "closing", label: "Closing qty", value: numberTotal(rows, ["closing"]).closing ?? 0, format: "qty" },
        { key: "inward", label: "In", value: numberTotal(rows, ["inward"]).inward ?? 0, format: "qty" },
        { key: "outward", label: "Out", value: numberTotal(rows, ["outward"]).outward ?? 0, format: "qty" },
      ]);
    }
    case "current-stock": {
      const rows: ReportRow[] = [];
      for (const product of products) {
        const relevant = (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query));
        const byWh = new Map<string, StockMovement[]>();
        for (const movement of relevant) {
          const key = movement.warehouseId ?? "";
          const list = byWh.get(key) ?? [];
          list.push(movement);
          byWh.set(key, list);
        }
        const groups = byWh.size === 0 ? [[null as string | null, [] as StockMovement[]] as const] : Array.from(byWh.entries());
        for (const [warehouseId, list] of groups) {
          const quantity = accumulateFlow(list, query.from, query.to).closing;
          const status = stockStatus(quantity, product);
          if (query.status && query.status !== status) continue;
          rows.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            warehouse: warehouseName(catalog.warehouses, warehouseId || null),
            quantity,
            stockValue: quantity * product.purchasePrice,
            status,
          });
        }
      }
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "quantity", label: "Qty", value: numberTotal(rows, ["quantity"]).quantity ?? 0, format: "qty" },
        { key: "stockValue", label: "Value", value: numberTotal(rows, ["stockValue"]).stockValue ?? 0, format: "currency" },
        { key: "count", label: "Rows", value: rows.length, format: "number" },
      ]);
    }
    case "low-stock": {
      const rows: ReportRow[] = products
        .map((product) => {
          const quantity = closingQuantity(grouped.get(product.id) ?? [], query);
          const threshold = product.lowStockThreshold > 0 ? product.lowStockThreshold : product.minStock;
          const status = stockStatus(quantity, product);
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            threshold,
            shortage: Math.max(0, threshold - quantity),
            status,
          };
        })
        .filter((row) => row.status === "low");
      return result(definition, rows, query, ["quantity", "shortage"], [
        { key: "count", label: "Items", value: rows.length, format: "number" },
      ]);
    }
    case "out-of-stock": {
      const rows: ReportRow[] = products
        .map((product) => {
          const quantity = closingQuantity(grouped.get(product.id) ?? [], query);
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            reorderLevel: product.reorderLevel,
            status: stockStatus(quantity, product),
          };
        })
        .filter((row) => row.status === "out");
      return result(definition, rows, query, ["quantity"], [
        { key: "count", label: "Items", value: rows.length, format: "number" },
      ]);
    }
    case "negative-stock": {
      const rows: ReportRow[] = products
        .map((product) => {
          const quantity = closingQuantity(grouped.get(product.id) ?? [], query);
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            status: stockStatus(quantity, product),
          };
        })
        .filter((row) => row.status === "negative");
      return result(definition, rows, query, ["quantity"], [
        { key: "count", label: "Items", value: rows.length, format: "number" },
      ]);
    }
    case "stock-ledger": {
      const rows: ReportRow[] = [];
      const running = new Map<string, number>();
      const ordered = [...movements]
        .filter((movement) => movementMatches(movement, query))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const movement of ordered) {
        const date = movement.createdAt.slice(0, 10);
        const before = running.get(movement.productId) ?? 0;
        if (date < query.from) {
          running.set(movement.productId, before + movement.change);
          continue;
        }
        if (date > query.to) continue;
        const after = before + movement.change;
        running.set(movement.productId, after);
        const product = byProduct.get(movement.productId);
        if (!product) continue;
        const batch = batchOf(catalog.batches, movement.batchId);
        rows.push({
          date,
          productName: product.name,
          sku: product.sku,
          movementType: movement.movementType,
          warehouse: warehouseName(catalog.warehouses, movement.warehouseId),
          batchNo: batch?.batchNo ?? null,
          inQty: qtyIn(movement) || posAdj(movement),
          outQty: qtyOut(movement) || (movement.movementType === "ADJUSTMENT" && movement.change < 0 ? Math.abs(movement.change) : 0),
          balance: after,
          reference: movement.referenceId ?? movement.notes,
        });
      }
      return result(definition, rows, query, ["inQty", "outQty"], [
        { key: "count", label: "Movements", value: rows.length, format: "number" },
      ]);
    }
    case "stock-in":
    case "stock-out":
    case "stock-adjustment":
    case "stock-transfer":
    case "purchase-return-stock":
    case "sales-return-stock": {
      const typeFilter =
        definition.id === "stock-in"
          ? (type: StockMovement["movementType"]) => IN_TYPES.includes(type) || (type === "ADJUSTMENT" && false)
          : definition.id === "stock-out"
            ? (type: StockMovement["movementType"]) => OUT_TYPES.includes(type)
            : definition.id === "stock-adjustment"
              ? (type: StockMovement["movementType"]) => type === "ADJUSTMENT"
              : definition.id === "stock-transfer"
                ? (type: StockMovement["movementType"]) => type === "TRANSFER_IN" || type === "TRANSFER_OUT"
                : definition.id === "purchase-return-stock"
                  ? (type: StockMovement["movementType"]) => type === "PURCHASE_RETURN"
                  : (type: StockMovement["movementType"]) => type === "SALE_RETURN";
      const extraIn =
        definition.id === "stock-in"
          ? (movement: StockMovement) => IN_TYPES.includes(movement.movementType)
          : null;
      const rows: ReportRow[] = movements
        .filter((movement) => movementMatches(movement, query))
        .filter((movement) => {
          const date = movement.createdAt.slice(0, 10);
          if (date < query.from || date > query.to) return false;
          if (extraIn) return extraIn(movement);
          return typeFilter(movement.movementType);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((movement) => {
          const product = byProduct.get(movement.productId);
          return {
            date: movement.createdAt.slice(0, 10),
            productName: product?.name ?? "Unknown",
            sku: product?.sku ?? null,
            movementType: movement.movementType,
            quantity: Math.abs(movement.change),
            warehouse: warehouseName(catalog.warehouses, movement.warehouseId),
            reference: movement.referenceId ?? movement.notes,
            notes: movement.notes,
          };
        });
      return result(definition, rows, query, ["quantity"], [
        { key: "quantity", label: "Qty", value: numberTotal(rows, ["quantity"]).quantity ?? 0, format: "qty" },
        { key: "count", label: "Rows", value: rows.length, format: "number" },
      ]);
    }
    case "fast-moving":
    case "slow-moving":
    case "non-moving": {
      const want = definition.id === "fast-moving" ? "fast" : definition.id === "slow-moving" ? "slow" : "non-moving";
      const rows: ReportRow[] = products
        .map((product) => {
          const list = (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query));
          const sold = soldQty(list, query.from, query.to);
          const closing = accumulateFlow(list, query.from, query.to).closing;
          const band = velocityBand(sold, fastThreshold);
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            soldQty: sold,
            closing,
            lastMovement: lastMovementDate(list),
            band,
          };
        })
        .filter((row) => row.band === want && (want !== "non-moving" || Number(row.closing) > 0));
      return result(definition, rows, query, ["soldQty", "closing"], [
        { key: "count", label: "Items", value: rows.length, format: "number" },
      ]);
    }
    case "stock-aging": {
      const rows: ReportRow[] = products
        .map((product) => {
          const list = (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query));
          const quantity = accumulateFlow(list, query.from, query.to).closing;
          const inbound = lastInboundDate(list.filter((movement) => movement.createdAt.slice(0, 10) <= query.to));
          const days = inbound ? daysBetween(inbound, query.to) : 0;
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            days,
            bucket: agingBucket(days),
            stockValue: quantity * product.purchasePrice,
          };
        })
        .filter((row) => Number(row.quantity) > 0);
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "stockValue", label: "Value", value: numberTotal(rows, ["stockValue"]).stockValue ?? 0, format: "currency" },
      ]);
    }
    case "abc-analysis": {
      const valued = products
        .map((product) => {
          const quantity = closingQuantity(grouped.get(product.id) ?? [], query);
          return {
            product,
            quantity,
            stockValue: Math.max(0, quantity) * product.purchasePrice,
          };
        })
        .filter((row) => row.stockValue > 0)
        .sort((a, b) => b.stockValue - a.stockValue);
      const totalValue = valued.reduce((sum, row) => sum + row.stockValue, 0) || 1;
      let cumulative = 0;
      const rows: ReportRow[] = valued.map((row) => {
        cumulative += row.stockValue;
        const share = (row.stockValue / totalValue) * 100;
        const className = cumulative / totalValue <= 0.8 ? "A" : cumulative / totalValue <= 0.95 ? "B" : "C";
        return {
          productId: row.product.id,
          productName: row.product.name,
          sku: row.product.sku,
          unit: row.product.unit,
          quantity: row.quantity,
          stockValue: row.stockValue,
          share: Math.round(share * 100) / 100,
          class: className,
        };
      });
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "stockValue", label: "Value", value: numberTotal(rows, ["stockValue"]).stockValue ?? 0, format: "currency" },
      ]);
    }
    case "stock-valuation": {
      const rows: ReportRow[] = products.map((product) => {
        const quantity = closingQuantity(grouped.get(product.id) ?? [], query);
        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity,
          costPrice: product.purchasePrice,
          stockValue: quantity * product.purchasePrice,
        };
      });
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "stockValue", label: "Value", value: numberTotal(rows, ["stockValue"]).stockValue ?? 0, format: "currency" },
        { key: "quantity", label: "Qty", value: numberTotal(rows, ["quantity"]).quantity ?? 0, format: "qty" },
      ]);
    }
    case "batch-wise-stock": {
      const rows: ReportRow[] = [];
      const keyMap = new Map<string, StockMovement[]>();
      for (const movement of movements.filter((item) => movementMatches(item, query))) {
        const key = `${movement.productId}|${movement.batchId ?? ""}|${movement.warehouseId ?? ""}`;
        const list = keyMap.get(key) ?? [];
        list.push(movement);
        keyMap.set(key, list);
      }
      for (const [key, list] of keyMap) {
        const [productId, batchId, warehouseId] = key.split("|");
        const product = byProduct.get(productId);
        if (!product) continue;
        const quantity = accumulateFlow(list, query.from, query.to).closing;
        if (quantity === 0 && !batchId) continue;
        const batch = batchOf(catalog.batches, batchId || null);
        rows.push({
          productId,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          batchNo: batch?.batchNo ?? "—",
          expiryDate: batch?.expiryDate ?? null,
          warehouse: warehouseName(catalog.warehouses, warehouseId || null),
          quantity,
          mrp: batch?.mrp ?? product.mrp,
        });
      }
      return result(definition, rows.filter((row) => Number(row.quantity) !== 0), query, ["quantity"], [
        { key: "quantity", label: "Qty", value: numberTotal(rows, ["quantity"]).quantity ?? 0, format: "qty" },
      ]);
    }
    case "expiry-stock": {
      const rows: ReportRow[] = [];
      const keyMap = new Map<string, StockMovement[]>();
      for (const movement of movements.filter((item) => movementMatches(item, query))) {
        if (!movement.batchId) continue;
        const key = `${movement.productId}|${movement.batchId}`;
        const list = keyMap.get(key) ?? [];
        list.push(movement);
        keyMap.set(key, list);
      }
      for (const [key, list] of keyMap) {
        const [productId, batchId] = key.split("|");
        const product = byProduct.get(productId);
        const batch = batchOf(catalog.batches, batchId);
        if (!product || !batch?.expiryDate) continue;
        const quantity = accumulateFlow(list, query.from, query.to).closing;
        if (quantity <= 0) continue;
        const expired = batch.expiryDate < query.to;
        const near = !expired && daysBetween(query.to, batch.expiryDate) <= nearExpiryDays;
        if (!expired && !near) continue;
        rows.push({
          productId,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          daysToExpiry: expired ? -daysBetween(batch.expiryDate, query.to) : daysBetween(query.to, batch.expiryDate),
          quantity,
          status: expired ? "expired" : "near-expiry",
        });
      }
      return result(definition, rows, query, ["quantity"], [
        { key: "count", label: "Lots", value: rows.length, format: "number" },
      ]);
    }
    case "warehouse-stock": {
      const rows: ReportRow[] = [];
      const keyMap = new Map<string, StockMovement[]>();
      for (const movement of movements.filter((item) => movementMatches(item, query))) {
        const key = `${movement.productId}|${movement.warehouseId ?? ""}`;
        const list = keyMap.get(key) ?? [];
        list.push(movement);
        keyMap.set(key, list);
      }
      for (const [key, list] of keyMap) {
        const [productId, warehouseId] = key.split("|");
        const product = byProduct.get(productId);
        if (!product) continue;
        const quantity = accumulateFlow(list, query.from, query.to).closing;
        rows.push({
          warehouse: warehouseName(catalog.warehouses, warehouseId || null),
          productName: product.name,
          sku: product.sku,
          quantity,
          stockValue: quantity * product.purchasePrice,
        });
      }
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "stockValue", label: "Value", value: numberTotal(rows, ["stockValue"]).stockValue ?? 0, format: "currency" },
      ]);
    }
    case "location-stock": {
      const rows: ReportRow[] = [];
      const keyMap = new Map<string, StockMovement[]>();
      for (const movement of movements.filter((item) => movementMatches(item, query))) {
        const key = `${movement.productId}|${movement.warehouseId ?? ""}|${movement.locationId ?? ""}`;
        const list = keyMap.get(key) ?? [];
        list.push(movement);
        keyMap.set(key, list);
      }
      for (const [key, list] of keyMap) {
        const [productId, warehouseId, locationId] = key.split("|");
        const product = byProduct.get(productId);
        if (!product) continue;
        const quantity = accumulateFlow(list, query.from, query.to).closing;
        rows.push({
          warehouse: warehouseName(catalog.warehouses, warehouseId || null),
          location: locationName(catalog.locations, locationId || null),
          productName: product.name,
          sku: product.sku,
          quantity,
        });
      }
      return result(definition, rows, query, ["quantity"], [
        { key: "quantity", label: "Qty", value: numberTotal(rows, ["quantity"]).quantity ?? 0, format: "qty" },
      ]);
    }
    case "unused-stock": {
      const rows: ReportRow[] = products
        .map((product) => {
          const list = (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query));
          const inPeriod = list.some((movement) => {
            const date = movement.createdAt.slice(0, 10);
            return date >= query.from && date <= query.to;
          });
          const quantity = accumulateFlow(list, query.from, query.to).closing;
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            lastMovement: lastMovementDate(list),
            stockValue: quantity * product.purchasePrice,
            unused: !inPeriod && quantity > 0,
          };
        })
        .filter((row) => row.unused)
        .map(({ unused: _unused, ...row }) => row);
      return result(definition, rows, query, ["quantity", "stockValue"], [
        { key: "count", label: "Items", value: rows.length, format: "number" },
      ]);
    }
    case "stock-mismatch": {
      const rows: ReportRow[] = products
        .map((product) => {
          const list = (grouped.get(product.id) ?? []).filter((movement) => movementMatches(movement, query));
          const flow = accumulateFlow(list, query.from, query.to);
          const ledgerQty = list.reduce((sum, movement) => sum + movement.change, 0);
          const difference = ledgerQty - flow.closing;
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            ledgerQty,
            closing: flow.closing,
            difference,
          };
        })
        .filter((row) => Math.abs(Number(row.difference)) > 0.0001);
      return result(definition, rows, query, ["difference"], [
        { key: "count", label: "Mismatches", value: rows.length, format: "number" },
      ]);
    }
    default:
      return result(definition, [], query, [], []);
  }
}

export function listStockReportDefinitions(): ReportDefinition[] {
  return STOCK_REPORT_DEFINITIONS;
}
