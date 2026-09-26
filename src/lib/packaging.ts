export type UnitKind = "base" | "pack";

export interface ProductPackaging {
  unit: string;
  packUnit: string | null;
  unitsPerPack: number;
  minSaleQty: number;
  maxSaleQty: number | null;
  allowBaseSale: boolean;
  allowPackSale: boolean;
}

export interface PackagingSource {
  unit?: string | null;
  packUnit?: string | null;
  unitsPerPack?: number | null;
  minSaleQty?: number | null;
  maxSaleQty?: number | null;
  allowBaseSale?: boolean | null;
  allowPackSale?: boolean | null;
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

export function purchaseUnitOptions(
  packaging: ProductPackaging
): Array<{ kind: UnitKind; code: string }> {
  const options: Array<{ kind: UnitKind; code: string }> = [{ kind: "base", code: packaging.unit }];
  if (packaging.packUnit && packaging.unitsPerPack > 1) {
    options.push({ kind: "pack", code: packaging.packUnit });
  }
  return options;
}

export function defaultUnitKind(packaging: ProductPackaging): UnitKind {
  const options = saleUnitOptions(packaging);
  return options[0]?.kind ?? "base";
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

export function formatBaseAvailable(baseQuantity: number, packaging: ProductPackaging): string {
  const qty = Number.isFinite(baseQuantity) ? baseQuantity : 0;
  return `${qty} ${packaging.unit}`;
}

export function oversellMessage(availableBase: number, unit: string): string {
  return `Only ${availableBase} ${unit} available.`;
}

export function validateSaleQuantity(
  quantity: number,
  packaging: ProductPackaging
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  if (packaging.minSaleQty > 0 && quantity < packaging.minSaleQty) {
    return `Minimum sale quantity is ${packaging.minSaleQty}.`;
  }
  if (packaging.maxSaleQty != null && packaging.maxSaleQty > 0 && quantity > packaging.maxSaleQty) {
    return `Maximum sale quantity is ${packaging.maxSaleQty}.`;
  }
  return null;
}
