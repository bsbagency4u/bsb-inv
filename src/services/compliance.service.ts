import type { Repositories } from "@/repositories/types";
import type { ComplianceRepository } from "@/repositories/compliance.repository";
import type {
  BusinessProfile,
  Customer,
  GstEinvoiceRecord,
  GstEwayBillRecord,
  GstIrpCredentialPublic,
  GstIrpDocumentKind,
  SalesReturn,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import {
  GST_EINVOICE_SETTINGS_KEY,
  GST_EWB_SETTINGS_KEY,
  einvoiceLocksDocument,
  evaluateEinvoiceEligibility,
  evaluateEwayBillEligibility,
  parseEinvoiceSettings,
  parseEwayBillSettings,
  supplyIncludesGoods,
  type EligibilityDecision,
  type GstEinvoiceSettings,
  type GstEwayBillSettings,
} from "@/lib/gst-einvoice";
import {
  postGstApi,
  type GstCancelRequest,
  type GstCredentialRequest,
  type GstEwaySubmitRequest,
  type GstSubmitRequest,
} from "@/lib/gst-compliance-api";
import type { EwayBillTransport } from "@/lib/gst-irp-payload";
import { AuthorizationService } from "./authorization.service";
import type { AuditService } from "./audit.service";

export interface GstComplianceWorkspace {
  credentials: GstIrpCredentialPublic;
  einvoiceSettings: GstEinvoiceSettings;
  ewayBillSettings: GstEwayBillSettings;
  einvoices: GstEinvoiceRecord[];
  ewayBills: GstEwayBillRecord[];
  documents: GstComplianceDocumentRow[];
}

export interface GstComplianceDocumentRow {
  documentKind: GstIrpDocumentKind;
  documentId: string;
  documentNo: string;
  documentDate: string;
  partyName: string;
  partyGstin: string | null;
  status: string;
  total: number;
  einvoice: EligibilityDecision & { record: GstEinvoiceRecord | null };
  ewayBill: EligibilityDecision & { record: GstEwayBillRecord | null };
}

export class GstComplianceService {
  protected auth: AuthorizationService;

  constructor(
    protected repos: Repositories,
    protected audits: AuditService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
  }

  complianceRepo(): ComplianceRepository {
    if (!this.repos.compliance) {
      throw AppError.unprocessable(
        "GST compliance storage is not available. Connect the IRP/GSP tables before generating an IRN."
      );
    }
    return this.repos.compliance;
  }

  protected compliance(): ComplianceRepository {
    return this.complianceRepo();
  }

  async getWorkspace(businessId: string, userId: string): Promise<GstComplianceWorkspace> {
    await this.auth.requireAnyPermission(businessId, userId, ["sales.view", "sales.manage", "report.view"]);
    const store = this.compliance();
    const [credentials, einvoiceSettings, ewayBillSettings, einvoices, ewayBills, documents] = await Promise.all([
      store.getCredentialPublic(businessId),
      this.getEinvoiceSettings(businessId),
      this.getEwayBillSettings(businessId),
      store.listEinvoices(businessId),
      store.listEwayBills(businessId),
      this.listDocuments(businessId),
    ]);
    return { credentials, einvoiceSettings, ewayBillSettings, einvoices, ewayBills, documents };
  }

  async getEinvoiceSettings(businessId: string): Promise<GstEinvoiceSettings> {
    return parseEinvoiceSettings(await this.repos.businesses.getSetting(businessId, GST_EINVOICE_SETTINGS_KEY));
  }

  async getEwayBillSettings(businessId: string): Promise<GstEwayBillSettings> {
    return parseEwayBillSettings(await this.repos.businesses.getSetting(businessId, GST_EWB_SETTINGS_KEY));
  }

  async saveEinvoiceSettings(
    businessId: string,
    userId: string,
    input: GstEinvoiceSettings
  ): Promise<GstEinvoiceSettings> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const value = parseEinvoiceSettings(input);
    await this.repos.businesses.setSetting(businessId, GST_EINVOICE_SETTINGS_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "gst.einvoice.settings.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: { optedIn: value.optedIn, aggregateTurnover: value.aggregateTurnover },
    });
    return value;
  }

  async saveEwayBillSettings(
    businessId: string,
    userId: string,
    input: GstEwayBillSettings
  ): Promise<GstEwayBillSettings> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const value = parseEwayBillSettings(input);
    await this.repos.businesses.setSetting(businessId, GST_EWB_SETTINGS_KEY, value, userId);
    await this.audits.log({
      businessId,
      userId,
      action: "gst.ewaybill.settings.updated",
      entityType: "business_settings",
      entityId: businessId,
      metadata: { optedIn: value.optedIn, valueThreshold: value.valueThreshold },
    });
    return value;
  }

  async listDocuments(businessId: string): Promise<GstComplianceDocumentRow[]> {
    const store = this.compliance();
    const [business, invoices, returns, customers, einvoices, ewayBills, einvoiceSettings, ewaySettings] =
      await Promise.all([
        this.requireBusiness(businessId),
        this.repos.transactions.listSalesInvoices(businessId),
        this.repos.transactions.listSalesReturns(businessId),
        this.repos.parties.listCustomers(businessId),
        store.listEinvoices(businessId),
        store.listEwayBills(businessId),
        this.getEinvoiceSettings(businessId),
        this.getEwayBillSettings(businessId),
      ]);
    const customerById = new Map(customers.map((item) => [item.id, item]));
    const invoiceById = new Map(invoices.map((item) => [item.id, item]));
    const einvoiceByKey = new Map(einvoices.map((item) => [`${item.documentKind}:${item.documentId}`, item]));
    const ewayByKey = new Map(ewayBills.map((item) => [`${item.documentKind}:${item.documentId}`, item]));

    const invoiceRows = invoices.map((invoice) => {
      const customer = invoice.customerId ? customerById.get(invoice.customerId) ?? null : null;
      const partyGstin = customer?.gstin ?? null;
      const partyName = customer?.name ?? "Walk-in customer";
      return this.documentRow({
        business,
        documentKind: "sales_invoice",
        documentId: invoice.id,
        documentNo: invoice.invoiceNo,
        documentDate: invoice.invoiceDate,
        documentStatus: invoice.status,
        documentType: invoice.gstDocumentType ?? "tax_invoice",
        partyName,
        partyGstin,
        recipientRegistrationType: customer?.gstRegistrationType ?? null,
        intraState: invoice.intraState ?? true,
        total: invoice.total,
        hsnCodes: invoice.items.map((item) => item.hsn),
        einvoiceSettings,
        ewaySettings,
        einvoice: einvoiceByKey.get(`sales_invoice:${invoice.id}`) ?? null,
        ewayBill: ewayByKey.get(`sales_invoice:${invoice.id}`) ?? null,
      });
    });

    const returnRows = returns.map((creditNote) => {
      const original = creditNote.salesInvoiceId ? invoiceById.get(creditNote.salesInvoiceId) ?? null : null;
      const customer = creditNote.customerId
        ? customerById.get(creditNote.customerId) ?? null
        : original?.customerId
          ? customerById.get(original.customerId) ?? null
          : null;
      return this.documentRow({
        business,
        documentKind: "sales_return",
        documentId: creditNote.id,
        documentNo: creditNote.returnNo,
        documentDate: creditNote.returnDate,
        documentStatus: "completed",
        documentType: "credit_note",
        partyName: customer?.name ?? "Customer",
        partyGstin: customer?.gstin ?? null,
        recipientRegistrationType: customer?.gstRegistrationType ?? null,
        intraState: original?.intraState ?? true,
        total: creditNote.total,
        hsnCodes: original?.items.map((item) => item.hsn) ?? [],
        einvoiceSettings,
        ewaySettings,
        einvoice: einvoiceByKey.get(`sales_return:${creditNote.id}`) ?? null,
        ewayBill: ewayByKey.get(`sales_return:${creditNote.id}`) ?? null,
      });
    });

    return [...invoiceRows, ...returnRows].sort((a, b) => b.documentDate.localeCompare(a.documentDate));
  }

  async getEinvoiceForDocument(
    businessId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEinvoiceRecord | null> {
    return this.compliance().getEinvoice(businessId, documentKind, documentId);
  }

  async getEwayBillForDocument(
    businessId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEwayBillRecord | null> {
    return this.compliance().getEwayBill(businessId, documentKind, documentId);
  }

  async assertInvoiceMutable(businessId: string, invoiceId: string): Promise<void> {
    const record = await this.compliance().getEinvoice(businessId, "sales_invoice", invoiceId);
    if (einvoiceLocksDocument(record?.status)) {
      throw AppError.validation(
        "This invoice has a generated IRN. Cancel the IRN with the IRP before changing GST-mandatory fields."
      );
    }
  }

  async assertCreditNoteMutable(businessId: string, returnId: string): Promise<void> {
    const record = await this.compliance().getEinvoice(businessId, "sales_return", returnId);
    if (einvoiceLocksDocument(record?.status)) {
      throw AppError.validation(
        "This credit note has a generated IRN. Cancel the IRN with the IRP before changing it."
      );
    }
  }

  async saveCredentials(input: GstCredentialRequest): Promise<GstIrpCredentialPublic> {
    return postGstApi<GstIrpCredentialPublic>("/api/gst/credentials", input);
  }

  async submitEinvoice(
    businessId: string,
    _userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEinvoiceRecord> {
    const body: GstSubmitRequest = { businessId, documentKind, documentId };
    return postGstApi<GstEinvoiceRecord>("/api/gst/einvoice/submit", body);
  }

  async cancelEinvoice(
    businessId: string,
    _userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    reason: string,
    remark?: string
  ): Promise<GstEinvoiceRecord> {
    const body: GstCancelRequest = { businessId, documentKind, documentId, reason, remark };
    return postGstApi<GstEinvoiceRecord>("/api/gst/einvoice/cancel", body);
  }

  async submitEwayBill(
    businessId: string,
    _userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    transport: EwayBillTransport
  ): Promise<GstEwayBillRecord> {
    const body: GstEwaySubmitRequest = {
      businessId,
      documentKind,
      documentId,
      transMode: transport.transMode,
      transDistance: transport.transDistance,
      transDocNo: transport.transDocNo,
      transDocDate: transport.transDocDate,
      vehicleNo: transport.vehicleNo,
      fromPlace: transport.fromPlace,
      toPlace: transport.toPlace,
    };
    return postGstApi<GstEwayBillRecord>("/api/gst/ewaybill/submit", body);
  }

  async cancelEwayBill(
    businessId: string,
    _userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    reason: string,
    remark?: string
  ): Promise<GstEwayBillRecord> {
    const body: GstCancelRequest = { businessId, documentKind, documentId, reason, remark };
    return postGstApi<GstEwayBillRecord>("/api/gst/ewaybill/cancel", body);
  }

  protected async requireBusiness(businessId: string): Promise<BusinessProfile> {
    const business = await this.repos.businesses.getById(businessId);
    if (!business) throw AppError.notFound("Business not found.");
    return business;
  }

  private documentRow(input: {
    business: BusinessProfile;
    documentKind: GstIrpDocumentKind;
    documentId: string;
    documentNo: string;
    documentDate: string;
    documentStatus: string;
    documentType: import("@/types/domain").GstDocumentType;
    partyName: string;
    partyGstin: string | null;
    recipientRegistrationType: Customer["gstRegistrationType"] | null;
    intraState: boolean;
    total: number;
    hsnCodes: Array<string | null | undefined>;
    einvoiceSettings: GstEinvoiceSettings;
    ewaySettings: GstEwayBillSettings;
    einvoice: GstEinvoiceRecord | null;
    ewayBill: GstEwayBillRecord | null;
  }): GstComplianceDocumentRow {
    return {
      documentKind: input.documentKind,
      documentId: input.documentId,
      documentNo: input.documentNo,
      documentDate: input.documentDate,
      partyName: input.partyName,
      partyGstin: input.partyGstin,
      status: input.documentStatus,
      total: input.total,
      einvoice: {
        ...evaluateEinvoiceEligibility({
          registrationType: input.business.gstRegistrationType,
          supplierGstin: input.business.gstin,
          recipientGstin: input.partyGstin,
          recipientRegistrationType: input.recipientRegistrationType,
          documentType: input.documentType,
          documentDate: input.documentDate,
          documentStatus: input.documentStatus,
          aggregateTurnover: input.einvoiceSettings.aggregateTurnover,
          optedIn: input.einvoiceSettings.optedIn,
          turnoverThreshold: input.einvoiceSettings.turnoverThreshold,
          mandatoryFrom: input.einvoiceSettings.mandatoryFrom,
        }),
        record: input.einvoice,
      },
      ewayBill: {
        ...evaluateEwayBillEligibility({
          registrationType: input.business.gstRegistrationType,
          supplierGstin: input.business.gstin,
          documentStatus: input.documentStatus,
          documentDate: input.documentDate,
          invoiceValue: input.total,
          intraState: input.intraState,
          supplyIsGoods: supplyIncludesGoods(input.hsnCodes),
          optedIn: input.ewaySettings.optedIn,
          valueThreshold: input.ewaySettings.valueThreshold,
          intraStateThreshold: input.ewaySettings.intraStateThreshold,
        }),
        record: input.ewayBill,
      },
    };
  }

  protected async loadDocumentContext(
    businessId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ) {
    const business = await this.requireBusiness(businessId);
    const [einvoiceSettings, ewaySettings] = await Promise.all([
      this.getEinvoiceSettings(businessId),
      this.getEwayBillSettings(businessId),
    ]);
    if (documentKind === "sales_invoice") {
      const invoice = await this.repos.transactions.getSalesInvoice(businessId, documentId);
      if (!invoice) throw AppError.notFound("Invoice not found.");
      const customer = invoice.customerId
        ? await this.repos.parties.getCustomer(businessId, invoice.customerId)
        : null;
      return {
        business,
        invoice,
        creditNote: null as SalesReturn | null,
        customer,
        partyName: customer?.name ?? "Walk-in customer",
        partyGstin: customer?.gstin ?? null,
        documentNo: invoice.invoiceNo,
        documentDate: invoice.invoiceDate,
        documentStatus: invoice.status,
        documentType: invoice.gstDocumentType ?? ("tax_invoice" as const),
        intraState: invoice.intraState ?? true,
        total: invoice.total,
        hsnCodes: invoice.items.map((item) => item.hsn),
        einvoiceSettings,
        ewaySettings,
      };
    }
    const returns = await this.repos.transactions.listSalesReturns(businessId);
    const creditNote = returns.find((item) => item.id === documentId) ?? null;
    if (!creditNote) throw AppError.notFound("Credit note not found.");
    const invoice = creditNote.salesInvoiceId
      ? await this.repos.transactions.getSalesInvoice(businessId, creditNote.salesInvoiceId)
      : null;
    const customerId = creditNote.customerId ?? invoice?.customerId ?? null;
    const customer = customerId ? await this.repos.parties.getCustomer(businessId, customerId) : null;
    return {
      business,
      invoice,
      creditNote,
      customer,
      partyName: customer?.name ?? "Customer",
      partyGstin: customer?.gstin ?? null,
      documentNo: creditNote.returnNo,
      documentDate: creditNote.returnDate,
      documentStatus: "completed",
      documentType: "credit_note" as const,
      intraState: invoice?.intraState ?? true,
      total: creditNote.total,
      hsnCodes: invoice?.items.map((item) => item.hsn) ?? [],
      einvoiceSettings,
      ewaySettings,
    };
  }
}
