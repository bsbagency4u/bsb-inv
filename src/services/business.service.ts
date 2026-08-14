import type { Repositories } from "@/repositories/types";
import { AppError } from "@/lib/errors";
import { businessProfileSchema, type BusinessProfileValues } from "@/lib/validation/schemas";
import type { BusinessProfile } from "@/types/domain";
import { readStorage, writeStorage } from "@/repositories/local/local-data";
import type { AuditService } from "./audit.service";

const ACTIVE_BUSINESS_KEY = "active-business-id";

export class BusinessService {
  constructor(
    private repos: Repositories,
    private audits: AuditService
  ) {}

  getActiveBusinessId(): string | null {
    return readStorage<string | null>(ACTIVE_BUSINESS_KEY, null);
  }

  setActiveBusinessId(businessId: string): void {
    writeStorage(ACTIVE_BUSINESS_KEY, businessId);
  }

  async listForUser(userId: string): Promise<BusinessProfile[]> {
    return this.repos.businesses.listForUser(userId);
  }

  async getActiveBusiness(userId: string): Promise<BusinessProfile | null> {
    const businesses = await this.listForUser(userId);
    const activeId = this.getActiveBusinessId();
    const active =
      businesses.find((b) => b.id === activeId) ?? businesses[0] ?? null;
    if (active && active.id !== activeId) {
      this.setActiveBusinessId(active.id);
    }
    return active;
  }

  /**
   * Validates and creates a business profile. The creating user becomes the
   * owner via the database trigger (or directly in demo mode).
   */
  async createBusiness(
    userId: string,
    input: BusinessProfileValues
  ): Promise<BusinessProfile> {
    const parsed = businessProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const business = await this.repos.businesses.create(userId, {
      name: data.name,
      legalName: data.legalName || null,
      logoUrl: data.logoUrl || null,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country,
      pincode: data.pincode || null,
      gstin: data.gstin || null,
      pan: data.pan || null,
      currency: data.currency,
      financialYear: data.financialYear || "01-04",
      invoicePrefix: data.invoicePrefix || "INV",
      invoiceStartNumber: data.invoiceStartNumber ?? 1001,
    });

    this.setActiveBusinessId(business.id);
    await this.audits.log({
      businessId: business.id,
      userId,
      action: "business.created",
      entityType: "business",
      entityId: business.id,
      metadata: { name: business.name, type: business.type },
    });
    return business;
  }

  async updateBusiness(
    userId: string,
    businessId: string,
    input: BusinessProfileValues
  ): Promise<BusinessProfile> {
    const parsed = businessProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const business = await this.repos.businesses.update(userId, businessId, {
      name: data.name,
      legalName: data.legalName || null,
      logoUrl: data.logoUrl || null,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country,
      pincode: data.pincode || null,
      gstin: data.gstin || null,
      pan: data.pan || null,
      currency: data.currency,
      financialYear: data.financialYear || "01-04",
      invoicePrefix: data.invoicePrefix || "INV",
      invoiceStartNumber: data.invoiceStartNumber ?? 1001,
    });

    await this.audits.log({
      businessId,
      userId,
      action: "business.updated",
      entityType: "business",
      entityId: businessId,
      metadata: { name: business.name },
    });
    return business;
  }
}
