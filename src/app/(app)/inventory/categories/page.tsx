"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags } from "lucide-react";
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
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import type { Category } from "@/types/domain";

export default function CategoriesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
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

  const createCategory = async () => {
    if (!business || !user) return;
    if (!name.trim()) {
      toastError("Name required", "Give the category a name.");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().products.createCategory(business.id, user.id, {
        name,
        description: description || null,
      });
      toastSuccess("Category added", `“${name.trim()}” was created.`);
      setName("");
      setDescription("");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toastError("Could not add category", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organise your products into groups."
        actions={
          <Button onClick={() => setOpen(true)}>
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
            description="Categories help you organise products and keep your catalogue tidy."
            action={{ label: "Add category", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category: Category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium text-foreground">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add category"
        description="Categories group related products together."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createCategory()} loading={saving}>
              Add category
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
              placeholder="e.g. Apparel"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="category-description">
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
