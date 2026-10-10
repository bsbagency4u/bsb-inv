import type { Product, StockMovement, StockMovementType } from "@/types/domain";

export const IN_TYPES: StockMovementType[] = ["OPENING", "PURCHASE", "SALE_RETURN", "TRANSFER_IN"];
export const OUT_TYPES: StockMovementType[] = ["SALE", "PURCHASE_RETURN", "TRANSFER_OUT", "SCRAP"];

export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_FAST_THRESHOLD = 10;
export const DEFAULT_NEAR_EXPIRY_DAYS = 30;
export const DEFAULT_DEAD_DAYS = 180;

export const AGING_BUCKETS = [
  { key: "0-30", label: "0-30", min: 0, max: 30 },
  { key: "31-60", label: "31-60", min: 31, max: 60 },
  { key: "61-90", label: "61-90", min: 61, max: 90 },
  { key: "91-180", label: "91-180", min: 91, max: 180 },
  { key: "181-365", label: "181-365", min: 181, max: 365 },
  { key: "365+", label: "365+", min: 366, max: Number.POSITIVE_INFINITY },
] as const;

export function ledgerDate(movement: Pick<StockMovement, "createdAt">): string {
  return movement.createdAt.slice(0, 10);
}

export function qtyIn(movement: StockMovement): number {
  if (movement.movementType === "ADJUSTMENT") return 0;
  if (IN_TYPES.includes(movement.movementType)) return Math.abs(movement.change);
  return 0;
}

export function qtyOut(movement: StockMovement): number {
  if (movement.movementType === "ADJUSTMENT") return 0;
  if (OUT_TYPES.includes(movement.movementType)) return Math.abs(movement.change);
  return 0;
}

export function posAdj(movement: StockMovement): number {
  return movement.movementType === "ADJUSTMENT" && movement.change > 0 ? movement.change : 0;
}

export function negAdj(movement: StockMovement): number {
  return movement.movementType === "ADJUSTMENT" && movement.change < 0 ? Math.abs(movement.change) : 0;
}

export interface StockFlow {
  opening: number;
  inward: number;
  outward: number;
  positiveAdj: number;
  negativeAdj: number;
  closing: number;
}

export function emptyFlow(): StockFlow {
  return { opening: 0, inward: 0, outward: 0, positiveAdj: 0, negativeAdj: 0, closing: 0 };
}

export function closingFromFlow(flow: Omit<StockFlow, "closing">): number {
  return flow.opening + flow.inward - flow.outward + flow.positiveAdj - flow.negativeAdj;
}

export function accumulateFlow(movements: StockMovement[], from: string, to: string): StockFlow {
  const flow = emptyFlow();
  for (const movement of movements) {
    const date = ledgerDate(movement);
    if (date < from) {
      flow.opening += movement.change;
      continue;
    }
    if (date > to) continue;
    flow.inward += qtyIn(movement);
    flow.outward += qtyOut(movement);
    flow.positiveAdj += posAdj(movement);
    flow.negativeAdj += negAdj(movement);
  }
  flow.closing = closingFromFlow(flow);
  return flow;
}

export type StockStatus = "negative" | "out" | "low" | "in";

export function stockStatus(
  quantity: number,
  product: Pick<Product, "lowStockThreshold" | "minStock">
): StockStatus {
  if (quantity < 0) return "negative";
  if (quantity <= 0) return "out";
  const threshold = product.lowStockThreshold > 0 ? product.lowStockThreshold : product.minStock;
  if (threshold > 0 && quantity <= threshold) return "low";
  return "in";
}

export function agingBucket(days: number): string {
  for (const bucket of AGING_BUCKETS) {
    if (days >= bucket.min && days <= bucket.max) return bucket.label;
  }
  return "365+";
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function lastInboundDate(movements: StockMovement[]): string | null {
  let last: string | null = null;
  for (const movement of movements) {
    const inbound =
      IN_TYPES.includes(movement.movementType) ||
      (movement.movementType === "ADJUSTMENT" && movement.change > 0);
    if (!inbound) continue;
    const date = ledgerDate(movement);
    if (!last || date > last) last = date;
  }
  return last;
}

export function lastMovementDate(movements: StockMovement[]): string | null {
  let last: string | null = null;
  for (const movement of movements) {
    const date = ledgerDate(movement);
    if (!last || date > last) last = date;
  }
  return last;
}

export function soldQty(movements: StockMovement[], from: string, to: string): number {
  let qty = 0;
  for (const movement of movements) {
    const date = ledgerDate(movement);
    if (date < from || date > to) continue;
    if (movement.movementType === "SALE") qty += Math.abs(movement.change);
    if (movement.movementType === "SALE_RETURN") qty -= Math.abs(movement.change);
  }
  return qty;
}

export type VelocityBand = "fast" | "slow" | "non-moving";

export function velocityBand(sold: number, fastThreshold: number): VelocityBand {
  if (sold >= fastThreshold) return "fast";
  if (sold > 0) return "slow";
  return "non-moving";
}

export function defaultPeriod(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), 0, 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
