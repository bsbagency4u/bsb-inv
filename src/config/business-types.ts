/**
 * Business type and product attribute configuration.
 *
 * Business behaviour must remain configuration-driven. UI components must not
 * branch on business type strings (e.g. `if (businessType === "pharmacy")`).
 * Instead they should read from this registry.
 */

export type AttributeType = "text" | "number" | "date" | "boolean" | "select";

export interface ProductAttributeDefinition {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  group: "identity" | "variation" | "compliance" | "sourcing" | "pricing" | "stock";
}

export interface BusinessTypeDefinition {
  slug: string;
  label: string;
  description: string;
  /** Default product attributes for businesses of this type. */
  productAttributes: ProductAttributeDefinition[];
  /** Suggested navigation shortcuts. */
  highlights: string[];
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    slug: "retail",
    label: "Retail",
    description: "Point-of-sale retail store.",
    highlights: ["POS", "Barcode", "GST"],
    productAttributes: [
      { key: "barcode", label: "Barcode / SKU", type: "text", group: "identity" },
      { key: "mrp", label: "MRP", type: "number", group: "pricing" },
      { key: "gst", label: "GST Rate", type: "number", group: "compliance" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
      { key: "unit", label: "Unit", type: "select", options: ["pcs", "kg", "g", "ltr", "box", "dozen", "pack"], group: "identity" },
    ],
  },
  {
    slug: "wholesale",
    label: "Wholesale",
    description: "Bulk distribution and wholesale supply.",
    highlights: ["Purchase", "Stock Transfers", "GST"],
    productAttributes: [
      { key: "barcode", label: "Barcode / SKU", type: "text", group: "identity" },
      { key: "gst", label: "GST Rate", type: "number", group: "compliance" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
      { key: "unit", label: "Unit", type: "select", options: ["pcs", "kg", "g", "ltr", "box", "dozen", "pack", "ton"], group: "identity" },
    ],
  },
  {
    slug: "pharmacy",
    label: "Pharmacy",
    description: "Pharmacy and medicine retail.",
    highlights: ["Batch", "Expiry", "MRP"],
    productAttributes: [
      { key: "batch", label: "Batch No.", type: "text", group: "sourcing" },
      { key: "expiry", label: "Expiry Date", type: "date", group: "stock" },
      { key: "mrp", label: "MRP", type: "number", group: "pricing" },
      { key: "manufacturer", label: "Manufacturer", type: "text", group: "sourcing" },
      { key: "schedule", label: "Drug Schedule", type: "select", options: ["H", "H1", "G", "OTC", "X"], group: "compliance" },
      { key: "gst", label: "GST Rate", type: "number", group: "compliance" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
    ],
  },
  {
    slug: "garments",
    label: "Garments",
    description: "Apparel, fashion and textile retail.",
    highlights: ["Size", "Color", "Variants"],
    productAttributes: [
      { key: "size", label: "Size", type: "select", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"], group: "variation" },
      { key: "color", label: "Color", type: "text", group: "variation" },
      { key: "fabric", label: "Fabric", type: "text", group: "sourcing" },
      { key: "variant", label: "Variant", type: "text", group: "variation" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
    ],
  },
  {
    slug: "hardware",
    label: "Hardware",
    description: "Hardware, tools and building materials.",
    highlights: ["Stock", "Unit", "Purchase"],
    productAttributes: [
      { key: "barcode", label: "Barcode / SKU", type: "text", group: "identity" },
      { key: "unit", label: "Unit", type: "select", options: ["pcs", "kg", "g", "ltr", "box", "pack", "m", "ft", "dozen"], group: "identity" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
    ],
  },
  {
    slug: "electronics",
    label: "Electronics",
    description: "Electronics, gadgets and appliances.",
    highlights: ["Model", "Serial", "Warranty"],
    productAttributes: [
      { key: "model", label: "Model", type: "text", group: "identity" },
      { key: "serial", label: "Serial Number", type: "text", group: "stock" },
      { key: "warranty", label: "Warranty (months)", type: "number", group: "sourcing" },
      { key: "brand", label: "Brand", type: "text", group: "identity" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
    ],
  },
  {
    slug: "restaurant",
    label: "Restaurant",
    description: "Restaurant, cafe and food service.",
    highlights: ["Recipe", "Ingredients", "Unit"],
    productAttributes: [
      { key: "recipe", label: "Recipe", type: "text", group: "sourcing" },
      { key: "ingredients", label: "Ingredients", type: "text", group: "sourcing" },
      { key: "unit", label: "Unit", type: "select", options: ["pcs", "kg", "g", "ltr", "ml", "serving", "plate", "bowl"], group: "identity" },
      { key: "fssai", label: "FSSAI Licence", type: "text", group: "compliance" },
    ],
  },
  {
    slug: "distributor",
    label: "Distributor",
    description: "Distribution and logistics driven business.",
    highlights: ["Purchase", "Stock Transfers", "Customers"],
    productAttributes: [
      { key: "barcode", label: "Barcode / SKU", type: "text", group: "identity" },
      { key: "gst", label: "GST Rate", type: "number", group: "compliance" },
      { key: "hsn", label: "HSN Code", type: "text", group: "compliance" },
      { key: "unit", label: "Unit", type: "select", options: ["pcs", "kg", "box", "pack", "case", "ton"], group: "identity" },
    ],
  },
  {
    slug: "custom",
    label: "Custom",
    description: "A business with custom requirements.",
    highlights: ["Custom attributes"],
    productAttributes: [],
  },
];

export const BUSINESS_TYPE_BY_SLUG: Record<string, BusinessTypeDefinition> =
  Object.fromEntries(BUSINESS_TYPES.map((type) => [type.slug, type]));

export function getBusinessType(slug: string | null | undefined): BusinessTypeDefinition {
  if (!slug) return BUSINESS_TYPE_BY_SLUG["retail"];
  return BUSINESS_TYPE_BY_SLUG[slug] ?? BUSINESS_TYPE_BY_SLUG["custom"];
}

export function getProductAttributesForType(
  slug: string | null | undefined
): ProductAttributeDefinition[] {
  return getBusinessType(slug).productAttributes;
}

const PRODUCT_FORM_DEDUPED_KEYS = new Set(["mrp", "gst", "hsn", "unit", "barcode"]);

export function getProductFormAttributesForType(
  slug: string | null | undefined
): ProductAttributeDefinition[] {
  return getProductAttributesForType(slug).filter(
    (attribute) => !PRODUCT_FORM_DEDUPED_KEYS.has(attribute.key)
  );
}

/** Batch/expiry UI is driven by attribute registry, not business-type string checks. */
export function businessTracksBatches(slug: string | null | undefined): boolean {
  return getProductAttributesForType(slug).some(
    (attribute) => attribute.key === "batch" || attribute.key === "expiry"
  );
}

export function businessShowsMrp(slug: string | null | undefined): boolean {
  return (
    businessTracksBatches(slug) ||
    getProductAttributesForType(slug).some((attribute) => attribute.key === "mrp")
  );
}

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)", symbol: "₹", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", symbol: "€", locale: "de-DE" },
  { code: "GBP", label: "British Pound (£)", symbol: "£", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (د.إ)", symbol: "د.إ", locale: "ar-AE" },
  { code: "SAR", label: "Saudi Riyal (ر.س)", symbol: "ر.س", locale: "ar-SA" },
  { code: "PKR", label: "Pakistani Rupee (₨)", symbol: "₨", locale: "en-PK" },
  { code: "BDT", label: "Bangladeshi Taka (৳)", symbol: "৳", locale: "bn-BD" },
  { code: "LKR", label: "Sri Lankan Rupee (Rs)", symbol: "Rs", locale: "en-LK" },
  { code: "NPR", label: "Nepalese Rupee (Rs)", symbol: "Rs", locale: "ne-NP" },
  { code: "MMK", label: "Myanmar Kyat (K)", symbol: "K", locale: "my-MM" },
  { code: "SGD", label: "Singapore Dollar ($)", symbol: "$", locale: "en-SG" },
] as const;

export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Saudi Arabia",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Myanmar",
  "Singapore",
  "Malaysia",
] as const;

export const DEFAULT_FINANCIAL_YEAR = "01-04";
export const DEFAULT_INVOICE_PREFIX = "INV";
export const DEFAULT_INVOICE_START_NUMBER = 1001;
