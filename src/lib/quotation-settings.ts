import type {
  InvoicePaperSize,
  QuotationBankDetails,
  QuotationDefaults,
  QuotationFormat,
  QuotationTemplate,
  QuotationWatermarkMode,
} from "@/types/domain";

export const QUOTATION_SETTINGS_KEY = "quotation.defaults";

export const QUOTATION_FORMATS: QuotationFormat[] = ["formal_proposal", "product_service"];

export const QUOTATION_FORMAT_META: Record<QuotationFormat, { label: string; description: string }> = {
  formal_proposal: {
    label: "Formal proposal",
    description: "Cover, scope, timeline and assumptions for project work.",
  },
  product_service: {
    label: "Product / service",
    description: "Itemised catalogue quotation with GST totals.",
  },
};

export const EMPTY_BANK_DETAILS: QuotationBankDetails = {
  accountName: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  branch: "",
  upi: "",
};

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplate = {
  id: "default-product",
  name: "Product / service",
  format: "product_service",
  isDefault: true,
  introHtml: "",
  termsAndConditions: "",
  footerNote: "",
  showCover: false,
  showScope: false,
  showTimeline: false,
  showAssumptions: false,
};

export const DEFAULT_PROPOSAL_TEMPLATE: QuotationTemplate = {
  id: "default-proposal",
  name: "Formal proposal",
  format: "formal_proposal",
  isDefault: false,
  introHtml: "",
  termsAndConditions: "",
  footerNote: "",
  showCover: true,
  showScope: true,
  showTimeline: true,
  showAssumptions: true,
};

export const DEFAULT_QUOTATION: QuotationDefaults = {
  defaultFormat: "product_service",
  validityDays: 15,
  paperSize: "a4",
  orientation: "portrait",
  showLogo: true,
  showGstin: true,
  showHsn: true,
  showSku: false,
  showDiscount: true,
  showTaxBreakup: true,
  showBankDetails: false,
  showSignature: true,
  showStamp: false,
  signatureLabel: "Authorised Signatory",
  watermarkEnabled: false,
  watermarkMode: "text",
  watermarkText: "QUOTATION",
  watermarkOpacity: 0.12,
  watermarkImageUrl: null,
  logoUrl: null,
  signatureImageUrl: null,
  stampImageUrl: null,
  bankDetails: { ...EMPTY_BANK_DETAILS },
  termsAndConditions: "",
  footerNote: "",
  whatsappEnabled: true,
  messageTemplate:
    "Hi {party}, {docTitle} {docNo} from {business} dated {date} totals {total}. Valid until {validUntil}.",
  templates: [DEFAULT_QUOTATION_TEMPLATE, DEFAULT_PROPOSAL_TEMPLATE],
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next ? next : null;
}

function parseBankDetails(value: unknown): QuotationBankDetails {
  const source = value && typeof value === "object" ? (value as Partial<QuotationBankDetails>) : {};
  return {
    accountName: asString(source.accountName, "").trim(),
    accountNumber: asString(source.accountNumber, "").trim(),
    ifsc: asString(source.ifsc, "").trim().toUpperCase(),
    bankName: asString(source.bankName, "").trim(),
    branch: asString(source.branch, "").trim(),
    upi: asString(source.upi, "").trim(),
  };
}

function parseTemplate(value: unknown, fallback: QuotationTemplate): QuotationTemplate {
  if (!value || typeof value !== "object") return { ...fallback };
  const source = value as Partial<QuotationTemplate>;
  const format: QuotationFormat = source.format === "formal_proposal" ? "formal_proposal" : "product_service";
  return {
    id: asString(source.id, fallback.id).trim() || fallback.id,
    name: asString(source.name, fallback.name).trim() || fallback.name,
    format,
    isDefault: asBoolean(source.isDefault, fallback.isDefault),
    introHtml: asString(source.introHtml, fallback.introHtml),
    termsAndConditions: asString(source.termsAndConditions, fallback.termsAndConditions),
    footerNote: asString(source.footerNote, fallback.footerNote),
    showCover: asBoolean(source.showCover, format === "formal_proposal"),
    showScope: asBoolean(source.showScope, format === "formal_proposal"),
    showTimeline: asBoolean(source.showTimeline, format === "formal_proposal"),
    showAssumptions: asBoolean(source.showAssumptions, format === "formal_proposal"),
  };
}

function parseTemplates(value: unknown): QuotationTemplate[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_QUOTATION.templates.map((template) => ({ ...template }));
  }
  const templates = value.map((item, index) =>
    parseTemplate(item, index === 0 ? DEFAULT_QUOTATION_TEMPLATE : DEFAULT_PROPOSAL_TEMPLATE)
  );
  const seen = new Set<string>();
  const unique: QuotationTemplate[] = [];
  for (const template of templates) {
    let id = template.id;
    if (!id || seen.has(id)) id = `tpl-${unique.length + 1}`;
    seen.add(id);
    unique.push({ ...template, id });
  }
  if (!unique.some((template) => template.isDefault)) {
    unique[0] = { ...unique[0], isDefault: true };
  }
  return unique.map((template) =>
    template.isDefault && unique.filter((item) => item.isDefault).length > 1 && template.id !== unique[0].id
      ? { ...template, isDefault: false }
      : template
  );
}

export function parseQuotationDefaults(stored: unknown): QuotationDefaults {
  if (!stored || typeof stored !== "object") {
    return {
      ...DEFAULT_QUOTATION,
      bankDetails: { ...EMPTY_BANK_DETAILS },
      templates: DEFAULT_QUOTATION.templates.map((template) => ({ ...template })),
    };
  }
  const value = stored as Partial<QuotationDefaults> & Record<string, unknown>;
  const paperSize: InvoicePaperSize =
    value.paperSize === "a4" || value.paperSize === "a5" || value.paperSize === "thermal" || value.paperSize === "custom"
      ? value.paperSize
      : DEFAULT_QUOTATION.paperSize;
  const orientation = value.orientation === "landscape" ? "landscape" : "portrait";
  const defaultFormat: QuotationFormat =
    value.defaultFormat === "formal_proposal" ? "formal_proposal" : "product_service";
  const watermarkMode: QuotationWatermarkMode = value.watermarkMode === "image" ? "image" : "text";
  return {
    defaultFormat,
    validityDays: Math.round(asNumber(value.validityDays, DEFAULT_QUOTATION.validityDays, 1, 365)),
    paperSize,
    orientation,
    showLogo: asBoolean(value.showLogo, DEFAULT_QUOTATION.showLogo),
    showGstin: asBoolean(value.showGstin, DEFAULT_QUOTATION.showGstin),
    showHsn: asBoolean(value.showHsn, DEFAULT_QUOTATION.showHsn),
    showSku: asBoolean(value.showSku, DEFAULT_QUOTATION.showSku),
    showDiscount: asBoolean(value.showDiscount, DEFAULT_QUOTATION.showDiscount),
    showTaxBreakup: asBoolean(value.showTaxBreakup, DEFAULT_QUOTATION.showTaxBreakup),
    showBankDetails: asBoolean(value.showBankDetails, DEFAULT_QUOTATION.showBankDetails),
    showSignature: asBoolean(value.showSignature, DEFAULT_QUOTATION.showSignature),
    showStamp: asBoolean(value.showStamp, DEFAULT_QUOTATION.showStamp),
    signatureLabel: asString(value.signatureLabel, DEFAULT_QUOTATION.signatureLabel),
    watermarkEnabled: asBoolean(value.watermarkEnabled, DEFAULT_QUOTATION.watermarkEnabled),
    watermarkMode,
    watermarkText: asString(value.watermarkText, DEFAULT_QUOTATION.watermarkText),
    watermarkOpacity: asNumber(value.watermarkOpacity, DEFAULT_QUOTATION.watermarkOpacity, 0.04, 0.35),
    watermarkImageUrl: asNullableUrl(value.watermarkImageUrl),
    logoUrl: asNullableUrl(value.logoUrl),
    signatureImageUrl: asNullableUrl(value.signatureImageUrl),
    stampImageUrl: asNullableUrl(value.stampImageUrl),
    bankDetails: parseBankDetails(value.bankDetails),
    termsAndConditions: asString(value.termsAndConditions, DEFAULT_QUOTATION.termsAndConditions),
    footerNote: asString(value.footerNote, DEFAULT_QUOTATION.footerNote),
    whatsappEnabled: asBoolean(value.whatsappEnabled, DEFAULT_QUOTATION.whatsappEnabled),
    messageTemplate: asString(value.messageTemplate, DEFAULT_QUOTATION.messageTemplate),
    templates: parseTemplates(value.templates),
  };
}

export function defaultTemplateForFormat(
  settings: QuotationDefaults,
  format: QuotationFormat
): QuotationTemplate {
  return (
    settings.templates.find((template) => template.format === format && template.isDefault) ??
    settings.templates.find((template) => template.format === format) ??
    (format === "formal_proposal" ? DEFAULT_PROPOSAL_TEMPLATE : DEFAULT_QUOTATION_TEMPLATE)
  );
}

export function addDaysIso(iso: string, days: number): string {
  const match = iso.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  const base = match?.[1] ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${base}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));
  return date.toISOString().slice(0, 10);
}

export function formatBankDetails(details: QuotationBankDetails): string {
  return [
    details.accountName ? `A/c name: ${details.accountName}` : "",
    details.bankName ? `Bank: ${details.bankName}` : "",
    details.branch ? `Branch: ${details.branch}` : "",
    details.accountNumber ? `A/c no: ${details.accountNumber}` : "",
    details.ifsc ? `IFSC: ${details.ifsc}` : "",
    details.upi ? `UPI: ${details.upi}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
