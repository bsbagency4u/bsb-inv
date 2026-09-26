import type { ReportColumn, ReportResult, ReportRow } from "./types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function cellText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function reportToCsv(result: ReportResult): string {
  const header = result.columns.map((column) => csvEscape(column.label)).join(",");
  const lines = result.rows.map((row) =>
    result.columns.map((column) => csvEscape(cellText(row[column.key]))).join(",")
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printReport(title: string, columns: ReportColumn[], rows: ReportRow[]): void {
  const header = columns.map((column) => `<th>${column.label}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${cellText(row[column.key]) || "—"}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>${title}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #131722; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e4e7ec; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
</style></head><body>
<h1>${title}</h1>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
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
