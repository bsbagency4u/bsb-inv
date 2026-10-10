import { describe, expect, it } from "vitest";
import {
  allocateReceivedQuantities,
  remainingForProduct,
  remainingOnLine,
  remainingOnOrder,
  receivingStatusForItems,
} from "./purchase-receiving";

describe("purchase receiving helpers", () => {
  it("computes remaining qty from ordered minus received", () => {
    expect(remainingOnLine({ quantity: 10, receivedQuantity: 4 })).toBe(6);
    expect(remainingOnOrder([
      { quantity: 10, receivedQuantity: 4 },
      { quantity: 2, receivedQuantity: 2 },
    ])).toBe(6);
  });

  it("marks orders confirmed, partial, then received", () => {
    expect(receivingStatusForItems([{ quantity: 5, receivedQuantity: 0 }])).toBe("confirmed");
    expect(receivingStatusForItems([{ quantity: 5, receivedQuantity: 2 }])).toBe("partial");
    expect(receivingStatusForItems([{ quantity: 5, receivedQuantity: 5 }])).toBe("received");
  });

  it("allocates a receipt across remaining room on matching product lines", () => {
    const next = allocateReceivedQuantities(
      [
        { productId: "p-1", quantity: 6, receivedQuantity: 1 },
        { productId: "p-1", quantity: 4, receivedQuantity: 0 },
      ],
      [{ productId: "p-1", quantity: 7 }]
    );
    expect(next[0].receivedQuantity).toBe(6);
    expect(next[1].receivedQuantity).toBe(2);
    expect(remainingForProduct(next, "p-1")).toBe(2);
  });
});
