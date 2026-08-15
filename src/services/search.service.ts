import type { Repositories } from "@/repositories/types";
import type { SearchResult } from "@/types/domain";

export interface SearchProvider {
  entityType: SearchResult["entityType"];
  label: string;
  search(businessId: string, query: string): Promise<SearchResult[]>;
}

/**
 * Global search. Phase 2 wires repository-backed providers for products,
 * customers, suppliers, invoices, purchase documents and stock. Providers are
 * cheap filters over repository data — the command palette contract stays
 * identical to Phase 1.
 */
class ProductSearchProvider implements SearchProvider {
  entityType = "product" as const;
  label = "Products";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const products = await this.repos.products.listProductsForSearch(businessId, query);
    return products.map((p) => ({
      id: p.id,
      entityType: "product",
      title: p.name,
      subtitle: p.sku ? `SKU ${p.sku}` : p.category ?? "Product",
      meta: p.hsn ?? undefined,
      href: `/inventory/products?highlight=${p.id}`,
    }));
  }
}

class CustomerSearchProvider implements SearchProvider {
  entityType = "customer" as const;
  label = "Customers";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const customers = await this.repos.parties.listCustomersForSearch(businessId, query);
    return customers.map((c) => ({
      id: c.id,
      entityType: "customer",
      title: c.name,
      subtitle: "Customer",
      meta: c.phone ?? undefined,
      href: `/customers?highlight=${c.id}`,
    }));
  }
}

class SupplierSearchProvider implements SearchProvider {
  entityType = "supplier" as const;
  label = "Suppliers";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const suppliers = await this.repos.parties.listSuppliersForSearch(businessId, query);
    return suppliers.map((s) => ({
      id: s.id,
      entityType: "supplier",
      title: s.name,
      subtitle: "Supplier",
      meta: s.phone ?? undefined,
      href: `/suppliers?highlight=${s.id}`,
    }));
  }
}

class InvoiceSearchProvider implements SearchProvider {
  entityType = "invoice" as const;
  label = "Invoices";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const invoices = await this.repos.transactions.listSalesInvoicesForSearch(businessId, query);
    return invoices.map((i) => ({
      id: i.id,
      entityType: "invoice",
      title: i.invoiceNo,
      subtitle: "Sales invoice",
      meta: i.customerName ?? undefined,
      href: `/sales/invoices?highlight=${i.id}`,
    }));
  }
}

class PurchaseSearchProvider implements SearchProvider {
  entityType = "purchase" as const;
  label = "Purchase documents";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const documents = await this.repos.transactions.listPurchaseInvoicesForSearch(businessId, query);
    return documents.map((d) => ({
      id: d.id,
      entityType: "purchase",
      title: d.billNo,
      subtitle: "Purchase invoice",
      meta: d.supplierName ?? undefined,
      href: `/purchase/invoices?highlight=${d.id}`,
    }));
  }
}

class StockSearchProvider implements SearchProvider {
  entityType = "stock" as const;
  label = "Stock records";
  constructor(private repos: Repositories) {}
  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const records = await this.repos.products.listStockForSearch(businessId, query);
    return records.map((r) => ({
      id: r.productId,
      entityType: "stock",
      title: r.name,
      subtitle: "Stock record",
      meta: `${r.quantity} ${r.unit}`,
      href: `/inventory/stock?highlight=${r.productId}`,
    }));
  }
}

export class SearchService {
  private providers: SearchProvider[];

  constructor(repos: Repositories) {
    this.providers = [
      new ProductSearchProvider(repos),
      new CustomerSearchProvider(repos),
      new SupplierSearchProvider(repos),
      new InvoiceSearchProvider(repos),
      new PurchaseSearchProvider(repos),
      new StockSearchProvider(repos),
    ];
  }

  async search(businessId: string, query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = await Promise.all(
      this.providers.map((provider) => provider.search(businessId, q))
    );
    return results.flat().slice(0, 20);
  }
}
