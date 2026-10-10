export interface TenderAllocation {
  mode: string;
  amount: number;
  reference?: string | null;
}

export interface TenderSettlement {
  payments: TenderAllocation[];
  changeDue: number;
  error: string | null;
}

const DEFAULT_CASH_MODES = new Set(["cash"]);

function isCashMode(mode: string, cashModes: Set<string>): boolean {
  const normalized = mode.trim().toLowerCase();
  if (cashModes.has(normalized)) return true;
  return normalized.includes("cash");
}

/**
 * Caps tender to the invoice total. Extra cash becomes change; non-cash overpay is an error.
 */
export function settleTender(
  allocations: TenderAllocation[],
  total: number,
  cashModes: Iterable<string> = DEFAULT_CASH_MODES
): TenderSettlement {
  const cash = new Set(Array.from(cashModes, (mode) => mode.trim().toLowerCase()));
  const prepared = allocations
    .map((allocation) => ({
      mode: allocation.mode,
      amount: Math.max(0, Number(allocation.amount) || 0),
      reference: allocation.reference ?? null,
    }))
    .filter((allocation) => allocation.amount > 0);
  const due = Math.max(0, Number(total) || 0);
  const tendered = prepared.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (tendered <= due) {
    return { payments: prepared, changeDue: 0, error: null };
  }

  const excess = round2(tendered - due);
  const cashTendered = prepared
    .filter((allocation) => isCashMode(allocation.mode, cash))
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  if (cashTendered + 1e-9 < excess) {
    return {
      payments: [],
      changeDue: 0,
      error: "Amount paid cannot exceed the invoice total.",
    };
  }

  let remainingExcess = excess;
  const payments: TenderAllocation[] = [];
  for (const allocation of prepared) {
    if (remainingExcess > 0 && isCashMode(allocation.mode, cash)) {
      const reduceBy = Math.min(allocation.amount, remainingExcess);
      remainingExcess = round2(remainingExcess - reduceBy);
      const nextAmount = round2(allocation.amount - reduceBy);
      if (nextAmount > 0) {
        payments.push({ ...allocation, amount: nextAmount });
      }
      continue;
    }
    payments.push(allocation);
  }

  return { payments, changeDue: excess, error: null };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
