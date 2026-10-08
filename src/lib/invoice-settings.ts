import type {
  InvoiceDefaults,
  InvoiceDocumentTypeSetting,
  PrintDocumentType,
} from "@/types/domain";

export const PRINT_DOCUMENT_TYPES: PrintDocumentType[] = [
  "sales_invoice",
  "sales_return",
  "purchase_invoice",
  "purchase_return",
  "payment_receipt",
  "quotation",
  "delivery_challan",
];

export const PRINT_DOCUMENT_TYPE_META: Record<
  PrintDocumentType,
  { label: string; available: boolean; description: string }
> = {
  sales_invoice: {
    label: "Sales invoice",
    available: true,
    description: "POS and sales invoices.",
  },
  sales_return: {
    label: "Sales return",
    available: true,
    description: "Credit notes against sales invoices.",
  },
  purchase_invoice: {
    label: "Purchase bill",
    available: true,
    description: "Supplier bills after they are saved.",
  },
  purchase_return: {
    label: "Purchase return",
    available: true,
    description: "Returns sent back to suppliers.",
  },
  payment_receipt: {
    label: "Payment receipt",
    available: true,
    description: "Customer and supplier payment receipts.",
  },
  quotation: {
    label: "Quotation",
    available: false,
    description: "Layout is stored here. Quotations are not issued in this workspace yet.",
  },
  delivery_challan: {
    label: "Delivery challan",
    available: false,
    description: "Layout is stored here. Delivery challans are not issued in this workspace yet.",
  },
};

export const DEFAULT_DOCUMENT_TYPES: Record<PrintDocumentType, InvoiceDocumentTypeSetting> = {
  sales_invoice: { enabled: true },
  sales_return: { enabled: true },
  purchase_invoice: { enabled: true },
  purchase_return: { enabled: true },
  payment_receipt: { enabled: true },
  quotation: { enabled: false },
  delivery_challan: { enabled: false },
};

export const DEFAULT_INVOICE: InvoiceDefaults = {
  showLogo: true,
  showGstin: true,
  showHsn: false,
  showBankDetails: false,
  bankDetails: "",
  termsAndConditions: "",
  footerNote: "",
  paperSize: "a4",
  orientation: "portrait",
  customWidthMm: 210,
  customHeightMm: 297,
  showSku: false,
  showBatch: true,
  showMrp: false,
  showDiscount: true,
  showTaxBreakup: true,
  showPaidBalance: true,
  showNotes: true,
  showSignature: false,
  signatureLabel: "Authorised Signatory",
  autoPrintOnSave: true,
  copies: 1,
  defaultOutput: "print",
  whatsappEnabled: true,
  messageTemplate:
    "Hi {party}, {docTitle} {docNo} from {business} dated {date} totals {total}.",
  documentTypes: {
    sales_invoice: { enabled: true },
    sales_return: { enabled: true },
    purchase_invoice: { enabled: true },
    purchase_return: { enabled: true },
    payment_receipt: { enabled: true },
    quotation: { enabled: false },
    delivery_challan: { enabled: false },
  },
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

function mergeDocumentTypes(value: unknown): Record<PrintDocumentType, InvoiceDocumentTypeSetting> {
  const source =
    value && typeof value === "object" ? (value as Record<string, { enabled?: boolean }>) : {};
  const next = {} as Record<PrintDocumentType, InvoiceDocumentTypeSetting>;
  for (const kind of PRINT_DOCUMENT_TYPES) {
    next[kind] = {
      enabled: asBoolean(source[kind]?.enabled, DEFAULT_INVOICE.documentTypes[kind].enabled),
    };
  }
  return next;
}

export function parseInvoiceDefaults(stored: unknown): InvoiceDefaults {
  if (!stored || typeof stored !== "object") {
    return parseInvoiceDefaults(DEFAULT_INVOICE);
  }
  const value = stored as Partial<InvoiceDefaults> & Record<string, unknown>;
  const paperSize =
    value.paperSize === "a4" ||
    value.paperSize === "a5" ||
    value.paperSize === "thermal" ||
    value.paperSize === "custom"
      ? value.paperSize
      : DEFAULT_INVOICE.paperSize;
  const orientation = value.orientation === "landscape" ? "landscape" : "portrait";
  const defaultOutput = value.defaultOutput === "pdf" ? "pdf" : "print";
  return {
    showLogo: asBoolean(value.showLogo, DEFAULT_INVOICE.showLogo),
    showGstin: asBoolean(value.showGstin, DEFAULT_INVOICE.showGstin),
    showHsn: asBoolean(value.showHsn, DEFAULT_INVOICE.showHsn),
    showBankDetails: asBoolean(value.showBankDetails, DEFAULT_INVOICE.showBankDetails),
    bankDetails: asString(value.bankDetails, DEFAULT_INVOICE.bankDetails),
    termsAndConditions: asString(value.termsAndConditions, DEFAULT_INVOICE.termsAndConditions),
    footerNote: asString(value.footerNote, DEFAULT_INVOICE.footerNote),
    paperSize,
    orientation,
    customWidthMm: asNumber(value.customWidthMm, DEFAULT_INVOICE.customWidthMm, 40, 400),
    customHeightMm: asNumber(value.customHeightMm, DEFAULT_INVOICE.customHeightMm, 40, 600),
    showSku: asBoolean(value.showSku, DEFAULT_INVOICE.showSku),
    showBatch: asBoolean(value.showBatch, DEFAULT_INVOICE.showBatch),
    showMrp: asBoolean(value.showMrp, DEFAULT_INVOICE.showMrp),
    showDiscount: asBoolean(value.showDiscount, DEFAULT_INVOICE.showDiscount),
    showTaxBreakup: asBoolean(value.showTaxBreakup, DEFAULT_INVOICE.showTaxBreakup),
    showPaidBalance: asBoolean(value.showPaidBalance, DEFAULT_INVOICE.showPaidBalance),
    showNotes: asBoolean(value.showNotes, DEFAULT_INVOICE.showNotes),
    showSignature: asBoolean(value.showSignature, DEFAULT_INVOICE.showSignature),
    signatureLabel: asString(value.signatureLabel, DEFAULT_INVOICE.signatureLabel),
    autoPrintOnSave: asBoolean(value.autoPrintOnSave, DEFAULT_INVOICE.autoPrintOnSave),
    copies: Math.round(asNumber(value.copies, DEFAULT_INVOICE.copies, 1, 9)),
    defaultOutput,
    whatsappEnabled: asBoolean(value.whatsappEnabled, DEFAULT_INVOICE.whatsappEnabled),
    messageTemplate: asString(value.messageTemplate, DEFAULT_INVOICE.messageTemplate),
    documentTypes: mergeDocumentTypes(value.documentTypes),
  };
}

export function isPrintDocumentEnabled(
  defaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  kind: PrintDocumentType
): boolean {
  const settings = parseInvoiceDefaults(defaults ?? DEFAULT_INVOICE);
  return settings.documentTypes[kind]?.enabled !== false;
}

export function documentHeading(kind: PrintDocumentType): string {
  return PRINT_DOCUMENT_TYPE_META[kind]?.label ?? "Document";
}

export function formatShareMessage(
  template: string,
  params: {
    party: string;
    docNo: string;
    docTitle: string;
    business: string;
    date: string;
    total: string;
  }
): string {
  const source = template.trim() || DEFAULT_INVOICE.messageTemplate;
  return source
    .replaceAll("{party}", params.party)
    .replaceAll("{docNo}", params.docNo)
    .replaceAll("{docTitle}", params.docTitle)
    .replaceAll("{business}", params.business)
    .replaceAll("{date}", params.date)
    .replaceAll("{total}", params.total);
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.replace(/^0+/, "");
}

export function buildWhatsAppUrl(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  const digits = normalizeWhatsAppPhone(phone);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
