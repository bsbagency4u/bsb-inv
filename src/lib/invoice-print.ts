import type { BusinessProfile, InvoiceDefaults, PrintDocumentType } from "@/types/domain";
import {
  DEFAULT_INVOICE,
  documentHeading,
  formatShareMessage,
  isPrintDocumentEnabled,
  parseInvoiceDefaults,
  buildWhatsAppUrl,
} from "@/lib/invoice-settings";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface PrintLine {
  name: string;
  sku?: string | null;
  hsn?: string | null;
  batchNo?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount?: number;
  gstRate: number;
  amount: number;
  mrp?: number | null;
}

export interface PrintDocumentModel {
  kind: PrintDocumentType;
  docNo: string;
  docDate: string;
  partyLabel: string;
  partyGstin?: string | null;
  partyPhone?: string | null;
  notes?: string | null;
  paymentMode?: string | null;
  paidAmount?: number;
  lines: PrintLine[];
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  intraState?: boolean;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface SalesPrintLine {
  name: string;
  hsn?: string | null;
  batchNo?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount?: number;
  gstRate: number;
  amount: number;
  mrp?: number | null;
  sku?: string | null;
}

export interface SalesPrintModel {
  invoiceNo: string;
  invoiceDate: string;
  partyLabel: string;
  partyGstin?: string | null;
  notes?: string | null;
  paymentMode?: string | null;
  paidAmount: number;
  lines: SalesPrintLine[];
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  intraState?: boolean;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface PrintResult {
  ok: boolean;
  reason?: "disabled" | "blocked" | "unsupported";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pageCss(defaults: InvoiceDefaults): string {
  const orientation = defaults.orientation === "landscape" ? "landscape" : "portrait";
  if (defaults.paperSize === "thermal") {
    return `@page { size: 80mm auto; margin: 4mm; } body { width: 72mm; font-size: 11px; }`;
  }
  if (defaults.paperSize === "a5") {
    return `@page { size: A5 ${orientation}; margin: 10mm; }`;
  }
  if (defaults.paperSize === "custom") {
    const width = orientation === "landscape" ? defaults.customHeightMm : defaults.customWidthMm;
    const height = orientation === "landscape" ? defaults.customWidthMm : defaults.customHeightMm;
    return `@page { size: ${width}mm ${height}mm; margin: 8mm; }`;
  }
  return `@page { size: A4 ${orientation}; margin: 14mm; }`;
}

function salesToPrintModel(model: SalesPrintModel): PrintDocumentModel {
  return {
    kind: "sales_invoice",
    docNo: model.invoiceNo,
    docDate: model.invoiceDate,
    partyLabel: model.partyLabel,
    partyGstin: model.partyGstin,
    notes: model.notes,
    paymentMode: model.paymentMode,
    paidAmount: model.paidAmount,
    lines: model.lines,
    subtotal: model.subtotal,
    discount: model.discount,
    taxTotal: model.taxTotal,
    total: model.total,
    intraState: model.intraState,
    cgst: model.cgst,
    sgst: model.sgst,
    igst: model.igst,
  };
}

function partyRole(kind: PrintDocumentType): string {
  if (kind === "purchase_invoice" || kind === "purchase_return") return "Supplier";
  if (kind === "payment_receipt") return "Party";
  return "Bill to";
}

function taxRows(model: PrintDocumentModel, defaults: InvoiceDefaults, currency: string): string {
  if (!defaults.showTaxBreakup) {
    return `<div class="row"><span>Tax</span><span>${escapeHtml(formatCurrency(model.taxTotal, currency))}</span></div>`;
  }
  const igst = model.igst ?? 0;
  const cgst = model.cgst ?? 0;
  const sgst = model.sgst ?? 0;
  if (model.intraState === false && igst > 0) {
    return `<div class="row"><span>IGST</span><span>${escapeHtml(formatCurrency(igst, currency))}</span></div>`;
  }
  const parts: string[] = [];
  if (cgst > 0) {
    parts.push(
      `<div class="row"><span>CGST</span><span>${escapeHtml(formatCurrency(cgst, currency))}</span></div>`
    );
  }
  if (sgst > 0) {
    parts.push(
      `<div class="row"><span>SGST</span><span>${escapeHtml(formatCurrency(sgst, currency))}</span></div>`
    );
  }
  if (parts.length === 0 && model.taxTotal > 0) {
    parts.push(
      `<div class="row"><span>Tax</span><span>${escapeHtml(formatCurrency(model.taxTotal, currency))}</span></div>`
    );
  }
  return parts.join("");
}

function pageLayoutRows(
  model: PrintDocumentModel,
  defaults: InvoiceDefaults,
  currency: string
): { header: string; rows: string } {
  const headerCells = [
    "<th>Item</th>",
    defaults.showSku ? "<th>SKU</th>" : "",
    defaults.showHsn ? "<th>HSN</th>" : "",
    defaults.showBatch ? "<th>Batch</th>" : "",
    "<th class='num'>Qty</th>",
    defaults.showMrp ? "<th class='num'>MRP</th>" : "",
    "<th class='num'>Rate</th>",
    defaults.showDiscount ? "<th class='num'>Disc</th>" : "",
    "<th class='num'>GST</th>",
    "<th class='num'>Amount</th>",
  ].join("");
  const rows = model.lines
    .map((line) => {
      const qty = line.unit ? `${line.quantity} ${escapeHtml(line.unit)}` : String(line.quantity);
      return `<tr>
        <td>${escapeHtml(line.name)}</td>
        ${defaults.showSku ? `<td>${escapeHtml(line.sku || "—")}</td>` : ""}
        ${defaults.showHsn ? `<td>${escapeHtml(line.hsn || "—")}</td>` : ""}
        ${defaults.showBatch ? `<td>${escapeHtml(line.batchNo || "—")}</td>` : ""}
        <td class="num">${escapeHtml(qty)}</td>
        ${defaults.showMrp ? `<td class="num">${line.mrp != null ? escapeHtml(formatCurrency(line.mrp, currency)) : "—"}</td>` : ""}
        <td class="num">${escapeHtml(formatCurrency(line.unitPrice, currency))}</td>
        ${defaults.showDiscount ? `<td class="num">${escapeHtml(formatCurrency(line.discount ?? 0, currency))}</td>` : ""}
        <td class="num">${line.gstRate}%</td>
        <td class="num">${escapeHtml(formatCurrency(line.amount, currency))}</td>
      </tr>`;
    })
    .join("");
  return { header: headerCells, rows };
}

function thermalRows(model: PrintDocumentModel, defaults: InvoiceDefaults, currency: string): string {
  return model.lines
    .map((line) => {
      const qty = line.unit ? `${line.quantity} ${escapeHtml(line.unit)}` : String(line.quantity);
      const meta = [
        defaults.showSku && line.sku ? `SKU ${escapeHtml(line.sku)}` : "",
        defaults.showHsn && line.hsn ? `HSN ${escapeHtml(line.hsn)}` : "",
        defaults.showBatch && line.batchNo ? `Batch ${escapeHtml(line.batchNo)}` : "",
        defaults.showMrp && line.mrp != null ? `MRP ${escapeHtml(formatCurrency(line.mrp, currency))}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const disc =
        defaults.showDiscount && (line.discount ?? 0) > 0
          ? ` · Disc ${escapeHtml(formatCurrency(line.discount ?? 0, currency))}`
          : "";
      return `<div class="item">
        <div><strong>${escapeHtml(line.name)}</strong></div>
        ${meta ? `<div class="muted">${meta}</div>` : ""}
        <div class="row"><span>${escapeHtml(qty)} × ${escapeHtml(formatCurrency(line.unitPrice, currency))} @ ${line.gstRate}%${disc}</span><span>${escapeHtml(formatCurrency(line.amount, currency))}</span></div>
      </div>`;
    })
    .join("");
}

function documentBodyHtml(
  business: BusinessProfile,
  defaults: InvoiceDefaults,
  model: PrintDocumentModel,
  currency: string,
  copyLabel?: string
): string {
  const address = [business.address, business.city, business.state, business.pincode]
    .filter(Boolean)
    .join(", ");
  const logo =
    defaults.showLogo && business.logoUrl
      ? `<img src="${escapeHtml(business.logoUrl)}" alt="" style="max-height:48px;max-width:160px" />`
      : "";
  const gstin =
    defaults.showGstin && business.gstin ? `<div>GSTIN: ${escapeHtml(business.gstin)}</div>` : "";
  const bank =
    defaults.showBankDetails && defaults.bankDetails
      ? `<p class="muted">${escapeHtml(defaults.bankDetails)}</p>`
      : "";
  const terms = defaults.termsAndConditions
    ? `<p class="muted">${escapeHtml(defaults.termsAndConditions)}</p>`
    : "";
  const footer = defaults.footerNote ? `<p class="muted">${escapeHtml(defaults.footerNote)}</p>` : "";
  const signature = defaults.showSignature
    ? `<div class="sign"><div class="sign-line"></div><div class="muted">${escapeHtml(defaults.signatureLabel || "Authorised Signatory")}</div></div>`
    : "";
  const paid = model.paidAmount ?? 0;
  const paidBlock = defaults.showPaidBalance
    ? `<div class="row muted"><span>Paid</span><span>${escapeHtml(formatCurrency(paid, currency))}</span></div>
       <div class="row muted"><span>Balance</span><span>${escapeHtml(formatCurrency(Math.max(0, model.total - paid), currency))}</span></div>`
    : "";
  const notes = defaults.showNotes && model.notes ? `<p class="muted">${escapeHtml(model.notes)}</p>` : "";
  const heading = documentHeading(model.kind);
  const partyGstin =
    defaults.showGstin && model.partyGstin ? ` · GSTIN ${escapeHtml(model.partyGstin)}` : "";
  const items =
    defaults.paperSize === "thermal"
      ? thermalRows(model, defaults, currency)
      : (() => {
          const table = pageLayoutRows(model, defaults, currency);
          return `<table><thead><tr>${table.header}</tr></thead><tbody>${table.rows}</tbody></table>`;
        })();

  return `<section class="sheet">
  <div class="header">
    <div>
      ${logo}
      <h1>${escapeHtml(business.legalName || business.name)}</h1>
      <div class="muted">${escapeHtml(address || "")}</div>
      ${gstin}
      ${business.phone ? `<div class="muted">${escapeHtml(business.phone)}</div>` : ""}
    </div>
    <div class="right">
      <h1>${escapeHtml(heading)}</h1>
      <div><strong>${escapeHtml(model.docNo)}</strong></div>
      <div class="muted">${escapeHtml(formatDate(model.docDate))}</div>
      ${model.paymentMode ? `<div class="muted">${escapeHtml(model.paymentMode)}</div>` : ""}
      ${copyLabel ? `<div class="muted">${escapeHtml(copyLabel)}</div>` : ""}
    </div>
  </div>
  <p><strong>${escapeHtml(partyRole(model.kind))}:</strong> ${escapeHtml(model.partyLabel)}${partyGstin}</p>
  ${items}
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(model.subtotal, currency))}</span></div>
    ${defaults.showDiscount && model.discount > 0 ? `<div class="row"><span>Discount</span><span>${escapeHtml(formatCurrency(model.discount, currency))}</span></div>` : ""}
    ${taxRows(model, defaults, currency)}
    <div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(model.total, currency))}</span></div>
    ${paidBlock}
  </div>
  ${notes}
  ${bank}${terms}${footer}${signature}
</section>`;
}

export function documentPrintHtml(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults>,
  model: PrintDocumentModel,
  currency: string
): string {
  const defaults = parseInvoiceDefaults(defaultsInput);
  const copies = Math.max(1, Math.min(9, defaults.copies || 1));
  const sheets = Array.from({ length: copies }, (_, index) =>
    documentBodyHtml(
      business,
      defaults,
      model,
      currency,
      copies > 1 ? `Copy ${index + 1} of ${copies}` : undefined
    )
  ).join("");
  return `<!doctype html><html><head><title>${escapeHtml(model.docNo)}</title>
<style>
  ${pageCss(defaults)}
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #131722; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th, td { border-bottom: 1px solid #e4e7ec; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #67707e; font-size: 11px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; }
  .totals { width: 240px; margin-left: auto; margin-top: 12px; }
  .total { font-weight: 700; border-top: 1px solid #e4e7ec; padding-top: 6px; margin-top: 6px; }
  .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .right { text-align: right; }
  .sheet { page-break-after: always; padding-bottom: 8px; }
  .sheet:last-child { page-break-after: auto; }
  .item { border-bottom: 1px dashed #e4e7ec; padding: 6px 0; }
  .sign { margin-top: 36px; width: 180px; margin-left: auto; text-align: center; }
  .sign-line { border-top: 1px solid #c9cdd4; margin-bottom: 4px; }
</style></head><body>
  ${sheets}
</body></html>`;
}

export function salesInvoicePrintHtml(
  business: BusinessProfile,
  defaults: InvoiceDefaults,
  model: SalesPrintModel,
  currency: string
): string {
  return documentPrintHtml(business, defaults, salesToPrintModel(model), currency);
}

function writePrintFrame(html: string): PrintResult {
  if (typeof document === "undefined") return { ok: false, reason: "unsupported" };
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return { ok: false, reason: "blocked" };
  }
  try {
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 1500);
    return { ok: true };
  } catch {
    frame.remove();
    return { ok: false, reason: "blocked" };
  }
}

export function printDocument(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: PrintDocumentModel,
  currency = business.currency || "INR"
): PrintResult {
  const defaults = parseInvoiceDefaults(defaultsInput ?? DEFAULT_INVOICE);
  if (!isPrintDocumentEnabled(defaults, model.kind)) {
    return { ok: false, reason: "disabled" };
  }
  return writePrintFrame(documentPrintHtml(business, defaults, model, currency));
}

export function printSalesInvoice(
  business: BusinessProfile,
  defaults: InvoiceDefaults,
  model: SalesPrintModel,
  currency = business.currency || "INR"
): PrintResult {
  return printDocument(business, defaults, salesToPrintModel(model), currency);
}

export function downloadDocumentHtml(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: PrintDocumentModel,
  currency = business.currency || "INR"
): PrintResult {
  if (typeof document === "undefined") return { ok: false, reason: "unsupported" };
  const defaults = parseInvoiceDefaults(defaultsInput ?? DEFAULT_INVOICE);
  if (!isPrintDocumentEnabled(defaults, model.kind)) {
    return { ok: false, reason: "disabled" };
  }
  const html = documentPrintHtml(business, defaults, model, currency);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${model.docNo.replace(/[^\w.-]+/g, "-")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

export function exportDocumentPdf(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: PrintDocumentModel,
  currency = business.currency || "INR"
): PrintResult {
  const printed = printDocument(business, defaultsInput, model, currency);
  if (printed.ok) return printed;
  return downloadDocumentHtml(business, defaultsInput, model, currency);
}

export function shareDocumentWhatsApp(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: PrintDocumentModel,
  currency = business.currency || "INR"
): { ok: boolean; message: string; url: string } {
  const defaults = parseInvoiceDefaults(defaultsInput ?? DEFAULT_INVOICE);
  const message = formatShareMessage(defaults.messageTemplate, {
    party: model.partyLabel,
    docNo: model.docNo,
    docTitle: documentHeading(model.kind),
    business: business.legalName || business.name,
    date: formatDate(model.docDate),
    total: formatCurrency(model.total, currency),
  });
  const url = buildWhatsAppUrl(message, model.partyPhone);
  if (typeof window !== "undefined" && defaults.whatsappEnabled) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return { ok: defaults.whatsappEnabled, message, url };
}

export function shouldAutoPrint(
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  kind: PrintDocumentType
): boolean {
  const defaults = parseInvoiceDefaults(defaultsInput ?? DEFAULT_INVOICE);
  return defaults.autoPrintOnSave && isPrintDocumentEnabled(defaults, kind);
}

export function autoOutputDocument(
  business: BusinessProfile,
  defaultsInput: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: PrintDocumentModel,
  currency = business.currency || "INR"
): PrintResult {
  const defaults = parseInvoiceDefaults(defaultsInput ?? DEFAULT_INVOICE);
  if (!shouldAutoPrint(defaults, model.kind)) {
    return { ok: false, reason: "disabled" };
  }
  if (defaults.defaultOutput === "pdf") {
    return exportDocumentPdf(business, defaults, model, currency);
  }
  return printDocument(business, defaults, model, currency);
}

export function samplePrintModel(kind: PrintDocumentType = "sales_invoice"): PrintDocumentModel {
  return {
    kind,
    docNo: "INV-2026-001001",
    docDate: "2026-10-04",
    partyLabel: "Walk-in customer",
    partyGstin: "27BBBBB0000B1Z5",
    notes: "Sample preview. Saved documents keep their original tax and totals.",
    paymentMode: "Cash",
    paidAmount: 118,
    lines: [
      {
        name: "Sample soap",
        sku: "SOAP-01",
        hsn: "3401",
        batchNo: "B-100",
        quantity: 1,
        unit: "PCS",
        unitPrice: 100,
        discount: 0,
        gstRate: 18,
        amount: 118,
        mrp: 120,
      },
      {
        name: "Sample rice",
        sku: "RICE-05",
        hsn: "1006",
        batchNo: "B-200",
        quantity: 2,
        unit: "KG",
        unitPrice: 50,
        discount: 5,
        gstRate: 5,
        amount: 99.75,
        mrp: 55,
      },
    ],
    subtotal: 200,
    discount: 5,
    taxTotal: 17.75,
    total: 212.75,
    intraState: true,
    cgst: 8.875,
    sgst: 8.875,
    igst: 0,
  };
}
