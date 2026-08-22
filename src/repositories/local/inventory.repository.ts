import type { Brand, StockLocation, Unit, Warehouse } from "@/types/domain";
import type { InventoryRepository } from "../inventory.repository";
import { readStorage, writeStorage } from "./local-data";

const UNITS_KEY = "demo-units";
const BRANDS_KEY = "demo-brands";
const WAREHOUSES_KEY = "demo-warehouses";
const LOCATIONS_KEY = "demo-stock-locations";

export class LocalInventoryRepository implements InventoryRepository {
  private readUnits(): Unit[] {
    return readStorage<Unit[]>(UNITS_KEY, []);
  }
  private saveUnits(units: Unit[]): void {
    writeStorage(UNITS_KEY, units);
  }
  private readBrands(): Brand[] {
    return readStorage<Brand[]>(BRANDS_KEY, []);
  }
  private saveBrands(brands: Brand[]): void {
    writeStorage(BRANDS_KEY, brands);
  }
  private readWarehouses(): Warehouse[] {
    return readStorage<Warehouse[]>(WAREHOUSES_KEY, []);
  }
  private saveWarehouses(warehouses: Warehouse[]): void {
    writeStorage(WAREHOUSES_KEY, warehouses);
  }
  private readLocations(): StockLocation[] {
    return readStorage<StockLocation[]>(LOCATIONS_KEY, []);
  }
  private saveLocations(locations: StockLocation[]): void {
    writeStorage(LOCATIONS_KEY, locations);
  }

  async listUnits(businessId: string): Promise<Unit[]> {
    return this.readUnits().filter((u) => u.businessId === businessId);
  }

  async createUnit(businessId: string, input: { name: string; code: string }): Promise<Unit> {
    const now = new Date().toISOString();
    const unit: Unit = {
      id: `unit-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      code: input.code,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readUnits();
    all.push(unit);
    this.saveUnits(all);
    return unit;
  }

  async updateUnit(
    businessId: string,
    unitId: string,
    input: { name?: string; code?: string; isActive?: boolean }
  ): Promise<Unit> {
    const all = this.readUnits();
    const index = all.findIndex((u) => u.businessId === businessId && u.id === unitId);
    if (index === -1) throw new Error("Unit not found.");
    all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
    this.saveUnits(all);
    return all[index];
  }

  async deleteUnit(businessId: string, unitId: string): Promise<void> {
    this.saveUnits(
      this.readUnits().filter((u) => !(u.businessId === businessId && u.id === unitId))
    );
  }

  async listBrands(businessId: string): Promise<Brand[]> {
    return this.readBrands().filter((b) => b.businessId === businessId);
  }

  async createBrand(
    businessId: string,
    input: { name: string; description?: string | null; logoUrl?: string | null }
  ): Promise<Brand> {
    const now = new Date().toISOString();
    const brand: Brand = {
      id: `brand-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readBrands();
    all.push(brand);
    this.saveBrands(all);
    return brand;
  }

  async updateBrand(
    businessId: string,
    brandId: string,
    input: { name?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }
  ): Promise<Brand> {
    const all = this.readBrands();
    const index = all.findIndex((b) => b.businessId === businessId && b.id === brandId);
    if (index === -1) throw new Error("Brand not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      description: input.description === undefined ? all[index].description : input.description,
      logoUrl: input.logoUrl === undefined ? all[index].logoUrl : input.logoUrl,
      isActive: input.isActive ?? all[index].isActive,
      updatedAt: new Date().toISOString(),
    };
    this.saveBrands(all);
    return all[index];
  }

  async deleteBrand(businessId: string, brandId: string): Promise<void> {
    this.saveBrands(
      this.readBrands().filter((b) => !(b.businessId === businessId && b.id === brandId))
    );
  }

  async listWarehouses(businessId: string): Promise<Warehouse[]> {
    return this.readWarehouses().filter((w) => w.businessId === businessId);
  }

  async createWarehouse(
    businessId: string,
    input: { name: string; code: string; address?: string | null }
  ): Promise<Warehouse> {
    const now = new Date().toISOString();
    const warehouse: Warehouse = {
      id: `wh-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readWarehouses();
    all.push(warehouse);
    this.saveWarehouses(all);
    return warehouse;
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: { name?: string; code?: string; address?: string | null; isActive?: boolean }
  ): Promise<Warehouse> {
    const all = this.readWarehouses();
    const index = all.findIndex((w) => w.businessId === businessId && w.id === warehouseId);
    if (index === -1) throw new Error("Warehouse not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      code: input.code ?? all[index].code,
      address: input.address === undefined ? all[index].address : input.address,
      isActive: input.isActive ?? all[index].isActive,
      updatedAt: new Date().toISOString(),
    };
    this.saveWarehouses(all);
    return all[index];
  }

  async deleteWarehouse(businessId: string, warehouseId: string): Promise<void> {
    this.saveWarehouses(
      this.readWarehouses().filter((w) => !(w.businessId === businessId && w.id === warehouseId))
    );
  }

  async listLocations(businessId: string, warehouseId?: string): Promise<StockLocation[]> {
    return this.readLocations().filter(
      (l) => l.businessId === businessId && (!warehouseId || l.warehouseId === warehouseId)
    );
  }

  async createLocation(
    businessId: string,
    input: { warehouseId: string; name: string; code: string; parentId?: string | null }
  ): Promise<StockLocation> {
    const now = new Date().toISOString();
    const location: StockLocation = {
      id: `loc-${crypto.randomUUID()}`,
      businessId,
      warehouseId: input.warehouseId,
      parentId: input.parentId ?? null,
      name: input.name,
      code: input.code,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readLocations();
    all.push(location);
    this.saveLocations(all);
    return location;
  }

  async updateLocation(
    businessId: string,
    locationId: string,
    input: { name?: string; code?: string; parentId?: string | null; isActive?: boolean }
  ): Promise<StockLocation> {
    const all = this.readLocations();
    const index = all.findIndex((l) => l.businessId === businessId && l.id === locationId);
    if (index === -1) throw new Error("Location not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      code: input.code ?? all[index].code,
      parentId: input.parentId === undefined ? all[index].parentId : input.parentId,
      isActive: input.isActive ?? all[index].isActive,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocations(all);
    return all[index];
  }

  async deleteLocation(businessId: string, locationId: string): Promise<void> {
    this.saveLocations(
      this.readLocations().filter((l) => !(l.businessId === businessId && l.id === locationId))
    );
  }
}
