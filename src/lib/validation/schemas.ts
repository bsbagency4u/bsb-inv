import { z } from "zod";

const EMAIL = z.string().trim().toLowerCase().email("Enter a valid email address.");

const PHONE = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{6,15}$/, "Enter a valid phone number.")
  .optional()
  .or(z.literal(""));

const PINCODE = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z-]{3,10}$/, "Enter a valid pincode / postal code.")
  .optional()
  .or(z.literal(""));

export function validateGstin(value: string | null | undefined): boolean {
  const v = value?.trim().toUpperCase() ?? "";
  if (!v) return true;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v)) {
    return false;
  }
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  let factor = 2;
  for (let i = 0; i < 14; i++) {
    const num = chars.indexOf(v.charAt(i));
    sum += num * factor;
    factor = factor === 2 ? 1 : 2;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return chars.charAt(checkCodePoint) === v.charAt(14);
}

export const GSTIN = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .or(z.literal(""))
  .refine((v) => validateGstin(v), {
    message: "Enter a valid GSTIN (format: 22AAAAA0000A1Z5).",
  });

export const PAN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid PAN (format: ABCDE1234F).")
  .optional()
  .or(z.literal(""));

export const FINANCIAL_YEAR = z
  .string()
  .trim()
  .regex(
    /^((0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2]))$/,
    "Use month-day format, e.g. 01-04."
  )
  .optional()
  .or(z.literal(""));

export const INVOICE_PREFIX = z
  .string()
  .trim()
  .max(8, "Invoice prefix must be 8 characters or fewer.")
  .regex(/^[A-Za-z0-9-]*$/, "Prefix may only contain letters, numbers and dashes.")
  .optional()
  .or(z.literal(""));

export const INVOICE_START_NUMBER = z
  .union([z.number(), z.string().trim()])
  .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
  .pipe(z.number().int("Must be a whole number.").min(1, "Must be at least 1.").max(999999999))
  .optional();

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Business name is required.").max(120),
  legalName: z.string().trim().optional().or(z.literal("")),
  type: z.string().min(1, "Select a business type."),
  logoUrl: z
    .string()
    .trim()
    .url("Enter a valid image URL (include https://).")
    .optional()
    .or(z.literal("")),
  email: EMAIL.optional().or(z.literal("")),
  phone: PHONE,
  website: z
    .string()
    .trim()
    .url("Enter a valid URL (include https://).")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().min(1, "Country is required."),
  pincode: PINCODE,
  gstin: GSTIN,
  pan: PAN,
  currency: z.string().min(1, "Currency is required."),
  financialYear: FINANCIAL_YEAR,
  invoicePrefix: INVOICE_PREFIX,
  invoiceStartNumber: INVOICE_START_NUMBER,
});

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  phone: PHONE,
  avatarUrl: z.string().trim().url("Invalid image URL.").optional().or(z.literal("")),
});

export type UserProfileValues = z.infer<typeof userProfileSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200),
  description: z.string().trim().optional().or(z.literal("")),
  sku: z.string().trim().optional().or(z.literal("")),
  barcode: z.string().trim().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  brandId: z.string().optional().or(z.literal("")),
  unitId: z.string().optional().or(z.literal("")),
  unit: z.string().trim().optional().or(z.literal("pcs")),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  gstRate: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "GST rate cannot be negative.").max(100, "GST rate is too high."))
    .optional(),
  hsn: z.string().trim().optional().or(z.literal("")),
  purchasePrice: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Purchase price cannot be negative."))
    .optional(),
  salePrice: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Sale price cannot be negative."))
    .optional(),
  mrp: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "MRP cannot be negative."))
    .optional(),
  lowStockThreshold: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(0, "Threshold must be a whole number."))
    .optional(),
  minStock: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(0, "Minimum stock must be a whole number."))
    .optional(),
  maxStock: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(0, "Maximum stock must be a whole number."))
    .optional(),
  reorderLevel: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(0, "Reorder level must be a whole number."))
    .optional(),
  trackInventory: z.boolean().optional(),
  taxable: z.boolean().optional(),
  productStatus: z.enum(["active", "inactive", "draft", "discontinued"]).optional(),
});

export type ProductValues = z.infer<typeof productSchema>;

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  phone: PHONE,
  email: EMAIL.optional().or(z.literal("")),
  gstin: GSTIN,
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  pincode: PINCODE,
  openingBalance: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Opening balance cannot be negative."))
    .optional(),
});

export type PartyValues = z.infer<typeof partySchema>;
