import { describe, expect, it } from "vitest";
import { allocateReturnToLots } from "./sales-return";

describe("allocateReturnToLots", () => {
  const lines = [
    { productId: "p1", variantId: null, batchId: "b-a", soldBase: 10 },
    { productId: "p1", variantId: null, batchId: "b-b", soldBase: 5 },
  ];

  it("rejects items that were not on the invoice", () => {
    const result = allocateReturnToLots(lines, [], [{ productId: "p2", baseQuantity: 1 }]);
    expect(result.error).toMatch(/original invoice/);
  });

  it("rejects returning more than remaining quantity", () => {
    const result = allocateReturnToLots(
      lines,
      [{ productId: "p1", baseQuantity: 12 }],
      [{ productId: "p1", baseQuantity: 4 }]
    );
    expect(result.error).toMatch(/exceeds/);
  });

  it("allocates FIFO to the original lots and detects a full return", () => {
    const partial = allocateReturnToLots(lines, [], [{ productId: "p1", baseQuantity: 12 }]);
    expect(partial.error).toBeNull();
    expect(partial.fullyReturned).toBe(false);
    expect(partial.allocations).toEqual([
      { productId: "p1", variantId: null, batchId: "b-a", quantity: 10 },
      { productId: "p1", variantId: null, batchId: "b-b", quantity: 2 },
    ]);

    const full = allocateReturnToLots(
      lines,
      [{ productId: "p1", baseQuantity: 12 }],
      [{ productId: "p1", baseQuantity: 3 }]
    );
    expect(full.error).toBeNull();
    expect(full.fullyReturned).toBe(true);
    expect(full.allocations).toEqual([
      { productId: "p1", variantId: null, batchId: "b-b", quantity: 3 },
    ]);
  });
});
