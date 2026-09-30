"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { productSchema, type ProductValues } from "@/lib/validation/schemas";
import { getProductFormAttributesForType } from "@/config/business-types";
import { packagingFromProduct, packingHelperText } from "@/lib/packaging";
import { GST_RATE_OPTIONS } from "@/services/gst.service";
import type { Brand, Category, Product, Unit } from "@/types/domain";

function toFormValues(product?: Product | null): ProductValues {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    categoryId: product?.categoryId ?? "",
    brandId: product?.brandId ?? "",
    unitId: product?.unitId ?? "",
    unit: product?.unit ?? "pcs",
    packUnitId: product?.packUnitId ?? "",
    packUnit: product?.packUnit ?? "",
    unitsPerPack: product?.unitsPerPack ?? 1,
    minSaleQty: product?.minSaleQty ?? 1,
    maxSaleQty: product?.maxSaleQty ?? undefined,
    allowBaseSale: product?.allowBaseSale ?? true,
    allowPackSale: product?.allowPackSale ?? false,
    allowPackPurchase: product?.allowPackPurchase ?? true,
    fixedPacking: product?.fixedPacking ?? true,
    attributes: product?.attributes ?? {},
    gstRate: product?.gstRate ?? 0,
    hsn: product?.hsn ?? "",
    purchasePrice: product?.purchasePrice ?? 0,
    salePrice: product?.salePrice ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 0,
    minStock: product?.minStock ?? 0,
    maxStock: product?.maxStock ?? undefined,
    reorderLevel: product?.reorderLevel ?? 0,
    trackInventory: product?.trackInventory ?? true,
    taxable: product?.taxable ?? true,
    productStatus: product?.productStatus ?? "active",
  };
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-surface-subtle p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ProductForm({
  businessType,
  categories,
  brands,
  units,
  product,
  onSubmit,
  submitLabel = "Save product",
}: {
  businessType: string | null | undefined;
  categories: Category[];
  brands?: Brand[];
  units?: Unit[];
  product?: Product | null;
  onSubmit: (values: ProductValues) => Promise<void>;
  submitLabel?: string;
}) {
  const attributes = getProductFormAttributesForType(businessType);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  });

  const trackInventory = useWatch({ control, name: "trackInventory" });
  const taxable = useWatch({ control, name: "taxable" });
  const unitCode = useWatch({ control, name: "unit" });
  const packUnitCode = useWatch({ control, name: "packUnit" });
  const unitsPerPack = useWatch({ control, name: "unitsPerPack" });
  const allowBaseSale = useWatch({ control, name: "allowBaseSale" });
  const allowPackSale = useWatch({ control, name: "allowPackSale" });
  const allowPackPurchase = useWatch({ control, name: "allowPackPurchase" });
  const fixedPacking = useWatch({ control, name: "fixedPacking" });
  const gstRate = useWatch({ control, name: "gstRate" });
  const packingPreview = packingHelperText(
    packagingFromProduct({
      unit: unitCode || "pcs",
      packUnit: packUnitCode || null,
      unitsPerPack: Number(unitsPerPack) || 1,
      allowBaseSale,
      allowPackSale,
      allowPackPurchase,
      fixedPacking,
    })
  );

  const unitById = React.useMemo(() => {
    const map = new Map<string, Unit>();
    for (const unit of units ?? []) map.set(unit.id, unit);
    return map;
  }, [units]);

  const gstOptions = React.useMemo(() => {
    const rates = new Set<number>(GST_RATE_OPTIONS);
    if (typeof gstRate === "number") rates.add(gstRate);
    return Array.from(rates).sort((a, b) => a - b);
  }, [gstRate]);

  const submit = async (values: ProductValues) => {
    const attributesRecord: ProductValues["attributes"] = {};
    for (const definition of attributes) {
      const value = (values.attributes ?? {})[definition.key];
      if (value === undefined || value === null || value === "") continue;
      if (definition.type === "number") {
        attributesRecord[definition.key] = Number(value);
      } else if (definition.type === "boolean") {
        attributesRecord[definition.key] = value === true || value === "true";
      } else {
        attributesRecord[definition.key] = String(value);
      }
    }
    const baseUnit = values.unitId ? unitById.get(values.unitId) : undefined;
    const packUnit = values.packUnitId ? unitById.get(values.packUnitId) : undefined;
    await onSubmit({
      ...values,
      unit: baseUnit?.code ?? values.unit ?? "pcs",
      packUnit: packUnit?.code ?? values.packUnit ?? "",
      attributes: attributesRecord,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormSection title="Basic">
        <Field
          label="Product name"
          htmlFor="product-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="product-name"
            placeholder="e.g. Cotton T-Shirt (White)"
            invalid={Boolean(errors.name)}
            {...register("name")}
          />
        </Field>

        <Field label="Description" htmlFor="product-description" error={errors.description?.message}>
          <Textarea
            id="product-description"
            placeholder="Short description shown on invoices and POS"
            {...register("description")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="SKU" htmlFor="product-sku" error={errors.sku?.message}>
            <Input id="product-sku" placeholder="e.g. TS-WHT-M" {...register("sku")} />
          </Field>
          <Field label="Barcode" htmlFor="product-barcode" error={errors.barcode?.message}>
            <Input id="product-barcode" placeholder="Scan or type" {...register("barcode")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="product-category" error={errors.categoryId?.message}>
            <Select
              id="product-category"
              defaultValue={product?.categoryId ?? ""}
              onChange={(event) => setValue("categoryId", event.target.value || "")}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand" htmlFor="product-brand" error={errors.brandId?.message}>
            <Select
              id="product-brand"
              defaultValue={product?.brandId ?? ""}
              onChange={(event) => setValue("brandId", event.target.value || "")}
            >
              <option value="">No brand</option>
              {(brands ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Status" htmlFor="product-status">
          <Select
            id="product-status"
            defaultValue={product?.productStatus ?? "active"}
            onChange={(event) => setValue("productStatus", event.target.value as ProductValues["productStatus"])}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
            <option value="discontinued">Discontinued</option>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Units and packaging"
        hint="Stock is always kept in the Minor Unit. Purchases default to Major Unit. Sales and POS default to Minor Unit. MRP is set on the purchase batch, not here."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Minor Unit"
            htmlFor="product-unit"
            hint="Stock unit. Example: PCS."
            error={errors.unitId?.message}
          >
            <Select
              id="product-unit"
              defaultValue={product?.unitId ?? ""}
              onChange={(event) => {
                const id = event.target.value || "";
                setValue("unitId", id);
                setValue("unit", unitById.get(id)?.code ?? "pcs");
              }}
            >
              <option value="">Select unit…</option>
              {(units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Major Unit"
            htmlFor="product-pack-unit"
            hint="Purchase pack. Example: STRIP."
            error={errors.packUnitId?.message}
          >
            <Select
              id="product-pack-unit"
              defaultValue={product?.packUnitId ?? ""}
              onChange={(event) => {
                const id = event.target.value || "";
                setValue("packUnitId", id);
                setValue("packUnit", unitById.get(id)?.code ?? "");
              }}
            >
              <option value="">No major unit</option>
              {(units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.code})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Packing"
          htmlFor="product-units-per-pack"
          hint="How many Minor Units are in one Major Unit. Example: 1 STRIP = 15 PCS."
          error={errors.unitsPerPack?.message}
        >
          <Input
            id="product-units-per-pack"
            type="number"
            min={1}
            step="any"
            defaultValue={product?.unitsPerPack ?? 1}
            {...register("unitsPerPack")}
          />
        </Field>
        <p className="text-xs text-muted-foreground">{packingPreview}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Fixed Packing</p>
              <p className="text-xs text-muted-foreground">
                ON locks conversion on every bill. OFF keeps this product default unless a transaction is allowed to override.
              </p>
            </div>
            <Switch
              checked={fixedPacking ?? true}
              onCheckedChange={(checked) => setValue("fixedPacking", checked)}
              aria-label="Fixed packing"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Buy in Major Unit</p>
              <p className="text-xs text-muted-foreground">Purchases default to the Major Unit when packing is set.</p>
            </div>
            <Switch
              checked={allowPackPurchase ?? true}
              onCheckedChange={(checked) => setValue("allowPackPurchase", checked)}
              aria-label="Allow purchase in major unit"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Sell in Minor Unit</p>
              <p className="text-xs text-muted-foreground">Allow cashiers to sell the Minor Unit. This is the POS default.</p>
            </div>
            <Switch
              checked={allowBaseSale ?? true}
              onCheckedChange={(checked) => setValue("allowBaseSale", checked)}
              aria-label="Allow sale in minor unit"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Sell in Major Unit</p>
              <p className="text-xs text-muted-foreground">Allow cashiers to sell whole packs.</p>
            </div>
            <Switch
              checked={allowPackSale ?? false}
              onCheckedChange={(checked) => setValue("allowPackSale", checked)}
              aria-label="Allow sale in major unit"
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Tax and pricing"
        hint="One GST rate and one HSN. MRP is captured on the purchase batch, not on the product."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="GST rate (%)" htmlFor="product-gst" error={errors.gstRate?.message}>
            <Select
              id="product-gst"
              defaultValue={String(product?.gstRate ?? 0)}
              onChange={(event) => setValue("gstRate", Number(event.target.value))}
            >
              {gstOptions.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
          </Field>
          <Field label="HSN code" htmlFor="product-hsn" error={errors.hsn?.message}>
            <Input id="product-hsn" placeholder="e.g. 6109" {...register("hsn")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Purchase price"
            htmlFor="product-purchase"
            hint="Default cost per Minor Unit. Batch MRP is captured on purchase."
            error={errors.purchasePrice?.message}
          >
            <Input
              id="product-purchase"
              type="number"
              step="0.01"
              min={0}
              defaultValue={product?.purchasePrice ?? 0}
              {...register("purchasePrice")}
            />
          </Field>
          <Field
            label="Sale price"
            htmlFor="product-sale"
            hint="Default selling price per Minor Unit. MRP comes from the selected batch."
            error={errors.salePrice?.message}
          >
            <Input
              id="product-sale"
              type="number"
              step="0.01"
              min={0}
              defaultValue={product?.salePrice ?? 0}
              {...register("salePrice")}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">Taxable</p>
            <p className="text-xs text-muted-foreground">Apply GST on sales of this product.</p>
          </div>
          <Switch
            checked={taxable ?? true}
            onCheckedChange={(checked) => setValue("taxable", checked)}
            aria-label="Taxable product"
          />
        </div>
      </FormSection>

      <FormSection title="Stock controls">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Min sale qty"
            htmlFor="product-min-sale"
            hint="In Minor Units. Independent of packing and Max stock."
            error={errors.minSaleQty?.message}
          >
            <Input
              id="product-min-sale"
              type="number"
              min={0}
              step="any"
              defaultValue={product?.minSaleQty ?? 1}
              {...register("minSaleQty")}
            />
          </Field>
          <Field
            label="Max sale qty"
            htmlFor="product-max-sale"
            hint="In Minor Units. Not the same as Max stock."
            error={errors.maxSaleQty?.message}
          >
            <Input
              id="product-max-sale"
              type="number"
              min={0}
              step="any"
              defaultValue={product?.maxSaleQty ?? ""}
              {...register("maxSaleQty")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Low-stock threshold"
            htmlFor="product-threshold"
            hint="Alert when stock drops to this level."
            error={errors.lowStockThreshold?.message}
          >
            <Input
              id="product-threshold"
              type="number"
              step="1"
              min={0}
              defaultValue={product?.lowStockThreshold ?? 0}
              {...register("lowStockThreshold")}
            />
          </Field>
          <Field label="Reorder level" htmlFor="product-reorder" error={errors.reorderLevel?.message}>
            <Input
              id="product-reorder"
              type="number"
              step="1"
              min={0}
              defaultValue={product?.reorderLevel ?? 0}
              {...register("reorderLevel")}
            />
          </Field>
          <Field
            label="Max stock"
            htmlFor="product-max"
            hint="Inventory ceiling in Minor Units. Not Max sale quantity."
            error={errors.maxStock?.message}
          >
            <Input
              id="product-max"
              type="number"
              step="1"
              min={0}
              defaultValue={product?.maxStock ?? ""}
              {...register("maxStock")}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">Track inventory</p>
            <p className="text-xs text-muted-foreground">Count this product in stock levels.</p>
          </div>
          <Switch
            checked={trackInventory ?? true}
            onCheckedChange={(checked) => setValue("trackInventory", checked)}
            aria-label="Track inventory"
          />
        </div>
      </FormSection>

      {attributes.length > 0 ? (
        <FormSection title="Product attributes">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {attributes.map((definition) => (
              <Field
                key={definition.key}
                label={definition.label}
                htmlFor={`attr-${definition.key}`}
              >
                {definition.type === "select" ? (
                  <Select
                    id={`attr-${definition.key}`}
                    defaultValue={
                      (product?.attributes?.[definition.key] as string) ?? definition.options?.[0] ?? ""
                    }
                    onChange={(event) =>
                      setValue(`attributes.${definition.key}`, event.target.value || "")
                    }
                  >
                    <option value="">—</option>
                    {definition.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : definition.type === "date" ? (
                  <Input
                    id={`attr-${definition.key}`}
                    type="date"
                    defaultValue={(product?.attributes?.[definition.key] as string) ?? ""}
                    onChange={(event) =>
                      setValue(`attributes.${definition.key}`, event.target.value || "")
                    }
                  />
                ) : definition.type === "number" ? (
                  <Input
                    id={`attr-${definition.key}`}
                    type="number"
                    defaultValue={(product?.attributes?.[definition.key] as string | number) ?? ""}
                    onChange={(event) =>
                      setValue(`attributes.${definition.key}`, event.target.value || "")
                    }
                  />
                ) : (
                  <Input
                    id={`attr-${definition.key}`}
                    defaultValue={(product?.attributes?.[definition.key] as string) ?? ""}
                    onChange={(event) =>
                      setValue(`attributes.${definition.key}`, event.target.value || "")
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </FormSection>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
