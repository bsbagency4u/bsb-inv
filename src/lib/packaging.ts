export type UnitKind = "base" | "pack";
export type RateBasis = "base" | "pack";

export interface ProductPackaging {
  unit: string;
  packUnit: string | null;
  unitsPerPack: number;
  minSaleQty: number;
  maxSaleQty: number | null;
  allowBaseSale: boolean;
  allowPackSale: boolean;
  allowPackPurchase: boolean;
  fixedPacking: boolean;
}

export interface PackagingSource {
  unit?: string | null;
  packUnit?: string | null;
  unitsPerPack?: number | null;
  minSaleQty?: number | null;
  maxSaleQty?: number | null;
  allowBaseSale?: boolean | null;
  allowPackSale?: boolean | null;
  allowPackPurchase?: boolean | null;
  fixedPacking?: boolean | null;
}

export function packagingFromProduct(product: PackagingSource): ProductPackaging {
  const unitsPerPack = Number(product.unitsPerPack);
  return {
    unit: (product.unit ?? "pcs").trim() || "pcs",
    packUnit: product.packUnit?.trim() ? product.packUnit.trim() : null,
    unitsPerPack: Number.isFinite(unitsPerPack) && unitsPerPack > 0 ? unitsPerPack : 1,
    minSaleQty: Number.isFinite(Number(product.minSaleQty)) ? Number(product.minSaleQty) : 1,
    maxSaleQty:
      product.maxSaleQty == null || product.maxSaleQty === undefined
        ? null
        : Number(product.maxSaleQty),
    allowBaseSale: product.allowBaseSale !== false,
    allowPackSale: product.allowPackSale === true,
    allowPackPurchase: product.allowPackPurchase !== false,
    fixedPacking: product.fixedPacking !== false,
  };
}

export function packSaleEnabled(packaging: ProductPackaging): boolean {
  return (
    packaging.allowPackSale &&
    Boolean(packaging.packUnit) &&
    packaging.unitsPerPack > 1
  );
}

export function saleUnitOptions(
  packaging: ProductPackaging
): Array<{ kind: UnitKind; code: string }> {
  const options: Array<{ kind: UnitKind; code: string }> = [];
  if (packaging.allowBaseSale !== false) {
    options.push({ kind: "base", code: packaging.unit });
  }
  if (packSaleEnabled(packaging) && packaging.packUnit) {
    options.push({ kind: "pack", code: packaging.packUnit });
  }
  if (options.length === 0) {
    options.push({ kind: "base", code: packaging.unit });
  }
  return options;
}

export function majorUnitEnabled(packaging: ProductPackaging): boolean {
  return Boolean(packaging.packUnit) && packaging.unitsPerPack > 1;
}

export function purchaseUnitOptions(
  packaging: ProductPackaging
): Array<{ kind: UnitKind; code: string }> {
  const options: Array<{ kind: UnitKind; code: string }> = [];
  if (packaging.allowPackPurchase !== false && majorUnitEnabled(packaging) && packaging.packUnit) {
    options.push({ kind: "pack", code: packaging.packUnit });
  }
  options.push({ kind: "base", code: packaging.unit });
  return options;
}

export function defaultSaleUnitKind(packaging: ProductPackaging): UnitKind {
  const options = saleUnitOptions(packaging);
  return options[0]?.kind ?? "base";
}

export function defaultPurchaseUnitKind(packaging: ProductPackaging): UnitKind {
  const options = purchaseUnitOptions(packaging);
  return options[0]?.kind ?? "base";
}

export function defaultUnitKind(packaging: ProductPackaging): UnitKind {
  return defaultSaleUnitKind(packaging);
}

export function packingHelperText(packaging: ProductPackaging): string {
  if (!majorUnitEnabled(packaging) || !packaging.packUnit) {
    return `Stock is kept in ${packaging.unit}.`;
  }
  return `1 ${packaging.packUnit} = ${packaging.unitsPerPack} ${packaging.unit}. Purchases convert automatically into ${packaging.unit}. Sales use ${packaging.unit} by default.`;
}

export function resolveUnitKind(
  kind: UnitKind | string | null | undefined,
  packaging: ProductPackaging
): UnitKind {
  const options = saleUnitOptions(packaging);
  if (kind === "pack" && options.some((option) => option.kind === "pack")) return "pack";
  if (kind === "base" && options.some((option) => option.kind === "base")) return "base";
  return options[0]?.kind ?? "base";
}

export function unitCodeForKind(kind: UnitKind, packaging: ProductPackaging): string {
  if (kind === "pack" && packaging.packUnit) return packaging.packUnit;
  return packaging.unit;
}

export function resolvePurchaseUnitKind(
  kind: UnitKind | string | null | undefined,
  packaging: ProductPackaging
): UnitKind {
  const options = purchaseUnitOptions(packaging);
  if (kind === "pack" && options.some((option) => option.kind === "pack")) return "pack";
  if (kind === "base" && options.some((option) => option.kind === "base")) return "base";
  return options[0]?.kind ?? "base";
}

export function unitKindFromSaleUnit(
  saleUnit: string | null | undefined,
  packaging: ProductPackaging
): UnitKind {
  if (saleUnit && packaging.packUnit && saleUnit.toUpperCase() === packaging.packUnit.toUpperCase()) {
    return "pack";
  }
  return "base";
}

export function resolveReturnUnitKind(
  kind: UnitKind | string | null | undefined,
  packaging: ProductPackaging
): UnitKind {
  if (kind === "pack" && majorUnitEnabled(packaging)) return "pack";
  return "base";
}

export function rateBasisOptions(
  packaging: ProductPackaging
): Array<{ basis: RateBasis; code: string; label: string }> {
  const options: Array<{ basis: RateBasis; code: string; label: string }> = [
    { basis: "base", code: packaging.unit, label: `Per ${packaging.unit}` },
  ];
  if (packaging.packUnit && packaging.unitsPerPack > 1) {
    options.push({
      basis: "pack",
      code: packaging.packUnit,
      label: `Per ${packaging.packUnit}`,
    });
  }
  return options;
}

export function resolveRateBasis(
  basis: RateBasis | string | null | undefined,
  packaging: ProductPackaging,
  unitKind: UnitKind = "base"
): RateBasis {
  const options = rateBasisOptions(packaging);
  if (basis === "pack" && options.some((option) => option.basis === "pack")) return "pack";
  if (basis === "base" && options.some((option) => option.basis === "base")) return "base";
  return unitKind === "pack" && options.some((option) => option.basis === "pack") ? "pack" : "base";
}

export function toBaseQuantity(
  quantity: number,
  kind: UnitKind,
  packaging: ProductPackaging
): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (kind === "pack" && packaging.unitsPerPack > 0 && packaging.packUnit) {
    return qty * packaging.unitsPerPack;
  }
  return qty;
}

export function fromBaseQuantity(
  baseQuantity: number,
  kind: UnitKind,
  packaging: ProductPackaging
): number {
  const qty = Number(baseQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (kind === "pack" && packaging.unitsPerPack > 0 && packaging.packUnit) {
    return qty / packaging.unitsPerPack;
  }
  return qty;
}

export function commercialLineAmount(
  quantity: number,
  unitPrice: number,
  unitKind: UnitKind,
  rateBasis: RateBasis,
  packaging: ProductPackaging
): number {
  const qty = Number(quantity);
  const rate = Number(unitPrice);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) return 0;
  return qty * rateForUnitKind(rate, rateBasis, unitKind, packaging);
}

export function rateForUnitKind(
  unitPrice: number,
  rateBasis: RateBasis,
  unitKind: UnitKind,
  packaging: ProductPackaging
): number {
  const rate = Number(unitPrice);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (unitKind === rateBasis) return rate;
  if (unitKind === "pack" && rateBasis === "base") return packUnitCost(rate, "base", packaging);
  if (unitKind === "base" && rateBasis === "pack") return baseUnitCost(rate, "pack", packaging);
  return rate;
}

export function baseUnitCost(
  unitPrice: number,
  rateBasis: RateBasis,
  packaging: ProductPackaging
): number {
  const rate = Number(unitPrice);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (rateBasis === "pack" && packaging.unitsPerPack > 1) {
    return rate / packaging.unitsPerPack;
  }
  return rate;
}

export function packUnitCost(
  unitPrice: number,
  rateBasis: RateBasis,
  packaging: ProductPackaging
): number {
  const rate = Number(unitPrice);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (rateBasis === "base" && packaging.unitsPerPack > 1) {
    return rate * packaging.unitsPerPack;
  }
  return rate;
}

export interface ConvertedLine {
  quantity: number;
  unitKind: UnitKind;
  saleUnit: string;
  baseQuantity: number;
  unitPrice: number;
  rateBasis: RateBasis;
  lineAmount: number;
  baseUnitCost: number;
}

export function convertLine(input: {
  quantity: number;
  unitKind?: UnitKind | string | null;
  rateBasis?: RateBasis | string | null;
  unitPrice: number;
  packaging: ProductPackaging;
  mode?: "sale" | "purchase" | "return";
}): ConvertedLine {
  const packaging = input.packaging;
  const mode = input.mode ?? "sale";
  const kind =
    mode === "sale"
      ? resolveUnitKind(input.unitKind, packaging)
      : mode === "purchase"
        ? resolvePurchaseUnitKind(input.unitKind, packaging)
        : resolveReturnUnitKind(input.unitKind, packaging);
  const rateBasis = resolveRateBasis(input.rateBasis, packaging, kind);
  const quantity = Number(input.quantity);
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const unitPrice = Number(input.unitPrice);
  const rate = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  return {
    quantity: qty,
    unitKind: kind,
    saleUnit: unitCodeForKind(kind, packaging),
    baseQuantity: toBaseQuantity(qty, kind, packaging),
    unitPrice: rate,
    rateBasis,
    lineAmount: commercialLineAmount(qty, rate, kind, rateBasis, packaging),
    baseUnitCost: baseUnitCost(rate, rateBasis, packaging),
  };
}

export function formatBaseAvailable(baseQuantity: number, packaging: ProductPackaging): string {
  const qty = Number.isFinite(baseQuantity) ? baseQuantity : 0;
  return `${qty} ${packaging.unit}`;
}

export function oversellMessage(availableBase: number, unit: string): string {
  return `Only ${availableBase} ${unit} available.`;
}

export function validateSaleQuantity(
  quantity: number,
  packaging: ProductPackaging,
  unitKind: UnitKind = "base"
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  const baseQty = toBaseQuantity(quantity, unitKind, packaging);
  if (packaging.minSaleQty > 0 && baseQty < packaging.minSaleQty) {
    return `Minimum sale quantity is ${packaging.minSaleQty} ${packaging.unit}.`;
  }
  if (packaging.maxSaleQty != null && packaging.maxSaleQty > 0 && baseQty > packaging.maxSaleQty) {
    return `Maximum sale quantity is ${packaging.maxSaleQty} ${packaging.unit}.`;
  }
  return null;
}
