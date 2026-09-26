export const SITE = {
  name: "BSB StockFlow",
  shortName: "StockFlow",
  tagline: "Smart Inventory. Simple Business.",
  description:
    "BSB StockFlow is a scalable inventory, POS and business management platform.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bsb-stockflow.vercel.app").replace(
    /\/$/,
    ""
  ),
} as const;

export const APP_DEFAULT_CURRENCY = "INR";
export const APP_DEFAULT_COUNTRY = "India";
export const APP_DEFAULT_LOCALE = "en-IN";

export const COMPANY_DETAILS = {
  name: "BSB Agency",
  product: SITE.name,
} as const;
