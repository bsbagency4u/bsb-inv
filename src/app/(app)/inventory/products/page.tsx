"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Layers, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";
import { VariantForm } from "@/components/products/variant-form";
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
  const [variantsFor, setVariantsFor] = React.useState<Product | null>(null);
  const [imagesFor, setImagesFor] = React.useState<Product | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const { data: brands } = useQuery({
    queryKey: ["brands", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listBrands(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: units } = useQuery({
    queryKey: ["units", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listUnits(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: variants } = useQuery({
    queryKey: ["product-variants", business?.id, variantsFor?.id],
    queryFn: async () => {
      if (!business || !variantsFor) return [];
      return getClientServices().products.listVariants(business.id, variantsFor.id);
    },
    enabled: Boolean(business && variantsFor),
  });

  const { data: images } = useQuery({
    queryKey: ["product-images", business?.id, imagesFor?.id],
    queryFn: async () => {
      if (!business || !imagesFor) return [];
      return getClientServices().products.listImages(business.id, imagesFor.id);
    },
    enabled: Boolean(business && imagesFor),
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
                    onVariants={() => setVariantsFor(product)}
                    onImages={() => setImagesFor(product)}
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
            brands={brands ?? []}
            units={units ?? []}
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
        open={Boolean(variantsFor)}
        onClose={() => setVariantsFor(null)}
        title={variantsFor ? `Variants: ${variantsFor.name}` : "Variants"}
        description="Add variants like sizes or colours with their own SKUs and prices."
        size="xl"
      >
        {variantsFor && business && user ? (
          <div className="space-y-4">
            {variants && variants.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Attributes</TableHead>
                      <TableHead className="text-right">Sale price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium text-foreground">
                          {variant.sku ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {variant.barcode ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Object.entries(variant.attributes)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {variant.salePrice !== null && variant.salePrice !== undefined
                            ? formatCurrency(variant.salePrice, business.currency)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={async () => {
                              try {
                                await getClientServices().products.deleteVariant(
                                  business.id,
                                  user.id,
                                  variant.id
                                );
                                toastSuccess("Variant deleted", "The variant was removed.");
                                await queryClient.invalidateQueries({
                                  queryKey: ["product-variants", business.id, variantsFor.id],
                                });
                              } catch (err) {
                                toastError("Could not delete variant", normalizeError(err).userMessage);
                              }
                            }}
                            aria-label={`Delete variant ${variant.sku ?? ""}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={<Layers className="size-6" />}
                title="No variants yet"
                description="Variants let you track stock for each size, colour or option separately."
              />
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-foreground">Add a variant</p>
              <VariantForm
                businessType={business.type}
                onSubmit={async (values) => {
                  try {
                    await getClientServices().products.createVariant(business.id, user.id, {
                      productId: variantsFor.id,
                      sku: values.sku || null,
                      barcode: values.barcode || null,
                      attributes: values.attributes ?? {},
                      salePrice: values.salePrice ?? null,
                      purchasePrice: values.purchasePrice ?? null,
                      mrp: values.mrp ?? null,
                    });
                    toastSuccess("Variant added", "The variant was created.");
                    await queryClient.invalidateQueries({
                      queryKey: ["product-variants", business.id, variantsFor.id],
                    });
                  } catch (err) {
                    toastError("Could not add variant", normalizeError(err).userMessage);
                  }
                }}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(imagesFor)}
        onClose={() => setImagesFor(null)}
        title={imagesFor ? `Images: ${imagesFor.name}` : "Images"}
        description="Upload photos to Supabase Storage; only the URL is stored in the catalogue."
        size="lg"
      >
        {imagesFor && business && user ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images && images.length > 0 ? (
                images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-subtle"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={imagesFor.name}
                      className="size-full object-cover"
                    />
                    {image.isPrimary ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        Primary
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await getClientServices().storage.deleteProductImage(
                            business.id,
                            image.storagePath
                          );
                          await getClientServices().products.removeImage(
                            business.id,
                            user.id,
                            image.id
                          );
                          toastSuccess("Image removed", "The image was deleted.");
                          await queryClient.invalidateQueries({
                            queryKey: ["product-images", business.id, imagesFor.id],
                          });
                        } catch (err) {
                          toastError("Could not remove image", normalizeError(err).userMessage);
                        }
                      }}
                      className="absolute right-1.5 top-1.5 rounded bg-surface/90 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center gap-2 py-8 text-center">
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No images yet. Upload one to show your product.
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  const { storagePath, url } =
                    await getClientServices().storage.uploadProductImage(
                      business.id,
                      imagesFor.id,
                      file
                    );
                  await getClientServices().products.addImage(business.id, user.id, {
                    productId: imagesFor.id,
                    storagePath,
                    url,
                    position: images?.length ?? 0,
                    isPrimary: !images || images.length === 0,
                  });
                  toastSuccess("Image uploaded", "The image was added.");
                  await queryClient.invalidateQueries({
                    queryKey: ["product-images", business.id, imagesFor.id],
                  });
                } catch (err) {
                  toastError("Could not upload image", normalizeError(err).userMessage);
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              <Plus className="size-4" />
              Upload image
            </Button>
          </div>
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
  onVariants,
  onImages,
}: {
  product: ProductWithStock;
  currency: string;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onVariants: () => void;
  onImages: () => void;
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
          <Button variant="ghost" size="icon-sm" onClick={onImages} aria-label={`Images for ${product.name}`}>
            <ImagePlus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onVariants} aria-label={`Variants for ${product.name}`}>
            <Layers className="size-4" />
          </Button>
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
