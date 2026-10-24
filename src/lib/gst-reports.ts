import type {
  GstDocumentType,
  LineItem,
  ReportPeriod,
  SalesInvoice,
} from "@/types/domain";
import {
  gstTotals,
  lineTax,
  lineTaxable,
  splitTax,
  type GstBooksLine,
  type GstFilingCapability,
} from "@/lib/gst-recon";
import { countsAsSale, isWithin } from "@/lib/dashboard";
import { roundMoney } from "@/lib/party-ledger";

export type GstReportId =
  | "sales-register"
  | "purchase-itc"
  | "gstr-1"
  | "gstr-3b"
  | "gstr-4"
  | "hsn-summary"
  | "rate-wise"
  | "b2b-b2c"
  | "credit-debit-notes";

export type GstReportCategory = "register" | "return" | "analysis";

export interface GstReportDefinition {
  id: GstReportId;
  title: string;
  description: string;
  category: GstReportCategory;
  requires?: "gstr1Allowed" | "gstr3bAllowed" | "gstr4Allowed";
}

export const GST_REPORT_CATEGORIES: { id: GstReportCategory; label: string }[] = [
  { id: "register", label: "Registers" },
  { id: "return", label: "Return prep" },
  { id: "analysis", label: "Analysis" },
];

export const GST_REPORT_DEFINITIONS: GstReportDefinition[] = [
  {
    id: "sales-register",
    title: "Sales GST register",
    description: "Posted sales invoices using GST snapshots stored on each document.",
    category: "register",
  },
  {
    id: "purchase-itc",
    title: "Purchase / ITC books",
    description: "Posted purchase bills with ITC eligibility from stored snapshots.",
    category: "register",
  },
  {
    id: "gstr-1",
    title: "GSTR-1 prep",
    description: "Outward supplies from sales snapshots. Export aid only — not a filed return.",
    category: "return",
    requires: "gstr1Allowed",
  },
  {
    id: "gstr-3b",
    title: "GSTR-3B prep",
    description: "Books summary of outward tax, credit notes and ITC. Net tax is an estimate, not a liability.",
    category: "return",
    requires: "gstr3bAllowed",
  },
  {
    id: "gstr-4",
    title: "GSTR-4 prep (books)",
    description: "Composition turnover from bills of supply. CMP-08 / GSTR-4 filing stays outside this workspace.",
    category: "return",
    requires: "gstr4Allowed",
  },
  {
    id: "hsn-summary",
    title: "HSN summary",
    description: "Outward supplies grouped by HSN and rate from stored line snapshots.",
    category: "analysis",
  },
  {
    id: "rate-wise",
    title: "Rate-wise tax",
    description: "Outward taxable value and tax grouped by GST rate on stored lines.",
    category: "analysis",
  },
  {
    id: "b2b-b2c",
    title: "B2B / B2C",
    description: "Outward supplies split by whether the customer GSTIN was stored on the invoice.",
    category: "analysis",
    requires: "gstr1Allowed",
  },
  {
    id: "credit-debit-notes",
    title: "Credit / debit notes",
    description: "Credit notes from sales returns; debit notes only when stored as that document type.",
    category: "analysis",
  },
];

export interface GstRateRow {
  rate: number;
  documentCount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GstHsnRow {
  hsn: string;
  rate: number;
  quantity: number;
  documentCount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Gstr3bRow {
  key: string;
  label: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
}

export interface Gstr3bResult {
  rows: Gstr3bRow[];
  netTaxEstimate: number;
}

export interface Gstr4Result {
  outwardTurnover: number;
  taxCollected: number;
  purchaseTurnover: number;
  documentCount: number;
  purchaseCount: number;
}

export interface GstB2bB2cSplit {
  b2b: GstBooksLine[];
  b2c: GstBooksLine[];
  b2bTotals: ReturnType<typeof gstTotals>;
  b2cTotals: ReturnType<typeof gstTotals>;
}

function money(value: number): number {
  return roundMoney(value);
}

function emptyTax() {
  return { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, taxAmount: 0 };
}

function addTax<T extends ReturnType<typeof emptyTax>>(target: T, line: ReturnType<typeof emptyTax>): T {
  target.taxableAmount = money(target.taxableAmount + line.taxableAmount);
  target.cgst = money(target.cgst + line.cgst);
  target.sgst = money(target.sgst + line.sgst);
  target.igst = money(target.igst + line.igst);
  target.taxAmount = money(target.taxAmount + line.taxAmount);
  return target;
}

function hasGstin(gstin: string | null | undefined): boolean {
  return Boolean((gstin ?? "").replace(/\s+/g, ""));
}

export function gstReportVisible(definition: GstReportDefinition, filing: GstFilingCapability): boolean {
  if (!definition.requires) return true;
  return Boolean(filing[definition.requires]);
}

export function defaultGstReportId(filing: GstFilingCapability): GstReportId {
  if (filing.gstr1Allowed) return "gstr-1";
  if (filing.gstr4Allowed) return "gstr-4";
  return "sales-register";
}

export function splitB2bB2c(lines: GstBooksLine[]): GstB2bB2cSplit {
  const b2b = lines.filter((line) => hasGstin(line.gstin));
  const b2c = lines.filter((line) => !hasGstin(line.gstin));
  return {
    b2b,
    b2c,
    b2bTotals: gstTotals(b2b),
    b2cTotals: gstTotals(b2c),
  };
}

export function debitNoteLines(sales: GstBooksLine[], purchases: GstBooksLine[]): GstBooksLine[] {
  return [...sales, ...purchases].filter((line) => line.documentType === "debit_note");
}

function postedSales(invoices: SalesInvoice[], period: ReportPeriod): SalesInvoice[] {
  return invoices.filter((invoice) => countsAsSale(invoice) && isWithin(invoice.invoiceDate, period.from, period.to));
}

function lineRow(item: LineItem, intraState: boolean) {
  const taxableAmount = lineTaxable(item);
  const taxAmount = lineTax(item);
  const split = splitTax(taxAmount, intraState);
  return {
    taxableAmount,
    taxAmount,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
  };
}

export function rateWiseFromInvoices(invoices: SalesInvoice[], period: ReportPeriod): GstRateRow[] {
  const groups = new Map<number, GstRateRow & { documents: Set<string> }>();
  for (const invoice of postedSales(invoices, period)) {
    const intraState = invoice.intraState ?? true;
    for (const item of invoice.items ?? []) {
      const rate = item.gstRate ?? 0;
      const current = groups.get(rate) ?? {
        rate,
        documentCount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        documents: new Set<string>(),
      };
      addTax(current, lineRow(item, intraState));
      current.documents.add(invoice.id);
      groups.set(rate, current);
    }
  }
  return [...groups.values()]
    .map(({ documents, ...row }) => ({ ...row, documentCount: documents.size }))
    .sort((a, b) => a.rate - b.rate);
}

export function hsnFromInvoices(invoices: SalesInvoice[], period: ReportPeriod): GstHsnRow[] {
  const groups = new Map<string, GstHsnRow & { documents: Set<string> }>();
  for (const invoice of postedSales(invoices, period)) {
    const intraState = invoice.intraState ?? true;
    for (const item of invoice.items ?? []) {
      const hsn = (item.hsn ?? "").trim() || "Uncoded";
      const rate = item.gstRate ?? 0;
      const key = `${hsn}|${rate}`;
      const current = groups.get(key) ?? {
        hsn,
        rate,
        quantity: 0,
        documentCount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        documents: new Set<string>(),
      };
      addTax(current, lineRow(item, intraState));
      current.quantity = money(current.quantity + item.quantity);
      current.documents.add(invoice.id);
      groups.set(key, current);
    }
  }
  return [...groups.values()]
    .map(({ documents, ...row }) => ({ ...row, documentCount: documents.size }))
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
}

function section(
  key: string,
  label: string,
  values: ReturnType<typeof emptyTax>
): Gstr3bRow {
  return { key, label, ...values };
}

export function buildGstr3b(args: {
  sales: GstBooksLine[];
  creditNotes: GstBooksLine[];
  purchaseTotals: ReturnType<typeof gstTotals>;
  itcAllowed: boolean;
}): Gstr3bResult {
  const intra = emptyTax();
  const inter = emptyTax();
  const zeroRated = emptyTax();
  const nilExempt = emptyTax();
  for (const line of args.sales) {
    const values = {
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      taxAmount: line.taxAmount,
    };
    if (line.documentType === "export_invoice") addTax(zeroRated, values);
    else if (line.taxAmount > 0) addTax(line.igst > 0 ? inter : intra, values);
    else addTax(nilExempt, values);
  }
  const credit = gstTotals(args.creditNotes);
  const creditValues = {
    taxableAmount: credit.taxable,
    cgst: credit.cgst,
    sgst: credit.sgst,
    igst: credit.igst,
    taxAmount: credit.tax,
  };
  const itcTax = args.itcAllowed ? args.purchaseTotals.itc : 0;
  const itcShare =
    args.itcAllowed && args.purchaseTotals.tax > 0
      ? args.purchaseTotals.itc / args.purchaseTotals.tax
      : 0;
  const itc = {
    taxableAmount: 0,
    cgst: money(args.purchaseTotals.cgst * itcShare),
    sgst: money(args.purchaseTotals.sgst * itcShare),
    igst: money(args.purchaseTotals.igst * itcShare),
    taxAmount: money(itcTax),
  };
  const rcm = {
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    taxAmount: money(args.purchaseTotals.rcm),
  };
  const outwardTax = money(intra.taxAmount + inter.taxAmount + zeroRated.taxAmount);
  const netTaxEstimate = money(outwardTax - credit.tax - itc.taxAmount + rcm.taxAmount);
  return {
    rows: [
      section("intra", "Outward taxable (intra-state)", intra),
      section("inter", "Outward taxable (inter-state)", inter),
      section("zero", "Zero-rated / export", zeroRated),
      section("nil", "Nil-rated / exempt / non-GST", nilExempt),
      section("credit", "Less: credit notes (sales returns)", creditValues),
      section("itc", args.itcAllowed ? "Less: ITC in books" : "ITC (not claimed)", itc),
      section("rcm", "Add: reverse charge in books", rcm),
    ],
    netTaxEstimate,
  };
}

export function buildGstr4(args: { sales: GstBooksLine[]; purchases: GstBooksLine[] }): Gstr4Result {
  const salesTotals = gstTotals(args.sales);
  const purchaseTotals = gstTotals(args.purchases);
  return {
    outwardTurnover: salesTotals.invoiceValue,
    taxCollected: salesTotals.tax,
    purchaseTurnover: purchaseTotals.invoiceValue,
    documentCount: salesTotals.count,
    purchaseCount: purchaseTotals.count,
  };
}

export function rateWiseTotals(rows: GstRateRow[]) {
  return rows.reduce(
    (acc, row) => ({
      taxableAmount: money(acc.taxableAmount + row.taxableAmount),
      taxAmount: money(acc.taxAmount + row.taxAmount),
      cgst: money(acc.cgst + row.cgst),
      sgst: money(acc.sgst + row.sgst),
      igst: money(acc.igst + row.igst),
      documentCount: acc.documentCount + row.documentCount,
    }),
    { taxableAmount: 0, taxAmount: 0, cgst: 0, sgst: 0, igst: 0, documentCount: 0 }
  );
}

export function hsnTotals(rows: GstHsnRow[]) {
  return rows.reduce(
    (acc, row) => ({
      quantity: money(acc.quantity + row.quantity),
      taxableAmount: money(acc.taxableAmount + row.taxableAmount),
      taxAmount: money(acc.taxAmount + row.taxAmount),
    }),
    { quantity: 0, taxableAmount: 0, taxAmount: 0 }
  );
}

export function gstDocumentTypes(lines: GstBooksLine[]): Partial<Record<GstDocumentType, number>> {
  return lines.reduce<Partial<Record<GstDocumentType, number>>>((acc, line) => {
    acc[line.documentType] = (acc[line.documentType] ?? 0) + 1;
    return acc;
  }, {});
}
