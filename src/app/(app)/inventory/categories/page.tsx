"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import type { Category } from "@/types/domain";

function treeName(categories: Category[], id: string | null): string {
  if (!id) return "—";
  const category = categories.find((c) => c.id === id);
  if (!category) return "—";
  const parent = treeName(categories, category.parentId);
  return parent === "—" ? category.name : `${parent} / ${category.name}`;
}

export default function CategoriesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("");
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const { data: categories, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["categories", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listCategories(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading categories…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load categories"
      />
    );
  }

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setParentId("");
    setActive(true);
    setFormOpen(true);
  };
  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setParentId(category.parentId ?? "");
    setActive(category.isActive);
    setFormOpen(true);
  };

  const save = async () => {
    if (!business || !user) return;
    if (!name.trim()) {
      toastError("Name required", "Give the category a name.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await getClientServices().products.updateCategory(business.id, user.id, editing.id, {
          name: name.trim(),
          description: description || null,
          parentId: parentId || null,
          isActive: active,
        });
        toastSuccess("Category updated", "Your changes were saved.");
      } else {
        await getClientServices().products.createCategory(business.id, user.id, {
          name: name.trim(),
          description: description || null,
          parentId: parentId || null,
        });
        toastSuccess("Category added", "The category was created.");
      }
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toastError("Could not save category", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!business || !user || !deleting) return;
    try {
      await getClientServices().products.deleteCategory(business.id, user.id, deleting.id);
      toastSuccess("Category deleted", "The category was removed.");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toastError("Could not delete category", normalizeError(err).userMessage);
    }
  };

  const parentOptions = (categories ?? []).filter((c) => c.id !== editing?.id);

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organise your products into a hierarchy."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add category
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {!categories || categories.length === 0 ? (
          <EmptyState
            icon={<Tags className="size-6" />}
            title="No categories yet"
            description="Categories group products, and can be nested, e.g. Electronics → Mobile."
            action={{ label: "Add category", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {treeName(categories, category.id)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {category.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.isActive ? "success" : "secondary"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(category)}
                          aria-label={`Delete ${category.name}`}
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
        title={editing ? "Edit category" : "Add category"}
        description="Categories can be nested under a parent."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {editing ? "Save changes" : "Add category"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="category-name" required>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Mobile"
              autoFocus
            />
          </Field>
          <Field label="Parent category" htmlFor="category-parent">
            <Select
              id="category-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">None (top level)</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {treeName(categories ?? [], category.id)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="category-description">
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />
          </Field>
          {editing ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-subtle px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-xs text-muted-foreground">Show this category when cataloguing products.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Category active" />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete category"
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
          Products using this category will be left without a category. Child categories are removed too.
        </p>
      </Modal>
    </div>
  );
}
