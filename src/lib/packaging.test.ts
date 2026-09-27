import { describe, expect, it } from "vitest";
import {
  baseUnitCost,
  commercialLineAmount,
  convertLine,
  defaultUnitKind,
  formatBaseAvailable,
  fromBaseQuantity,
  oversellMessage,
  packagingFromProduct,
  packSaleEnabled,
  purchaseUnitOptions,
  resolvePurchaseUnitKind,
  resolveRateBasis,
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

  it("enforces min and max sale qty in base units", () => {
    expect(validateSaleQuantity(0, strip)).toBe("Quantity must be greater than zero.");
    expect(validateSaleQuantity(1, strip)).toBeNull();
    expect(validateSaleQuantity(21, strip)).toBe("Maximum sale quantity is 20 PCS.");
    expect(validateSaleQuantity(3, strip, "pack")).toBe("Maximum sale quantity is 20 PCS.");
    expect(validateSaleQuantity(2, strip, "pack")).toBeNull();
    const minTwo = packagingFromProduct({ ...strip, minSaleQty: 2, maxSaleQty: null });
    expect(validateSaleQuantity(1, minTwo)).toBe("Minimum sale quantity is 2 PCS.");
  });

  it("does not double-convert pack qty at per-base rate", () => {
    expect(commercialLineAmount(1, 5, "pack", "base", strip)).toBe(50);
    expect(commercialLineAmount(1, 50, "pack", "pack", strip)).toBe(50);
    expect(baseUnitCost(5, "base", strip)).toBe(5);
    expect(baseUnitCost(50, "pack", strip)).toBe(5);
    expect(resolveRateBasis(undefined, strip, "pack")).toBe("pack");
  });

  it("converts 1 STRIP at Rs 5/PCS to 10 PCS and Rs 50", () => {
    const line = convertLine({
      quantity: 1,
      unitKind: "pack",
      rateBasis: "base",
      unitPrice: 5,
      packaging: strip,
      mode: "purchase",
    });
    expect(line.baseQuantity).toBe(10);
    expect(line.lineAmount).toBe(50);
    expect(line.baseUnitCost).toBe(5);
    expect(line.saleUnit).toBe("STRIP");
  });

  it("keeps 1 STRIP at Rs 50/STRIP as Rs 50 not Rs 500", () => {
    const line = convertLine({
      quantity: 1,
      unitKind: "pack",
      rateBasis: "pack",
      unitPrice: 50,
      packaging: strip,
      mode: "purchase",
    });
    expect(line.baseQuantity).toBe(10);
    expect(line.lineAmount).toBe(50);
    expect(line.baseUnitCost).toBe(5);
  });

  it("restores remaining base stock after pack then loose sale", () => {
    const opening = 110;
    const afterStrip = opening - toBaseQuantity(1, "pack", strip);
    const remaining = afterStrip - toBaseQuantity(2, "base", strip);
    expect(afterStrip).toBe(100);
    expect(remaining).toBe(98);
  });
});
