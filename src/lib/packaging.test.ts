import { describe, expect, it } from "vitest";
import {
  defaultUnitKind,
  formatBaseAvailable,
  fromBaseQuantity,
  oversellMessage,
  packagingFromProduct,
  packSaleEnabled,
  purchaseUnitOptions,
  resolvePurchaseUnitKind,
  resolveUnitKind,
  saleUnitOptions,
  toBaseQuantity,
  validateSaleQuantity,
} from "./packaging";

const strip = packagingFromProduct({
  unit: "PCS",
  packUnit: "STRIP",
  unitsPerPack: 10,
  minSaleQty: 1,
  maxSaleQty: 20,
  allowBaseSale: true,
  allowPackSale: true,
});

describe("packaging conversion", () => {
  it("keeps base qty unchanged", () => {
    expect(toBaseQuantity(14, "base", strip)).toBe(14);
    expect(fromBaseQuantity(14, "base", strip)).toBe(14);
  });

  it("converts pack qty to base units", () => {
    expect(toBaseQuantity(2, "pack", strip)).toBe(20);
    expect(fromBaseQuantity(20, "pack", strip)).toBe(2);
  });

  it("converts purchase packs even when pack sale is off", () => {
    const purchaseOnly = packagingFromProduct({
      unit: "PCS",
      packUnit: "BOX",
      unitsPerPack: 12,
      allowBaseSale: true,
      allowPackSale: false,
    });
    expect(packSaleEnabled(purchaseOnly)).toBe(false);
    expect(toBaseQuantity(3, "pack", purchaseOnly)).toBe(36);
    expect(resolvePurchaseUnitKind("pack", purchaseOnly)).toBe("pack");
    expect(purchaseUnitOptions(purchaseOnly).map((option) => option.kind)).toEqual(["base", "pack"]);
  });

  it("does not offer pack sale when pack sale is disabled", () => {
    const noPackSale = packagingFromProduct({
      unit: "PCS",
      packUnit: "BOX",
      unitsPerPack: 12,
      allowBaseSale: true,
      allowPackSale: false,
    });
    expect(saleUnitOptions(noPackSale).map((option) => option.kind)).toEqual(["base"]);
    expect(resolveUnitKind("pack", noPackSale)).toBe("base");
    expect(defaultUnitKind(noPackSale)).toBe("base");
  });

  it("formats available stock in base units", () => {
    expect(formatBaseAvailable(14, strip)).toBe("14 PCS");
    expect(oversellMessage(14, "PCS")).toBe("Only 14 PCS available.");
  });

  it("enforces min and max sale qty without using pack size", () => {
    expect(validateSaleQuantity(0, strip)).toBe("Quantity must be greater than zero.");
    expect(validateSaleQuantity(1, strip)).toBeNull();
    expect(validateSaleQuantity(21, strip)).toBe("Maximum sale quantity is 20.");
    const minTwo = packagingFromProduct({ ...strip, minSaleQty: 2, maxSaleQty: null });
    expect(validateSaleQuantity(1, minTwo)).toBe("Minimum sale quantity is 2.");
  });
});
