import type { Repositories } from "@/repositories/types";
import { AppError } from "@/lib/errors";
import {
  businessProfileSchema,
  invoiceDefaultsSchema,
  invoiceNumberingSchema,
  purchaseDefaultsSchema,
  salesDefaultsSchema,
  taxDefaultsSchema,
  type BusinessProfileValues,
  type InvoiceDefaultsValues,
  type InvoiceNumberingValues,
  type PurchaseDefaultsValues,
  type SalesDefaultsValues,
  type TaxDefaultsValues,
} from "@/lib/validation/schemas";
import type {
  BusinessProfile,
  InvoiceDefaults,
  PurchaseDefaults,
  SalesDefaults,
  TaxDefaults,
} from "@/types/domain";
import { readStorage, writeStorage } from "@/repositories/local/local-data";
import type { AuditService } from "./audit.service";
import { AuthorizationService } from "./authorization.service";

export const DEFAULT_SALES: SalesDefaults = {
  defaultPaymentMode: "cash",
  defaultIntraState: true,
  defaultDiscountPercent: 0,
  allowLineDiscount: true,
};

export const DEFAULT_PURCHASE: PurchaseDefaults = {
  defaultWarehouseId: null,
  defaultPaymentTerms: "",
  defaultIntraState: true,
};

export const DEFAULT_TAX: TaxDefaults = {
  gstEnabled: true,
  defaultGstRate: 18,
  defaultIntraState: true,
  defaultHsnCode: "",
  pricesIncludeTax: false,
};

export const DEFAULT_INVOICE: InvoiceDefaults = {
  showLogo: true,
  showGstin: true,
  showHsn: false,
  showBankDetails: false,
  bankDetails: "",
  termsAndConditions: "",
  footerNote: "",
  paperSize: "a4",
};

const SALES_KEY = "sales.defaults";
const PURCHASE_KEY = "purchase.defaults";
const TAX_KEY = "tax.defaults";
const INVOICE_KEY = "invoice.defaults";

const ACTIVE_BUSINESS_KEY = "active-business-id";

export class BusinessService {
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
  }

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
    await this.auth.requirePermission(businessId, userId, "business.update");
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

  async getSalesDefaults(businessId: string): Promise<SalesDefaults> {
    const stored = await this.repos.businesses.getSetting(businessId, SALES_KEY);
    if (!stored || typeof stored !== "object") return { ...DEFAULT_SALES };
    const value = stored as Partial<SalesDefaults>;
    return {
      defaultPaymentMode: value.defaultPaymentMode || DEFAULT_SALES.defaultPaymentMode,
      defaultIntraState: value.defaultIntraState ?? DEFAULT_SALES.defaultIntraState,
      defaultDiscountPercent:
        typeof value.defaultDiscountPercent === "number"
          ? value.defaultDiscountPercent
          : DEFAULT_SALES.defaultDiscountPercent,
      allowLineDiscount: value.allowLineDiscount ?? DEFAULT_SALES.allowLineDiscount,
    };
  }

  async updateSalesDefaults(
    userId: string,
    businessId: string,
    input: SalesDefaultsValues
  ): Promise<SalesDefaults> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const parsed = salesDefaultsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const value: SalesDefaults = {
      defaultPaymentMode: parsed.data.defaultPaymentMode,
      defaultIntraState: parsed.data.defaultIntraState,
      defaultDiscountPercent: parsed.data.defaultDiscountPercent,
      allowLineDiscount: parsed.data.allowLineDiscount,
    };
    await this.repos.businesses.setSetting(businessId, SALES_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "settings.sales.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: value as unknown as Record<string, unknown>,
    });
    return value;
  }

  async getPurchaseDefaults(businessId: string): Promise<PurchaseDefaults> {
    const stored = await this.repos.businesses.getSetting(businessId, PURCHASE_KEY);
    if (!stored || typeof stored !== "object") return { ...DEFAULT_PURCHASE };
    const value = stored as Partial<PurchaseDefaults>;
    return {
      defaultWarehouseId: value.defaultWarehouseId ?? null,
      defaultPaymentTerms: value.defaultPaymentTerms ?? "",
      defaultIntraState: value.defaultIntraState ?? DEFAULT_PURCHASE.defaultIntraState,
    };
  }

  async updatePurchaseDefaults(
    userId: string,
    businessId: string,
    input: PurchaseDefaultsValues
  ): Promise<PurchaseDefaults> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const parsed = purchaseDefaultsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const value: PurchaseDefaults = {
      defaultWarehouseId: parsed.data.defaultWarehouseId || null,
      defaultPaymentTerms: parsed.data.defaultPaymentTerms || "",
      defaultIntraState: parsed.data.defaultIntraState,
    };
    await this.repos.businesses.setSetting(businessId, PURCHASE_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "settings.purchase.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: value as unknown as Record<string, unknown>,
    });
    return value;
  }

  async getTaxDefaults(businessId: string): Promise<TaxDefaults> {
    const stored = await this.repos.businesses.getSetting(businessId, TAX_KEY);
    if (!stored || typeof stored !== "object") return { ...DEFAULT_TAX };
    const value = stored as Partial<TaxDefaults>;
    return {
      gstEnabled: value.gstEnabled ?? DEFAULT_TAX.gstEnabled,
      defaultGstRate:
        typeof value.defaultGstRate === "number"
          ? value.defaultGstRate
          : DEFAULT_TAX.defaultGstRate,
      defaultIntraState: value.defaultIntraState ?? DEFAULT_TAX.defaultIntraState,
      defaultHsnCode: value.defaultHsnCode ?? DEFAULT_TAX.defaultHsnCode,
      pricesIncludeTax: value.pricesIncludeTax ?? DEFAULT_TAX.pricesIncludeTax,
    };
  }

  async updateTaxDefaults(
    userId: string,
    businessId: string,
    input: TaxDefaultsValues
  ): Promise<TaxDefaults> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const parsed = taxDefaultsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const value: TaxDefaults = {
      gstEnabled: parsed.data.gstEnabled,
      defaultGstRate: parsed.data.defaultGstRate,
      defaultIntraState: parsed.data.defaultIntraState,
      defaultHsnCode: parsed.data.defaultHsnCode || "",
      pricesIncludeTax: parsed.data.pricesIncludeTax,
    };
    await this.repos.businesses.setSetting(businessId, TAX_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "settings.tax.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: value as unknown as Record<string, unknown>,
    });
    return value;
  }

  async getInvoiceDefaults(businessId: string): Promise<InvoiceDefaults> {
    const stored = await this.repos.businesses.getSetting(businessId, INVOICE_KEY);
    if (!stored || typeof stored !== "object") return { ...DEFAULT_INVOICE };
    const value = stored as Partial<InvoiceDefaults>;
    return {
      showLogo: value.showLogo ?? DEFAULT_INVOICE.showLogo,
      showGstin: value.showGstin ?? DEFAULT_INVOICE.showGstin,
      showHsn: value.showHsn ?? DEFAULT_INVOICE.showHsn,
      showBankDetails: value.showBankDetails ?? DEFAULT_INVOICE.showBankDetails,
      bankDetails: value.bankDetails ?? DEFAULT_INVOICE.bankDetails,
      termsAndConditions: value.termsAndConditions ?? DEFAULT_INVOICE.termsAndConditions,
      footerNote: value.footerNote ?? DEFAULT_INVOICE.footerNote,
      paperSize: value.paperSize ?? DEFAULT_INVOICE.paperSize,
    };
  }

  async updateInvoiceDefaults(
    userId: string,
    businessId: string,
    input: InvoiceDefaultsValues
  ): Promise<InvoiceDefaults> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const parsed = invoiceDefaultsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const value: InvoiceDefaults = {
      showLogo: parsed.data.showLogo,
      showGstin: parsed.data.showGstin,
      showHsn: parsed.data.showHsn,
      showBankDetails: parsed.data.showBankDetails,
      bankDetails: parsed.data.bankDetails || "",
      termsAndConditions: parsed.data.termsAndConditions || "",
      footerNote: parsed.data.footerNote || "",
      paperSize: parsed.data.paperSize,
    };
    await this.repos.businesses.setSetting(businessId, INVOICE_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "settings.invoice.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: value as unknown as Record<string, unknown>,
    });
    return value;
  }

  /** Updates the invoice prefix / starting number stored on the business profile. */
  async updateInvoiceNumbering(
    userId: string,
    businessId: string,
    input: InvoiceNumberingValues
  ): Promise<BusinessProfile> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const parsed = invoiceNumberingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const business = await this.repos.businesses.update(userId, businessId, {
      invoicePrefix: parsed.data.invoicePrefix?.toUpperCase() || "INV",
      invoiceStartNumber: parsed.data.invoiceStartNumber ?? 1001,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "settings.invoice_numbering.updated",
      entityType: "business",
      entityId: businessId,
      metadata: {
        invoicePrefix: business.invoicePrefix,
        invoiceStartNumber: business.invoiceStartNumber,
      },
    });
    return business;
  }
}
