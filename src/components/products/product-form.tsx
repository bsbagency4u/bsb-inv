"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { productSchema, type ProductValues } from "@/lib/validation/schemas";
import { getProductAttributesForType } from "@/config/business-types";
import type { Category, Product } from "@/types/domain";

function toFormValues(product?: Product | null): ProductValues {
  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    categoryId: product?.categoryId ?? "",
    unit: product?.unit ?? "pcs",
    attributes: product?.attributes ?? {},
    gstRate: product?.gstRate ?? 0,
    hsn: product?.hsn ?? "",
    purchasePrice: product?.purchasePrice ?? 0,
    salePrice: product?.salePrice ?? 0,
    mrp: product?.mrp ?? undefined,
    lowStockThreshold: product?.lowStockThreshold ?? 0,
  };
}

export function ProductForm({
  businessType,
  categories,
  product,
  onSubmit,
  submitLabel = "Save product",
}: {
  businessType: string | null | undefined;
  categories: Category[];
  product?: Product | null;
  onSubmit: (values: ProductValues) => Promise<void>;
  submitLabel?: string;
}) {
  const attributes = getProductAttributesForType(businessType);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  });

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
    await onSubmit({ ...values, attributes: attributesRecord });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="product-sku" error={errors.sku?.message}>
          <Input id="product-sku" placeholder="e.g. TS-WHT-M" {...register("sku")} />
        </Field>
        <Field label="Barcode" htmlFor="product-barcode" error={errors.barcode?.message}>
          <Input id="product-barcode" placeholder="Scan or type" {...register("barcode")} />
        </Field>
      </div>

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

      {attributes.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product attributes
          </p>
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
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="GST rate (%)" htmlFor="product-gst" error={errors.gstRate?.message}>
          <Input
            id="product-gst"
            type="number"
            step="0.01"
            min={0}
            max={100}
            defaultValue={product?.gstRate ?? 0}
            {...register("gstRate")}
          />
        </Field>
        <Field label="HSN code" htmlFor="product-hsn" error={errors.hsn?.message}>
          <Input id="product-hsn" placeholder="e.g. 6109" {...register("hsn")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Purchase price" htmlFor="product-purchase" error={errors.purchasePrice?.message}>
          <Input
            id="product-purchase"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.purchasePrice ?? 0}
            {...register("purchasePrice")}
          />
        </Field>
        <Field label="Sale price" htmlFor="product-sale" error={errors.salePrice?.message}>
          <Input
            id="product-sale"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.salePrice ?? 0}
            {...register("salePrice")}
          />
        </Field>
        <Field label="MRP" htmlFor="product-mrp" error={errors.mrp?.message}>
          <Input
            id="product-mrp"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.mrp ?? ""}
            {...register("mrp")}
          />
        </Field>
      </div>

      <Field
        label="Low-stock threshold"
        htmlFor="product-threshold"
        hint="You'll be notified when stock drops to this level."
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
