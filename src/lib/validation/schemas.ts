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

export const USERNAME = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be 24 characters or fewer.")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Username must start with a letter and contain only letters, numbers and underscores."
  );

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    username: USERNAME,
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupValues = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.password, {
    message: "New password must be different from the current password.",
    path: ["password"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  username: USERNAME,
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
  packUnitId: z.string().optional().or(z.literal("")),
  packUnit: z.string().trim().optional().or(z.literal("")),
  unitsPerPack: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0.0001, "Units per pack must be greater than zero."))
    .optional(),
  minSaleQty: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Minimum sale quantity cannot be negative."))
    .optional(),
  maxSaleQty: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Maximum sale quantity cannot be negative."))
    .optional(),
  allowBaseSale: z.boolean().optional(),
  allowPackSale: z.boolean().optional(),
  allowPackPurchase: z.boolean().optional(),
  fixedPacking: z.boolean().optional(),
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
})
  .superRefine((data, ctx) => {
    const hasMajorUnit = Boolean(data.packUnit || data.packUnitId);
    const packing = data.unitsPerPack ?? 1;
    if ((data.allowPackSale || data.allowPackPurchase !== false) && hasMajorUnit && packing <= 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Packing must be greater than 1 when a major unit is set.",
        path: ["unitsPerPack"],
      });
    }
    if (data.allowPackSale && !hasMajorUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a major unit to sell in packs.",
        path: ["packUnitId"],
      });
    }
    if (data.allowPackPurchase !== false && !hasMajorUnit && packing > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a major unit for this packing.",
        path: ["packUnitId"],
      });
    }
    if (data.allowBaseSale === false && data.allowPackSale !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allow sale in at least one unit.",
        path: ["allowBaseSale"],
      });
    }
    if (
      data.maxSaleQty != null &&
      data.minSaleQty != null &&
      data.maxSaleQty > 0 &&
      data.maxSaleQty < data.minSaleQty
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum sale quantity cannot be less than minimum.",
        path: ["maxSaleQty"],
      });
    }
  });

export type ProductValues = z.infer<typeof productSchema>;

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  phone: PHONE,
  email: EMAIL.optional().or(z.literal("")),
  gstin: GSTIN,
  pan: PAN,
  customerType: z.enum(["walkin", "regular", "business"]).optional(),
  creditLimit: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Credit limit cannot be negative."))
    .optional(),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  pincode: PINCODE,
  country: z.string().trim().optional().or(z.literal("")),
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  openingBalance: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? undefined : Number(v)))
    .pipe(z.number().min(0, "Opening balance cannot be negative."))
    .optional(),
});

export type PartyValues = z.infer<typeof partySchema>;

export const salesDefaultsSchema = z.object({
  defaultPaymentMode: z.string().trim().min(1, "Default payment mode is required."),
  defaultIntraState: z.boolean(),
  defaultDiscountPercent: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? 0 : Number(v)))
    .pipe(z.number().min(0, "Discount cannot be negative.").max(100, "Discount cannot exceed 100%.")),
  allowLineDiscount: z.boolean(),
});

export type SalesDefaultsValues = z.infer<typeof salesDefaultsSchema>;

export const purchaseDefaultsSchema = z.object({
  defaultWarehouseId: z.string().trim().optional().or(z.literal("")),
  defaultPaymentTerms: z.string().trim().max(200).optional().or(z.literal("")),
  defaultIntraState: z.boolean(),
});

export type PurchaseDefaultsValues = z.infer<typeof purchaseDefaultsSchema>;

export const taxDefaultsSchema = z.object({
  gstEnabled: z.boolean(),
  defaultGstRate: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" && v === "" ? 0 : Number(v)))
    .pipe(
      z
        .number()
        .min(0, "GST rate cannot be negative.")
        .max(100, "GST rate cannot exceed 100%.")
    ),
  defaultIntraState: z.boolean(),
  defaultHsnCode: z.string().trim().max(20).optional().or(z.literal("")),
  pricesIncludeTax: z.boolean(),
});

export type TaxDefaultsValues = z.infer<typeof taxDefaultsSchema>;

export const invoiceDefaultsSchema = z.object({
  showLogo: z.boolean(),
  showGstin: z.boolean(),
  showHsn: z.boolean(),
  showBankDetails: z.boolean(),
  bankDetails: z.string().trim().max(300).optional().or(z.literal("")),
  termsAndConditions: z.string().trim().max(1000).optional().or(z.literal("")),
  footerNote: z.string().trim().max(200).optional().or(z.literal("")),
  paperSize: z.enum(["a4", "a5", "thermal"]),
});

export type InvoiceDefaultsValues = z.infer<typeof invoiceDefaultsSchema>;

export const invoiceNumberingSchema = z.object({
  invoicePrefix: INVOICE_PREFIX,
  invoiceStartNumber: INVOICE_START_NUMBER,
});

export type InvoiceNumberingValues = z.infer<typeof invoiceNumberingSchema>;

export const inviteMemberSchema = z.object({
  email: EMAIL,
  fullName: z.string().trim().min(2, "Name is required.").max(80).optional().or(z.literal("")),
  roleSlug: z
    .string()
    .trim()
    .min(1, "Role is required.")
    .refine((slug) => slug !== "owner", "Owner cannot be assigned by invite."),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
