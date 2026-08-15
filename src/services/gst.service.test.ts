import { describe, expect, it } from "vitest";
import { GstEngine } from "./gst.service";

describe("GstEngine", () => {
  const engine = new GstEngine();

  it("computes intra-state totals with CGST + SGST split", () => {
    const result = engine.computeTotals(
      [{ quantity: 2, unitPrice: 100, gstRate: 18 }],
      { intraState: true }
    );
    expect(result.subtotal).toBe(200);
    expect(result.taxAmount).toBe(36);
    expect(result.total).toBe(236);
    expect(result.gstLines).toHaveLength(1);
    expect(result.gstLines[0]).toMatchObject({
      rate: 18,
      cgst: 18,
      sgst: 18,
      igst: 0,
    });
  });

  it("computes inter-state totals with IGST", () => {
    const result = engine.computeTotals(
      [{ quantity: 2, unitPrice: 100, gstRate: 18 }],
      { intraState: false }
    );
    expect(result.taxAmount).toBe(36);
    expect(result.total).toBe(236);
    expect(result.gstLines[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 36 });
  });

  it("groups multiple rates into separate GST lines", () => {
    const result = engine.computeTotals(
      [
        { quantity: 1, unitPrice: 100, gstRate: 5 },
        { quantity: 1, unitPrice: 100, gstRate: 18 },
      ],
      { intraState: true }
    );
    expect(result.gstLines).toHaveLength(2);
    expect(result.taxAmount).toBe(23);
    expect(result.total).toBe(223);
  });

  it("applies an invoice-level discount", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 100, gstRate: 18 }],
      { intraState: true, discount: 10 }
    );
    expect(result.discount).toBe(10);
    expect(result.total).toBe(108);
  });

  it("rounds to two decimal places", () => {
    const result = engine.computeTotals(
      [{ quantity: 3, unitPrice: 0.1, gstRate: 18 }],
      { intraState: true }
    );
    expect(result.subtotal).toBe(0.3);
    expect(result.taxAmount).toBe(0.05);
    expect(result.total).toBe(0.35);
  });

  it("derives GST lines from stored line items", () => {
    const lines = engine.gstLinesFromItems(
      [
        {
          productId: "p1",
          quantity: 1,
          unitPrice: 100,
          gstRate: 18,
          discount: 0,
          taxableAmount: 100,
          taxAmount: 18,
          amount: 118,
        },
      ],
      true
    );
    expect(lines[0]).toMatchObject({ rate: 18, cgst: 9, sgst: 9, igst: 0 });
  });

  it("splits tax into halves for intra-state", () => {
    expect(engine.splitTax(36, true)).toEqual({ cgst: 18, sgst: 18, igst: 0 });
    expect(engine.splitTax(36, false)).toEqual({ cgst: 0, sgst: 0, igst: 36 });
  });
});
