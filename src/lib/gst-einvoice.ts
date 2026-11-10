import type {
  GstDocumentType,
  GstPartyRegistrationType,
  GstRegistrationType,
} from "@/types/domain";
import { canIssueTaxInvoice } from "@/lib/gst";
import { validateGstin } from "@/lib/validation/schemas";
import { roundMoney } from "@/lib/party-ledger";

/** NIC e-invoice scheme start. Documents before this date cannot get an IRN. */
export const EINVOICE_SCHEME_START = "2020-10-01";

/** Current CBIC notified aggregate-turnover threshold (Rs 5 crore from 1 Aug 2023). */
export const EINVOICE_TURNOVER_THRESHOLD = 5_00_00_000;

export const EINVOICE_MANDATORY_FROM = "2023-08-01";

/** Rule 138: e-way bill for goods when consignment value is Rs 50,000 or more. */
export const EWB_VALUE_THRESHOLD = 50_000;

export const GST_EINVOICE_SETTINGS_KEY = "gst.einvoice";
export const GST_EWB_SETTINGS_KEY = "gst.ewaybill";

export const EINVOICE_DOCUMENT_TYPES: GstDocumentType[] = [
  "tax_invoice",
  "credit_note",
  "debit_note",
  "export_invoice",
];

export type EinvoiceStatus = "pending" | "generated" | "cancelled" | "failed";
export type EwayBillStatus = "pending" | "generated" | "cancelled" | "failed";
export type GstComplianceKind = "einvoice" | "ewaybill";
export type GstIrpDocumentKind = "sales_invoice" | "sales_return";

export interface GstEinvoiceSettings {
  optedIn: boolean;
  aggregateTurnover: number | null;
  turnoverThreshold: number;
  mandatoryFrom: string;
}

export interface GstEwayBillSettings {
  optedIn: boolean;
  valueThreshold: number;
  intraStateThreshold: number | null;
}

export interface EligibilityDecision {
  eligible: boolean;
  required: boolean;
  reasons: string[];
  blockers: string[];
}

export interface EinvoiceEligibilityInput {
  registrationType: GstRegistrationType;
  supplierGstin: string | null | undefined;
  recipientGstin: string | null | undefined;
  recipientRegistrationType?: GstPartyRegistrationType | null;
  documentType: GstDocumentType;
  documentDate: string;
  documentStatus: string;
  aggregateTurnover?: number | null;
  optedIn?: boolean;
  turnoverThreshold?: number | null;
  mandatoryFrom?: string | null;
}

export interface EwayBillEligibilityInput {
  registrationType: GstRegistrationType;
  supplierGstin: string | null | undefined;
  documentStatus: string;
  documentDate: string;
  invoiceValue: number;
  intraState: boolean;
  supplyIsGoods: boolean;
  optedIn?: boolean;
  valueThreshold?: number | null;
  intraStateThreshold?: number | null;
}

export const DEFAULT_EINVOICE_SETTINGS: GstEinvoiceSettings = {
  optedIn: false,
  aggregateTurnover: null,
  turnoverThreshold: EINVOICE_TURNOVER_THRESHOLD,
  mandatoryFrom: EINVOICE_MANDATORY_FROM,
};

export const DEFAULT_EWB_SETTINGS: GstEwayBillSettings = {
  optedIn: false,
  valueThreshold: EWB_VALUE_THRESHOLD,
  intraStateThreshold: null,
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function asDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? fallback;
}

export function parseEinvoiceSettings(stored: unknown): GstEinvoiceSettings {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_EINVOICE_SETTINGS };
  const value = stored as Partial<GstEinvoiceSettings>;
  const turnover = asNumber(value.aggregateTurnover, DEFAULT_EINVOICE_SETTINGS.aggregateTurnover);
  const threshold = asNumber(value.turnoverThreshold, DEFAULT_EINVOICE_SETTINGS.turnoverThreshold);
  return {
    optedIn: asBoolean(value.optedIn, DEFAULT_EINVOICE_SETTINGS.optedIn),
    aggregateTurnover: turnover,
    turnoverThreshold: threshold ?? EINVOICE_TURNOVER_THRESHOLD,
    mandatoryFrom: asDate(value.mandatoryFrom, DEFAULT_EINVOICE_SETTINGS.mandatoryFrom),
  };
}

export function parseEwayBillSettings(stored: unknown): GstEwayBillSettings {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_EWB_SETTINGS };
  const value = stored as Partial<GstEwayBillSettings>;
  const threshold = asNumber(value.valueThreshold, DEFAULT_EWB_SETTINGS.valueThreshold);
  return {
    optedIn: asBoolean(value.optedIn, DEFAULT_EWB_SETTINGS.optedIn),
    valueThreshold: threshold ?? EWB_VALUE_THRESHOLD,
    intraStateThreshold: asNumber(value.intraStateThreshold, DEFAULT_EWB_SETTINGS.intraStateThreshold),
  };
}

function isoDate(value: string | null | undefined): string {
  const match = (value ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function hasPresentGstin(value: string | null | undefined): boolean {
  return Boolean((value ?? "").replace(/\s+/g, ""));
}

function gstinOk(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  return Boolean(v) && validateGstin(v);
}

function postedStatus(status: string): boolean {
  return status !== "draft" && status !== "cancelled";
}

function canGenerateIrn(registrationType: GstRegistrationType): boolean {
  return canIssueTaxInvoice(registrationType) && registrationType !== "isd";
}

function isEinvoiceDocument(type: GstDocumentType): boolean {
  return EINVOICE_DOCUMENT_TYPES.includes(type);
}

function isExportDocument(input: EinvoiceEligibilityInput): boolean {
  return input.documentType === "export_invoice" || input.recipientRegistrationType === "overseas";
}

function turnoverMandatesEinvoice(input: EinvoiceEligibilityInput): boolean {
  const threshold = input.turnoverThreshold ?? EINVOICE_TURNOVER_THRESHOLD;
  const from = isoDate(input.mandatoryFrom) || EINVOICE_MANDATORY_FROM;
  const date = isoDate(input.documentDate);
  if (!date || date < from) return false;
  if (input.aggregateTurnover == null) return false;
  return input.aggregateTurnover >= threshold;
}

export function evaluateEinvoiceEligibility(input: EinvoiceEligibilityInput): EligibilityDecision {
  const reasons: string[] = [];
  const blockers: string[] = [];

  if (!canGenerateIrn(input.registrationType)) {
    blockers.push(
      input.registrationType === "composition"
        ? "Composition dealers issue bills of supply and cannot generate an IRN for a tax invoice."
        : input.registrationType === "unregistered"
          ? "Unregistered businesses cannot generate e-invoices."
          : "This GST registration type cannot generate an IRN."
    );
  }

  if (!isEinvoiceDocument(input.documentType)) {
    blockers.push("Only tax invoices, export invoices, credit notes and debit notes can receive an IRN.");
  }

  if (!postedStatus(input.documentStatus)) {
    blockers.push("Draft or cancelled documents cannot be reported to the IRP.");
  }

  const date = isoDate(input.documentDate);
  if (!date) {
    blockers.push("A document date is required.");
  } else if (date < EINVOICE_SCHEME_START) {
    blockers.push("E-invoice did not apply before 1 Oct 2020.");
  }

  if (!gstinOk(input.supplierGstin)) {
    blockers.push("A valid supplier GSTIN is required before an IRN can be requested.");
  }

  const exportDoc = isExportDocument(input);
  if (!exportDoc) {
    if (!hasPresentGstin(input.recipientGstin)) {
      blockers.push("B2C invoices without a recipient GSTIN are not reported to the IRP.");
    } else if (!gstinOk(input.recipientGstin)) {
      blockers.push("Recipient GSTIN is not valid, so the invoice cannot be reported to the IRP.");
    }
  }

  const eligible = blockers.length === 0;
  const mandated = eligible && turnoverMandatesEinvoice(input);
  const opted = eligible && input.optedIn === true;
  const required = mandated || opted;

  if (eligible) {
    reasons.push("Document type, GSTIN and registration status match current IRP rules.");
    if (mandated) {
      reasons.push("Aggregate turnover is at or above the notified e-invoice threshold for this date.");
    } else if (opted) {
      reasons.push("This business has opted in to e-invoice for eligible documents.");
    } else {
      reasons.push("E-invoice is optional until turnover crosses the notified threshold or the business opts in.");
    }
  }

  return { eligible, required, reasons, blockers };
}

export function evaluateEwayBillEligibility(input: EwayBillEligibilityInput): EligibilityDecision {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const interThreshold = input.valueThreshold ?? EWB_VALUE_THRESHOLD;
  const intraThreshold = input.intraStateThreshold ?? interThreshold;
  const threshold = input.intraState ? intraThreshold : interThreshold;
  const value = roundMoney(input.invoiceValue);

  if (input.registrationType === "unregistered") {
    blockers.push("Unregistered businesses cannot generate an e-way bill as the supplier.");
  }

  if (!gstinOk(input.supplierGstin) && input.registrationType !== "unregistered") {
    blockers.push("A valid supplier GSTIN is required to generate an e-way bill.");
  }

  if (!postedStatus(input.documentStatus)) {
    blockers.push("Draft or cancelled documents cannot be used to generate an e-way bill.");
  }

  if (!input.supplyIsGoods) {
    blockers.push("E-way bill applies to movement of goods, not services-only supplies.");
  }

  const eligible = blockers.length === 0;
  const overThreshold = eligible && value >= threshold;
  const required = overThreshold || (eligible && input.optedIn === true && input.supplyIsGoods);

  if (eligible) {
    if (overThreshold) {
      reasons.push(
        `Consignment value is Rs ${threshold.toLocaleString("en-IN")} or more, so an e-way bill is required for goods movement.`
      );
    } else if (input.optedIn) {
      reasons.push("This business has opted to generate e-way bills for goods movement below the default threshold.");
    } else {
      reasons.push(
        `E-way bill is not required while consignment value is below Rs ${threshold.toLocaleString("en-IN")}.`
      );
    }
  }

  return { eligible, required, reasons, blockers };
}

/** HSN chapter 99 is services (SAC). Goods movement is assumed when any line is not chapter 99. */
export function supplyIncludesGoods(hsnCodes: Array<string | null | undefined>): boolean {
  const codes = hsnCodes.map((code) => (code ?? "").trim()).filter(Boolean);
  if (codes.length === 0) return true;
  return codes.some((code) => !code.startsWith("99"));
}

export function einvoiceLocksDocument(status: EinvoiceStatus | null | undefined): boolean {
  return status === "generated";
}

export function ewayBillLocksTransport(status: EwayBillStatus | null | undefined): boolean {
  return status === "generated";
}

export function nicDocumentType(documentType: GstDocumentType): "INV" | "CRN" | "DBN" | null {
  if (documentType === "tax_invoice" || documentType === "export_invoice") return "INV";
  if (documentType === "credit_note") return "CRN";
  if (documentType === "debit_note") return "DBN";
  return null;
}

export function nicSupplyType(input: {
  documentType: GstDocumentType;
  recipientRegistrationType?: GstPartyRegistrationType | null;
  reverseCharge?: boolean;
}): "B2B" | "B2C" | "SEZWP" | "SEZWOP" | "EXPWP" | "EXPWOP" | "DEXP" {
  if (input.documentType === "export_invoice" || input.recipientRegistrationType === "overseas") {
    return "EXPWOP";
  }
  if (input.recipientRegistrationType === "sez") return "SEZWOP";
  return "B2B";
}

export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const v = (gstin ?? "").trim().toUpperCase();
  if (v.length < 2) return null;
  const code = v.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export function formatNicDate(iso: string): string {
  const date = isoDate(iso);
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
