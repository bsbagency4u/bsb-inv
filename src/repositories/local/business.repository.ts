import type { BusinessProfile } from "@/types/domain";
import type { BusinessRepository } from "../business.repository";
import {
  DEMO_BUSINESS,
  readStorage,
  writeStorage,
} from "./local-data";

const KEY = "demo-businesses";
const SETTINGS_KEY = "demo-business-settings";

interface LocalSetting {
  businessId: string;
  key: string;
  value: unknown;
}

export class LocalBusinessRepository implements BusinessRepository {
  private all(): BusinessProfile[] {
    return readStorage<BusinessProfile[]>(KEY, [DEMO_BUSINESS]);
  }

  private save(businesses: BusinessProfile[]): void {
    writeStorage(KEY, businesses);
  }

  async listForUser(_userId: string): Promise<BusinessProfile[]> {
    return this.all();
  }

  async getById(businessId: string): Promise<BusinessProfile | null> {
    return this.all().find((b) => b.id === businessId) ?? null;
  }

  async getByUserAndId(
    _userId: string,
    businessId: string
  ): Promise<BusinessProfile | null> {
    return this.getById(businessId);
  }

  async create(
    _userId: string,
    input: Partial<BusinessProfile> & { name: string }
  ): Promise<BusinessProfile> {
    const now = new Date().toISOString();
    const business: BusinessProfile = {
      id: `demo-${crypto.randomUUID()}`,
      name: input.name,
      legalName: input.legalName ?? null,
      type: input.type ?? "retail",
      logoUrl: input.logoUrl ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? "India",
      pincode: input.pincode ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      currency: input.currency ?? "INR",
      financialYear: input.financialYear ?? "01-04",
      invoicePrefix: input.invoicePrefix ?? "INV",
      invoiceStartNumber: input.invoiceStartNumber ?? 1001,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const businesses = this.all();
    businesses.push(business);
    this.save(businesses);
    return business;
  }

  async update(
    _userId: string,
    businessId: string,
    input: Partial<BusinessProfile>
  ): Promise<BusinessProfile> {
    const businesses = this.all();
    const index = businesses.findIndex((b) => b.id === businessId);
    if (index === -1) throw new Error("Business not found.");
    businesses[index] = {
      ...businesses[index],
      ...input,
      id: businessId,
      updatedAt: new Date().toISOString(),
    };
    this.save(businesses);
    return businesses[index];
  }

  async getSetting(businessId: string, key: string): Promise<unknown | null> {
    const all = readStorage<LocalSetting[]>(SETTINGS_KEY, []);
    return all.find((row) => row.businessId === businessId && row.key === key)?.value ?? null;
  }

  async setSetting(
    businessId: string,
    key: string,
    value: unknown,
    _userId: string
  ): Promise<void> {
    const all = readStorage<LocalSetting[]>(SETTINGS_KEY, []);
    const index = all.findIndex((row) => row.businessId === businessId && row.key === key);
    const row: LocalSetting = { businessId, key, value };
    if (index === -1) all.push(row);
    else all[index] = row;
    writeStorage(SETTINGS_KEY, all);
  }
}
