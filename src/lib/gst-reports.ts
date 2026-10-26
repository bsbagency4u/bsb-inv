import type {
  GstDocumentType,
  GstSupplyType,
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
  | "cmp-08"
  | "hsn-summary"
  | "rate-wise"
  | "b2b-b2c"
  | "credit-debit-notes"
  | "rcm"
  | "nil-exempt"
  | "place-of-supply"
  | "document-series"
  | "tax-estimate";

export type Gstr1TableId = "b2b" | "b2cl" | "b2cs" | "exp" | "cdnr" | "cdnur" | "hsn" | "docs";

/** Inter-state B2C invoices above this invoice value are reported in GSTR-1 B2CL. */
export const B2CL_INVOICE_THRESHOLD = 100_000;

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
    description: "Outward supplies in GSTR-1 table order from stored snapshots. Export aid only — not a filed return.",
    category: "return",
    requires: "gstr1Allowed",
  },
  {
    id: "gstr-3b",
    title: "GSTR-3B prep",
    description: "Books summary mapped to GSTR-3B sections. Net tax is an estimate, not portal liability.",
    category: "return",
    requires: "gstr3bAllowed",
  },
  {
    id: "cmp-08",
    title: "CMP-08 prep (books)",
    description: "Composition quarterly turnover from stored bills of supply. Levy rate is not stored, so tax due is not calculated.",
    category: "return",
    requires: "gstr4Allowed",
  },
  {
    id: "gstr-4",
    title: "GSTR-4 prep (books)",
    description: "Composition annual books turnover from stored documents. Filing stays outside this workspace.",
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
  {
    id: "rcm",
    title: "Reverse charge",
    description: "Purchase snapshots flagged reverse charge. Tax shown is stored on the bill, not a computed liability.",
    category: "analysis",
  },
  {
    id: "nil-exempt",
    title: "Nil / exempt / non-GST",
    description: "Outward lines stored as nil-rated, exempt or out of scope, plus zero-tax bills of supply.",
    category: "analysis",
  },
  {
    id: "place-of-supply",
    title: "Place of supply",
    description: "Outward supplies grouped by the place-of-supply state stored on each document.",
    category: "analysis",
  },
  {
    id: "document-series",
    title: "Document series",
    description: "Issued document numbers in the period, including cancelled. Drafts are excluded.",
    category: "analysis",
  },
  {
    id: "tax-estimate",
    title: "Tax estimate",
    description: "Books net tax estimate from outward tax, credit notes, ITC and RCM. Not GST payable.",
    category: "analysis",
    requires: "gstr3bAllowed",
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

export interface Gstr1TableSummary {
  id: Gstr1TableId;
  label: string;
  count: number;
  taxableAmount: number;
  taxAmount: number;
  invoiceValue: number;
}

export interface Gstr1PrepResult {
  tables: Gstr1TableSummary[];
  b2b: GstBooksLine[];
  b2cl: GstBooksLine[];
  b2cs: GstBooksLine[];
  exp: GstBooksLine[];
  cdnr: GstBooksLine[];
  cdnur: GstBooksLine[];
  hsn: GstHsnRow[];
  docs: GstDocumentSeriesRow[];
  issues: GstDataIssue[];
}

export interface Gstr3bMismatch {
  key: string;
  label: string;
  gstr1Value: number;
  gstr3bValue: number;
}

export interface Gstr3bPrepResult extends Gstr3bResult {
  mismatches: Gstr3bMismatch[];
}

export interface Cmp08Result {
  outwardTurnover: number;
  taxCollected: number;
  purchaseTurnover: number;
  rcmTax: number;
  documentCount: number;
  purchaseCount: number;
}

export interface GstPosRow {
  placeOfSupplyState: string;
  documentCount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoiceValue: number;
}

export interface GstDocumentSeriesRow {
  nature: string;
  prefix: string;
  fromNo: string;
  toNo: string;
  total: number;
  cancelled: number;
  netIssued: number;
}

export interface GstDataIssue {
  key: string;
  label: string;
  count: number;
}

export interface GstNilExemptRow {
  supplyType: string;
  documentCount: number;
  taxableAmount: number;
  invoiceValue: number;
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

function isInterState(line: GstBooksLine): boolean {
  return line.intraState === false || line.igst > 0;
}

function isExportDocument(line: GstBooksLine): boolean {
  return line.documentType === "export_invoice";
}

function isCreditNote(line: GstBooksLine): boolean {
  return line.documentType === "credit_note";
}

function isDebitNote(line: GstBooksLine): boolean {
  return line.documentType === "debit_note";
}

function isNoteDocument(line: GstBooksLine): boolean {
  return isCreditNote(line) || isDebitNote(line);
}

function isOutwardInvoice(line: GstBooksLine): boolean {
  return line.side === "sale" && !isNoteDocument(line);
}

export function classifyGstr1Invoice(line: GstBooksLine): Exclude<Gstr1TableId, "hsn" | "docs" | "cdnr" | "cdnur"> | null {
  if (!isOutwardInvoice(line)) return null;
  if (isExportDocument(line)) return "exp";
  if (hasGstin(line.gstin)) return "b2b";
  if (isInterState(line) && line.invoiceValue > B2CL_INVOICE_THRESHOLD) return "b2cl";
  return "b2cs";
}

export function classifyGstr1Note(line: GstBooksLine): "cdnr" | "cdnur" | null {
  if (line.side !== "sale" || !isNoteDocument(line)) return null;
  return hasGstin(line.gstin) ? "cdnr" : "cdnur";
}

function tableSummary(id: Gstr1TableId, label: string, lines: GstBooksLine[]): Gstr1TableSummary {
  const totals = gstTotals(lines);
  return {
    id,
    label,
    count: totals.count,
    taxableAmount: totals.taxable,
    taxAmount: totals.tax,
    invoiceValue: totals.invoiceValue,
  };
}

export function gstReportVisible(definition: GstReportDefinition, filing: GstFilingCapability): boolean {
  if (!definition.requires) return true;
  return Boolean(filing[definition.requires]);
}

export function defaultGstReportId(filing: GstFilingCapability): GstReportId {
  if (filing.gstr1Allowed) return "gstr-1";
  if (filing.gstr4Allowed) return "cmp-08";
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
  const taxableOutward = emptyTax();
  const interUnregistered = emptyTax();
  const zeroRated = emptyTax();
  const nilExempt = emptyTax();
  for (const line of args.sales.filter(isOutwardInvoice)) {
    const values = {
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      taxAmount: line.taxAmount,
    };
    if (isExportDocument(line)) addTax(zeroRated, values);
    else if (line.taxAmount > 0) {
      addTax(taxableOutward, values);
      if (isInterState(line) && !hasGstin(line.gstin)) addTax(interUnregistered, values);
    } else addTax(nilExempt, values);
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
  const outwardTax = money(taxableOutward.taxAmount + zeroRated.taxAmount);
  const netTaxEstimate = money(outwardTax - credit.tax - itc.taxAmount + rcm.taxAmount);
  return {
    rows: [
      section("3_1_a", "3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)", taxableOutward),
      section("3_1_b", "3.1(b) Outward taxable supplies (zero rated)", zeroRated),
      section("3_1_c", "3.1(c) Other outward supplies (nil rated, exempted)", nilExempt),
      section("3_1_d", "3.1(d) Inward supplies liable to reverse charge", rcm),
      section("3_2", "3.2 Inter-state taxable supplies to unregistered persons (from stored GSTIN)", interUnregistered),
      section("credit", "Books adjustment: credit notes (sales returns)", creditValues),
      section("4_a", args.itcAllowed ? "4 Eligible ITC in books" : "4 ITC (not claimed for this registration)", itc),
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

export function buildCmp08(args: { sales: GstBooksLine[]; purchases: GstBooksLine[] }): Cmp08Result {
  const gstr4 = buildGstr4(args);
  return {
    ...gstr4,
    rcmTax: gstTotals(args.purchases).rcm,
  };
}

export function buildGstr1Prep(args: {
  sales: GstBooksLine[];
  creditNotes: GstBooksLine[];
  debitNotes: GstBooksLine[];
  hsn: GstHsnRow[];
  docs: GstDocumentSeriesRow[];
}): Gstr1PrepResult {
  const invoices = args.sales.filter(isOutwardInvoice);
  const notes = [...args.creditNotes, ...args.debitNotes.filter((line) => line.side === "sale")];
  const b2b: GstBooksLine[] = [];
  const b2cl: GstBooksLine[] = [];
  const b2cs: GstBooksLine[] = [];
  const exp: GstBooksLine[] = [];
  for (const line of invoices) {
    const table = classifyGstr1Invoice(line);
    if (table === "b2b") b2b.push(line);
    else if (table === "b2cl") b2cl.push(line);
    else if (table === "exp") exp.push(line);
    else if (table === "b2cs") b2cs.push(line);
  }
  const cdnr = notes.filter((line) => classifyGstr1Note(line) === "cdnr");
  const cdnur = notes.filter((line) => classifyGstr1Note(line) === "cdnur");
  const hsnTotalsRow = hsnTotals(args.hsn);
  const docCount = args.docs.reduce((sum, row) => sum + row.total, 0);
  return {
    tables: [
      tableSummary("b2b", "4 — B2B invoices", b2b),
      tableSummary("b2cl", "5 — B2CL (inter-state unregistered, invoice value above 1 lakh)", b2cl),
      tableSummary("b2cs", "7 — B2CS (other unregistered)", b2cs),
      tableSummary("exp", "6A — Exports / zero-rated invoices", exp),
      tableSummary("cdnr", "9B — Credit / debit notes (registered)", cdnr),
      tableSummary("cdnur", "9B — Credit / debit notes (unregistered)", cdnur),
      {
        id: "hsn",
        label: "12 — HSN summary",
        count: args.hsn.length,
        taxableAmount: hsnTotalsRow.taxableAmount,
        taxAmount: hsnTotalsRow.taxAmount,
        invoiceValue: money(hsnTotalsRow.taxableAmount + hsnTotalsRow.taxAmount),
      },
      {
        id: "docs",
        label: "13 — Documents issued",
        count: docCount,
        taxableAmount: 0,
        taxAmount: 0,
        invoiceValue: 0,
      },
    ],
    b2b,
    b2cl,
    b2cs,
    exp,
    cdnr,
    cdnur,
    hsn: args.hsn,
    docs: args.docs,
    issues: gstr1Issues({ b2b, b2cl, b2cs, exp, cdnr, cdnur, hsn: args.hsn, docs: args.docs }),
  };
}

function gstr1Issues(args: {
  b2b: GstBooksLine[];
  b2cl: GstBooksLine[];
  b2cs: GstBooksLine[];
  exp: GstBooksLine[];
  cdnr: GstBooksLine[];
  cdnur: GstBooksLine[];
  hsn: GstHsnRow[];
  docs: GstDocumentSeriesRow[];
}): GstDataIssue[] {
  const issues: GstDataIssue[] = [];
  const missingPos = [...args.b2b, ...args.b2cl, ...args.b2cs, ...args.exp].filter(
    (line) => !(line.placeOfSupplyState ?? "").trim()
  ).length;
  if (missingPos > 0) issues.push({ key: "pos", label: "Invoices missing place of supply", count: missingPos });
  const uncoded = args.hsn.filter((row) => row.hsn === "Uncoded").reduce((sum, row) => sum + row.documentCount, 0);
  if (uncoded > 0) issues.push({ key: "hsn", label: "Lines without stored HSN", count: uncoded });
  const cancelled = args.docs.reduce((sum, row) => sum + row.cancelled, 0);
  if (cancelled > 0) issues.push({ key: "cancelled", label: "Cancelled documents in series", count: cancelled });
  return issues;
}

export function buildGstr3bPrep(args: {
  sales: GstBooksLine[];
  creditNotes: GstBooksLine[];
  purchaseTotals: ReturnType<typeof gstTotals>;
  itcAllowed: boolean;
  gstr1?: Gstr1PrepResult;
}): Gstr3bPrepResult {
  const base = buildGstr3b(args);
  const mismatches: Gstr3bMismatch[] = [];
  if (args.gstr1) {
    const gstr1Outward = money(
      args.gstr1.tables
        .filter((table) => table.id === "b2b" || table.id === "b2cl" || table.id === "b2cs" || table.id === "exp")
        .reduce((sum, table) => sum + table.taxAmount, 0)
    );
    const gstr3bOutward = money(
      (base.rows.find((row) => row.key === "3_1_a")?.taxAmount ?? 0) +
        (base.rows.find((row) => row.key === "3_1_b")?.taxAmount ?? 0)
    );
    if (Math.abs(gstr1Outward - gstr3bOutward) > 0.05) {
      mismatches.push({
        key: "outward-tax",
        label: "GSTR-1 outward tax vs GSTR-3B 3.1(a)+(b)",
        gstr1Value: gstr1Outward,
        gstr3bValue: gstr3bOutward,
      });
    }
    const gstr1Taxable = money(
      args.gstr1.tables
        .filter((table) => table.id === "b2b" || table.id === "b2cl" || table.id === "b2cs" || table.id === "exp")
        .reduce((sum, table) => sum + table.taxableAmount, 0)
    );
    const gstr3bTaxable = money(
      (base.rows.find((row) => row.key === "3_1_a")?.taxableAmount ?? 0) +
        (base.rows.find((row) => row.key === "3_1_b")?.taxableAmount ?? 0) +
        (base.rows.find((row) => row.key === "3_1_c")?.taxableAmount ?? 0)
    );
    if (Math.abs(gstr1Taxable - gstr3bTaxable) > 0.05) {
      mismatches.push({
        key: "outward-taxable",
        label: "GSTR-1 outward taxable vs GSTR-3B 3.1(a)+(b)+(c)",
        gstr1Value: gstr1Taxable,
        gstr3bValue: gstr3bTaxable,
      });
    }
  }
  return { ...base, mismatches };
}

export function rcmLines(purchases: GstBooksLine[]): GstBooksLine[] {
  return purchases.filter((line) => line.reverseCharge);
}

export function placeOfSupplyFromLines(lines: GstBooksLine[]): GstPosRow[] {
  const groups = new Map<string, GstPosRow>();
  for (const line of lines) {
    const place = (line.placeOfSupplyState ?? "").trim() || "Not stored";
    const current = groups.get(place) ?? {
      placeOfSupplyState: place,
      documentCount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      invoiceValue: 0,
    };
    current.documentCount += 1;
    current.taxableAmount = money(current.taxableAmount + line.taxableAmount);
    current.taxAmount = money(current.taxAmount + line.taxAmount);
    current.cgst = money(current.cgst + line.cgst);
    current.sgst = money(current.sgst + line.sgst);
    current.igst = money(current.igst + line.igst);
    current.invoiceValue = money(current.invoiceValue + line.invoiceValue);
    groups.set(place, current);
  }
  return [...groups.values()].sort((a, b) => a.placeOfSupplyState.localeCompare(b.placeOfSupplyState));
}

function seriesPrefix(documentNo: string): string {
  const match = documentNo.trim().match(/^([A-Za-z]+)[-/]?/);
  const prefix = match?.[1] ?? documentNo.trim().slice(0, 3);
  return (prefix || "DOC").toUpperCase();
}

function seriesSortKey(documentNo: string): string {
  const match = documentNo.trim().match(/(\d+)\s*$/);
  const num = match ? match[1].padStart(12, "0") : documentNo.trim();
  return `${seriesPrefix(documentNo)}|${num}|${documentNo}`;
}

export function documentSeriesFromInvoices(
  invoices: Array<{ invoiceNo: string; invoiceDate: string; status: string }>,
  period: ReportPeriod,
  nature = "Invoices for outward supply"
): GstDocumentSeriesRow[] {
  const issued = invoices.filter(
    (invoice) => invoice.status !== "draft" && isWithin(invoice.invoiceDate, period.from, period.to)
  );
  const groups = new Map<string, typeof issued>();
  for (const invoice of issued) {
    const prefix = seriesPrefix(invoice.invoiceNo);
    const list = groups.get(prefix) ?? [];
    list.push(invoice);
    groups.set(prefix, list);
  }
  return [...groups.entries()]
    .map(([prefix, list]) => {
      const sorted = [...list].sort((a, b) => seriesSortKey(a.invoiceNo).localeCompare(seriesSortKey(b.invoiceNo)));
      const cancelled = sorted.filter((row) => row.status === "cancelled").length;
      return {
        nature,
        prefix,
        fromNo: sorted[0]?.invoiceNo ?? "",
        toNo: sorted[sorted.length - 1]?.invoiceNo ?? "",
        total: sorted.length,
        cancelled,
        netIssued: sorted.length - cancelled,
      };
    })
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

const NIL_EXEMPT_TYPES: GstSupplyType[] = ["nil_rated", "exempt", "out_of_scope"];

function nilExemptLabel(type: string): string {
  if (type === "nil_rated") return "Nil-rated";
  if (type === "out_of_scope") return "Non-GST / out of scope";
  if (type === "bill_of_supply") return "Bill of supply (zero tax, type not stored)";
  return "Exempt";
}

export function nilExemptFromInvoices(invoices: SalesInvoice[], period: ReportPeriod): GstNilExemptRow[] {
  const groups = new Map<string, GstNilExemptRow & { documents: Set<string> }>();
  function add(supplyType: string, invoiceId: string, taxableAmount: number, invoiceValue: number) {
    const current = groups.get(supplyType) ?? {
      supplyType: nilExemptLabel(supplyType),
      documentCount: 0,
      taxableAmount: 0,
      invoiceValue: 0,
      documents: new Set<string>(),
    };
    current.taxableAmount = money(current.taxableAmount + taxableAmount);
    current.invoiceValue = money(current.invoiceValue + invoiceValue);
    current.documents.add(invoiceId);
    groups.set(supplyType, current);
  }
  for (const invoice of postedSales(invoices, period)) {
    if (invoice.gstDocumentType === "export_invoice") continue;
    const classified = (invoice.items ?? []).filter((item) =>
      NIL_EXEMPT_TYPES.includes((item.gstSupplyType ?? "taxable") as GstSupplyType)
    );
    if (classified.length > 0) {
      for (const item of classified) {
        add(item.gstSupplyType ?? "exempt", invoice.id, lineTaxable(item), item.amount ?? lineTaxable(item));
      }
      continue;
    }
    if (invoice.gstDocumentType === "bill_of_supply" || invoice.taxTotal === 0) {
      add("bill_of_supply", invoice.id, Math.max(0, invoice.total - invoice.taxTotal), invoice.total);
    }
  }
  return [...groups.values()]
    .map(({ documents, ...row }) => ({ ...row, documentCount: documents.size }))
    .sort((a, b) => a.supplyType.localeCompare(b.supplyType));
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
