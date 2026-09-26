"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RotateCcw, Save } from "lucide-react";
import { getClientServices } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { STOCK_REPORT_CATEGORIES, STOCK_REPORT_DEFINITIONS } from "@/reports/definitions";
import { downloadCsv, printReport, reportToCsv } from "@/reports/export";
import { DEFAULT_PAGE_SIZE, defaultPeriod } from "@/reports/stock-math";
import { deleteSavedView, listSavedViews, saveReportView } from "@/reports/saved-views";
import type { ReportColumn, ReportResult, ReportRow, StockFilterOptions, StockReportQuery } from "@/reports/types";
import type { StockReportCategory } from "@/reports/types";

function emptyQuery(reportId: string): StockReportQuery {
  const period = defaultPeriod();
  return {
    reportId,
    from: period.from,
    to: period.to,
    warehouseId: null,
    locationId: null,
    categoryId: null,
    brandId: null,
    productId: null,
    sku: null,
    supplierId: null,
    batchId: null,
    status: null,
    movementType: null,
    search: null,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

function statusVariant(value: string): "success" | "warning" | "destructive" | "info" | "secondary" {
  const key = value.toLowerCase();
  if (key === "in" || key === "fast" || key === "a") return "success";
  if (key === "low" || key === "slow" || key === "near-expiry" || key === "b") return "warning";
  if (key === "out" || key === "negative" || key === "expired" || key === "non-moving") return "destructive";
  if (key === "c") return "info";
  return "secondary";
}

function formatCell(column: ReportColumn, value: ReportRow[string], currency: string): React.ReactNode {
  if (value == null || value === "") return "—";
  if (column.type === "currency") return formatCurrency(Number(value), currency);
  if (column.type === "qty" || column.type === "number") {
    return typeof value === "number" ? formatNumber(value) : value;
  }
  if (column.type === "date") return formatDate(String(value));
  if (column.type === "status") {
    return <Badge variant={statusVariant(String(value))}>{String(value)}</Badge>;
  }
  return String(value);
}

export function StockReportsCentre({
  businessId,
  currency,
}: {
  businessId: string;
  currency: string;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [category, setCategory] = React.useState<StockReportCategory>("position");
  const [draft, setDraft] = React.useState<StockReportQuery>(() => emptyQuery("stock-summary"));
  const [applied, setApplied] = React.useState<StockReportQuery>(() => emptyQuery("stock-summary"));
  const [viewName, setViewName] = React.useState("");
  const [viewsVersion, setViewsVersion] = React.useState(0);

  const definition = STOCK_REPORT_DEFINITIONS.find((item) => item.id === applied.reportId) ?? STOCK_REPORT_DEFINITIONS[0];
  const reports = STOCK_REPORT_DEFINITIONS.filter((item) => item.category === category);

  const optionsQuery = useQuery({
    queryKey: ["stock-report-filters", businessId],
    queryFn: () => getClientServices().reports.stockFilterOptions(businessId),
  });

  const reportQuery = useQuery({
    queryKey: ["stock-report", businessId, applied],
    queryFn: () => getClientServices().reports.runStockReport(businessId, applied),
  });

  const savedViews = viewsVersion >= 0 ? listSavedViews(businessId, applied.reportId) : [];

  const options = optionsQuery.data;

  function selectReport(reportId: string) {
    const next = { ...emptyQuery(reportId), from: draft.from, to: draft.to };
    setDraft(next);
    setApplied(next);
  }

  function applyFilters() {
    setApplied({ ...draft, page: 1 });
  }

  function resetFilters() {
    const next = emptyQuery(draft.reportId);
    setDraft(next);
    setApplied(next);
  }

  function saveView() {
    if (!viewName.trim()) {
      toastError("Name required", "Enter a name for this view.");
      return;
    }
    saveReportView(businessId, viewName, applied);
    setViewName("");
    setViewsVersion((value) => value + 1);
    toastSuccess("View saved");
  }

  function loadView(id: string) {
    const view = savedViews.find((item) => item.id === id);
    if (!view) return;
    const next: StockReportQuery = { ...emptyQuery(view.reportId), ...view.filters, page: 1, pageSize: DEFAULT_PAGE_SIZE };
    setDraft(next);
    setApplied(next);
  }

  function exportCsv(result: ReportResult) {
    downloadCsv(`${result.reportId}-${applied.from}-to-${applied.to}`, reportToCsv(result));
  }

  const result = reportQuery.data;

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-surface p-3">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock reports</p>
        <div className="space-y-3">
          {STOCK_REPORT_CATEGORIES.map((item) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setCategory(item.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold ${
                  category === item.id ? "bg-primary-muted text-primary" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {item.label}
              </button>
              {category === item.id ? (
                <div className="mt-1 space-y-0.5">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => selectReport(report.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        applied.reportId === report.id
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {report.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">{definition.title}</h2>
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {definition.filters.map((filter) => (
              <FilterControl
                key={filter.key}
                filterKey={filter.key}
                label={filter.label}
                type={filter.type}
                optionsFrom={filter.optionsFrom}
                options={options}
                query={draft}
                onChange={setDraft}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Field label="Save view" className="w-44">
              <Input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="View name" />
            </Field>
            <Button variant="outline" onClick={saveView}>
              <Save className="size-4" />
              Save
            </Button>
            {savedViews.length > 0 ? (
              <Field label="Saved views" className="w-48">
                <Select
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith("del:")) {
                      deleteSavedView(businessId, value.slice(4));
                      setViewsVersion((current) => current + 1);
                      return;
                    }
                    if (value) loadView(value);
                  }}
                >
                  <option value="">Load view…</option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                disabled={!result}
                onClick={() => result && exportCsv(result)}
              >
                <Download className="size-4" />
                Export
              </Button>
              <Button
                variant="outline"
                disabled={!result}
                onClick={() => result && printReport(result.title, result.columns, result.rows)}
              >
                <Printer className="size-4" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {result?.summary.length ? (
          <div className="flex flex-wrap gap-2">
            {result.summary.map((item) => (
              <Badge key={item.key} variant="info" className="px-3 py-1 text-sm">
                {item.label}:{" "}
                {item.format === "currency"
                  ? formatCurrency(item.value, currency)
                  : formatNumber(item.value)}
              </Badge>
            ))}
          </div>
        ) : null}

        {reportQuery.isLoading ? (
          <LoadingState label="Loading report…" />
        ) : reportQuery.isError ? (
          <ErrorState
            error={normalizeError(reportQuery.error).userMessage}
            onRetry={() => reportQuery.refetch()}
            title="Could not load report"
          />
        ) : !result || result.rows.length === 0 ? (
          <EmptyState
            title="No data for this report"
            description="Adjust filters or record stock movements to populate this report."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={column.align === "right" ? "text-right" : undefined}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, index) => (
                  <TableRow key={`${row.productId ?? row.date ?? index}-${index}`}>
                    {result.columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.align === "right" ? "text-right tabular-nums" : undefined}
                      >
                        {formatCell(column, row[column.key], currency)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              totalItems={result.totalCount}
              onPageChange={(page) => setApplied((current) => ({ ...current, page }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterControl({
  filterKey,
  label,
  type,
  optionsFrom,
  options,
  query,
  onChange,
}: {
  filterKey: string;
  label: string;
  type: "date-range" | "select" | "search" | "number";
  optionsFrom?: keyof StockFilterOptions | "warehouses" | "locations" | "categories" | "brands" | "products" | "suppliers" | "batches" | "status" | "movementType";
  options?: StockFilterOptions;
  query: StockReportQuery;
  onChange: React.Dispatch<React.SetStateAction<StockReportQuery>>;
}) {
  const value = (query as unknown as Record<string, unknown>)[filterKey];
  if (filterKey === "from" || filterKey === "to" || type === "date-range") {
    const key = filterKey === "to" ? "to" : "from";
    return (
      <Field label={label}>
        <Input
          type="date"
          value={String(query[key] ?? "")}
          onChange={(event) => onChange((current) => ({ ...current, [key]: event.target.value }))}
        />
      </Field>
    );
  }
  if (type === "search") {
    return (
      <Field label={label}>
        <Input
          value={String(value ?? "")}
          onChange={(event) => onChange((current) => ({ ...current, [filterKey]: event.target.value || null }))}
          placeholder={label}
        />
      </Field>
    );
  }
  const list =
    optionsFrom === "warehouses"
      ? options?.warehouses
      : optionsFrom === "locations"
        ? options?.locations.filter((item) => !query.warehouseId || item.warehouseId === query.warehouseId)
        : optionsFrom === "categories"
          ? options?.categories
          : optionsFrom === "brands"
            ? options?.brands
            : optionsFrom === "products"
              ? options?.products
              : optionsFrom === "suppliers"
                ? options?.suppliers
                : optionsFrom === "batches"
                  ? options?.batches
                  : optionsFrom === "status"
                    ? options?.statuses
                    : optionsFrom === "movementType"
                      ? options?.movementTypes
                      : [];
  return (
    <Field label={label}>
      <Select
        value={String(value ?? "")}
        onChange={(event) =>
          onChange((current) => ({ ...current, [filterKey]: event.target.value || null, page: 1 }))
        }
      >
        <option value="">All</option>
        {(list ?? []).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
