import { describe, expect, it } from "vitest";
import {
  baseUnitCost,
  commercialLineAmount,
  convertLine,
  decodePackagingAttribute,
  defaultPurchaseUnitKind,
  defaultSaleUnitKind,
  defaultUnitKind,
  formatBaseAvailable,
  fromBaseQuantity,
  mergeAttributesWithPackaging,
  oversellMessage,
  PACKAGING_ATTRIBUTE_KEY,
  packagingFromProduct,
  packingHelperText,
  packSaleEnabled,
  purchaseUnitOptions,
  resolvePurchaseUnitKind,
  resolveRateBasis,
  resolveUnitKind,
  saleUnitOptions,
  storedPackagingFromInput,
  stripPackagingAttribute,
  toBaseQuantity,
  unitKindFromSaleUnit,
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
    expect(purchaseUnitOptions(purchaseOnly).map((option) => option.kind)).toEqual(["pack", "base"]);
    expect(defaultPurchaseUnitKind(purchaseOnly)).toBe("pack");
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

  it("defaults purchase to Major Unit and sales to Minor Unit", () => {
    expect(defaultPurchaseUnitKind(strip)).toBe("pack");
    expect(defaultSaleUnitKind(strip)).toBe("base");
    expect(unitKindFromSaleUnit("STRIP", strip)).toBe("pack");
    expect(unitKindFromSaleUnit("PCS", strip)).toBe("base");
    expect(packingHelperText(strip)).toContain("1 STRIP = 10 PCS");
  });

  it("converts 1 STRIP = 15 PCS purchase, sale, return and both rate bases", () => {
    const packing = packagingFromProduct({
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 15,
      allowBaseSale: true,
      allowPackSale: true,
      allowPackPurchase: true,
      fixedPacking: true,
    });
    const purchase = convertLine({
      quantity: 10,
      unitKind: "pack",
      rateBasis: "pack",
      unitPrice: 150,
      packaging: packing,
      mode: "purchase",
    });
    expect(purchase.baseQuantity).toBe(150);
    expect(purchase.lineAmount).toBe(1500);
    const purchasePerMinor = convertLine({
      quantity: 10,
      unitKind: "pack",
      rateBasis: "base",
      unitPrice: 10,
      packaging: packing,
      mode: "purchase",
    });
    expect(purchasePerMinor.lineAmount).toBe(purchase.lineAmount);
    expect(purchasePerMinor.baseQuantity).toBe(150);

    let stock = purchase.baseQuantity;
    const sellLoose = convertLine({
      quantity: 5,
      unitKind: "base",
      rateBasis: "base",
      unitPrice: 12,
      packaging: packing,
      mode: "sale",
    });
    stock -= sellLoose.baseQuantity;
    expect(stock).toBe(145);

    const sellStrip = convertLine({
      quantity: 1,
      unitKind: "pack",
      rateBasis: "pack",
      unitPrice: 180,
      packaging: packing,
      mode: "sale",
    });
    stock -= sellStrip.baseQuantity;
    expect(stock).toBe(130);

    const purchaseReturn = convertLine({
      quantity: 2,
      unitKind: "pack",
      rateBasis: "pack",
      unitPrice: 150,
      packaging: packing,
      mode: "return",
    });
    stock -= purchaseReturn.baseQuantity;
    expect(purchaseReturn.baseQuantity).toBe(30);
    expect(stock).toBe(100);

    const salesReturn = convertLine({
      quantity: 3,
      unitKind: "base",
      rateBasis: "base",
      unitPrice: 12,
      packaging: packing,
      mode: "return",
    });
    stock += salesReturn.baseQuantity;
    expect(salesReturn.baseQuantity).toBe(3);
    expect(stock).toBe(103);
  });
});

describe("packaging attribute fallback", () => {
  it("round-trips packing through product attributes", () => {
    const stored = storedPackagingFromInput({
      unit: "PCS",
      packUnit: "STRIP",
      packUnitId: "u-strip",
      unitsPerPack: 15,
      minSaleQty: 1,
      maxSaleQty: 30,
      allowBaseSale: true,
      allowPackSale: true,
      allowPackPurchase: true,
      fixedPacking: true,
    });
    const attributes = mergeAttributesWithPackaging({ manufacturer: "Acme" }, stored);
    expect(attributes[PACKAGING_ATTRIBUTE_KEY]).toMatchObject({
      packUnit: "STRIP",
      unitsPerPack: 15,
    });
    expect(decodePackagingAttribute(attributes)).toMatchObject({
      packUnit: "STRIP",
      packUnitId: "u-strip",
      unitsPerPack: 15,
      allowPackSale: true,
    });
    expect(stripPackagingAttribute(attributes)).toEqual({ manufacturer: "Acme" });
  });
});
