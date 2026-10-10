import type { Repositories } from "@/repositories/types";
import type { BusinessProfile, DashboardStats } from "@/types/domain";

function startOfToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dashboard service — aggregates real repository data into the DashboardStats
 * contract. In demo mode (local repositories) there is no seeded data, so the
 * figures are genuinely zero/empty until records are created.
 */
export class DashboardService {
  constructor(private repos: Repositories) {}

  async getStats(business: BusinessProfile): Promise<DashboardStats> {
    const today = startOfToday();

    const [invoices, purchases, products, stock] = await Promise.all([
      this.repos.transactions.listSalesInvoices(business.id),
      this.repos.transactions.listPurchaseInvoices(business.id),
      this.repos.products.listProducts(business.id),
      this.repos.products.listStock(business.id),
    ]);

    const todaySales = invoices
      .filter((i) => i.invoiceDate === today && i.status !== "cancelled" && i.status !== "draft")
      .reduce((sum, i) => sum + i.total, 0);

    const todayPurchase = purchases
      .filter((i) => i.invoiceDate === today && i.status !== "draft")
      .reduce((sum, i) => sum + i.total, 0);

    const stockByProduct = new Map(stock.map((s) => [s.productId, s.quantity]));
    let stockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const product of products) {
      const quantity = stockByProduct.get(product.id) ?? 0;
      stockValue += quantity * product.purchasePrice;
      if (product.lowStockThreshold > 0 && quantity <= product.lowStockThreshold) {
        lowStockCount += 1;
      }
      if (quantity <= 0) outOfStockCount += 1;
    }

    const outstanding =
      invoices
        .filter((i) => i.status !== "cancelled" && i.status !== "returned")
        .reduce((sum, i) => sum + (i.total - i.paidAmount), 0) +
      purchases
        .filter((i) => i.status === "unpaid" || i.status === "partial")
        .reduce((sum, i) => sum + (i.total - i.paidAmount), 0);

    return {
      isDemo: false,
      todaySales,
      todayPurchase,
      stockValue,
      lowStockCount,
      outOfStockCount,
      outstanding: Math.max(0, outstanding),
      currency: business.currency,
      updatedAt: new Date().toISOString(),
    };
  }
}
