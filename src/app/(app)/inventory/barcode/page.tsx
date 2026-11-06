"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanBarcode } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ProductWithStock, SellableLot } from "@/types/domain";

function matchProduct(products: ProductWithStock[], query: string): ProductWithStock | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    products.find(
      (product) =>
        product.barcode?.toLowerCase() === q ||
        product.sku?.toLowerCase() === q ||
        product.name.toLowerCase() === q
    ) ??
    products.find(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q) ||
        (product.barcode ?? "").toLowerCase().includes(q)
    ) ??
    null
  );
}

export default function BarcodePage() {
  const { business } = useSession();
  const { error: toastError } = useToast();
  const [scan, setScan] = React.useState("");
  const [matched, setMatched] = React.useState<ProductWithStock | null>(null);
  const [copies, setCopies] = React.useState("1");
  const [printProductId, setPrintProductId] = React.useState("");
  const printRef = React.useRef<HTMLDivElement>(null);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: defaults } = useQuery({
    queryKey: ["inventory-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.getInventoryDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: lots } = useQuery({
    queryKey: ["sellable-lots", business?.id, matched?.id],
    queryFn: async () => {
      if (!business || !matched) return [] as SellableLot[];
      return getClientServices().inventory.listSellableLots(business.id, { productId: matched.id });
    },
    enabled: Boolean(business && matched),
  });

  const printProduct = (products ?? []).find((p) => p.id === printProductId) ?? matched;
  const labelCount = Math.max(1, Math.min(48, Math.trunc(Number(copies) || 1)));
  const perRow = defaults?.labelsPerRow ?? 3;
  const widthMm = defaults?.labelWidthMm ?? 50;
  const heightMm = defaults?.labelHeightMm ?? 30;

  const runScan = () => {
    const product = matchProduct(products ?? [], scan);
    if (!product) {
      toastError("Product not found", "No product matches that barcode or SKU.");
      setMatched(null);
      return;
    }
    setMatched(product);
    setPrintProductId(product.id);
  };

  const printLabels = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "labels", "width=800,height=600");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Labels</title><style>
      body { font-family: sans-serif; margin: 12px; }
      .sheet { display: grid; grid-template-columns: repeat(${perRow}, ${widthMm}mm); gap: 4mm; }
      .label { width: ${widthMm}mm; height: ${heightMm}mm; border: 1px solid #111; padding: 2mm; box-sizing: border-box; overflow: hidden; }
      .name { font-size: 11px; font-weight: 700; }
      .code { font-family: ui-monospace, monospace; font-size: 10px; letter-spacing: 0.08em; margin-top: 2px; }
      .meta { font-size: 10px; margin-top: 2px; }
    </style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  if (isLoading) return <LoadingState label="Loading barcode tools…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load barcode tools"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Barcode"
        description="Scan a barcode or SKU to see available lots, then print labels from product or batch data."
      />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="size-4" />
              Scan
            </CardTitle>
            <CardDescription>Lookup by barcode, SKU or name. Available lots follow FEFO and hide reserved or blocked stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Barcode / SKU" htmlFor="barcode-scan">
              <div className="flex gap-2">
                <Input
                  id="barcode-scan"
                  value={scan}
                  onChange={(event) => setScan(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      runScan();
                    }
                  }}
                  placeholder="Scan or type"
                  autoFocus
                />
                <Button onClick={runScan} disabled={!scan.trim()}>
                  Lookup
                </Button>
              </div>
            </Field>
            {matched ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">{matched.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[matched.sku ? `SKU ${matched.sku}` : null, matched.barcode ? `BC ${matched.barcode}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No code"}
                  </p>
                </div>
                {(lots ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No available lots for this product.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {(lots ?? []).map((lot, index) => (
                      <li key={`${lot.batchId ?? "none"}-${index}`} className="flex justify-between gap-3">
                        <span>
                          {lot.batchNo ?? "No batch"}
                          {lot.expiryDate ? ` · exp ${formatDate(lot.expiryDate)}` : ""}
                        </span>
                        <span className="tabular-nums">
                          {lot.quantity}
                          {lot.mrp != null ? ` · MRP ${formatCurrency(lot.mrp)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<ScanBarcode className="size-6" />}
                title="Scan a product"
                description="Use a scanner or type a barcode to see sellable lots."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print labels</CardTitle>
            <CardDescription>
              Size {widthMm} x {heightMm} mm, {perRow} per row. Configure size under Settings / Inventory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Product" htmlFor="label-product">
              <Select
                id="label-product"
                value={printProductId}
                onChange={(event) => setPrintProductId(event.target.value)}
              >
                <option value="">Select product</option>
                {(products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Copies" htmlFor="label-copies">
              <Input
                id="label-copies"
                type="number"
                min={1}
                max={48}
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
              />
            </Field>
            <Button onClick={printLabels} disabled={!printProduct}>
              Print labels
            </Button>
            <div className="hidden">
              <div ref={printRef}>
                {printProduct ? (
                  <div className="sheet">
                    {Array.from({ length: labelCount }).map((_, index) => (
                      <div className="label" key={index}>
                        <div className="name">{printProduct.name}</div>
                        <div className="code">{printProduct.barcode || printProduct.sku || printProduct.id}</div>
                        <div className="meta">
                          {defaults?.showMrpOnLabel && printProduct.mrp != null
                            ? `MRP ${formatCurrency(printProduct.mrp)}`
                            : ""}
                          {defaults?.showBatchOnLabel && (lots?.[0]?.batchNo ?? "")
                            ? ` · ${lots?.[0]?.batchNo}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
