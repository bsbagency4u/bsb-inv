"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductWithStock } from "@/types/domain";

export default function ProductsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listCategories(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q) ||
        (product.hsn ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  if (isLoading) return <LoadingState label="Loading products…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load products"
      />
    );
  }

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Your product catalogue with prices, GST and stock levels."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add product
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search products…"
            className="w-full max-w-sm"
            aria-label="Search products"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </span>
        </div>

        {!products || products.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" />}
            title="No products yet"
            description="Add your first product to start tracking stock and sales."
            action={{ label: "Add product", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sale price</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    currency={business?.currency ?? "INR"}
                    categoryName={
                      categories?.find((c) => c.id === product.categoryId)?.name ?? "—"
                    }
                    onEdit={() => openEdit(product)}
                    onDelete={() => setDeleting(product)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit product" : "Add product"}
        description="Configure pricing, GST and stock thresholds."
        size="xl"
      >
        {business && user ? (
          <ProductForm
            businessType={business.type}
            categories={categories ?? []}
            product={editing}
            submitLabel={editing ? "Save changes" : "Add product"}
            onSubmit={async (values) => {
              try {
                if (editing) {
                  await getClientServices().products.updateProduct(
                    business.id,
                    user.id,
                    editing.id,
                    values
                  );
                  toastSuccess("Product updated", "Your changes were saved.");
                } else {
                  await getClientServices().products.createProduct(
                    business.id,
                    user.id,
                    values
                  );
                  toastSuccess("Product added", "The product was created.");
                }
                setFormOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["products"] });
              } catch (err) {
                toastError("Could not save product", normalizeError(err).userMessage);
              }
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete product"
        description={
          deleting
            ? `Delete “${deleting.name}”? This cannot be undone, and stock history for it will be removed.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleting || !business || !user) return;
                try {
                  await getClientServices().products.deleteProduct(business.id, user.id, deleting.id);
                  toastSuccess("Product deleted", "The product was removed.");
                  setDeleting(null);
                  await queryClient.invalidateQueries({ queryKey: ["products"] });
                } catch (err) {
                  toastError("Could not delete product", normalizeError(err).userMessage);
                }
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This will permanently remove the product from your catalogue.
        </p>
      </Modal>
    </div>
  );
}

function ProductRow({
  product,
  currency,
  categoryName,
  onEdit,
  onDelete,
}: {
  product: ProductWithStock;
  currency: string;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const low = product.lowStockThreshold > 0 && product.stockQuantity <= product.lowStockThreshold;
  const out = product.stockQuantity <= 0;

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {product.sku ? `SKU ${product.sku}` : "No SKU"}
        </p>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{categoryName}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm tabular-nums text-foreground">
          {formatCurrency(product.salePrice, currency)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={product.gstRate > 0 ? "info" : "secondary"}>
          {product.gstRate}%{product.hsn ? ` · ${product.hsn}` : ""}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Badge variant={out ? "destructive" : low ? "warning" : "success"}>
          {product.stockQuantity} {product.unit}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${product.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete ${product.name}`}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
