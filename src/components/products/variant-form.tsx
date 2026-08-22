"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { getProductAttributesForType } from "@/config/business-types";
import type { ProductVariant } from "@/types/domain";

const variantSchema = z.object({
  sku: z.string().trim().optional().or(z.literal("")),
  barcode: z.string().trim().optional().or(z.literal("")),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  salePrice: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Price cannot be negative.").optional()),
  purchasePrice: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Price cannot be negative.").optional()),
  mrp: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Price cannot be negative.").optional()),
});

type VariantValues = z.infer<typeof variantSchema>;

function toFormValues(variant?: ProductVariant | null): VariantValues {
  return {
    sku: variant?.sku ?? "",
    barcode: variant?.barcode ?? "",
    attributes: variant?.attributes ?? {},
    salePrice: variant?.salePrice ?? undefined,
    purchasePrice: variant?.purchasePrice ?? undefined,
    mrp: variant?.mrp ?? undefined,
  };
}

export function VariantForm({
  businessType,
  variant,
  onSubmit,
  submitLabel = "Add variant",
}: {
  businessType: string | null | undefined;
  variant?: ProductVariant | null;
  onSubmit: (values: VariantValues) => Promise<void>;
  submitLabel?: string;
}) {
  const attributes = getProductAttributesForType(businessType);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof variantSchema>, unknown, z.output<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: toFormValues(variant),
  });

  const submit = async (values: VariantValues) => {
    const attributesRecord: VariantValues["attributes"] = {};
    for (const definition of attributes) {
      const value = (values.attributes ?? {})[definition.key];
      if (value === undefined || value === null || value === "") continue;
      if (definition.type === "number") attributesRecord[definition.key] = Number(value);
      else attributesRecord[definition.key] = String(value);
    }
    await onSubmit({ ...values, attributes: attributesRecord });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Variant SKU" htmlFor="variant-sku" error={errors.sku?.message}>
          <Input id="variant-sku" placeholder="e.g. TS-WHT-M" {...register("sku")} />
        </Field>
        <Field label="Variant barcode" htmlFor="variant-barcode" error={errors.barcode?.message}>
          <Input id="variant-barcode" placeholder="Scan or type" {...register("barcode")} />
        </Field>
      </div>

      {attributes.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Variant attributes
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {attributes
              .filter((definition) =>
                ["select", "text", "number"].includes(definition.type)
              )
              .map((definition) => (
                <Field
                  key={definition.key}
                  label={definition.label}
                  htmlFor={`vattr-${definition.key}`}
                >
                  <Input
                    id={`vattr-${definition.key}`}
                    type={definition.type === "number" ? "number" : "text"}
                    defaultValue={
                      (variant?.attributes?.[definition.key] as string | number | undefined) ?? ""
                    }
                    onChange={(event) =>
                      setValue(`attributes.${definition.key}`, event.target.value || "")
                    }
                  />
                </Field>
              ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Sale price" htmlFor="variant-sale" error={errors.salePrice?.message}>
          <Input
            id="variant-sale"
            type="number"
            step="0.01"
            min={0}
            defaultValue={variant?.salePrice ?? ""}
            {...register("salePrice")}
          />
        </Field>
        <Field label="Purchase price" htmlFor="variant-purchase" error={errors.purchasePrice?.message}>
          <Input
            id="variant-purchase"
            type="number"
            step="0.01"
            min={0}
            defaultValue={variant?.purchasePrice ?? ""}
            {...register("purchasePrice")}
          />
        </Field>
        <Field label="MRP" htmlFor="variant-mrp" error={errors.mrp?.message}>
          <Input
            id="variant-mrp"
            type="number"
            step="0.01"
            min={0}
            defaultValue={variant?.mrp ?? ""}
            {...register("mrp")}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
