import type { BusinessProfile, InvoiceDefaults } from "@/types/domain";
import { formatCurrency, formatDate } from "@/lib/utils";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageCss(paperSize: InvoiceDefaults["paperSize"]): string {
  if (paperSize === "thermal") {
    return `@page { size: 80mm auto; margin: 6mm; } body { width: 68mm; font-size: 11px; }`;
  }
  if (paperSize === "a5") {
    return `@page { size: A5; margin: 12mm; }`;
  }
  return `@page { size: A4; margin: 16mm; }`;
}

export function salesInvoicePrintHtml(
  business: BusinessProfile,
  defaults: InvoiceDefaults,
  model: SalesPrintModel,
  currency: string
): string {
  const address = [business.address, business.city, business.state, business.pincode]
    .filter(Boolean)
    .join(", ");
  const showHsn = defaults.showHsn;
  const headerCells = [
    "<th>Item</th>",
    showHsn ? "<th>HSN</th>" : "",
    "<th class='num'>Qty</th>",
    "<th class='num'>Rate</th>",
    "<th class='num'>GST</th>",
    "<th class='num'>Amount</th>",
  ].join("");
  const rows = model.lines
    .map((line) => {
      const qty = line.unit ? `${line.quantity} ${escapeHtml(line.unit)}` : String(line.quantity);
      return `<tr>
        <td>${escapeHtml(line.name)}${line.batchNo ? `<div class="muted">Batch ${escapeHtml(line.batchNo)}</div>` : ""}</td>
        ${showHsn ? `<td>${escapeHtml(line.hsn || "—")}</td>` : ""}
        <td class="num">${escapeHtml(qty)}</td>
        <td class="num">${escapeHtml(formatCurrency(line.unitPrice, currency))}</td>
        <td class="num">${line.gstRate}%</td>
        <td class="num">${escapeHtml(formatCurrency(line.amount, currency))}</td>
      </tr>`;
    })
    .join("");

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
  const taxLines =
    model.intraState === false && (model.igst ?? 0) > 0
      ? `<div class="row"><span>IGST</span><span>${escapeHtml(formatCurrency(model.igst ?? 0, currency))}</span></div>`
      : `${(model.cgst ?? 0) > 0 ? `<div class="row"><span>CGST</span><span>${escapeHtml(formatCurrency(model.cgst ?? 0, currency))}</span></div>` : ""}${
          (model.sgst ?? 0) > 0
            ? `<div class="row"><span>SGST</span><span>${escapeHtml(formatCurrency(model.sgst ?? 0, currency))}</span></div>`
            : ""
        }`;

  return `<!doctype html><html><head><title>${escapeHtml(model.invoiceNo)}</title>
<style>
  ${pageCss(defaults.paperSize)}
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #131722; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th, td { border-bottom: 1px solid #e4e7ec; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #67707e; font-size: 11px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; }
  .totals { width: 240px; margin-left: auto; margin-top: 12px; }
  .total { font-weight: 700; border-top: 1px solid #e4e7ec; padding-top: 6px; margin-top: 6px; }
</style></head><body>
  <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
    <div>
      ${logo}
      <h1>${escapeHtml(business.legalName || business.name)}</h1>
      <div class="muted">${escapeHtml(address || "")}</div>
      ${gstin}
      ${business.phone ? `<div class="muted">${escapeHtml(business.phone)}</div>` : ""}
    </div>
    <div style="text-align:right">
      <h1>${escapeHtml(model.invoiceNo)}</h1>
      <div class="muted">${escapeHtml(formatDate(model.invoiceDate))}</div>
      ${model.paymentMode ? `<div class="muted">${escapeHtml(model.paymentMode)}</div>` : ""}
    </div>
  </div>
  <p><strong>Bill to:</strong> ${escapeHtml(model.partyLabel)}${
    model.partyGstin ? ` · GSTIN ${escapeHtml(model.partyGstin)}` : ""
  }</p>
  <table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(model.subtotal, currency))}</span></div>
    ${model.discount > 0 ? `<div class="row"><span>Discount</span><span>${escapeHtml(formatCurrency(model.discount, currency))}</span></div>` : ""}
    ${taxLines}
    <div class="row"><span>Tax</span><span>${escapeHtml(formatCurrency(model.taxTotal, currency))}</span></div>
    <div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(model.total, currency))}</span></div>
    <div class="row muted"><span>Paid</span><span>${escapeHtml(formatCurrency(model.paidAmount, currency))}</span></div>
    <div class="row muted"><span>Balance</span><span>${escapeHtml(formatCurrency(Math.max(0, model.total - model.paidAmount), currency))}</span></div>
  </div>
  ${model.notes ? `<p class="muted">${escapeHtml(model.notes)}</p>` : ""}
  ${bank}${terms}${footer}
</body></html>`;
}

export function printSalesInvoice(
  business: BusinessProfile,
  defaults: InvoiceDefaults,
  model: SalesPrintModel,
  currency = business.currency || "INR"
): void {
  if (typeof document === "undefined") return;
  const html = salesInvoicePrintHtml(business, defaults, model, currency);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 500);
}
