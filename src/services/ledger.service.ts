import type { Repositories } from "@/repositories/types";
import type {
  Customer,
  Payment,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
  Supplier,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import {
  agingTotals,
  buildCustomerLedger,
  buildSupplierLedger,
  customerOutstanding,
  filterOutstanding,
  roundMoney,
  settlePurchaseInvoice,
  settleSalesInvoice,
  summarizeCustomer,
  summarizeSupplier,
  supplierOutstanding,
  unallocatedAmount,
  type AgingBucket,
  type LedgerLine,
  type OutstandingRow,
  type PartyBalance,
} from "@/lib/party-ledger";
import { AuthorizationService } from "./authorization.service";

export interface OutstandingFilters {
  partyId?: string | null;
  overdueOnly?: boolean;
  minBalance?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
}

export interface PartyLedgerResult {
  partyId: string;
  partyName: string;
  kind: "customer" | "supplier";
  lines: LedgerLine[];
  balance: PartyBalance;
  outstanding: OutstandingRow[];
  advances: Payment[];
}

export class LedgerService {
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
  }

  async loadBooks(businessId: string) {
    const [customers, suppliers, sales, purchases, payments, salesReturns, purchaseReturns] =
      await Promise.all([
        this.repos.parties.listCustomers(businessId),
        this.repos.parties.listSuppliers(businessId),
        this.repos.transactions.listSalesInvoices(businessId),
        this.repos.transactions.listPurchaseInvoices(businessId),
        this.repos.transactions.listPayments(businessId),
        this.repos.transactions.listSalesReturns(businessId),
        this.repos.transactions.listPurchaseReturns(businessId),
      ]);
    return { customers, suppliers, sales, purchases, payments, salesReturns, purchaseReturns };
  }

  customerLines(
    customer: Customer,
    invoices: SalesInvoice[],
    returns: SalesReturn[],
    payments: Payment[]
  ): LedgerLine[] {
    return buildCustomerLedger({
      partyId: customer.id,
      openingBalance: customer.openingBalance,
      invoices,
      returns,
      payments,
    });
  }

  supplierLines(
    supplier: Supplier,
    invoices: PurchaseInvoice[],
    returns: PurchaseReturn[],
    payments: Payment[]
  ): LedgerLine[] {
    return buildSupplierLedger({
      partyId: supplier.id,
      openingBalance: supplier.openingBalance,
      invoices,
      returns,
      payments,
    });
  }

  async getCustomerLedger(businessId: string, customerId: string): Promise<PartyLedgerResult> {
    const books = await this.loadBooks(businessId);
    const customer = books.customers.find((item) => item.id === customerId);
    if (!customer) throw AppError.notFound("Customer not found.");
    const names = new Map(books.customers.map((item) => [item.id, item.name]));
    const lines = this.customerLines(customer, books.sales, books.salesReturns, books.payments);
    return {
      partyId: customer.id,
      partyName: customer.name,
      kind: "customer",
      lines,
      balance: summarizeCustomer(customer.id, customer.openingBalance, lines),
      outstanding: customerOutstanding(books.sales, books.payments, books.salesReturns, names).filter(
        (row) => row.partyId === customer.id
      ),
      advances: books.payments.filter(
        (payment) =>
          payment.partyType === "customer" &&
          payment.partyId === customer.id &&
          unallocatedAmount(payment) > 0
      ),
    };
  }

  async getSupplierLedger(businessId: string, supplierId: string): Promise<PartyLedgerResult> {
    const books = await this.loadBooks(businessId);
    const supplier = books.suppliers.find((item) => item.id === supplierId);
    if (!supplier) throw AppError.notFound("Supplier not found.");
    const names = new Map(books.suppliers.map((item) => [item.id, item.name]));
    const lines = this.supplierLines(supplier, books.purchases, books.purchaseReturns, books.payments);
    return {
      partyId: supplier.id,
      partyName: supplier.name,
      kind: "supplier",
      lines,
      balance: summarizeSupplier(supplier.id, supplier.openingBalance, lines),
      outstanding: supplierOutstanding(books.purchases, books.payments, books.purchaseReturns, names).filter(
        (row) => row.partyId === supplier.id
      ),
      advances: books.payments.filter(
        (payment) =>
          payment.partyType === "supplier" &&
          payment.partyId === supplier.id &&
          unallocatedAmount(payment) > 0
      ),
    };
  }

  async receivables(
    businessId: string,
    filters: OutstandingFilters = {},
    today?: string
  ): Promise<OutstandingRow[]> {
    const books = await this.loadBooks(businessId);
    const names = new Map(books.customers.map((item) => [item.id, item.name]));
    return filterOutstanding(
      customerOutstanding(books.sales, books.payments, books.salesReturns, names, today),
      filters
    );
  }

  async payables(
    businessId: string,
    filters: OutstandingFilters = {},
    today?: string
  ): Promise<OutstandingRow[]> {
    const books = await this.loadBooks(businessId);
    const names = new Map(books.suppliers.map((item) => [item.id, item.name]));
    return filterOutstanding(
      supplierOutstanding(books.purchases, books.payments, books.purchaseReturns, names, today),
      filters
    );
  }

  async receivableTotal(businessId: string, today?: string): Promise<number> {
    const rows = await this.receivables(businessId, {}, today);
    return roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));
  }

  async payableTotal(businessId: string, today?: string): Promise<number> {
    const rows = await this.payables(businessId, {}, today);
    return roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));
  }

  aging(rows: OutstandingRow[], buckets?: AgingBucket[]) {
    return agingTotals(rows, buckets);
  }

  settleSale(invoice: SalesInvoice, payments: Payment[], returns: SalesReturn[]) {
    return settleSalesInvoice(invoice, payments, returns);
  }

  settlePurchase(invoice: PurchaseInvoice, payments: Payment[], returns: PurchaseReturn[]) {
    return settlePurchaseInvoice(invoice, payments, returns);
  }

  async requireView(businessId: string, userId: string, kind: "customer" | "supplier" | "report") {
    if (kind === "report") {
      await this.auth.requireAnyPermission(businessId, userId, ["report.view", "sales.view", "purchase.view"]);
      return;
    }
    await this.auth.requirePermission(businessId, userId, `${kind}.view`);
  }
}
