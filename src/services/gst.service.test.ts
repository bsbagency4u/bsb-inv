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

  it("applies item and invoice discounts before GST", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 500, gstRate: 18, discount: 20 }],
      { intraState: true, discount: 30 }
    );
    expect(result.subtotal).toBe(500);
    expect(result.itemDiscount).toBe(20);
    expect(result.discount).toBe(30);
    expect(result.taxableAmount).toBe(450);
    expect(result.taxAmount).toBe(81);
    expect(result.total).toBe(531);
  });

  it("applies an invoice-level discount before GST", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 100, gstRate: 18 }],
      { intraState: true, discount: 10 }
    );
    expect(result.discount).toBe(10);
    expect(result.taxableAmount).toBe(90);
    expect(result.taxAmount).toBe(16.2);
    expect(result.total).toBe(106.2);
  });

  it("applies item percentage discount before GST", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 200, gstRate: 18, discountPercent: 10 }],
      { intraState: true }
    );
    expect(result.itemDiscount).toBe(20);
    expect(result.taxableAmount).toBe(180);
    expect(result.taxAmount).toBe(32.4);
    expect(result.total).toBe(212.4);
  });

  it("applies invoice percentage discount after item discounts", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 500, gstRate: 18, discount: 50 }],
      { intraState: true, discountPercent: 10 }
    );
    expect(result.itemDiscount).toBe(50);
    expect(result.discount).toBe(45);
    expect(result.taxableAmount).toBe(405);
    expect(result.taxAmount).toBe(72.9);
    expect(result.total).toBe(477.9);
  });

  it("clamps discounts so taxable amount is never negative", () => {
    const result = engine.computeTotals(
      [{ quantity: 1, unitPrice: 100, gstRate: 18, discount: 80 }],
      { intraState: true, discount: 50 }
    );
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
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
