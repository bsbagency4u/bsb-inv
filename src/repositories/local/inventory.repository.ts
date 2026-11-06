import type {
  Brand,
  ProductSerial,
  StockAdjustment,
  StockCountSession,
  StockLocation,
  StockReservation,
  StockReservationStatus,
  StockTransfer,
  Unit,
  Warehouse,
  WarehouseAssignment,
} from "@/types/domain";
import type {
  InventoryRepository,
  LocationUpdateInput,
  LocationWriteInput,
  ProductSerialWriteInput,
  StockAdjustmentPatch,
  StockAdjustmentWriteInput,
  StockCountPatch,
  StockCountWriteInput,
  StockReservationWriteInput,
  StockTransferPatch,
  StockTransferWriteInput,
  WarehouseUpdateInput,
  WarehouseWriteInput,
} from "../inventory.repository";
import { readStorage, writeStorage } from "./local-data";

const UNITS_KEY = "demo-units";
const BRANDS_KEY = "demo-brands";
const WAREHOUSES_KEY = "demo-warehouses";
const LOCATIONS_KEY = "demo-stock-locations";
const ASSIGNMENTS_KEY = "demo-warehouse-users";
const TRANSFERS_KEY = "demo-stock-transfers";
const ADJUSTMENTS_KEY = "demo-stock-adjustments";
const COUNTS_KEY = "demo-stock-counts";
const RESERVATIONS_KEY = "demo-stock-reservations";
const SERIALS_KEY = "demo-product-serials";

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
  private readAssignments(): WarehouseAssignment[] {
    return readStorage<WarehouseAssignment[]>(ASSIGNMENTS_KEY, []);
  }
  private saveAssignments(rows: WarehouseAssignment[]): void {
    writeStorage(ASSIGNMENTS_KEY, rows);
  }
  private readTransfers(): StockTransfer[] {
    return readStorage<StockTransfer[]>(TRANSFERS_KEY, []);
  }
  private saveTransfers(rows: StockTransfer[]): void {
    writeStorage(TRANSFERS_KEY, rows);
  }
  private readAdjustments(): StockAdjustment[] {
    return readStorage<StockAdjustment[]>(ADJUSTMENTS_KEY, []);
  }
  private saveAdjustments(rows: StockAdjustment[]): void {
    writeStorage(ADJUSTMENTS_KEY, rows);
  }
  private readCounts(): StockCountSession[] {
    return readStorage<StockCountSession[]>(COUNTS_KEY, []);
  }
  private saveCounts(rows: StockCountSession[]): void {
    writeStorage(COUNTS_KEY, rows);
  }
  private readReservations(): StockReservation[] {
    return readStorage<StockReservation[]>(RESERVATIONS_KEY, []);
  }
  private saveReservations(rows: StockReservation[]): void {
    writeStorage(RESERVATIONS_KEY, rows);
  }
  private readSerials(): ProductSerial[] {
    return readStorage<ProductSerial[]>(SERIALS_KEY, []);
  }
  private saveSerials(rows: ProductSerial[]): void {
    writeStorage(SERIALS_KEY, rows);
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
    this.saveUnits(this.readUnits().filter((u) => !(u.businessId === businessId && u.id === unitId)));
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
    this.saveBrands(this.readBrands().filter((b) => !(b.businessId === businessId && b.id === brandId)));
  }

  async listWarehouses(businessId: string): Promise<Warehouse[]> {
    return this.readWarehouses().filter((w) => w.businessId === businessId);
  }

  async createWarehouse(businessId: string, input: WarehouseWriteInput): Promise<Warehouse> {
    const now = new Date().toISOString();
    const warehouse: Warehouse = {
      id: `wh-${crypto.randomUUID()}`,
      businessId,
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
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
    input: WarehouseUpdateInput
  ): Promise<Warehouse> {
    const all = this.readWarehouses();
    const index = all.findIndex((w) => w.businessId === businessId && w.id === warehouseId);
    if (index === -1) throw new Error("Warehouse not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      code: input.code ?? all[index].code,
      address: input.address === undefined ? all[index].address : input.address,
      state: input.state === undefined ? all[index].state : input.state,
      pincode: input.pincode === undefined ? all[index].pincode : input.pincode,
      phone: input.phone === undefined ? all[index].phone : input.phone,
      email: input.email === undefined ? all[index].email : input.email,
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

  async createLocation(businessId: string, input: LocationWriteInput): Promise<StockLocation> {
    const now = new Date().toISOString();
    const location: StockLocation = {
      id: `loc-${crypto.randomUUID()}`,
      businessId,
      warehouseId: input.warehouseId,
      parentId: input.parentId ?? null,
      name: input.name,
      code: input.code,
      kind: input.kind ?? "main_store",
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
    input: LocationUpdateInput
  ): Promise<StockLocation> {
    const all = this.readLocations();
    const index = all.findIndex((l) => l.businessId === businessId && l.id === locationId);
    if (index === -1) throw new Error("Location not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      code: input.code ?? all[index].code,
      parentId: input.parentId === undefined ? all[index].parentId : input.parentId,
      kind: input.kind ?? all[index].kind,
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

  async listWarehouseAssignments(businessId: string, warehouseId?: string): Promise<WarehouseAssignment[]> {
    const allowed = new Set((await this.listWarehouses(businessId)).map((w) => w.id));
    return this.readAssignments().filter(
      (row) => allowed.has(row.warehouseId) && (!warehouseId || row.warehouseId === warehouseId)
    );
  }

  async setWarehouseAssignments(
    businessId: string,
    warehouseId: string,
    userIds: string[]
  ): Promise<WarehouseAssignment[]> {
    const warehouses = await this.listWarehouses(businessId);
    if (!warehouses.some((w) => w.id === warehouseId)) throw new Error("Warehouse not found.");
    const rest = this.readAssignments().filter((row) => row.warehouseId !== warehouseId);
    const next = userIds.map((userId) => ({
      warehouseId,
      userId,
      fullName: null,
      email: null,
    }));
    this.saveAssignments([...rest, ...next]);
    return next;
  }

  async listTransfers(businessId: string): Promise<StockTransfer[]> {
    return this.readTransfers()
      .filter((row) => row.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTransfer(businessId: string, transferId: string): Promise<StockTransfer | null> {
    return this.readTransfers().find((row) => row.businessId === businessId && row.id === transferId) ?? null;
  }

  async createTransfer(businessId: string, input: StockTransferWriteInput): Promise<StockTransfer> {
    const now = new Date().toISOString();
    const transfer: StockTransfer = {
      id: `tr-${crypto.randomUUID()}`,
      businessId,
      transferNo: input.transferNo,
      status: input.status ?? "draft",
      fromWarehouseId: input.fromWarehouseId,
      fromLocationId: input.fromLocationId ?? null,
      toWarehouseId: input.toWarehouseId,
      toLocationId: input.toLocationId ?? null,
      requestedBy: input.requestedBy ?? null,
      dispatchedBy: null,
      receivedBy: null,
      requestedAt: now,
      dispatchedAt: null,
      receivedAt: null,
      notes: input.notes ?? null,
      shortageReason: null,
      items: input.items.map((item) => ({
        id: `tri-${crypto.randomUUID()}`,
        productId: item.productId,
        variantId: item.variantId ?? null,
        batchId: item.batchId ?? null,
        quantity: item.quantity,
        dispatchedQuantity: 0,
        receivedQuantity: 0,
        shortageQuantity: 0,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readTransfers();
    all.push(transfer);
    this.saveTransfers(all);
    return transfer;
  }

  async updateTransfer(businessId: string, transferId: string, input: StockTransferPatch): Promise<StockTransfer> {
    const all = this.readTransfers();
    const index = all.findIndex((row) => row.businessId === businessId && row.id === transferId);
    if (index === -1) throw new Error("Transfer not found.");
    const current = all[index];
    all[index] = {
      ...current,
      status: input.status ?? current.status,
      dispatchedBy: input.dispatchedBy === undefined ? current.dispatchedBy : input.dispatchedBy,
      dispatchedAt: input.dispatchedAt === undefined ? current.dispatchedAt : input.dispatchedAt,
      receivedBy: input.receivedBy === undefined ? current.receivedBy : input.receivedBy,
      receivedAt: input.receivedAt === undefined ? current.receivedAt : input.receivedAt,
      notes: input.notes === undefined ? current.notes : input.notes,
      shortageReason: input.shortageReason === undefined ? current.shortageReason : input.shortageReason,
      items: input.items ?? current.items,
      updatedAt: new Date().toISOString(),
    };
    this.saveTransfers(all);
    return all[index];
  }

  async listAdjustments(businessId: string): Promise<StockAdjustment[]> {
    return this.readAdjustments()
      .filter((row) => row.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAdjustment(businessId: string, adjustmentId: string): Promise<StockAdjustment | null> {
    return this.readAdjustments().find((row) => row.businessId === businessId && row.id === adjustmentId) ?? null;
  }

  async createAdjustment(businessId: string, input: StockAdjustmentWriteInput): Promise<StockAdjustment> {
    const now = new Date().toISOString();
    const adjustment: StockAdjustment = {
      id: `adj-${crypto.randomUUID()}`,
      businessId,
      adjustmentNo: input.adjustmentNo,
      status: input.status ?? "draft",
      reason: input.reason,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
      requestedBy: input.requestedBy ?? null,
      approvedBy: null,
      postedAt: null,
      items: input.items.map((item) => ({
        id: `adji-${crypto.randomUUID()}`,
        productId: item.productId,
        variantId: item.variantId ?? null,
        batchId: item.batchId ?? null,
        change: item.change,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readAdjustments();
    all.push(adjustment);
    this.saveAdjustments(all);
    return adjustment;
  }

  async updateAdjustment(
    businessId: string,
    adjustmentId: string,
    input: StockAdjustmentPatch
  ): Promise<StockAdjustment> {
    const all = this.readAdjustments();
    const index = all.findIndex((row) => row.businessId === businessId && row.id === adjustmentId);
    if (index === -1) throw new Error("Adjustment not found.");
    const current = all[index];
    all[index] = {
      ...current,
      status: input.status ?? current.status,
      approvedBy: input.approvedBy === undefined ? current.approvedBy : input.approvedBy,
      postedAt: input.postedAt === undefined ? current.postedAt : input.postedAt,
      notes: input.notes === undefined ? current.notes : input.notes,
      items: input.items ?? current.items,
      updatedAt: new Date().toISOString(),
    };
    this.saveAdjustments(all);
    return all[index];
  }

  async listCounts(businessId: string): Promise<StockCountSession[]> {
    return this.readCounts()
      .filter((row) => row.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCount(businessId: string, countId: string): Promise<StockCountSession | null> {
    return this.readCounts().find((row) => row.businessId === businessId && row.id === countId) ?? null;
  }

  async createCount(businessId: string, input: StockCountWriteInput): Promise<StockCountSession> {
    const now = new Date().toISOString();
    const session: StockCountSession = {
      id: `cnt-${crypto.randomUUID()}`,
      businessId,
      countNo: input.countNo,
      status: input.status ?? "draft",
      warehouseId: input.warehouseId,
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
      countedBy: input.countedBy ?? null,
      approvedBy: null,
      postedAt: null,
      items: input.items.map((item) => ({
        id: `cnti-${crypto.randomUUID()}`,
        productId: item.productId,
        variantId: item.variantId ?? null,
        batchId: item.batchId ?? null,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity ?? null,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readCounts();
    all.push(session);
    this.saveCounts(all);
    return session;
  }

  async updateCount(businessId: string, countId: string, input: StockCountPatch): Promise<StockCountSession> {
    const all = this.readCounts();
    const index = all.findIndex((row) => row.businessId === businessId && row.id === countId);
    if (index === -1) throw new Error("Count not found.");
    const current = all[index];
    all[index] = {
      ...current,
      status: input.status ?? current.status,
      countedBy: input.countedBy === undefined ? current.countedBy : input.countedBy,
      approvedBy: input.approvedBy === undefined ? current.approvedBy : input.approvedBy,
      postedAt: input.postedAt === undefined ? current.postedAt : input.postedAt,
      notes: input.notes === undefined ? current.notes : input.notes,
      items: input.items ?? current.items,
      updatedAt: new Date().toISOString(),
    };
    this.saveCounts(all);
    return all[index];
  }

  async listReservations(
    businessId: string,
    filter?: { productId?: string; status?: StockReservationStatus; referenceId?: string }
  ): Promise<StockReservation[]> {
    return this.readReservations().filter((row) => {
      if (row.businessId !== businessId) return false;
      if (filter?.productId && row.productId !== filter.productId) return false;
      if (filter?.status && row.status !== filter.status) return false;
      if (filter?.referenceId && row.referenceId !== filter.referenceId) return false;
      return true;
    });
  }

  async createReservation(businessId: string, input: StockReservationWriteInput): Promise<StockReservation> {
    const now = new Date().toISOString();
    const reservation: StockReservation = {
      id: `rsv-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      batchId: input.batchId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      quantity: input.quantity,
      status: input.status ?? "open",
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readReservations();
    all.push(reservation);
    this.saveReservations(all);
    return reservation;
  }

  async updateReservationStatus(
    businessId: string,
    reservationId: string,
    status: StockReservationStatus
  ): Promise<StockReservation> {
    const all = this.readReservations();
    const index = all.findIndex((row) => row.businessId === businessId && row.id === reservationId);
    if (index === -1) throw new Error("Reservation not found.");
    all[index] = { ...all[index], status, updatedAt: new Date().toISOString() };
    this.saveReservations(all);
    return all[index];
  }

  async listSerials(businessId: string, productId?: string): Promise<ProductSerial[]> {
    return this.readSerials().filter(
      (row) => row.businessId === businessId && (!productId || row.productId === productId)
    );
  }

  async createSerial(businessId: string, input: ProductSerialWriteInput): Promise<ProductSerial> {
    const now = new Date().toISOString();
    const serial: ProductSerial = {
      id: `ser-${crypto.randomUUID()}`,
      businessId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      serialNo: input.serialNo,
      imei: input.imei ?? null,
      warrantyMonths: input.warrantyMonths ?? null,
      warrantyExpiresOn: input.warrantyExpiresOn ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      batchId: input.batchId ?? null,
      status: input.status ?? "in_stock",
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readSerials();
    all.push(serial);
    this.saveSerials(all);
    return serial;
  }

  async updateSerial(
    businessId: string,
    serialId: string,
    input: Partial<ProductSerialWriteInput>
  ): Promise<ProductSerial> {
    const all = this.readSerials();
    const index = all.findIndex((row) => row.businessId === businessId && row.id === serialId);
    if (index === -1) throw new Error("Serial not found.");
    const current = all[index];
    all[index] = {
      ...current,
      serialNo: input.serialNo ?? current.serialNo,
      imei: input.imei === undefined ? current.imei : input.imei,
      warrantyMonths: input.warrantyMonths === undefined ? current.warrantyMonths : input.warrantyMonths,
      warrantyExpiresOn: input.warrantyExpiresOn === undefined ? current.warrantyExpiresOn : input.warrantyExpiresOn,
      warehouseId: input.warehouseId === undefined ? current.warehouseId : input.warehouseId,
      locationId: input.locationId === undefined ? current.locationId : input.locationId,
      batchId: input.batchId === undefined ? current.batchId : input.batchId,
      status: input.status ?? current.status,
      referenceType: input.referenceType === undefined ? current.referenceType : input.referenceType,
      referenceId: input.referenceId === undefined ? current.referenceId : input.referenceId,
      updatedAt: new Date().toISOString(),
    };
    this.saveSerials(all);
    return all[index];
  }
}
