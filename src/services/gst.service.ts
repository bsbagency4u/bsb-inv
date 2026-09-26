import type { GstLine, InvoiceTotals, LineItem } from "@/types/domain";

/** Standard Indian GST slabs selectable in settings and product forms. */
export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;

export interface GstItemInput {
  quantity: number;
  unitPrice: number;
  gstRate: number;
  /** Item discount amount, applied before invoice discount and GST. */
  discount?: number;
  /** Item discount percent of gross. Ignored when `discount` is set. */
  discountPercent?: number;
}

export interface GstComputeOptions {
  /** true → CGST+SGST split, false → IGST */
  intraState?: boolean;
  /** Invoice-level discount amount, applied after item discounts and before GST. */
  discount?: number;
  /** Invoice-level discount percent of net-after-item-discount. */
  discountPercent?: number;
}

export interface GstComputedLine {
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount: number;
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * GST engine — pure, deterministic invoice tax calculation.
 *
 * Order: Gross → item discount → invoice discount → taxable → GST → grand total.
 * Intra-state: CGST + SGST split (half each). Inter-state: IGST (full tax).
 *
 * Business behaviour is config-driven; this module has no UI or storage
 * dependencies and can be unit-tested in isolation.
 */
export class GstEngine {
  computeTotals(
    items: GstItemInput[],
    options: GstComputeOptions = {}
  ): InvoiceTotals & { lines: GstComputedLine[] } {
    const intraState = options.intraState ?? true;

    const prepared = items.map((item) => {
      const quantity = Math.max(0, item.quantity ?? 0);
      const unitPrice = Math.max(0, item.unitPrice ?? 0);
      const rate = Math.max(0, item.gstRate ?? 0);
      const grossAmount = quantity * unitPrice;
      let itemDiscount =
        item.discount != null
          ? Math.max(0, item.discount)
          : item.discountPercent
            ? (grossAmount * Math.max(0, item.discountPercent)) / 100
            : 0;
      itemDiscount = Math.min(itemDiscount, grossAmount);
      return {
        quantity,
        unitPrice,
        gstRate: rate,
        grossAmount,
        itemDiscount,
        netAfterItem: grossAmount - itemDiscount,
      };
    });

    const subtotal = prepared.reduce((sum, line) => sum + line.grossAmount, 0);
    const itemDiscount = prepared.reduce((sum, line) => sum + line.itemDiscount, 0);
    const netAfterItems = Math.max(0, subtotal - itemDiscount);

    let invoiceDiscount =
      options.discount != null
        ? Math.max(0, options.discount)
        : options.discountPercent
          ? (netAfterItems * Math.max(0, options.discountPercent)) / 100
          : 0;
    invoiceDiscount = Math.min(invoiceDiscount, netAfterItems);

    const byRate = new Map<number, { taxableAmount: number; taxAmount: number }>();
    const computedLines: GstComputedLine[] = [];

    for (const line of prepared) {
      const share =
        netAfterItems > 0 ? (line.netAfterItem / netAfterItems) * invoiceDiscount : 0;
      const taxableAmount = Math.max(0, line.netAfterItem - share);
      const taxAmount = (taxableAmount * line.gstRate) / 100;
      const split = this.splitTax(taxAmount, intraState);
      computedLines.push({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        gstRate: line.gstRate,
        discount: line.itemDiscount,
        grossAmount: round2(line.grossAmount),
        taxableAmount: round2(taxableAmount),
        taxAmount: round2(taxAmount),
        amount: round2(taxableAmount + taxAmount),
        cgst: split.cgst,
        sgst: split.sgst,
        igst: split.igst,
      });

      const entry = byRate.get(line.gstRate) ?? { taxableAmount: 0, taxAmount: 0 };
      entry.taxableAmount += taxableAmount;
      entry.taxAmount += taxAmount;
      byRate.set(line.gstRate, entry);
    }

    const taxAmount = Array.from(byRate.values()).reduce(
      (sum, entry) => sum + entry.taxAmount,
      0
    );
    const taxableAmount = Math.max(0, netAfterItems - invoiceDiscount);

    const gstLines: GstLine[] = Array.from(byRate.entries())
      .sort(([a], [b]) => a - b)
      .map(([rate, entry]) => ({
        rate,
        taxableAmount: round2(entry.taxableAmount),
        taxAmount: round2(entry.taxAmount),
        ...this.splitTax(entry.taxAmount, intraState),
      }));

    const splitTotals = this.splitTax(taxAmount, intraState);
    const taxRounded = round2(taxAmount);
    const taxableRounded = round2(taxableAmount);

    return {
      subtotal: round2(subtotal),
      itemDiscount: round2(itemDiscount),
      discount: round2(invoiceDiscount),
      taxableAmount: taxableRounded,
      taxAmount: taxRounded,
      cgst: splitTotals.cgst,
      sgst: splitTotals.sgst,
      igst: splitTotals.igst,
      roundOff: 0,
      total: round2(taxableAmount + taxAmount),
      gstLines,
      intraState,
      lines: computedLines,
    };
  }

  /**
   * Returns a summary split for a given total tax figure.
   * Used when re-deriving GST lines from stored invoice items.
   */
  splitTax(amount: number, intraState: boolean): { cgst: number; sgst: number; igst: number } {
    if (intraState) {
      return { cgst: round2(amount / 2), sgst: round2(amount / 2), igst: 0 };
    }
    return { cgst: 0, sgst: 0, igst: round2(amount) };
  }

  /** Derives GstLine[] from already-computed line items. */
  gstLinesFromItems(items: LineItem[], intraState: boolean): GstLine[] {
    const byRate = new Map<number, { taxableAmount: number; taxAmount: number }>();
    for (const item of items) {
      const entry = byRate.get(item.gstRate) ?? { taxableAmount: 0, taxAmount: 0 };
      entry.taxableAmount += item.taxableAmount ?? 0;
      entry.taxAmount += item.taxAmount ?? 0;
      byRate.set(item.gstRate, entry);
    }
    return Array.from(byRate.entries())
      .sort(([a], [b]) => a - b)
      .map(([rate, entry]) => ({
        rate,
        taxableAmount: round2(entry.taxableAmount),
        taxAmount: round2(entry.taxAmount),
        ...this.splitTax(entry.taxAmount, intraState),
      }));
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
