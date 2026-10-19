/**
 * Central, configuration-driven GST model.
 *
 * This module is pure and side-effect free: it turns the registration status
 * of the business, the counterparty and the supply classification of each line
 * into a document decision (tax invoice vs bill of supply vs commercial
 * invoice), whether tax is chargeable, and the intra/inter-state split.
 *
 * It deliberately does NOT compute tax amounts — that stays in `GstEngine`.
 * Keeping classification here means every screen (POS, invoice, purchase,
 * returns) derives the same legal document type from one place.
 */

import type {
  GstDocumentType,
  GstPartyRegistrationType,
  GstRegistrationType,
  GstSupplyType,
} from "@/types/domain";

export const GST_REGISTRATION_TYPES: GstRegistrationType[] = [
  "regular",
  "composition",
  "unregistered",
  "sez",
  "casual",
  "isd",
];

export const GST_REGISTRATION_TYPE_LABELS: Record<GstRegistrationType, string> = {
  regular: "Regular taxpayer",
  composition: "Composition dealer",
  unregistered: "Unregistered",
  sez: "SEZ unit / developer",
  casual: "Casual taxable person",
  isd: "Input service distributor",
};

export const GST_REGISTRATION_TYPE_DESCRIPTIONS: Record<GstRegistrationType, string> = {
  regular: "Charges GST on all taxable supplies and issues tax invoices.",
  composition: "Pays a flat rate on turnover and issues bills of supply (no tax collected).",
  unregistered: "Not registered for GST; issues commercial invoices without tax.",
  sez: "Supplies to SEZ units are zero-rated with specific invoicing requirements.",
  casual: "Registered for a limited period; issues tax invoices while active.",
  isd: "Distributes input tax credit to other units via ISD invoices.",
};

export const GST_PARTY_REGISTRATION_TYPES: GstPartyRegistrationType[] = [
  "registered",
  "composition",
  "unregistered",
  "sez",
  "consumer",
  "overseas",
];

export const GST_PARTY_REGISTRATION_TYPE_LABELS: Record<GstPartyRegistrationType, string> = {
  registered: "Registered (B2B)",
  composition: "Composition dealer",
  unregistered: "Unregistered (B2C)",
  sez: "SEZ unit / developer",
  consumer: "Consumer (B2C)",
  overseas: "Overseas / export",
};

export const GST_SUPPLY_TYPES: GstSupplyType[] = [
  "taxable",
  "nil_rated",
  "exempt",
  "zero_rated",
  "out_of_scope",
];

export const GST_SUPPLY_TYPE_LABELS: Record<GstSupplyType, string> = {
  taxable: "Taxable",
  nil_rated: "Nil-rated",
  exempt: "Exempt",
  zero_rated: "Zero-rated",
  out_of_scope: "Out of scope (non-GST)",
};

export const GST_DOCUMENT_TYPE_LABELS: Record<GstDocumentType, string> = {
  tax_invoice: "Tax Invoice",
  bill_of_supply: "Bill of Supply",
  commercial_invoice: "Commercial Invoice",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  self_invoice: "Self Invoice",
  export_invoice: "Export Invoice",
};

export function normalizeGstRegistrationType(value: unknown): GstRegistrationType {
  return GST_REGISTRATION_TYPES.includes(value as GstRegistrationType)
    ? (value as GstRegistrationType)
    : "unregistered";
}

export function normalizeGstPartyRegistrationType(value: unknown): GstPartyRegistrationType {
  return GST_PARTY_REGISTRATION_TYPES.includes(value as GstPartyRegistrationType)
    ? (value as GstPartyRegistrationType)
    : "unregistered";
}

export function normalizeGstSupplyType(value: unknown): GstSupplyType {
  return GST_SUPPLY_TYPES.includes(value as GstSupplyType)
    ? (value as GstSupplyType)
    : "taxable";
}

export function normalizeGstDocumentType(value: unknown): GstDocumentType {
  const types = Object.keys(GST_DOCUMENT_TYPE_LABELS) as GstDocumentType[];
  return types.includes(value as GstDocumentType) ? (value as GstDocumentType) : "tax_invoice";
}

/** Zero-rated and taxable supplies require a tax invoice; nil/exempt/out-of-scope do not. */
export function isTaxableSupplyType(type: GstSupplyType): boolean {
  return type === "taxable" || type === "zero_rated";
}

/** Registration statuses legally permitted to issue a tax invoice. */
export function canIssueTaxInvoice(registrationType: GstRegistrationType): boolean {
  return registrationType !== "unregistered" && registrationType !== "composition";
}

function normalizeState(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Resolves whether a supply is intra-state (CGST + SGST) or inter-state (IGST).
 * Falls back to the supplied default when either state is unknown.
 */
export function resolveIntraState(
  businessState: string | null | undefined,
  placeOfSupplyState: string | null | undefined,
  fallback = true
): boolean {
  const from = normalizeState(businessState);
  const to = normalizeState(placeOfSupplyState);
  if (!from || !to) return fallback;
  return from === to;
}

export interface GstLineClassification {
  supplyType: GstSupplyType;
  rate: number;
}

export interface GstDocumentContext {
  side: "sale" | "purchase";
  /** Authoritative registration status of the business issuing/recording the document. */
  registrationType: GstRegistrationType;
  businessState?: string | null;
  /** Counterparty state; used as place of supply when no explicit value is set. */
  partyState?: string | null;
  partyPlaceOfSupplyState?: string | null;
  partyRegistrationType?: GstPartyRegistrationType | null;
  lines: GstLineClassification[];
  isExport?: boolean;
  defaultIntraState?: boolean;
}

export interface GstDocumentDecision {
  documentType: GstDocumentType;
  /** True when tax should be charged and a tax breakup printed. */
  chargeTax: boolean;
  intraState: boolean;
  placeOfSupplyState: string | null;
  taxInvoiceAllowed: boolean;
  /** Human-readable rationale, safe to surface in the UI. */
  reason: string;
}

/**
 * Classifies a sale/purchase into a GST document type and tax treatment.
 *
 * Precedence (sale side):
 *  1. Unregistered business → commercial invoice, no tax.
 *  2. Composition dealer → bill of supply, no tax.
 *  3. All lines non-taxable (nil/exempt/out of scope) → bill of supply, no tax.
 *  4. Export / overseas party → export invoice (zero-rated unless a line is taxable).
 *  5. Otherwise → tax invoice.
 */
export function classifyGstDocument(context: GstDocumentContext): GstDocumentDecision {
  const {
    side,
    registrationType,
    businessState,
    partyState,
    partyPlaceOfSupplyState,
    partyRegistrationType,
    lines,
    isExport = false,
    defaultIntraState = true,
  } = context;

  const placeOfSupplyState =
    (partyPlaceOfSupplyState ?? partyState ?? "").trim() ||
    (isExport ? "Export" : null);
  const intraState = resolveIntraState(businessState, placeOfSupplyState, defaultIntraState);

  const hasLines = lines.length > 0;
  const hasTaxableLine = lines.some(
    (line) => isTaxableSupplyType(line.supplyType) && line.rate > 0
  );
  const allNonTaxable =
    hasLines && lines.every((line) => !isTaxableSupplyType(line.supplyType));

  if (side === "purchase") {
    const supplierRegistered =
      partyRegistrationType == null
        ? true
        : partyRegistrationType === "registered" ||
          partyRegistrationType === "composition" ||
          partyRegistrationType === "sez";
    if (!supplierRegistered) {
      return {
        documentType: "bill_of_supply",
        chargeTax: false,
        intraState,
        placeOfSupplyState,
        taxInvoiceAllowed: false,
        reason: "Supplier is not registered, so no tax invoice is expected.",
      };
    }
    return {
      documentType: "tax_invoice",
      chargeTax: hasTaxableLine,
      intraState,
      placeOfSupplyState,
      taxInvoiceAllowed: true,
      reason:
        registrationType === "unregistered"
          ? "Self-invoice required for an unregistered supplier under reverse charge."
          : "Registered supplier bill with tax as per the supplier invoice.",
    };
  }

  if (registrationType === "unregistered") {
    return {
      documentType: "commercial_invoice",
      chargeTax: false,
      intraState,
      placeOfSupplyState,
      taxInvoiceAllowed: false,
      reason: "The business is not registered for GST, so no tax is charged.",
    };
  }

  if (registrationType === "composition") {
    return {
      documentType: "bill_of_supply",
      chargeTax: false,
      intraState,
      placeOfSupplyState,
      taxInvoiceAllowed: false,
      reason: "Composition dealers cannot collect tax and issue a bill of supply.",
    };
  }

  if (allNonTaxable) {
    return {
      documentType: "bill_of_supply",
      chargeTax: false,
      intraState,
      placeOfSupplyState,
      taxInvoiceAllowed: false,
      reason: "The supply is exempt / nil-rated, so a bill of supply is issued.",
    };
  }

  if (isExport || partyRegistrationType === "overseas") {
    return {
      documentType: "export_invoice",
      chargeTax: false,
      intraState: false,
      placeOfSupplyState: placeOfSupplyState ?? "Export",
      taxInvoiceAllowed: true,
      reason: "Export supply — zero-rated, no domestic GST is charged.",
    };
  }

  return {
    documentType: "tax_invoice",
    chargeTax: hasTaxableLine,
    intraState,
    placeOfSupplyState,
    taxInvoiceAllowed: true,
    reason: "Registered business issuing a tax invoice for a taxable supply.",
  };
}

/** Returns the human-readable heading for a document type. */
export function gstDocumentHeading(type: GstDocumentType): string {
  return GST_DOCUMENT_TYPE_LABELS[type] ?? "Document";
}
