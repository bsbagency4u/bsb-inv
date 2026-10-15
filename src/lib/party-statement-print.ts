import { formatCurrency, formatDate } from "@/lib/utils";
import type { LedgerLine, PartyBalance } from "@/lib/party-ledger";
import type { BusinessProfile } from "@/types/domain";

function writePrintFrame(html: string): { ok: boolean } {
  if (typeof document === "undefined") return { ok: false };
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
    return { ok: false };
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
    return { ok: false };
  }
}

export function printPartyStatement(input: {
  business: BusinessProfile;
  partyName: string;
  kind: "customer" | "supplier";
  lines: LedgerLine[];
  balance: PartyBalance;
  currency: string;
}): { ok: boolean } {
  const title = input.kind === "customer" ? "Customer statement" : "Supplier statement";
  const rows = input.lines
    .map(
      (line) => `<tr>
        <td>${formatDate(line.date === "1970-01-01" ? null : line.date)}</td>
        <td>${line.documentNo}</td>
        <td>${line.typeLabel}</td>
        <td class="num">${line.debit ? formatCurrency(line.debit, input.currency) : ""}</td>
        <td class="num">${line.credit ? formatCurrency(line.credit, input.currency) : ""}</td>
        <td class="num">${formatCurrency(line.balance, input.currency)}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} — ${input.partyName}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #101828; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 16px; font-size: 12px; color: #667085; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #e4e7ec; padding: 6px 8px; text-align: left; }
  th { color: #667085; font-weight: 600; text-transform: uppercase; font-size: 10px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 2px 0; }
  .total { font-weight: 700; border-top: 1px solid #e4e7ec; margin-top: 6px; padding-top: 6px; }
</style></head><body>
  <h1>${title}</h1>
  <p>${input.business.name} · ${input.partyName}</p>
  <table>
    <thead><tr><th>Date</th><th>Document</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">No ledger entries.</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Opening</span><span>${formatCurrency(input.balance.opening, input.currency)}</span></div>
    <div class="row"><span>Invoiced</span><span>${formatCurrency(input.balance.invoiced, input.currency)}</span></div>
    <div class="row"><span>Returned</span><span>${formatCurrency(input.balance.returned, input.currency)}</span></div>
    <div class="row"><span>Paid</span><span>${formatCurrency(input.balance.paid, input.currency)}</span></div>
    <div class="row"><span>Advance</span><span>${formatCurrency(input.balance.advance, input.currency)}</span></div>
    <div class="row total"><span>Outstanding</span><span>${formatCurrency(input.balance.outstanding, input.currency)}</span></div>
  </div>
</body></html>`;
  return writePrintFrame(html);
}
