import type { BusinessProfile, DashboardStats } from "@/types/domain";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Dashboard service.
 *
 * Phase 1 provides clearly-marked placeholder metrics. When Phase 2/3 add real
 * transaction data this service is swapped to query repositories — the
 * DashboardStats contract does not change, so the UI needs no redesign.
 */
export class DashboardService {
  async getStats(business: BusinessProfile): Promise<DashboardStats> {
    const seed = hashString(business.id);

    return {
      isDemo: true,
      todaySales: 12000 + (seed % 40000),
      todayPurchase: 8500 + (seed % 22000),
      stockValue: 480000 + (seed % 600000),
      lowStockCount: 6 + (seed % 14),
      outOfStockCount: 2 + (seed % 8),
      outstanding: 35000 + (seed % 90000),
      currency: business.currency,
      updatedAt: new Date().toISOString(),
    };
  }
}
