import type { Repositories } from "@/repositories/types";
import type {
  GstRegistrationType,
  GstReportRow,
  Payment,
  ReportPeriod,
  SalesReportRow,
  StockReportRow,
  StockMovementType,
} from "@/types/domain";
import { LedgerService, type OutstandingFilters } from "./ledger.service";
import { runStockReport, listStockReportDefinitions } from "@/reports/engine";
import type { ReportCatalog } from "@/reports/engine";
import type {
  ReportDefinition,
  ReportResult,
  StockFilterOptions,
  StockReportQuery,
} from "@/reports/types";
import { DEFAULT_PAGE_SIZE } from "@/reports/stock-math";
import { DOCUMENT_CONTROL_KEY, parseDocumentControlDefaults } from "@/lib/document-control";
import { sumPurchases, sumSales } from "@/lib/dashboard";
import {
  advanceTotals,
  cashMovement,
  customerReconSummaries,
  overdueFromRows,
  outstandingTotal,
  periodPaymentRows,
  postedPeriodPurchases,
  postedPeriodSales,
  supplierReconSummaries,
  type CashMovement,
  type AdvanceTotals,
  type PartyReconSummary,
} from "@/lib/finance";
import { customerOutstanding, supplierOutstanding, type OutstandingRow } from "@/lib/party-ledger";
import {
  booksPurchaseRegister,
  booksSalesRegister,
  filingCapability,
  GST_RECON_NOTES_KEY,
  gstTotals,
  notesForPeriod,
  parseGstReconNotes,
  salesReturnCreditNotes,
  type GstBooksLine,
  type GstFilingCapability,
  type GstReconNote,
} from "@/lib/gst-recon";
import {
  buildGstr3b,
  buildGstr4,
  debitNoteLines,
  hsnFromInvoices,
  rateWiseFromInvoices,
  splitB2bB2c,
  type Gstr3bResult,
  type Gstr4Result,
  type GstHsnRow,
  type GstRateRow,
} from "@/lib/gst-reports";


export interface FinanceSnapshot {
  period: ReportPeriod;
  registrationType: GstRegistrationType;
  filing: GstFilingCapability;
  salesTotal: number;
  purchaseTotal: number;
  salesCount: number;
  purchaseCount: number;
  receivables: OutstandingRow[];
  payables: OutstandingRow[];
  receivableTotal: number;
  payableTotal: number;
  receivableOverdue: number;
  payableOverdue: number;
  cash: CashMovement;
  advances: AdvanceTotals;
  payments: Payment[];
  customers: PartyReconSummary[];
  suppliers: PartyReconSummary[];
  salesGst: GstBooksLine[];
  purchaseGst: GstBooksLine[];
  creditNotes: GstBooksLine[];
  salesGstTotals: ReturnType<typeof gstTotals>;
  purchaseGstTotals: ReturnType<typeof gstTotals>;
  reconNotes: GstReconNote[];
  lockedSalesCount: number;
  lockedPurchaseCount: number;
}

export interface GstReportsSnapshot {
  period: ReportPeriod;
  registrationType: GstRegistrationType;
  filing: GstFilingCapability;
  sales: GstBooksLine[];
  purchases: GstBooksLine[];
  creditNotes: GstBooksLine[];
  debitNotes: GstBooksLine[];
  salesTotals: ReturnType<typeof gstTotals>;
  purchaseTotals: ReturnType<typeof gstTotals>;
  creditTotals: ReturnType<typeof gstTotals>;
  gstr3b: Gstr3bResult;
  gstr4: Gstr4Result;
  hsn: GstHsnRow[];
  rateWise: GstRateRow[];
  b2b: GstBooksLine[];
  b2c: GstBooksLine[];
  b2bTotals: ReturnType<typeof gstTotals>;
  b2cTotals: ReturnType<typeof gstTotals>;
  lockedSalesCount: number;
  lockedPurchaseCount: number;
}

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
  private ledger: LedgerService;

  constructor(private repos: Repositories) {
    this.ledger = new LedgerService(repos);
  }

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

  async receivables(businessId: string, filters: OutstandingFilters = {}) {
    return this.ledger.receivables(businessId, filters);
  }

  async payables(businessId: string, filters: OutstandingFilters = {}) {
    return this.ledger.payables(businessId, filters);
  }

  async gstReport(businessId: string, period: ReportPeriod): Promise<GstReportRow[]> {
    const [invoices, customers] = await Promise.all([
      this.repos.transactions.listSalesInvoices(businessId),
      this.repos.parties.listCustomers(businessId),
    ]);
    const byCustomer = new Map(customers.map((customer) => [customer.id, customer]));
    return invoices
      .filter(
        (i) =>
          i.invoiceDate >= period.from &&
          i.invoiceDate <= period.to &&
          i.status !== "cancelled"
      )
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
      .map((invoice) => {
        const customer = invoice.customerId ? byCustomer.get(invoice.customerId) : null;
        const intraState = invoice.intraState ?? true;
        const taxAmount = invoice.taxTotal;
        return {
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.invoiceDate,
          customerName: this.partyName(customers, [], "customer", invoice.customerId),
          customerGstin: customer?.gstin ?? null,
          documentType: invoice.gstDocumentType ?? "tax_invoice",
          placeOfSupplyState: invoice.placeOfSupplyState ?? customer?.placeOfSupplyState ?? null,
          reverseCharge: invoice.reverseCharge ?? false,
          taxableAmount: Math.max(0, invoice.total - taxAmount),
          taxAmount,
          cgst: intraState ? taxAmount / 2 : 0,
          sgst: intraState ? taxAmount / 2 : 0,
          igst: intraState ? 0 : taxAmount,
        };
      });
  }

  async financeSnapshot(businessId: string, period: ReportPeriod, today?: string): Promise<FinanceSnapshot> {
    const [books, business, lockStored, notesStored] = await Promise.all([
      this.ledger.loadBooks(businessId),
      this.repos.businesses.getById(businessId),
      this.repos.businesses.getSetting(businessId, DOCUMENT_CONTROL_KEY),
      this.repos.businesses.getSetting(businessId, GST_RECON_NOTES_KEY),
    ]);
    if (!business) throw new Error("Business not found.");

    const customerNames = new Map(books.customers.map((customer) => [customer.id, customer.name]));
    const supplierNames = new Map(books.suppliers.map((supplier) => [supplier.id, supplier.name]));
    const customerGstin = new Map(books.customers.map((customer) => [customer.id, customer.gstin]));
    const supplierGstin = new Map(books.suppliers.map((supplier) => [supplier.id, supplier.gstin]));
    const lockSettings = parseDocumentControlDefaults(lockStored);
    const registrationType = business.gstRegistrationType;
    const capability = filingCapability(registrationType);

    const receivables = customerOutstanding(
      books.sales,
      books.payments,
      books.salesReturns,
      customerNames,
      today
    );
    const payables = supplierOutstanding(
      books.purchases,
      books.payments,
      books.purchaseReturns,
      supplierNames,
      today
    );
    const receivableOverdue = overdueFromRows(receivables);
    const payableOverdue = overdueFromRows(payables);
    const cash = cashMovement(books.payments, period);
    const advances = advanceTotals(books.payments);
    const salesLines = booksSalesRegister(
      books.sales,
      period,
      customerNames,
      customerGstin,
      lockSettings
    );
    const purchaseLines = booksPurchaseRegister(
      books.purchases,
      period,
      supplierNames,
      supplierGstin,
      lockSettings
    );
    const creditNotes = salesReturnCreditNotes(books.salesReturns, books.sales, period, customerNames);
    const notes = notesForPeriod(parseGstReconNotes(notesStored), period);

    return {
      period,
      registrationType,
      filing: capability,
      salesTotal: sumSales(books.sales, period.from, period.to),
      purchaseTotal: sumPurchases(books.purchases, period.from, period.to),
      salesCount: postedPeriodSales(books.sales, period).length,
      purchaseCount: postedPeriodPurchases(books.purchases, period).length,
      receivables,
      payables,
      receivableTotal: outstandingTotal(receivables),
      payableTotal: outstandingTotal(payables),
      receivableOverdue: receivableOverdue.total,
      payableOverdue: payableOverdue.total,
      cash,
      advances,
      payments: periodPaymentRows(books.payments, period),
      customers: customerReconSummaries(books.customers, books.sales, books.salesReturns, books.payments, today),
      suppliers: supplierReconSummaries(books.suppliers, books.purchases, books.purchaseReturns, books.payments, today),
      salesGst: salesLines,
      purchaseGst: purchaseLines,
      creditNotes,
      salesGstTotals: gstTotals(salesLines),
      purchaseGstTotals: gstTotals(purchaseLines),
      reconNotes: notes,
      lockedSalesCount: salesLines.filter((line) => line.locked).length,
      lockedPurchaseCount: purchaseLines.filter((line) => line.locked).length,
    };
  }

  async gstReportsSnapshot(businessId: string, period: ReportPeriod): Promise<GstReportsSnapshot> {
    const snapshot = await this.financeSnapshot(businessId, period);
    const books = await this.ledger.loadBooks(businessId);
    const split = splitB2bB2c(snapshot.salesGst);
    const debitNotes = debitNoteLines(snapshot.salesGst, snapshot.purchaseGst);
    return {
      period,
      registrationType: snapshot.registrationType,
      filing: snapshot.filing,
      sales: snapshot.salesGst,
      purchases: snapshot.purchaseGst,
      creditNotes: snapshot.creditNotes,
      debitNotes,
      salesTotals: snapshot.salesGstTotals,
      purchaseTotals: snapshot.purchaseGstTotals,
      creditTotals: gstTotals(snapshot.creditNotes),
      gstr3b: buildGstr3b({
        sales: snapshot.salesGst,
        creditNotes: snapshot.creditNotes,
        purchaseTotals: snapshot.purchaseGstTotals,
        itcAllowed: snapshot.filing.itcAllowed,
      }),
      gstr4: buildGstr4({ sales: snapshot.salesGst, purchases: snapshot.purchaseGst }),
      hsn: hsnFromInvoices(books.sales, period),
      rateWise: rateWiseFromInvoices(books.sales, period),
      b2b: split.b2b,
      b2c: split.b2c,
      b2bTotals: split.b2bTotals,
      b2cTotals: split.b2cTotals,
      lockedSalesCount: snapshot.lockedSalesCount,
      lockedPurchaseCount: snapshot.lockedPurchaseCount,
    };
  }

  async saveGstReconNote(
    businessId: string,
    userId: string,
    period: ReportPeriod,
    documentNo: string,
    note: string
  ): Promise<GstReconNote> {
    const trimmed = note.trim();
    if (!trimmed) throw new Error("Enter a reconciliation note.");
    const stored = parseGstReconNotes(await this.repos.businesses.getSetting(businessId, GST_RECON_NOTES_KEY));
    const entry: GstReconNote = {
      id: `gst-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      periodFrom: period.from,
      periodTo: period.to,
      documentNo: documentNo.trim(),
      note: trimmed,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    await this.repos.businesses.setSetting(businessId, GST_RECON_NOTES_KEY, [...stored, entry], userId);
    return entry;
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
