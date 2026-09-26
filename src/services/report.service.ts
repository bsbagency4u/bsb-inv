import type { Repositories } from "@/repositories/types";
import type {
  GstReportRow,
  ReportPeriod,
  SalesReportRow,
  StockReportRow,
  StockMovementType,
} from "@/types/domain";
import { GstEngine } from "./gst.service";
import { runStockReport, listStockReportDefinitions } from "@/reports/engine";
import type { ReportCatalog } from "@/reports/engine";
import type {
  ReportDefinition,
  ReportResult,
  StockFilterOptions,
  StockReportQuery,
} from "@/reports/types";
import { DEFAULT_PAGE_SIZE } from "@/reports/stock-math";

const MOVEMENT_TYPE_LABELS: { value: StockMovementType; label: string }[] = [
  { value: "OPENING", label: "Opening" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "PURCHASE_RETURN", label: "Purchase return" },
  { value: "SALE_RETURN", label: "Sale return" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "TRANSFER_IN", label: "Transfer in" },
  { value: "TRANSFER_OUT", label: "Transfer out" },
  { value: "SCRAP", label: "Scrap" },
];

const STOCK_STATUSES = [
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "negative", label: "Negative" },
];

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

  listStockReportDefinitions(): ReportDefinition[] {
    return listStockReportDefinitions();
  }

  private async loadCatalog(businessId: string): Promise<ReportCatalog> {
    const [products, movements, batches, warehouses, locations, categories, brands] =
      await Promise.all([
        this.repos.products.listProducts(businessId),
        this.repos.products.listMovements(businessId, undefined, 20_000),
        this.repos.products.listBatches(businessId),
        this.repos.inventory.listWarehouses(businessId),
        this.repos.inventory.listLocations(businessId),
        this.repos.products.listCategories(businessId),
        this.repos.inventory.listBrands(businessId),
      ]);
    return { products, movements, batches, warehouses, locations, categories, brands };
  }

  async runStockReport(businessId: string, query: StockReportQuery): Promise<ReportResult> {
    const catalog = await this.loadCatalog(businessId);
    let movements = catalog.movements;
    if (query.supplierId) {
      const [purchases, purchaseReturns] = await Promise.all([
        this.repos.transactions.listPurchaseInvoices(businessId),
        this.repos.transactions.listPurchaseReturns(businessId),
      ]);
      const allowed = new Set<string>();
      for (const invoice of purchases) {
        if (invoice.supplierId === query.supplierId) allowed.add(invoice.id);
      }
      for (const ret of purchaseReturns) {
        if (ret.supplierId === query.supplierId) allowed.add(ret.id);
      }
      movements = movements.filter(
        (movement) => !movement.referenceId || allowed.has(movement.referenceId)
      );
    }
    return runStockReport({ ...catalog, movements }, {
      ...query,
      page: query.page || 1,
      pageSize: query.pageSize || DEFAULT_PAGE_SIZE,
    });
  }

  async stockFilterOptions(businessId: string): Promise<StockFilterOptions> {
    const catalog = await this.loadCatalog(businessId);
    return {
      warehouses: catalog.warehouses.map((item) => ({ value: item.id, label: item.name })),
      locations: catalog.locations.map((item) => ({
        value: item.id,
        label: item.name,
        warehouseId: item.warehouseId,
      })),
      categories: catalog.categories.map((item) => ({ value: item.id, label: item.name })),
      brands: catalog.brands.map((item) => ({ value: item.id, label: item.name })),
      products: catalog.products.map((item) => ({
        value: item.id,
        label: item.sku ? `${item.name} (${item.sku})` : item.name,
      })),
      suppliers: (await this.repos.parties.listSuppliers(businessId)).map((item) => ({
        value: item.id,
        label: item.name,
      })),
      batches: catalog.batches.map((item) => ({ value: item.id, label: item.batchNo })),
      statuses: STOCK_STATUSES,
      movementTypes: MOVEMENT_TYPE_LABELS.map((item) => ({ value: item.value, label: item.label })),
    };
  }
}
