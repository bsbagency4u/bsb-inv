import type {
  DocumentControlDefaults,
  GstDocumentType,
  GstRegistrationType,
  GstReportRow,
  LineItem,
  PurchaseInvoice,
  ReportPeriod,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import { canClaimInputTaxCredit, canIssueTaxInvoice, GST_DOCUMENT_TYPE_LABELS } from "@/lib/gst";
import { countsAsPurchase, countsAsSale, isWithin, toIsoDate } from "@/lib/dashboard";
import { roundMoney } from "@/lib/party-ledger";
import { documentIsLocked, parseDocumentControlDefaults } from "@/lib/document-control";

export const GST_RECON_NOTES_KEY = "gst.recon.notes";

export type GstFilingKind = "gstr1" | "gstr3b" | "none";

export type GstReconMatchStatus = "matched" | "mismatch" | "books_only" | "portal_only";

export interface GstBooksLine {
  id: string;
  side: "sale" | "purchase";
  documentNo: string;
  documentDate: string;
  partyName: string;
  gstin: string | null;
  documentType: GstDocumentType;
  placeOfSupplyState: string | null;
  reverseCharge: boolean;
  itcEligible: boolean;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoiceValue: number;
  locked: boolean;
}

export interface GstPortalLine {
  gstin: string;
  partyName: string;
  documentNo: string;
  documentDate: string;
  invoiceValue: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  reverseCharge: boolean;
  placeOfSupplyState: string;
}

export interface GstReconMatch {
  status: GstReconMatchStatus;
  books: GstBooksLine | null;
  portal: GstPortalLine | null;
  differences: string[];
}

export interface GstReconNote {
  id: string;
  periodFrom: string;
  periodTo: string;
  documentNo: string;
  note: string;
  createdAt: string;
  createdBy: string | null;
}

export interface GstFilingCapability {
  registrationType: GstRegistrationType;
  filingKind: GstFilingKind;
  gstr1Allowed: boolean;
  gstr3bAllowed: boolean;
  itcAllowed: boolean;
  reason: string;
}

const MONEY_TOLERANCE = 0.05;

export function filingCapability(registrationType: GstRegistrationType): GstFilingCapability {
  const itcAllowed = canClaimInputTaxCredit(registrationType);
  if (registrationType === "unregistered") {
    return {
      registrationType,
      filingKind: "none",
      gstr1Allowed: false,
      gstr3bAllowed: false,
      itcAllowed: false,
      reason: "Unregistered businesses do not file GSTR-1 or GSTR-3B. Sales here are commercial invoices only.",
    };
  }
  if (registrationType === "composition") {
    return {
      registrationType,
      filingKind: "none",
      gstr1Allowed: false,
      gstr3bAllowed: false,
      itcAllowed: false,
      reason: "Composition dealers do not file GSTR-1. Use CMP-08 / GSTR-4 outside this workspace; ITC is not claimed.",
    };
  }
  if (registrationType === "isd") {
    return {
      registrationType,
      filingKind: "none",
      gstr1Allowed: false,
      gstr3bAllowed: false,
      itcAllowed: false,
      reason: "ISD units distribute credit and do not prepare GSTR-1 outward supplies from this register.",
    };
  }
  return {
    registrationType,
    filingKind: "gstr1",
    gstr1Allowed: true,
    gstr3bAllowed: true,
    itcAllowed,
    reason: canIssueTaxInvoice(registrationType)
      ? "Regular-style taxpayer: GSTR-1 outward supplies and purchase ITC can be prepared from stored snapshots."
      : "GST filing reports use stored invoice snapshots only.",
  };
}

export function snapshotTaxable(total: number, taxTotal: number): number {
  return roundMoney(Math.max(0, total - taxTotal));
}

export function splitTax(taxAmount: number, intraState: boolean): { cgst: number; sgst: number; igst: number } {
  if (intraState) {
    const half = roundMoney(taxAmount / 2);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: roundMoney(taxAmount) };
}

export function lineTaxable(item: LineItem): number {
  if (typeof item.taxableAmount === "number") return item.taxableAmount;
  return roundMoney(Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0)));
}

export function lineTax(item: LineItem): number {
  if (typeof item.taxAmount === "number") return item.taxAmount;
  return roundMoney((lineTaxable(item) * (item.gstRate ?? 0)) / 100);
}

export function salesBooksLine(
  invoice: SalesInvoice,
  partyName: string,
  partyGstin: string | null,
  lockSettings: DocumentControlDefaults,
  now?: Date
): GstBooksLine {
  const taxAmount = invoice.taxTotal;
  const taxableAmount = snapshotTaxable(invoice.total, taxAmount);
  const split = splitTax(taxAmount, invoice.intraState ?? true);
  return {
    id: invoice.id,
    side: "sale",
    documentNo: invoice.invoiceNo,
    documentDate: toIsoDate(invoice.invoiceDate),
    partyName,
    gstin: partyGstin,
    documentType: invoice.gstDocumentType ?? "tax_invoice",
    placeOfSupplyState: invoice.placeOfSupplyState ?? null,
    reverseCharge: invoice.reverseCharge ?? false,
    itcEligible: false,
    taxableAmount,
    taxAmount,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
    invoiceValue: roundMoney(invoice.total),
    locked: documentIsLocked(lockSettings, invoice.invoiceDate, invoice.status, now),
  };
}

export function purchaseBooksLine(
  invoice: PurchaseInvoice,
  partyName: string,
  partyGstin: string | null,
  lockSettings: DocumentControlDefaults,
  now?: Date
): GstBooksLine {
  const taxAmount = invoice.taxTotal;
  const taxableAmount = snapshotTaxable(invoice.total, taxAmount);
  const split = splitTax(taxAmount, invoice.intraState ?? true);
  const itcEligible = Boolean(invoice.itcEligible) && taxAmount > 0;
  return {
    id: invoice.id,
    side: "purchase",
    documentNo: invoice.billNo,
    documentDate: toIsoDate(invoice.invoiceDate),
    partyName,
    gstin: invoice.supplierGstin ?? partyGstin,
    documentType: invoice.gstDocumentType ?? "tax_invoice",
    placeOfSupplyState: invoice.placeOfSupplyState ?? null,
    reverseCharge: invoice.reverseCharge ?? false,
    itcEligible,
    taxableAmount,
    taxAmount,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
    invoiceValue: roundMoney(invoice.total),
    locked: documentIsLocked(lockSettings, invoice.invoiceDate, invoice.status, now),
  };
}

export function toGstReportRow(line: GstBooksLine): GstReportRow {
  return {
    invoiceNo: line.documentNo,
    invoiceDate: line.documentDate,
    customerName: line.partyName,
    customerGstin: line.gstin,
    documentType: line.documentType,
    placeOfSupplyState: line.placeOfSupplyState,
    reverseCharge: line.reverseCharge,
    taxableAmount: line.taxableAmount,
    taxAmount: line.taxAmount,
    cgst: line.cgst,
    sgst: line.sgst,
    igst: line.igst,
  };
}

export function salesReturnCreditNotes(
  returns: SalesReturn[],
  invoices: SalesInvoice[],
  period: ReportPeriod,
  partyNameById: Map<string, string>
): GstBooksLine[] {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  return returns
    .filter((item) => isWithin(item.returnDate, period.from, period.to))
    .map((item) => {
      const invoice = item.salesInvoiceId ? invoiceById.get(item.salesInvoiceId) : undefined;
      const intraState = invoice?.intraState ?? true;
      const taxShare =
        invoice && invoice.total > 0 ? roundMoney((item.total / invoice.total) * invoice.taxTotal) : 0;
      const split = splitTax(taxShare, intraState);
      return {
        id: item.id,
        side: "sale" as const,
        documentNo: item.returnNo,
        documentDate: toIsoDate(item.returnDate),
        partyName: item.customerId ? partyNameById.get(item.customerId) ?? "Customer" : "Walk-in",
        gstin: null,
        documentType: "credit_note" as const,
        placeOfSupplyState: invoice?.placeOfSupplyState ?? null,
        reverseCharge: invoice?.reverseCharge ?? false,
        itcEligible: false,
        taxableAmount: snapshotTaxable(item.total, taxShare),
        taxAmount: taxShare,
        cgst: split.cgst,
        sgst: split.sgst,
        igst: split.igst,
        invoiceValue: roundMoney(item.total),
        locked: false,
      };
    });
}

export function booksSalesRegister(
  invoices: SalesInvoice[],
  period: ReportPeriod,
  partyNameById: Map<string, string>,
  partyGstinById: Map<string, string | null>,
  lockSettings: DocumentControlDefaults,
  now?: Date
): GstBooksLine[] {
  return invoices
    .filter((invoice) => countsAsSale(invoice) && isWithin(invoice.invoiceDate, period.from, period.to))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.invoiceNo.localeCompare(b.invoiceNo))
    .map((invoice) =>
      salesBooksLine(
        invoice,
        invoice.customerId ? partyNameById.get(invoice.customerId) ?? "Unknown" : "Walk-in",
        invoice.customerId ? partyGstinById.get(invoice.customerId) ?? null : null,
        lockSettings,
        now
      )
    );
}

export function booksPurchaseRegister(
  invoices: PurchaseInvoice[],
  period: ReportPeriod,
  partyNameById: Map<string, string>,
  partyGstinById: Map<string, string | null>,
  lockSettings: DocumentControlDefaults,
  now?: Date
): GstBooksLine[] {
  return invoices
    .filter((invoice) => countsAsPurchase(invoice) && isWithin(invoice.invoiceDate, period.from, period.to))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.billNo.localeCompare(b.billNo))
    .map((invoice) =>
      purchaseBooksLine(
        invoice,
        invoice.supplierId ? partyNameById.get(invoice.supplierId) ?? "Unknown" : "Unknown",
        invoice.supplierId ? partyGstinById.get(invoice.supplierId) ?? null : null,
        lockSettings,
        now
      )
    );
}

export function gstTotals(lines: GstBooksLine[]) {
  return lines.reduce(
    (acc, line) => ({
      taxable: roundMoney(acc.taxable + line.taxableAmount),
      cgst: roundMoney(acc.cgst + line.cgst),
      sgst: roundMoney(acc.sgst + line.sgst),
      igst: roundMoney(acc.igst + line.igst),
      tax: roundMoney(acc.tax + line.taxAmount),
      invoiceValue: roundMoney(acc.invoiceValue + line.invoiceValue),
      itc: roundMoney(acc.itc + (line.itcEligible ? line.taxAmount : 0)),
      rcm: roundMoney(acc.rcm + (line.reverseCharge ? line.taxAmount : 0)),
      count: acc.count + 1,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, invoiceValue: 0, itc: 0, rcm: 0, count: 0 }
  );
}

function moneyDiffers(a: number, b: number): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) > MONEY_TOLERANCE;
}

function normalizeGstin(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeDocNo(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function matchKey(gstin: string | null | undefined, documentNo: string, documentDate: string): string {
  return `${normalizeGstin(gstin)}|${normalizeDocNo(documentNo)}|${toIsoDate(documentDate)}`;
}

function lineDifferences(books: GstBooksLine, portal: GstPortalLine): string[] {
  const differences: string[] = [];
  if (moneyDiffers(books.taxableAmount, portal.taxableAmount)) differences.push("taxable");
  if (moneyDiffers(books.cgst, portal.cgst)) differences.push("cgst");
  if (moneyDiffers(books.sgst, portal.sgst)) differences.push("sgst");
  if (moneyDiffers(books.igst, portal.igst)) differences.push("igst");
  if (moneyDiffers(books.invoiceValue, portal.invoiceValue)) differences.push("invoice value");
  if (Boolean(books.reverseCharge) !== Boolean(portal.reverseCharge)) differences.push("reverse charge");
  const booksPos = (books.placeOfSupplyState ?? "").trim().toLowerCase();
  const portalPos = (portal.placeOfSupplyState ?? "").trim().toLowerCase();
  if (booksPos && portalPos && booksPos !== portalPos) differences.push("place of supply");
  return differences;
}

export function reconcileGstLines(books: GstBooksLine[], portal: GstPortalLine[]): GstReconMatch[] {
  const usedPortal = new Set<number>();
  const matches: GstReconMatch[] = [];
  const portalByKey = new Map<string, number[]>();
  portal.forEach((row, index) => {
    const key = matchKey(row.gstin, row.documentNo, row.documentDate);
    const list = portalByKey.get(key) ?? [];
    list.push(index);
    portalByKey.set(key, list);
  });

  for (const book of books) {
    const key = matchKey(book.gstin, book.documentNo, book.documentDate);
    const candidates = (portalByKey.get(key) ?? []).filter((index) => !usedPortal.has(index));
    const index = candidates[0];
    if (index == null) {
      matches.push({ status: "books_only", books: book, portal: null, differences: ["missing on portal / 2B"] });
      continue;
    }
    usedPortal.add(index);
    const portalRow = portal[index];
    const differences = lineDifferences(book, portalRow);
    matches.push({
      status: differences.length === 0 ? "matched" : "mismatch",
      books: book,
      portal: portalRow,
      differences,
    });
  }

  portal.forEach((row, index) => {
    if (usedPortal.has(index)) return;
    matches.push({ status: "portal_only", books: null, portal: row, differences: ["missing in books"] });
  });

  return matches.sort((a, b) => {
    const dateA = a.books?.documentDate ?? a.portal?.documentDate ?? "";
    const dateB = b.books?.documentDate ?? b.portal?.documentDate ?? "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const noA = a.books?.documentNo ?? a.portal?.documentNo ?? "";
    const noB = b.books?.documentNo ?? b.portal?.documentNo ?? "";
    return noA.localeCompare(noB);
  });
}

export function reconSummary(matches: GstReconMatch[]) {
  return matches.reduce(
    (acc, match) => {
      acc[match.status] += 1;
      return acc;
    },
    { matched: 0, mismatch: 0, books_only: 0, portal_only: 0 }
  );
}

function csvSplit(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((header) => header.replace(/[^a-z0-9]/gi, "").toLowerCase());
  for (const alias of aliases) {
    const key = alias.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const index = normalized.indexOf(key);
    if (index >= 0) return index;
  }
  return -1;
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return row[index] ?? "";
}

function moneyCell(row: string[], index: number): number {
  const raw = cell(row, index).replace(/[,₹]/g, "").trim();
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? roundMoney(value) : 0;
}

function yesCell(row: string[], index: number): boolean {
  const raw = cell(row, index).trim().toLowerCase();
  return raw === "y" || raw === "yes" || raw === "true" || raw === "1";
}

export function parseGstPortalCsv(text: string): GstPortalLine[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = csvSplit(lines[0]);
  const gstinIdx = headerIndex(headers, ["GSTIN/UIN", "GSTIN", "Supplier GSTIN", "CTIN"]);
  const nameIdx = headerIndex(headers, ["Receiver name", "Trade/Legal name", "Party name", "Supplier name", "Name"]);
  const noIdx = headerIndex(headers, ["Invoice number", "Invoice Number", "Document number", "Inv_No", "inum"]);
  const dateIdx = headerIndex(headers, ["Invoice date", "Invoice Date", "Document date", "idt"]);
  const valueIdx = headerIndex(headers, ["Invoice value", "Invoice Value", "val"]);
  const taxableIdx = headerIndex(headers, ["Taxable value", "Taxable Value", "txval"]);
  const cgstIdx = headerIndex(headers, ["CGST", "camt"]);
  const sgstIdx = headerIndex(headers, ["SGST", "samt"]);
  const igstIdx = headerIndex(headers, ["IGST", "iamt"]);
  const rcmIdx = headerIndex(headers, ["Reverse charge", "Reverse Charge", "rchrg"]);
  const posIdx = headerIndex(headers, ["Place of supply", "Place of Supply", "pos"]);

  if (noIdx < 0 && gstinIdx < 0) {
    throw new Error("CSV needs at least GSTIN and invoice number columns.");
  }

  const rows: GstPortalLine[] = [];
  for (const line of lines.slice(1)) {
    const cols = csvSplit(line);
    const documentNo = cell(cols, noIdx);
    if (!documentNo) continue;
    const documentDate = toIsoDate(cell(cols, dateIdx));
    rows.push({
      gstin: normalizeGstin(cell(cols, gstinIdx)),
      partyName: cell(cols, nameIdx) || "Imported",
      documentNo,
      documentDate,
      invoiceValue: moneyCell(cols, valueIdx),
      taxableAmount: moneyCell(cols, taxableIdx),
      cgst: moneyCell(cols, cgstIdx),
      sgst: moneyCell(cols, sgstIdx),
      igst: moneyCell(cols, igstIdx),
      reverseCharge: yesCell(cols, rcmIdx),
      placeOfSupplyState: cell(cols, posIdx),
    });
  }
  return rows;
}

export function parseGstReconNotes(stored: unknown): GstReconNote[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const value = row as Partial<GstReconNote>;
      if (!value.id || !value.documentNo || !value.note) return null;
      return {
        id: String(value.id),
        periodFrom: String(value.periodFrom ?? ""),
        periodTo: String(value.periodTo ?? ""),
        documentNo: String(value.documentNo),
        note: String(value.note),
        createdAt: String(value.createdAt ?? ""),
        createdBy: value.createdBy == null ? null : String(value.createdBy),
      };
    })
    .filter((row): row is GstReconNote => row != null);
}

export function notesForPeriod(notes: GstReconNote[], period: ReportPeriod): GstReconNote[] {
  return notes.filter((note) => note.periodFrom === period.from && note.periodTo === period.to);
}

export function gstDocumentLabel(type: GstDocumentType): string {
  return GST_DOCUMENT_TYPE_LABELS[type] ?? type;
}

export function lockSettingsFromStored(stored: unknown): DocumentControlDefaults {
  return parseDocumentControlDefaults(stored);
}
