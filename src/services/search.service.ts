import type { SearchEntityType, SearchResult } from "@/types/domain";

const DEMO_RECORDS: Omit<SearchResult, "href">[] = [
  { id: "p-1", entityType: "product", title: "Cotton T-Shirt (White)", subtitle: "Garments", meta: "SKU-1001" },
  { id: "p-2", entityType: "product", title: "Paracetamol 500mg", subtitle: "Pharmacy", meta: "SKU-1002" },
  { id: "p-3", entityType: "product", title: "Stainless Steel Hammer", subtitle: "Hardware", meta: "SKU-1003" },
  { id: "p-4", entityType: "product", title: "LED Monitor 24 inch", subtitle: "Electronics", meta: "SKU-1004" },
  { id: "c-1", entityType: "customer", title: "Ramesh Traders", subtitle: "Customer", meta: "Acc #CT-001" },
  { id: "c-2", entityType: "customer", title: "Sunrise Mart", subtitle: "Customer", meta: "Acc #CT-002" },
  { id: "s-1", entityType: "supplier", title: "Nova Distributors", subtitle: "Supplier", meta: "Acc #SP-001" },
  { id: "i-1", entityType: "invoice", title: "INV-1001", subtitle: "Sales invoice", meta: "₹1,250.00" },
  { id: "i-2", entityType: "invoice", title: "INV-1002", subtitle: "Sales invoice", meta: "₹3,400.00" },
  { id: "i-3", entityType: "purchase", title: "PO-2001", subtitle: "Purchase order", meta: "₹8,900.00" },
  { id: "st-1", entityType: "stock", title: "Warehouse A — Cotton T-Shirt", subtitle: "Stock record", meta: "42 units" },
];

/**
 * Global search foundation. Phase 1 ships a searchable index + demo records.
 * Later phases plug real repository-backed search providers into the same
 * `SearchProvider` contract, and the command palette stays unchanged.
 */
export interface SearchProvider {
  entityType: SearchEntityType;
  label: string;
  search(query: string): Promise<SearchResult[]>;
}

export class DemoSearchProvider implements SearchProvider {
  entityType: SearchEntityType;
  label: string;

  constructor(entityType: SearchEntityType, label: string) {
    this.entityType = entityType;
    this.label = label;
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DEMO_RECORDS.filter((r) => r.entityType === this.entityType)
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.subtitle?.toLowerCase().includes(q) ?? false) ||
          (r.meta?.toLowerCase().includes(q) ?? false)
      )
      .map((r) => ({ ...r, href: buildHref(r.entityType, r.id) }));
  }
}

function buildHref(entityType: SearchEntityType, id: string): string {
  switch (entityType) {
    case "product":
      return `/inventory/products?highlight=${id}`;
    case "customer":
      return `/customers?highlight=${id}`;
    case "supplier":
      return `/suppliers?highlight=${id}`;
    case "invoice":
      return `/sales/invoices?highlight=${id}`;
    case "purchase":
      return `/purchase/invoices?highlight=${id}`;
    case "stock":
      return `/inventory/stock?highlight=${id}`;
    default:
      return "/dashboard";
  }
}

export class SearchService {
  private providers: SearchProvider[] = [
    new DemoSearchProvider("product", "Products"),
    new DemoSearchProvider("customer", "Customers"),
    new DemoSearchProvider("supplier", "Suppliers"),
    new DemoSearchProvider("invoice", "Invoices"),
    new DemoSearchProvider("purchase", "Purchase documents"),
    new DemoSearchProvider("stock", "Stock records"),
  ];

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = await Promise.all(
      this.providers.map((provider) => provider.search(q))
    );
    return results.flat().slice(0, 20);
  }
}
