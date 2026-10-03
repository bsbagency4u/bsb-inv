import { describe, expect, it, vi } from "vitest";
import { SupabaseProductRepository } from "./product.repository";

function missingPurchasePriceError() {
  return { code: "42703", message: "column product_batches.purchase_price does not exist", details: null, hint: null };
}

function chain(result: { data: unknown; error: unknown }, captured: Array<Record<string, unknown>>) {
  const api = {
    insert(payload: Record<string, unknown>) {
      captured.push(payload);
      return api;
    },
    update(payload: Record<string, unknown>) {
      captured.push(payload);
      return api;
    },
    eq() {
      return api;
    },
    select() {
      return api;
    },
    single() {
      return Promise.resolve(result);
    },
  };
  return api;
}

describe("SupabaseProductRepository batch writes", () => {
  it("retries createBatch without purchase_price when the column is missing", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const row = {
      id: "batch-1",
      business_id: "b-1",
      product_id: "p-1",
      batch_no: "GH6478",
      expiry_date: null,
      mrp: null,
      created_at: "2026-10-02T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    };
    const from = vi.fn()
      .mockReturnValueOnce(chain({ data: null, error: missingPurchasePriceError() }, captured))
      .mockReturnValueOnce(chain({ data: row, error: null }, captured));
    const repo = new SupabaseProductRepository({ from } as never);
    const created = await repo.createBatch("b-1", {
      productId: "p-1",
      batchNo: "GH6478",
      purchasePrice: 140,
    });
    expect(captured[0]).toHaveProperty("purchase_price", 140);
    expect(captured[1]).not.toHaveProperty("purchase_price");
    expect(captured[1]).toMatchObject({ batch_no: "GH6478", product_id: "p-1" });
    expect(created).toMatchObject({ id: "batch-1", batchNo: "GH6478", purchasePrice: null });
  });

  it("retries updateBatch without purchase_price when the column is missing", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const row = {
      id: "batch-1",
      business_id: "b-1",
      product_id: "p-1",
      batch_no: "GH6478",
      expiry_date: "2027-01-31",
      mrp: 200,
      created_at: "2026-10-02T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    };
    const from = vi.fn()
      .mockReturnValueOnce(chain({ data: null, error: missingPurchasePriceError() }, captured))
      .mockReturnValueOnce(chain({ data: row, error: null }, captured));
    const repo = new SupabaseProductRepository({ from } as never);
    const updated = await repo.updateBatch("b-1", "batch-1", {
      expiryDate: "2027-01-31",
      mrp: 200,
      purchasePrice: 140,
    });
    expect(captured[0]).toHaveProperty("purchase_price", 140);
    expect(captured[1]).not.toHaveProperty("purchase_price");
    expect(updated).toMatchObject({ expiryDate: "2027-01-31", mrp: 200, purchasePrice: null });
  });
});
