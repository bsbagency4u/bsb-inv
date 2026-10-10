export interface InvoiceStockLine {
  productId: string;
  variantId: string | null;
  batchId: string | null;
  soldBase: number;
}

export interface ReturnRequest {
  productId: string;
  baseQuantity: number;
}

export interface ReturnAllocation {
  productId: string;
  variantId: string | null;
  batchId: string | null;
  quantity: number;
}

export function allocateReturnToLots(
  lines: InvoiceStockLine[],
  previous: ReturnRequest[],
  requests: ReturnRequest[]
): { allocations: ReturnAllocation[]; fullyReturned: boolean; error: string | null } {
  const remaining = lines.map((line) => ({
    ...line,
    remaining: Math.max(0, line.soldBase),
  }));

  const consume = (productId: string, qty: number, record: boolean): { leftover: number; got: ReturnAllocation[] } => {
    let need = Math.max(0, qty);
    const got: ReturnAllocation[] = [];
    for (const line of remaining) {
      if (line.productId !== productId || line.remaining <= 0 || need <= 0) continue;
      const take = Math.min(need, line.remaining);
      line.remaining -= take;
      need -= take;
      if (record && take > 0) {
        got.push({
          productId: line.productId,
          variantId: line.variantId,
          batchId: line.batchId,
          quantity: take,
        });
      }
    }
    return { leftover: need, got };
  };

  for (const prev of previous) {
    consume(prev.productId, prev.baseQuantity, false);
  }

  const allocations: ReturnAllocation[] = [];
  for (const request of requests) {
    if (request.baseQuantity <= 0) {
      return { allocations: [], fullyReturned: false, error: "Add at least one returned item." };
    }
    const sold = lines.some((line) => line.productId === request.productId);
    if (!sold) {
      return {
        allocations: [],
        fullyReturned: false,
        error: "Returned items must come from the original invoice.",
      };
    }
    const { leftover, got } = consume(request.productId, request.baseQuantity, true);
    if (leftover > 1e-9) {
      return {
        allocations: [],
        fullyReturned: false,
        error: "Return quantity exceeds the original invoice.",
      };
    }
    allocations.push(...got);
  }

  const fullyReturned = remaining.every((line) => line.remaining <= 1e-9);
  return { allocations, fullyReturned, error: null };
}
