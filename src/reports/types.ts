export type ReportColumnType = "text" | "number" | "currency" | "date" | "status" | "qty";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
  align?: "left" | "right";
  sortable?: boolean;
}

export type ReportFilterType = "date-range" | "select" | "search" | "number";

export interface ReportFilterDef {
  key: string;
  label: string;
  type: ReportFilterType;
  optionsFrom?:
    | "warehouses"
    | "locations"
    | "categories"
    | "brands"
    | "products"
    | "suppliers"
    | "batches"
    | "status"
    | "movementType";
}

export type StockReportCategory =
  | "position"
  | "movement"
  | "analysis"
  | "valuation"
  | "batch"
  | "warehouse"
  | "control";

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: StockReportCategory;
  filters: ReportFilterDef[];
  columns: ReportColumn[];
}

export interface ReportSummaryItem {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number" | "qty";
}

export type ReportCell = string | number | null;

export type ReportRow = Record<string, ReportCell>;

export interface ReportResult {
  reportId: string;
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: Record<string, number>;
  summary: ReportSummaryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface StockReportQuery {
  reportId: string;
  from: string;
  to: string;
  warehouseId?: string | null;
  locationId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  productId?: string | null;
  sku?: string | null;
  supplierId?: string | null;
  batchId?: string | null;
  status?: string | null;
  movementType?: string | null;
  search?: string | null;
  nearExpiryDays?: number;
  fastThreshold?: number;
  deadDays?: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface StockFilterOptions {
  warehouses: FilterOption[];
  locations: Array<FilterOption & { warehouseId: string }>;
  categories: FilterOption[];
  brands: FilterOption[];
  products: FilterOption[];
  suppliers: FilterOption[];
  batches: FilterOption[];
  statuses: FilterOption[];
  movementTypes: FilterOption[];
}

export interface SavedReportView {
  id: string;
  name: string;
  reportId: string;
  filters: Omit<StockReportQuery, "page" | "pageSize" | "sortBy" | "sortDir">;
  createdAt: string;
}
