import type { InventoryDefaults, StockAdjustmentReasonCode, StockLocationKind } from "@/types/domain";

export const INVENTORY_SETTINGS_KEY = "inventory.defaults";

export const DEFAULT_INVENTORY: InventoryDefaults = {
  allowNegativeStock: false,
  reserveOnConfirm: true,
  defaultWarehouseId: null,
  defaultLocationId: null,
  transferApproval: false,
  adjustmentApproval: false,
  countApproval: true,
  batchTracking: true,
  expiryTracking: true,
  fefoPreferred: true,
  nearExpiryDays: 30,
  barcodeEnabled: true,
  labelWidthMm: 50,
  labelHeightMm: 30,
  labelsPerRow: 3,
  showMrpOnLabel: true,
  showBatchOnLabel: true,
};

export const LOCATION_KIND_META: Record<StockLocationKind, { label: string; blocked: boolean }> = {
  main_store: { label: "Main Store", blocked: false },
  godown: { label: "Godown", blocked: false },
  rack: { label: "Rack", blocked: false },
  shelf: { label: "Shelf", blocked: false },
  bin: { label: "Bin", blocked: false },
  damaged: { label: "Damaged Stock", blocked: true },
  quarantine: { label: "Quarantine Stock", blocked: true },
};

export const LOCATION_KINDS = Object.keys(LOCATION_KIND_META) as StockLocationKind[];

export const ADJUSTMENT_REASON_META: Record<StockAdjustmentReasonCode, { label: string; sensitive: boolean }> = {
  physical_count: { label: "Physical quantity correction", sensitive: false },
  damage: { label: "Damage", sensitive: true },
  expiry: { label: "Expiry", sensitive: false },
  theft: { label: "Theft / loss", sensitive: true },
  found: { label: "Found stock", sensitive: false },
  opening_correction: { label: "Opening stock correction", sensitive: true },
  other: { label: "Other", sensitive: false },
};

export const ADJUSTMENT_REASONS = Object.keys(ADJUSTMENT_REASON_META) as StockAdjustmentReasonCode[];

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next ? next : null;
}

export function parseInventoryDefaults(stored: unknown): InventoryDefaults {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_INVENTORY };
  const value = stored as Partial<InventoryDefaults>;
  return {
    allowNegativeStock: asBoolean(value.allowNegativeStock, DEFAULT_INVENTORY.allowNegativeStock),
    reserveOnConfirm: asBoolean(value.reserveOnConfirm, DEFAULT_INVENTORY.reserveOnConfirm),
    defaultWarehouseId: asId(value.defaultWarehouseId),
    defaultLocationId: asId(value.defaultLocationId),
    transferApproval: asBoolean(value.transferApproval, DEFAULT_INVENTORY.transferApproval),
    adjustmentApproval: asBoolean(value.adjustmentApproval, DEFAULT_INVENTORY.adjustmentApproval),
    countApproval: asBoolean(value.countApproval, DEFAULT_INVENTORY.countApproval),
    batchTracking: asBoolean(value.batchTracking, DEFAULT_INVENTORY.batchTracking),
    expiryTracking: asBoolean(value.expiryTracking, DEFAULT_INVENTORY.expiryTracking),
    fefoPreferred: asBoolean(value.fefoPreferred, DEFAULT_INVENTORY.fefoPreferred),
    nearExpiryDays: Math.trunc(asNumber(value.nearExpiryDays, DEFAULT_INVENTORY.nearExpiryDays, 1, 365)),
    barcodeEnabled: asBoolean(value.barcodeEnabled, DEFAULT_INVENTORY.barcodeEnabled),
    labelWidthMm: Math.trunc(asNumber(value.labelWidthMm, DEFAULT_INVENTORY.labelWidthMm, 20, 210)),
    labelHeightMm: Math.trunc(asNumber(value.labelHeightMm, DEFAULT_INVENTORY.labelHeightMm, 10, 297)),
    labelsPerRow: Math.trunc(asNumber(value.labelsPerRow, DEFAULT_INVENTORY.labelsPerRow, 1, 8)),
    showMrpOnLabel: asBoolean(value.showMrpOnLabel, DEFAULT_INVENTORY.showMrpOnLabel),
    showBatchOnLabel: asBoolean(value.showBatchOnLabel, DEFAULT_INVENTORY.showBatchOnLabel),
  };
}

export function isBlockedLocationKind(kind: StockLocationKind | null | undefined): boolean {
  return Boolean(kind && LOCATION_KIND_META[kind]?.blocked);
}

export function normalizeLocationKind(value: unknown): StockLocationKind {
  if (typeof value === "string" && value in LOCATION_KIND_META) return value as StockLocationKind;
  return "main_store";
}
