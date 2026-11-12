import type {
  BusinessProfile,
  InvoiceDefaults,
  Quotation,
  QuotationBankDetails,
  QuotationDefaults,
  QuotationFormat,
  QuotationTemplate,
} from "@/types/domain";
import {
  DEFAULT_QUOTATION,
  QUOTATION_FORMAT_META,
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
import { SITE, COMPANY_DETAILS } from "@/config/site";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PrintDocumentModel, PrintLine, PrintResult } from "@/lib/invoice-print";

export const QUOTATION_DESIGNER_CREDIT = "Designed by BSB Agency";

export interface QuotationPrintModel {
  quotation: Quotation;
  settings: QuotationDefaults;
  template: QuotationTemplate;
  partyLabel: string;
  partyGstin?: string | null;
  partyPhone?: string | null;
  partyEmail?: string | null;
  partyAddress?: string | null;
  lines: PrintLine[];
  cgst: number;
  sgst: number;
  igst: number;
}

export interface PaperMetrics {
  widthMm: number;
  heightMm: number;
  sizeCss: string;
  orientation: "portrait" | "landscape";
  label: string;
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

function compact(parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean);
}

function joinLine(parts: Array<string | null | undefined>, sep = ", "): string {
  return compact(parts).join(sep);
}

export function paperMetrics(settings: QuotationDefaults): PaperMetrics {
  const orientation = settings.orientation === "landscape" ? "landscape" : "portrait";
  let widthMm = 210;
  let heightMm = 297;
  let label = "A4";
  if (settings.paperSize === "a5") {
    widthMm = 148;
    heightMm = 210;
    label = "A5";
  } else if (settings.paperSize === "custom") {
    widthMm = settings.customWidthMm || 210;
    heightMm = settings.customHeightMm || 297;
    label = "Custom";
  } else if (settings.paperSize === "thermal") {
    widthMm = 80;
    heightMm = 297;
    label = "Thermal";
  }
  if (orientation === "landscape") {
    const nextWidth = heightMm;
    const nextHeight = widthMm;
    widthMm = nextWidth;
    heightMm = nextHeight;
  }
  const sizeCss =
    settings.paperSize === "custom" || settings.paperSize === "thermal"
      ? `${widthMm}mm ${settings.paperSize === "thermal" ? "auto" : `${heightMm}mm`}`
      : `${label} ${orientation}`;
  return { widthMm, heightMm, sizeCss, orientation, label };
}

function businessDisplayName(business: BusinessProfile): string {
  return (business.legalName || business.name || "").trim();
}

function businessAddress(business: BusinessProfile): string {
  return joinLine([business.address, business.city, business.state, business.pincode, business.country]);
}

function documentTitle(quotation: Quotation): string {
  if (quotation.format === "formal_proposal") {
    return (quotation.title || "Formal Proposal").trim() || "Formal Proposal";
  }
  return (quotation.title || "Quotation").trim() || "Quotation";
}

function documentKindLabel(format: QuotationFormat): string {
  return format === "formal_proposal" ? "FORMAL PROPOSAL" : "QUOTATION";
}

function watermarkLayer(settings: QuotationDefaults): string {
  if (!settings.watermarkEnabled) return "";
  const opacity = Math.min(0.35, Math.max(0.04, settings.watermarkOpacity));
  if (settings.watermarkMode === "image" && settings.watermarkImageUrl) {
    return `<div class="watermark" aria-hidden="true" style="opacity:${opacity}"><img src="${escapeHtml(settings.watermarkImageUrl)}" alt="" /></div>`;
  }
  const text = (settings.watermarkText || "QUOTATION").trim();
  if (!text) return "";
  return `<div class="watermark watermark-text" aria-hidden="true" style="opacity:${opacity}">${escapeHtml(text)}</div>`;
}

function brandingLogo(business: BusinessProfile, settings: QuotationDefaults): string {
  if (!settings.showLogo) return "";
  const src = settings.logoUrl || business.logoUrl;
  if (!src) return "";
  return `<img class="logo" src="${escapeHtml(src)}" alt="${escapeHtml(businessDisplayName(business))}" />`;
}

function filledBankFields(details: QuotationBankDetails): Array<{ label: string; value: string }> {
  return compact([
    details.accountName ? "accountName" : "",
    details.bankName ? "bankName" : "",
    details.branch ? "branch" : "",
    details.accountNumber ? "accountNumber" : "",
    details.ifsc ? "ifsc" : "",
    details.upi ? "upi" : "",
  ]).map((key) => {
    const map: Record<string, { label: string; value: string }> = {
      accountName: { label: "Account Name", value: details.accountName },
      bankName: { label: "Bank Name", value: details.bankName },
      branch: { label: "Branch", value: details.branch },
      accountNumber: { label: "Account Number", value: details.accountNumber },
      ifsc: { label: "IFSC", value: details.ifsc },
      upi: { label: "UPI ID", value: details.upi },
    };
    return map[key];
  });
}

function bankBlock(settings: QuotationDefaults): string {
  if (!settings.showBankDetails) return "";
  const rows = filledBankFields(settings.bankDetails);
  if (rows.length === 0) return "";
  const cells = rows
    .map(
      (row) =>
        `<div class="bank-row"><span class="bank-label">${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`
    )
    .join("");
  return `<section class="panel bank-panel keep-together"><h3>Bank Details</h3><div class="bank-grid">${cells}</div></section>`;
}

function signatureBlock(settings: QuotationDefaults): string {
  if (!settings.showSignature && !settings.showStamp) return "";
  const signature = settings.showSignature
    ? settings.signatureImageUrl
      ? `<img class="sign-img" src="${escapeHtml(settings.signatureImageUrl)}" alt="" />`
      : `<div class="sign-line"></div>`
    : "";
  const stamp =
    settings.showStamp && settings.stampImageUrl
      ? `<img class="stamp-img" src="${escapeHtml(settings.stampImageUrl)}" alt="" />`
      : "";
  const label = escapeHtml(settings.signatureLabel || "Authorised Signatory");
  return `<section class="sign-row keep-together">
    <div class="stamp-slot">${stamp}</div>
    <div class="sign">${signature}<div class="muted">${label}</div></div>
  </section>`;
}

function taxRows(model: QuotationPrintModel, currency: string): string {
  if (!model.settings.showTaxBreakup) {
    return `<div class="row"><span>GST</span><span>${escapeHtml(formatCurrency(model.quotation.taxTotal, currency))}</span></div>`;
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
  if (parts.length === 0) {
    parts.push(
      `<div class="row"><span>GST</span><span>${escapeHtml(formatCurrency(model.quotation.taxTotal, currency))}</span></div>`
    );
  }
  return parts.join("");
}

function lineTable(model: QuotationPrintModel, currency: string): string {
  const settings = model.settings;
  const colCount =
    5 + (settings.showSku ? 1 : 0) + (settings.showHsn ? 1 : 0) + (settings.showDiscount ? 1 : 0);
  const header = [
    "<th>Item</th>",
    settings.showSku ? "<th>SKU</th>" : "",
    settings.showHsn ? "<th>HSN/SAC</th>" : "",
    "<th class='num'>Qty</th>",
    "<th class='num'>Rate</th>",
    settings.showDiscount ? "<th class='num'>Disc</th>" : "",
    "<th class='num'>GST</th>",
    "<th class='num'>Amount</th>",
  ].join("");
  const rows = model.lines
    .map((line, index) => {
      const qty = line.unit ? `${line.quantity} ${escapeHtml(line.unit)}` : String(line.quantity);
      const description = (line.description ?? "").trim();
      const name = `<div class="item-name">${escapeHtml(line.name)}</div>${
        description ? `<div class="item-desc">${nl2br(description)}</div>` : ""
      }`;
      return `<tr>
        <td>${index + 1}. ${name}</td>
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
  return `<table class="items">
    <thead><tr>${header}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${colCount}" class="muted">No line items.</td></tr>`}</tbody>
  </table>`;
}

function section(title: string, body: string | null | undefined, enabled = true): string {
  const text = (body ?? "").trim();
  if (!enabled || !text) return "";
  return `<section class="panel"><h3>${escapeHtml(title)}</h3><p>${nl2br(text)}</p></section>`;
}

function businessIdentity(
  business: BusinessProfile,
  settings: QuotationDefaults
): { gstin: string; pan: string; phone: string; email: string; website: string } {
  return {
    gstin: settings.showGstin && business.gstin ? business.gstin : "",
    pan: business.pan || "",
    phone: business.phone || "",
    email: business.email || "",
    website: business.website || "",
  };
}

function headerBlock(business: BusinessProfile, model: QuotationPrintModel): string {
  const settings = model.settings;
  const q = model.quotation;
  const name = businessDisplayName(business);
  const address = businessAddress(business);
  const identity = businessIdentity(business, settings);
  const taxBits = joinLine(
    [
      identity.gstin ? `GSTIN ${identity.gstin}` : "",
      identity.pan ? `PAN ${identity.pan}` : "",
    ],
    "  ·  "
  );
  const contactBits = joinLine(
    [identity.phone, identity.email, identity.website],
    "  ·  "
  );
  return `<header class="doc-header">
    <div class="brand">
      ${brandingLogo(business, settings)}
      <div>
        <div class="brand-name">${escapeHtml(name)}</div>
        <div class="tagline">${escapeHtml(SITE.tagline)}</div>
        ${address ? `<div class="muted">${escapeHtml(address)}</div>` : ""}
        ${contactBits ? `<div class="muted">${escapeHtml(contactBits)}</div>` : ""}
        ${taxBits ? `<div class="muted">${escapeHtml(taxBits)}</div>` : ""}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-kind">${escapeHtml(documentKindLabel(q.format))}</div>
      <div class="doc-title">${escapeHtml(documentTitle(q))}</div>
      <div class="meta-grid">
        <div><span class="muted">Quotation no.</span><strong>${escapeHtml(q.quotationNo)}</strong></div>
        <div><span class="muted">Date</span><strong>${escapeHtml(formatDate(q.quotationDate))}</strong></div>
        ${
          q.validUntil
            ? `<div><span class="muted">Valid until</span><strong>${escapeHtml(formatDate(q.validUntil))}</strong></div>`
            : ""
        }
      </div>
    </div>
  </header>`;
}

function recipientBlock(model: QuotationPrintModel): string {
  const gstin =
    model.settings.showGstin && model.partyGstin ? `GSTIN ${model.partyGstin}` : "";
  const contact = joinLine([model.partyPhone, model.partyEmail], "  ·  ");
  return `<section class="parties">
    <div>
      <h3>Prepared For</h3>
      <div class="party-name">${escapeHtml(model.partyLabel)}</div>
      ${model.partyAddress ? `<div class="muted">${escapeHtml(model.partyAddress)}</div>` : ""}
      ${contact ? `<div class="muted">${escapeHtml(contact)}</div>` : ""}
      ${gstin ? `<div class="muted">${escapeHtml(gstin)}</div>` : ""}
    </div>
    <div>
      <h3>Subject</h3>
      <div class="party-name">${escapeHtml(documentTitle(model.quotation))}</div>
      ${
        model.quotation.validUntil
          ? `<div class="muted">Offer valid until ${escapeHtml(formatDate(model.quotation.validUntil))}</div>`
          : ""
      }
    </div>
  </section>`;
}

function footerInner(business: BusinessProfile, model: QuotationPrintModel): string {
  const address = businessAddress(business);
  const contact = joinLine([business.phone, business.email, business.website], "  ·  ");
  const extra = (model.settings.footerNote || model.template.footerNote || "").trim();
  return `${address ? `<div>${escapeHtml(address)}</div>` : ""}
    ${contact ? `<div>${escapeHtml(contact)}</div>` : ""}
    ${extra ? `<div class="footer-note">${escapeHtml(extra)}</div>` : ""}
    <div class="credit">${escapeHtml(QUOTATION_DESIGNER_CREDIT)}</div>
    <div class="page-ref">${escapeHtml(businessDisplayName(business))} · ${escapeHtml(model.quotation.quotationNo)}</div>`;
}

function footerBlock(business: BusinessProfile, model: QuotationPrintModel): string {
  return `<footer class="doc-footer">${footerInner(business, model)}</footer>`;
}

function coverPage(business: BusinessProfile, model: QuotationPrintModel, currency: string): string {
  const q = model.quotation;
  return `<section class="sheet cover">
    ${watermarkLayer(model.settings)}
    ${brandingLogo(business, model.settings)}
    <p class="muted">${escapeHtml(QUOTATION_FORMAT_META[q.format].label)}</p>
    <div class="doc-kind">${escapeHtml(documentKindLabel(q.format))}</div>
    <h1>${escapeHtml(documentTitle(q))}</h1>
    <p class="lead">Prepared for ${escapeHtml(model.partyLabel)}</p>
    <p class="brand-name">${escapeHtml(businessDisplayName(business))}</p>
    <p class="muted">${escapeHtml(businessAddress(business))}</p>
    <div class="meta">
      <div><span class="muted">Reference</span><strong>${escapeHtml(q.quotationNo)}</strong></div>
      <div><span class="muted">Date</span><strong>${escapeHtml(formatDate(q.quotationDate))}</strong></div>
      <div><span class="muted">Valid until</span><strong>${escapeHtml(q.validUntil ? formatDate(q.validUntil) : "—")}</strong></div>
      <div><span class="muted">Grand Total</span><strong>${escapeHtml(formatCurrency(q.total, currency))}</strong></div>
    </div>
    ${footerBlock(business, model)}
  </section>`;
}

function quotationBodyHtml(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency: string
): string {
  const q = model.quotation;
  const settings = model.settings;
  const intro = (q.intro || model.template.introHtml || "").trim();
  const terms = (q.termsAndConditions || settings.termsAndConditions || model.template.termsAndConditions || "").trim();
  const paymentTerms = paymentTermsFrom(q, terms);
  const showProposal = q.format === "formal_proposal";
  const cover =
    showProposal && model.template.showCover ? coverPage(business, model, currency) : "";

  return `${cover}<section class="sheet">
  ${watermarkLayer(settings)}
  ${headerBlock(business, model)}
  ${recipientBlock(model)}
  ${intro ? `<section class="panel"><h3>Introduction</h3><p>${nl2br(intro)}</p></section>` : ""}
  ${section("Scope of Work", q.scope, showProposal && model.template.showScope)}
  ${section("Project Description", q.scope, !showProposal)}
  ${section("Timeline", q.timeline, showProposal && model.template.showTimeline)}
  ${section("Assumptions", q.assumptions, showProposal && model.template.showAssumptions)}
  <h3 class="table-heading">Product / Service Cost Estimation</h3>
  ${lineTable(model, currency)}
  <div class="totals-wrap keep-together">
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(q.subtotal, currency))}</span></div>
      ${
        settings.showDiscount && q.discount > 0
          ? `<div class="row"><span>Discount</span><span>${escapeHtml(formatCurrency(q.discount, currency))}</span></div>`
          : ""
      }
      ${taxRows(model, currency)}
      <div class="row total"><span>Grand Total</span><span>${escapeHtml(formatCurrency(q.total, currency))}</span></div>
    </div>
  </div>
  ${section("Notes / Additional Charges", q.notes, Boolean(q.notes))}
  ${section("Terms and Conditions", terms, Boolean(terms))}
  ${section("Payment Terms", paymentTerms, Boolean(paymentTerms))}
  ${section(
    "Delivery Terms",
    q.timeline,
    Boolean(q.timeline) && !(showProposal && model.template.showTimeline)
  )}
  ${bankBlock(settings)}
  ${signatureBlock(settings)}
  ${footerBlock(business, model)}
</section>`;
}

function paymentTermsFrom(quotation: Quotation, terms: string): string {
  const labeled = terms
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /^payment(\s+terms)?\s*[:\-]/i.test(line));
  if (labeled) {
    return labeled.replace(/^payment(\s+terms)?\s*[:\-]\s*/i, "").trim();
  }
  const notes = (quotation.notes ?? "").trim();
  if (/in advance/i.test(notes) || /payment terms/i.test(notes)) return notes;
  return "";
}

function quotationCss(settings: QuotationDefaults): string {
  const paper = paperMetrics(settings);
  const pageMargin = settings.paperSize === "a5" ? "5mm 6mm 4mm 6mm" : "10mm 12mm 8mm 12mm";
  return `
  @page { size: ${paper.sizeCss}; margin: ${pageMargin}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Source Sans 3", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
    color: #1b2430;
    background: #dfe3ea;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: 0.01em; }
  h3 { font-size: 10px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; color: #5b6573; font-weight: 700; }
  p { margin: 0; line-height: 1.4; font-size: 12px; }
  .doc-root { width: ${paper.widthMm}mm; margin: 12px auto; border-collapse: collapse; background: #fff; box-shadow: 0 8px 24px rgba(16, 24, 40, 0.08); }
  .doc-root > tbody > tr > td { padding: 0; }
  .doc-root > tfoot { display: none; }
  .sheet {
    position: relative;
    width: ${paper.widthMm}mm;
    min-height: ${paper.heightMm}mm;
    margin: 0;
    background: #fff;
    padding: 10mm 12mm 26mm;
    overflow: visible;
  }
  .sheet.cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; min-height: ${paper.heightMm}mm; }
  .sheet:last-of-type { page-break-after: auto; }
  .doc-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 2px solid #1b2430; padding-bottom: 10px; margin-bottom: 12px; background: #fff; }
  .brand { display: flex; gap: 12px; align-items: flex-start; min-width: 0; flex: 1; }
  .brand-name { font-size: 18px; font-weight: 700; line-height: 1.2; color: #102033; }
  .tagline { font-size: 11px; color: #5b6573; margin: 2px 0 6px; font-style: italic; }
  .logo { max-height: 56px; max-width: 140px; width: auto; height: auto; object-fit: contain; display: block; flex-shrink: 0; }
  .doc-meta { text-align: right; min-width: 168px; max-width: 40%; flex-shrink: 0; background: #fff; }
  .doc-kind { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; color: #1d4ed8; margin-bottom: 4px; }
  .doc-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; line-height: 1.25; }
  .meta-grid { display: grid; gap: 4px; justify-items: end; }
  .meta-grid strong, .party-name { display: block; font-size: 12px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0 0 12px; padding: 8px 0; border-bottom: 1px solid #e4e7ec; background: #fff; }
  .muted { color: #5b6573; font-size: 11px; margin: 2px 0; }
  .panel { margin: 8px 0; background: #fff; }
  .table-heading { margin: 10px 0 0; background: #fff; }
  table.items { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 6px; background: #fff; }
  table.items thead { display: table-header-group; }
  table.items th, table.items td { border-bottom: 1px solid #e4e7ec; padding: 6px 7px; text-align: left; vertical-align: top; background: #fff; }
  table.items th { background: #f3f5f8; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  table.items tr { page-break-inside: avoid; break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .item-name { font-weight: 600; }
  .item-desc { color: #5b6573; font-size: 10.5px; margin-top: 2px; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; background: #fff; }
  .totals { width: 250px; background: #fff; }
  .row { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; padding: 2px 0; }
  .total { font-weight: 800; border-top: 2px solid #1b2430; padding-top: 6px; margin-top: 4px; font-size: 13px; }
  .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .bank-row { display: flex; flex-direction: column; font-size: 12px; }
  .bank-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6573; }
  .sign-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 16px; background: #fff; }
  .sign { width: 180px; text-align: center; }
  .sign-line { border-top: 1px solid #c9cdd4; margin: 28px 0 4px; }
  .sign-img { max-height: 48px; max-width: 140px; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto 4px; }
  .stamp-img { max-height: 64px; max-width: 64px; width: auto; height: auto; object-fit: contain; display: block; }
  .keep-together { page-break-inside: avoid; break-inside: avoid; }
  .watermark {
    position: absolute;
    inset: 26% 8% 30%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
  }
  .watermark img { max-width: 46%; max-height: 34%; width: auto; height: auto; object-fit: contain; }
  .watermark-text { font-size: 48px; font-weight: 800; letter-spacing: 0.18em; transform: rotate(-28deg); white-space: nowrap; color: #98a2b3; }
  .sheet > *:not(.watermark):not(.doc-footer) { position: relative; z-index: 1; }
  .cover h1 { font-size: 28px; margin: 8px 0; }
  .lead { font-size: 16px; margin: 8px 0; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; max-width: 420px; }
  .doc-footer, .print-footer {
    text-align: center;
    font-size: 9.5px;
    color: #5b6573;
    border-top: 1px solid #d0d5dd;
    padding-top: 5px;
    line-height: 1.35;
    background: #fff;
  }
  .doc-footer {
    position: absolute;
    left: 12mm;
    right: 12mm;
    bottom: 8mm;
    z-index: 2;
  }
  .credit { margin-top: 3px; font-weight: 700; letter-spacing: 0.04em; color: #1b2430; font-size: 9px; }
  .page-ref { margin-top: 2px; font-size: 8.5px; }
  .print-watermark { display: none; }
  .paper-a5 .sheet { padding: 5mm 6mm 18mm; }
  .paper-a5 .doc-header { gap: 6px; padding-bottom: 4px; margin-bottom: 6px; }
  .paper-a5 .brand { gap: 6px; }
  .paper-a5 .brand-name { font-size: 12px; }
  .paper-a5 .tagline { font-size: 8px; margin: 0 0 2px; }
  .paper-a5 .doc-title { font-size: 10px; margin-bottom: 2px; }
  .paper-a5 .logo { max-height: 24px; max-width: 64px; }
  .paper-a5 table.items { font-size: 8.5px; }
  .paper-a5 table.items th, .paper-a5 table.items td { padding: 2px 3px; }
  .paper-a5 .doc-meta { min-width: 104px; max-width: 36%; }
  .paper-a5 .doc-kind { font-size: 9px; margin-bottom: 2px; }
  .paper-a5 .muted { font-size: 8px; }
  .paper-a5 .panel { margin: 3px 0; }
  .paper-a5 .parties { margin-bottom: 4px; padding: 3px 0; gap: 6px; }
  .paper-a5 .sign-row { margin-top: 4px; gap: 12px; }
  .paper-a5 .sign { width: 120px; }
  .paper-a5 .sign-line { margin: 8px 0 2px; }
  .paper-a5 .sign-img { max-height: 18px; max-width: 72px; }
  .paper-a5 .stamp-img { max-height: 22px; max-width: 22px; }
  .paper-a5 .doc-footer, .paper-a5 .print-footer { left: 6mm; right: 6mm; bottom: 4mm; font-size: 7.5px; padding-top: 3px; }
  .paper-a5 .credit { font-size: 8px; margin-top: 1px; }
  .paper-a5 .page-ref { font-size: 7px; }
  .paper-a5 h3 { font-size: 8px; margin-bottom: 1px; }
  .paper-a5 p, .paper-a5 .row { font-size: 9px; }
  .paper-a5 .keep-together { page-break-inside: auto; break-inside: auto; }
  .paper-a5 .bank-grid { gap: 1px 8px; }
  .paper-a5 .bank-row { font-size: 8.5px; }
  .paper-a5 .bank-label { font-size: 7.5px; }
  .paper-a5 .totals { width: 180px; }
  .paper-a5 .totals-wrap { margin-top: 4px; }
  .paper-a5 .watermark-text { font-size: 28px; }
  .paper-a5 .table-heading { margin: 6px 0 0; }
  .paper-a5 .meta-grid { gap: 2px; }
  @media print {
    body { background: #fff; }
    .doc-root {
      width: 100%;
      margin: 0;
      box-shadow: none;
      position: relative;
      z-index: 1;
      background: transparent;
    }
    .doc-root > tfoot { display: table-footer-group; }
    .sheet {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 0 0 3mm;
      box-shadow: none;
      overflow: visible;
      background: transparent;
    }
    .sheet.cover { min-height: auto; page-break-after: always; }
    .sheet .watermark, .sheet .doc-footer { display: none; }
    .print-watermark {
      display: flex;
      position: fixed;
      inset: 22% 8% 26%;
      z-index: 0;
      pointer-events: none;
      align-items: center;
      justify-content: center;
    }
    .print-watermark .watermark { position: static; inset: auto; }
    .print-footer {
      display: block;
      position: relative;
      z-index: 3;
      padding: 4px 0 0;
      background: transparent;
    }
  }
`;
}

export function quotationPrintHtml(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): string {
  const paperClass =
    model.settings.paperSize === "a5" ? "paper-a5" : model.settings.paperSize === "custom" ? "paper-custom" : "paper-a4";
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(model.quotation.quotationNo)}</title>
<style>${quotationCss(model.settings)}</style></head><body class="${paperClass}">
  <div class="print-watermark">${watermarkLayer(model.settings)}</div>
  <table class="doc-root">
    <tbody>
      <tr><td>${quotationBodyHtml(business, model, currency)}</td></tr>
    </tbody>
    <tfoot>
      <tr><td><div class="print-footer">${footerInner(business, model)}</div></td></tr>
    </tfoot>
  </table>
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

export function shareQuotationEmail(
  business: BusinessProfile,
  model: QuotationPrintModel,
  currency = business.currency || "INR"
): { ok: boolean; url: string } {
  const heading = documentTitle(model.quotation);
  const subject = `${heading} ${model.quotation.quotationNo} — ${businessDisplayName(business)}`;
  const body = [
    `Dear ${model.partyLabel},`,
    "",
    `Please find ${heading} ${model.quotation.quotationNo} dated ${formatDate(model.quotation.quotationDate)}.`,
    `Grand Total: ${formatCurrency(model.quotation.total, currency)}`,
    model.quotation.validUntil ? `Valid until: ${formatDate(model.quotation.validUntil)}` : "",
    "",
    businessDisplayName(business),
    COMPANY_DETAILS.name,
  ]
    .filter((line) => line !== "")
    .join("\n");
  const url = `mailto:${encodeURIComponent(model.partyEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (typeof window !== "undefined" && model.partyEmail) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return { ok: Boolean(model.partyEmail), url };
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
