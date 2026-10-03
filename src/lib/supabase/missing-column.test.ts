import { describe, expect, it } from "vitest";
import { isMissingColumnError, omitColumns } from "./missing-column";

describe("isMissingColumnError", () => {
  it("detects Postgres undefined-column 42703", () => {
    expect(isMissingColumnError({ code: "42703", message: "column product_batches.purchase_price does not exist" })).toBe(
      true
    );
  });

  it("detects PostgREST unknown-column PGRST204", () => {
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'purchase_price' column" })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("omitColumns", () => {
  it("drops named keys without mutating the original", () => {
    const payload = { batch_no: "GH6478", purchase_price: 140, mrp: 200 };
    expect(omitColumns(payload, ["purchase_price"])).toEqual({ batch_no: "GH6478", mrp: 200 });
    expect(payload.purchase_price).toBe(140);
  });
});
