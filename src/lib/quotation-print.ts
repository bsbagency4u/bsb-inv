import type {
  BusinessProfile,
  InvoiceDefaults,
  InvoicePaperSize,
  Quotation,
  QuotationDefaults,
  QuotationFormat,
  QuotationTemplate,
} from "@/types/domain";
import {
  DEFAULT_QUOTATION,
  QUOTATION_FORMAT_META,
  formatBankDetails,
  parseQuotationDefaults,
} from "@/lib/quotation-settings";
import {
  DEFAULT_INVOICE,
  documentHeading,
  formatShareMessage,
  isPrintDocumentEnabled,
  parseInvoiceDefaults,
  buildWhatsAppUrl,
} from "@/lib/invoice-settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PrintDocumentModel, PrintLine, PrintResult } from "@/lib/invoice-print";
import { pageCss } from "@/lib/invoice-print";

export interface QuotationPrintModel {
  quotation: Quotation;
  settings: QuotationDefaults;
  template: QuotationTemplate;
  partyLabel: string;
  partyGstin?: string | null;
  partyPhone?: string | null;
  partyEmail?: string | null;
  lines: PrintLine[];
  cgst: number;
  sgst: number;
  igst: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function asInvoicePaper(settings: QuotationDefaults): InvoiceDefaults {
  const paperSize: InvoicePaperSize =
    settings.paperSize === "a5" || settings.paperSize === "a4" ? settings.paperSize : "a4";
  return parseInvoiceDefaults({
    ...DEFAULT_INVOICE,
    paperSize,
    orientation: settings.orientation,
    showLogo: settings.showLogo,
    showGstin: settings.showGstin,
    showHsn: settings.showHsn,
    showSku: settings.showSku,
    showDiscount: settings.showDiscount,
    showTaxBreakup: settings.showTaxBreakup,
    showBankDetails: settings.showBankDetails,
    showSignature: settings.showSignature,
    showNotes: true,
    showBatch: false,
    showMrp: false,
    showPaidBalance: false,
    copies: 1,
    documentTypes: { ...DEFAULT_INVOICE.documentTypes, quotation: { enabled: true } },
  });
}

function watermarkLayer(settings: QuotationDefaults): string {
  if (!settings.watermarkEnabled) return "";
  const opacity = Math.min(0.35, Math.max(0.04, settings.watermarkOpacity));
  if (settings.watermarkMode === "image" && settings.watermarkImageUrl) {
    return `<div class="watermark" style="opacity:${opacity}"><img src="${escapeHtml(settings.watermarkImageUrl)}" alt="" /></div>`;
  }
  const text = (settings.watermarkText || "QUOTATION").trim();
  if (!text) return "";
  return `<div class="watermark watermark-text" style="opacity:${opacity}">${escapeHtml(text)}</div>`;
}

function brandingLogo(business: BusinessProfile, settings: QuotationDefaults): string {
  if (!settings.showLogo) return "";
  const src = settings.logoUrl || business.logoUrl;
  if (!src) return "";
  return `<img class="logo" src="${escapeHtml(src)}" alt="" />`;
}

function signatureBlock(settings: QuotationDefaults): string {
  if (!settings.showSignature && !settings.showStamp) return "";
  const signature = settings.showSignature
    ? settings.signatureImageUrl
      ? `<img class="sign-img" src="${escapeHtml(settings.signatureImageUrl)}" alt="" />`
      : `<div class="sign-line"></div>`
    : "";
  const stamp = settings.showStamp && settings.stampImageUrl
    ? `<img class="stamp-img" src="${escapeHtml(settings.stampImageUrl)}" alt="" />`
    : "";
  const label = escapeHtml(settings.signatureLabel || "Authorised Signatory");
  return `<div class="sign-row">
    ${stamp}
    <div class="sign">${signature}<div class="muted">${label}</div></div>
  </div>`;
}

function bankBlock(settings: QuotationDefaults): string {
  if (!settings.showBankDetails) return "";
  const text = formatBankDetails(settings.bankDetails);
  if (!text) return "";
  return `<div class="panel"><h3>Bank details</h3><p class="muted">${nl2br(text)}</p></div>`;
}

function taxRows(model: QuotationPrintModel, currency: string): string {
  if (!model.settings.showTaxBreakup) {
    return `<div class="row"><span>Tax</span><span>${escapeHtml(formatCurrency(model.quotation.taxTotal, currency))}</span></div>`;
  }
  if (model.quotation.intraState === false && model.igst > 0) {
    return `<div class="row"><span>IGST</span><span>${escapeHtml(formatCurrency(model.igst, currency))}</span></div>`;
  }
  const parts: string[] = [];
  if (model.cgst > 0) {
    parts.push(
      `<div class="row"><span>CGST</span><span>${escapeHtml(formatCurrency(model.cgst, currency))}</span></div>`
    );
  }
  if (model.sgst > 0) {
    parts.push(
      `<div class="row"><span>SGST</span><span>${escapeHtml(formatCurrency(model.sgst, currency))}</span></div>`
    );
  }
  if (parts.length === 0 && model.quotation.taxTotal > 0) {
    parts.push(
      `<div class="row"><span>Tax</span><span>${escapeHtml(formatCurrency(model.quotation.taxTotal, currency))}</span></div>`
    );
  }
  return parts.join("");
}

function lineTable(model: QuotationPrintModel, currency: string): string {
  const settings = model.settings;
  const header = [
    "<th>Item</th>",
    settings.showSku ? "<th>SKU</th>" : "",
    settings.showHsn ? "<th>HSN</th>" : "",
    "<th class='num'>Qty</th>",
    "<th class='num'>Rate</th>",
    settings.showDiscount ? "<th class='num'>Disc</th>" : "",
    "<th class='num'>GST</th>",
    "<th class='num'>Amount</th>",
  ].join("");
  const rows = model.lines
    .map((line) => {
      const qty = line.unit ? `${line.quantity} ${escapeHtml(line.unit)}` : String(line.quantity);
      const name = line.name + (line.sku && !settings.showSku ? "" : "");
      return `<tr>
        <td>${escapeHtml(name)}</td>
        ${settings.showSku ? `<td>${escapeHtml(line.sku || "—")}</td>` : ""}
        ${settings.showHsn ? `<td>${escapeHtml(line.hsn || "—")}</td>` : ""}
        <td class="num">${escapeHtml(qty)}</td>
        <td class="num">${escapeHtml(formatCurrency(line.unitPrice, currency))}</td>
        ${settings.showDiscount ? `<td class="num">${escapeHtml(formatCurrency(line.discount ?? 0, currency))}</td>` : ""}
        <td class="num">${line.gstRate}%</td>
        <td class="num">${escapeHtml(formatCurrency(line.amount, currency))}</td>
      </tr>`;
    })
    .join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function section(title: string, body: string | null | undefined, enabled: boolean): string {
  const text = (body ?? "").trim();
  if (!enabled || !text) return "";
  return `<div class="panel"><h3>${escapeHtml(title)}</h3><p>${nl2br(text)}</p></div>`;
}

function coverPage(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency: string
): string {
  const q = model.quotation;
  const address = [business.address, business.city, business.state, business.pincode]
    .filter(Boolean)
    .join(", ");
  return `<section class="sheet cover">
    ${watermarkLayer(model.settings)}
    ${brandingLogo(business, model.settings)}
    <p class="muted">${escapeHtml(QUOTATION_FORMAT_META[q.format].label)}</p>
    <h1>${escapeHtml(q.title || "Proposal")}</h1>
    <p class="lead">Prepared for ${escapeHtml(model.partyLabel)}</p>
    <p class="muted">${escapeHtml(business.legalName || business.name)}</p>
    <p class="muted">${escapeHtml(address)}</p>
    <div class="meta">
      <div><span class="muted">Reference</span><strong>${escapeHtml(q.quotationNo)}</strong></div>
      <div><span class="muted">Date</span><strong>${escapeHtml(formatDate(q.quotationDate))}</strong></div>
      <div><span class="muted">Valid until</span><strong>${escapeHtml(formatDate(q.validUntil))}</strong></div>
      <div><span class="muted">Total</span><strong>${escapeHtml(formatCurrency(q.total, currency))}</strong></div>
    </div>
  </section>`;
}

function quotationBodyHtml(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency: string
): string {
  const q = model.quotation;
  const settings = model.settings;
  const address = [business.address, business.city, business.state, business.pincode]
    .filter(Boolean)
    .join(", ");
  const gstin =
    settings.showGstin && business.gstin ? `<div>GSTIN: ${escapeHtml(business.gstin)}</div>` : "";
  const partyGstin =
    settings.showGstin && model.partyGstin ? ` · GSTIN ${escapeHtml(model.partyGstin)}` : "";
  const heading = q.format === "formal_proposal" ? (q.title || "Proposal") : "Quotation";
  const intro = (q.intro || model.template.introHtml || "").trim();
  const terms = (q.termsAndConditions || settings.termsAndConditions || model.template.termsAndConditions || "").trim();
  const footer = (settings.footerNote || model.template.footerNote || "").trim();
  const cover =
    q.format === "formal_proposal" && model.template.showCover
      ? coverPage(business, model, currency)
      : "";

  return `${cover}<section class="sheet">
  ${watermarkLayer(settings)}
  <div class="header">
    <div>
      ${brandingLogo(business, settings)}
      <h1>${escapeHtml(business.legalName || business.name)}</h1>
      <div class="muted">${escapeHtml(address || "")}</div>
      ${gstin}
      ${business.phone ? `<div class="muted">${escapeHtml(business.phone)}</div>` : ""}
    </div>
    <div class="right">
      <h1>${escapeHtml(heading)}</h1>
      <div><strong>${escapeHtml(q.quotationNo)}</strong></div>
      <div class="muted">${escapeHtml(formatDate(q.quotationDate))}</div>
      ${q.validUntil ? `<div class="muted">Valid until ${escapeHtml(formatDate(q.validUntil))}</div>` : ""}
    </div>
  </div>
  <p><strong>Prepared for:</strong> ${escapeHtml(model.partyLabel)}${partyGstin}</p>
  ${model.partyPhone ? `<p class="muted">${escapeHtml(model.partyPhone)}${model.partyEmail ? ` · ${escapeHtml(model.partyEmail)}` : ""}</p>` : ""}
  ${intro ? `<p>${nl2br(intro)}</p>` : ""}
  ${section("Scope of work", q.scope, q.format === "formal_proposal" && model.template.showScope)}
  ${section("Timeline", q.timeline, q.format === "formal_proposal" && model.template.showTimeline)}
  ${section("Assumptions", q.assumptions, q.format === "formal_proposal" && model.template.showAssumptions)}
  ${lineTable(model, currency)}
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(q.subtotal, currency))}</span></div>
    ${settings.showDiscount && q.discount > 0 ? `<div class="row"><span>Discount</span><span>${escapeHtml(formatCurrency(q.discount, currency))}</span></div>` : ""}
    ${taxRows(model, currency)}
    <div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(q.total, currency))}</span></div>
  </div>
  ${q.notes ? `<p class="muted">${nl2br(q.notes)}</p>` : ""}
  ${bankBlock(settings)}
  ${terms ? `<div class="panel"><h3>Terms</h3><p class="muted">${nl2br(terms)}</p></div>` : ""}
  ${footer ? `<p class="muted">${nl2br(footer)}</p>` : ""}
  ${signatureBlock(settings)}
</section>`;
}

export function quotationPrintHtml(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): string {
  const invoicePaper = asInvoicePaper(model.settings);
  return `<!doctype html><html><head><title>${escapeHtml(model.quotation.quotationNo)}</title>
<style>
  ${pageCss(invoicePaper)}
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #131722; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h3 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
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
  .sheet { position: relative; page-break-after: always; padding-bottom: 8px; overflow: hidden; }
  .sheet:last-child { page-break-after: auto; }
  .logo { max-height: 48px; max-width: 160px; width: auto; height: auto; object-fit: contain; display: block; margin-bottom: 8px; }
  .cover { min-height: 240px; display: flex; flex-direction: column; justify-content: center; }
  .cover h1 { font-size: 28px; margin: 8px 0; }
  .lead { font-size: 16px; margin: 8px 0; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; max-width: 420px; }
  .panel { margin-top: 12px; }
  .sign-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 24px; margin-top: 36px; }
  .sign { width: 180px; text-align: center; }
  .sign-line { border-top: 1px solid #c9cdd4; margin-bottom: 4px; }
  .sign-img { max-height: 56px; max-width: 160px; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto 4px; }
  .stamp-img { max-height: 72px; max-width: 72px; width: auto; height: auto; object-fit: contain; display: block; }
  .watermark { position: absolute; inset: 18% 10%; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .watermark img { max-width: 70%; max-height: 50%; width: auto; height: auto; object-fit: contain; }
  .watermark-text { font-size: 64px; font-weight: 700; letter-spacing: 0.12em; transform: rotate(-28deg); white-space: nowrap; color: #131722; }
  .sheet > *:not(.watermark) { position: relative; z-index: 1; }
</style></head><body>
  ${quotationBodyHtml(business, model, currency)}
</body></html>`;
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

export function printQuotation(
  business: BusinessProfile,
  invoiceDefaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): PrintResult {
  const printSettings = parseInvoiceDefaults(invoiceDefaults ?? DEFAULT_INVOICE);
  if (!isPrintDocumentEnabled(printSettings, "quotation")) {
    return { ok: false, reason: "disabled" };
  }
  return writePrintFrame(quotationPrintHtml(business, model, currency));
}

export function downloadQuotationHtml(
  business: BusinessProfile,
  invoiceDefaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): PrintResult {
  if (typeof document === "undefined") return { ok: false, reason: "unsupported" };
  const printSettings = parseInvoiceDefaults(invoiceDefaults ?? DEFAULT_INVOICE);
  if (!isPrintDocumentEnabled(printSettings, "quotation")) {
    return { ok: false, reason: "disabled" };
  }
  const html = quotationPrintHtml(business, model, currency);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${model.quotation.quotationNo.replace(/[^\w.-]+/g, "-")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

export function exportQuotationPdf(
  business: BusinessProfile,
  invoiceDefaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): PrintResult {
  const printed = printQuotation(business, invoiceDefaults, model, currency);
  if (printed.ok) return printed;
  return downloadQuotationHtml(business, invoiceDefaults, model, currency);
}

export function shareQuotationWhatsApp(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): { ok: boolean; message: string; url: string } {
  const settings = parseQuotationDefaults(model.settings);
  const message = formatShareMessage(settings.messageTemplate || DEFAULT_QUOTATION.messageTemplate, {
    party: model.partyLabel,
    docNo: model.quotation.quotationNo,
    docTitle: documentHeading("quotation"),
    business: business.legalName || business.name,
    date: formatDate(model.quotation.quotationDate),
    total: formatCurrency(model.quotation.total, currency),
    validUntil: formatDate(model.quotation.validUntil),
  });
  const url = buildWhatsAppUrl(message, model.partyPhone);
  if (typeof window !== "undefined" && settings.whatsappEnabled) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return { ok: settings.whatsappEnabled, message, url };
}

export function quotationToPrintModel(model: QuotationPrintModel): PrintDocumentModel {
  return {
    kind: "quotation",
    docNo: model.quotation.quotationNo,
    docDate: model.quotation.quotationDate,
    partyLabel: model.partyLabel,
    partyGstin: model.partyGstin,
    partyPhone: model.partyPhone,
    notes: model.quotation.notes,
    lines: model.lines,
    subtotal: model.quotation.subtotal,
    discount: model.quotation.discount,
    taxTotal: model.quotation.taxTotal,
    total: model.quotation.total,
    intraState: model.quotation.intraState,
    cgst: model.cgst,
    sgst: model.sgst,
    igst: model.igst,
    documentLabel: model.quotation.title || QUOTATION_FORMAT_META[model.quotation.format as QuotationFormat].label,
    placeOfSupplyState: model.quotation.placeOfSupplyState ?? null,
  };
}
