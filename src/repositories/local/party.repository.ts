import type { Customer, Supplier } from "@/types/domain";
import type { PartyInput, PartyRepository } from "../party.repository";
import { readStorage, writeStorage } from "./local-data";

const CUSTOMERS_KEY = "demo-customers";
const SUPPLIERS_KEY = "demo-suppliers";

export class LocalPartyRepository implements PartyRepository {
  private readCustomers(): Customer[] {
    return readStorage<Customer[]>(CUSTOMERS_KEY, []);
  }
  private saveCustomers(customers: Customer[]): void {
    writeStorage(CUSTOMERS_KEY, customers);
  }
  private readSuppliers(): Supplier[] {
    return readStorage<Supplier[]>(SUPPLIERS_KEY, []);
  }
  private saveSuppliers(suppliers: Supplier[]): void {
    writeStorage(SUPPLIERS_KEY, suppliers);
  }

  async listCustomers(businessId: string): Promise<Customer[]> {
    return this.readCustomers().filter((c) => c.businessId === businessId);
  }

  async getCustomer(businessId: string, customerId: string): Promise<Customer | null> {
    return (
      this.readCustomers().find((c) => c.businessId === businessId && c.id === customerId) ??
      null
    );
  }

  async createCustomer(businessId: string, userId: string, input: PartyInput): Promise<Customer> {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: `cust-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      gstin: input.gstin ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      openingBalance: input.openingBalance ?? 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readCustomers();
    all.push(customer);
    this.saveCustomers(all);
    return customer;
  }

  async updateCustomer(
    businessId: string,
    customerId: string,
    input: Partial<PartyInput>
  ): Promise<Customer> {
    const all = this.readCustomers();
    const index = all.findIndex((c) => c.businessId === businessId && c.id === customerId);
    if (index === -1) throw new Error("Customer not found.");
    all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
    this.saveCustomers(all);
    return all[index];
  }

  async deleteCustomer(businessId: string, customerId: string): Promise<void> {
    this.saveCustomers(
      this.readCustomers().filter((c) => !(c.businessId === businessId && c.id === customerId))
    );
  }

  async listSuppliers(businessId: string): Promise<Supplier[]> {
    return this.readSuppliers().filter((s) => s.businessId === businessId);
  }

  async getSupplier(businessId: string, supplierId: string): Promise<Supplier | null> {
    return (
      this.readSuppliers().find((s) => s.businessId === businessId && s.id === supplierId) ??
      null
    );
  }

  async createSupplier(businessId: string, userId: string, input: PartyInput): Promise<Supplier> {
    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: `supp-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      gstin: input.gstin ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      openingBalance: input.openingBalance ?? 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readSuppliers();
    all.push(supplier);
    this.saveSuppliers(all);
    return supplier;
  }

  async updateSupplier(
    businessId: string,
    supplierId: string,
    input: Partial<PartyInput>
  ): Promise<Supplier> {
    const all = this.readSuppliers();
    const index = all.findIndex((s) => s.businessId === businessId && s.id === supplierId);
    if (index === -1) throw new Error("Supplier not found.");
    all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
    this.saveSuppliers(all);
    return all[index];
  }

  async deleteSupplier(businessId: string, supplierId: string): Promise<void> {
    this.saveSuppliers(
      this.readSuppliers().filter((s) => !(s.businessId === businessId && s.id === supplierId))
    );
  }

  async listCustomersForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; phone: string | null }>> {
    return (await this.listCustomers(businessId))
      .filter(
        (c) => c.name.toLowerCase().includes(query) || (c.phone ?? "").includes(query)
      )
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  }

  async listSuppliersForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; phone: string | null }>> {
    return (await this.listSuppliers(businessId))
      .filter(
        (s) => s.name.toLowerCase().includes(query) || (s.phone ?? "").includes(query)
      )
      .slice(0, 10)
      .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }
}
