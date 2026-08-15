import type { Repositories } from "@/repositories/types";
import type {
  GstReportRow,
  ReportPeriod,
  SalesReportRow,
  StockReportRow,
} from "@/types/domain";
import { GstEngine } from "./gst.service";

/**
 * Reporting service — aggregates repository data into report shapes.
 * Pure aggregation; no Supabase or UI dependencies.
 */
export class ReportService {
  private gst = new GstEngine();

  constructor(private repos: Repositories) {}

  private partyName(
    customers: { id: string; name: string }[],
    suppliers: { id: string; name: string }[],
    partyType: "customer" | "supplier",
    id: string | null
  ): string {
    if (!id) return "Walk-in";
    const list = partyType === "customer" ? customers : suppliers;
    return list.find((p) => p.id === id)?.name ?? "Unknown";
  }

  async salesReport(businessId: string, period: ReportPeriod): Promise<SalesReportRow[]> {
    const [invoices, customers] = await Promise.all([
      this.repos.transactions.listSalesInvoices(businessId),
      this.repos.parties.listCustomers(businessId),
    ]);
    return invoices
      .filter((i) => i.invoiceDate >= period.from && i.invoiceDate <= period.to)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
      .map((invoice) => ({
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        customerId: invoice.customerId,
        customerName: this.partyName(customers, [], "customer", invoice.customerId),
        total: invoice.total,
        taxTotal: invoice.taxTotal,
        status: invoice.status,
      }));
  }

  async stockReport(businessId: string): Promise<StockReportRow[]> {
    const products = await this.repos.products.listProducts(businessId);
    const stock = await this.repos.products.listStock(businessId);
    const byProduct = new Map(stock.map((s) => [s.productId, s.quantity]));
    return products.map((product) => {
      const quantity = byProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity,
        purchasePrice: product.purchasePrice,
        stockValue: quantity * product.purchasePrice,
        lowStockThreshold: product.lowStockThreshold,
      };
    });
  }

  async gstReport(businessId: string, period: ReportPeriod): Promise<GstReportRow[]> {
    const invoices = await this.repos.transactions.listSalesInvoices(businessId);
    return invoices
      .filter((i) => i.invoiceDate >= period.from && i.invoiceDate <= period.to)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
      .map((invoice) => {
        const lines = this.gst.gstLinesFromItems(invoice.items, true);
        return {
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.invoiceDate,
          taxableAmount: invoice.subtotal,
          taxAmount: invoice.taxTotal,
          cgst: lines.reduce((sum, line) => sum + line.cgst, 0),
          sgst: lines.reduce((sum, line) => sum + line.sgst, 0),
          igst: lines.reduce((sum, line) => sum + line.igst, 0),
        };
      });
  }
}
