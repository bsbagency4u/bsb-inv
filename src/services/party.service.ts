import type { Repositories } from "@/repositories/types";
import type { Customer, Supplier } from "@/types/domain";
import { AppError } from "@/lib/errors";
import { partySchema, type PartyValues } from "@/lib/validation/schemas";
import type { AuditService } from "./audit.service";

export class PartyService {
  constructor(
    private repos: Repositories,
    private audits: AuditService
  ) {}

  async listCustomers(businessId: string): Promise<Customer[]> {
    return this.repos.parties.listCustomers(businessId);
  }

  async getCustomer(businessId: string, customerId: string): Promise<Customer | null> {
    return this.repos.parties.getCustomer(businessId, customerId);
  }

  async createCustomer(businessId: string, userId: string, input: PartyValues): Promise<Customer> {
    const parsed = partySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const customer = await this.repos.parties.createCustomer(businessId, userId, {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      openingBalance: data.openingBalance ?? 0,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "customer.created",
      entityType: "customer",
      entityId: customer.id,
      metadata: { name: customer.name },
    });
    return customer;
  }

  async updateCustomer(
    businessId: string,
    userId: string,
    customerId: string,
    input: PartyValues
  ): Promise<Customer> {
    const parsed = partySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const customer = await this.repos.parties.updateCustomer(businessId, customerId, {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      openingBalance: data.openingBalance ?? 0,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "customer.updated",
      entityType: "customer",
      entityId: customerId,
      metadata: { name: customer.name },
    });
    return customer;
  }

  async deleteCustomer(businessId: string, userId: string, customerId: string): Promise<void> {
    await this.repos.parties.deleteCustomer(businessId, customerId);
    await this.audits.log({
      businessId,
      userId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: customerId,
    });
  }

  async listSuppliers(businessId: string): Promise<Supplier[]> {
    return this.repos.parties.listSuppliers(businessId);
  }

  async getSupplier(businessId: string, supplierId: string): Promise<Supplier | null> {
    return this.repos.parties.getSupplier(businessId, supplierId);
  }

  async createSupplier(businessId: string, userId: string, input: PartyValues): Promise<Supplier> {
    const parsed = partySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const supplier = await this.repos.parties.createSupplier(businessId, userId, {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      openingBalance: data.openingBalance ?? 0,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name },
    });
    return supplier;
  }

  async updateSupplier(
    businessId: string,
    userId: string,
    supplierId: string,
    input: PartyValues
  ): Promise<Supplier> {
    const parsed = partySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;
    const supplier = await this.repos.parties.updateSupplier(businessId, supplierId, {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      openingBalance: data.openingBalance ?? 0,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: supplierId,
      metadata: { name: supplier.name },
    });
    return supplier;
  }

  async deleteSupplier(businessId: string, userId: string, supplierId: string): Promise<void> {
    await this.repos.parties.deleteSupplier(businessId, supplierId);
    await this.audits.log({
      businessId,
      userId,
      action: "supplier.deleted",
      entityType: "supplier",
      entityId: supplierId,
    });
  }
}
