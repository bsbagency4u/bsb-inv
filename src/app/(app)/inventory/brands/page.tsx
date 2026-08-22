"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import type { Brand } from "@/types/domain";

export default function BrandsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [deleting, setDeleting] = React.useState<Brand | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const { data: brands, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["brands", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listBrands(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading brands…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load brands"
      />
    );
  }

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setFormOpen(true);
  };
  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setName(brand.name);
    setDescription(brand.description ?? "");
    setFormOpen(true);
  };

  const save = async () => {
    if (!business || !user) return;
    if (!name.trim()) {
      toastError("Name required", "Give the brand a name.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await getClientServices().products.updateBrand(business.id, user.id, editing.id, {
          name: name.trim(),
          description: description || null,
        });
        toastSuccess("Brand updated", "Your changes were saved.");
      } else {
        await getClientServices().products.createBrand(business.id, user.id, {
          name: name.trim(),
          description: description || null,
        });
        toastSuccess("Brand added", "The brand was created.");
      }
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["brands"] });
    } catch (err) {
      toastError("Could not save brand", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!business || !user || !deleting) return;
    try {
      await getClientServices().products.deleteBrand(business.id, user.id, deleting.id);
      toastSuccess("Brand deleted", "The brand was removed.");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["brands"] });
    } catch (err) {
      toastError("Could not delete brand", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Brands you stock across your catalogue."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add brand
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {!brands || brands.length === 0 ? (
          <EmptyState
            icon={<Pencil className="size-6" />}
            title="No brands yet"
            description="Add brands like the manufacturers or labels you carry."
            action={{ label: "Add brand", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium text-foreground">{brand.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {brand.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={brand.isActive ? "success" : "secondary"}>
                        {brand.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(brand)} aria-label={`Edit ${brand.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(brand)}
                          aria-label={`Delete ${brand.name}`}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit brand" : "Add brand"}
        description="A brand or manufacturer for products."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {editing ? "Save changes" : "Add brand"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="brand-name" required>
            <Input id="brand-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nike" autoFocus />
          </Field>
          <Field label="Description" htmlFor="brand-description">
            <Textarea
              id="brand-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete brand"
        description={deleting ? `Delete “${deleting.name}”?` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Products using this brand keep their current value; the brand is removed from your list.
        </p>
      </Modal>
    </div>
  );
}
