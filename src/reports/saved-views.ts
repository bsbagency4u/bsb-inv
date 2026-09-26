import type { SavedReportView, StockReportQuery } from "./types";

const STORAGE_PREFIX = "stockflow.report-views.";

function storageKey(businessId: string): string {
  return `${STORAGE_PREFIX}${businessId}`;
}

function readViews(businessId: string): SavedReportView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReportView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeViews(businessId: string, views: SavedReportView[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(businessId), JSON.stringify(views));
}

export function listSavedViews(businessId: string, reportId?: string): SavedReportView[] {
  const views = readViews(businessId);
  return reportId ? views.filter((view) => view.reportId === reportId) : views;
}

export function saveReportView(
  businessId: string,
  name: string,
  query: StockReportQuery
): SavedReportView {
  const views = readViews(businessId);
  const view: SavedReportView = {
    id: `view-${Date.now()}`,
    name: name.trim() || "Untitled view",
    reportId: query.reportId,
    filters: {
      reportId: query.reportId,
      from: query.from,
      to: query.to,
      warehouseId: query.warehouseId ?? null,
      locationId: query.locationId ?? null,
      categoryId: query.categoryId ?? null,
      brandId: query.brandId ?? null,
      productId: query.productId ?? null,
      sku: query.sku ?? null,
      supplierId: query.supplierId ?? null,
      batchId: query.batchId ?? null,
      status: query.status ?? null,
      movementType: query.movementType ?? null,
      search: query.search ?? null,
      nearExpiryDays: query.nearExpiryDays,
      fastThreshold: query.fastThreshold,
      deadDays: query.deadDays,
    },
    createdAt: new Date().toISOString(),
  };
  writeViews(businessId, [view, ...views].slice(0, 40));
  return view;
}

export function deleteSavedView(businessId: string, viewId: string): void {
  writeViews(
    businessId,
    readViews(businessId).filter((view) => view.id !== viewId)
  );
}
