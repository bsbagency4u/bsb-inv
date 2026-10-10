import { describe, expect, it } from "vitest";
import { settleTender } from "./tender";

describe("settleTender", () => {
  it("keeps under-pay and exact pay unchanged", () => {
    expect(settleTender([{ mode: "upi", amount: 100 }], 472)).toEqual({
      payments: [{ mode: "upi", amount: 100, reference: null }],
      changeDue: 0,
      error: null,
    });
    expect(settleTender([{ mode: "cash", amount: 472 }], 472).changeDue).toBe(0);
  });

  it("treats extra cash as change and records payment equal to the total", () => {
    const settled = settleTender([{ mode: "cash", amount: 500 }], 472);
    expect(settled.error).toBeNull();
    expect(settled.changeDue).toBe(28);
    expect(settled.payments).toEqual([{ mode: "cash", amount: 472, reference: null }]);
  });

  it("reduces the cash split first when tender exceeds the total", () => {
    const settled = settleTender(
      [
        { mode: "upi", amount: 200 },
        { mode: "cash", amount: 300 },
      ],
      472
    );
    expect(settled.error).toBeNull();
    expect(settled.changeDue).toBe(28);
    expect(settled.payments).toEqual([
      { mode: "upi", amount: 200, reference: null },
      { mode: "cash", amount: 272, reference: null },
    ]);
  });

  it("rejects non-cash overpay", () => {
    const settled = settleTender([{ mode: "upi", amount: 9999 }], 472);
    expect(settled.error).toBe("Amount paid cannot exceed the invoice total.");
    expect(settled.payments).toEqual([]);
  });
});
