import type { LineItem } from "@/types/domain";

export type PurchaseOrderReceiveStatus = "confirmed" | "partial" | "received";

export function receivedOnLine(item: Pick<LineItem, "receivedQuantity">): number {
  return item.receivedQuantity ?? 0;
}

export function remainingOnLine(item: Pick<LineItem, "quantity" | "receivedQuantity">): number {
  return Math.max(0, item.quantity - receivedOnLine(item));
}

export function remainingOnOrder(items: Array<Pick<LineItem, "quantity" | "receivedQuantity">>): number {
  return items.reduce((sum, item) => sum + remainingOnLine(item), 0);
}

export function remainingForProduct(
  items: Array<Pick<LineItem, "productId" | "quantity" | "receivedQuantity">>,
  productId: string
): number {
  return items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + remainingOnLine(item), 0);
}

export function receivingStatusForItems(
  items: Array<Pick<LineItem, "quantity" | "receivedQuantity">>
): PurchaseOrderReceiveStatus {
  if (items.length === 0) return "confirmed";
  const remaining = remainingOnOrder(items);
  const received = items.reduce((sum, item) => sum + receivedOnLine(item), 0);
  if (received <= 0) return "confirmed";
  if (remaining <= 1e-9) return "received";
  return "partial";
}

export function allocateReceivedQuantities<
  T extends { productId: string; quantity: number; receivedQuantity?: number },
>(lines: T[], receipts: Array<{ productId: string; quantity: number }>): T[] {
  const next = lines.map((line) => ({
    ...line,
    receivedQuantity: receivedOnLine(line),
  }));
  for (const item of receipts) {
    let remaining = item.quantity;
    if (remaining <= 0) continue;
    for (const line of next) {
      if (line.productId !== item.productId || remaining <= 0) continue;
      const room = remainingOnLine(line);
      if (room <= 0) continue;
      const take = Math.min(room, remaining);
      line.receivedQuantity += take;
      remaining -= take;
    }
  }
  return next;
}
