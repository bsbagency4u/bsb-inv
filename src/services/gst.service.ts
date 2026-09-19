import type { GstLine, InvoiceTotals, LineItem } from "@/types/domain";

/** Standard Indian GST slabs selectable in settings and product forms. */
export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;

export interface GstItemInput {
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
}

/**
 * GST engine — pure, deterministic invoice tax calculation.
 *
 * Intra-state (same state as the business): CGST + SGST split (half each).
 * Inter-state: IGST (full tax).
 *
 * Business behaviour is config-driven; this module has no UI or storage
 * dependencies and can be unit-tested in isolation.
 */
export class GstEngine {
  /**
   * @param intraState true → CGST+SGST split, false → IGST
   */
  computeTotals(
    items: GstItemInput[],
    options: { intraState?: boolean; discount?: number } = {}
  ): InvoiceTotals {
    const discount = options.discount ?? 0;
    const intraState = options.intraState ?? true;

    const byRate = new Map<number, { taxableAmount: number; taxAmount: number }>();
    let taxable = 0;

    for (const item of items) {
      const quantity = Math.max(0, item.quantity ?? 0);
      const unitPrice = Math.max(0, item.unitPrice ?? 0);
      const rate = Math.max(0, item.gstRate ?? 0);
      const itemTaxable = quantity * unitPrice;
      const itemTax = (itemTaxable * rate) / 100;
      taxable += itemTaxable;

      const entry = byRate.get(rate) ?? { taxableAmount: 0, taxAmount: 0 };
      entry.taxableAmount += itemTaxable;
      entry.taxAmount += itemTax;
      byRate.set(rate, entry);
    }

    const taxAmount = Array.from(byRate.values()).reduce(
      (sum, entry) => sum + entry.taxAmount,
      0
    );

    const gstLines: GstLine[] = Array.from(byRate.entries())
      .sort(([a], [b]) => a - b)
      .map(([rate, entry]) => {
        if (intraState) {
          return {
            rate,
            taxableAmount: round2(entry.taxableAmount),
            taxAmount: round2(entry.taxAmount),
            cgst: round2(entry.taxAmount / 2),
            sgst: round2(entry.taxAmount / 2),
            igst: 0,
          };
        }
        return {
          rate,
          taxableAmount: round2(entry.taxableAmount),
          taxAmount: round2(entry.taxAmount),
          cgst: 0,
          sgst: 0,
          igst: round2(entry.taxAmount),
        };
      });

    const taxableRounded = round2(taxable);
    const taxRounded = round2(taxAmount);
    const discountRounded = round2(discount);

    return {
      subtotal: round2(taxable),
      discount: discountRounded,
      taxableAmount: taxableRounded,
      taxAmount: taxRounded,
      total: round2(taxable + taxAmount - discount),
      gstLines,
      intraState,
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
