"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
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
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import type { Unit } from "@/types/domain";

export default function UnitsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Unit | null>(null);
  const [deleting, setDeleting] = React.useState<Unit | null>(null);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const { data: units, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["units", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listUnits(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading units…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load units"
      />
    );
  }

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setFormOpen(true);
  };
  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setName(unit.name);
    setCode(unit.code);
    setFormOpen(true);
  };

  const save = async () => {
    if (!business || !user) return;
    if (!name.trim() || !code.trim()) {
      toastError("Missing details", "Unit name and code are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await getClientServices().products.updateUnit(business.id, user.id, editing.id, {
          name: name.trim(),
          code: code.trim().toLowerCase(),
        });
        toastSuccess("Unit updated", "Your changes were saved.");
      } else {
        await getClientServices().products.createUnit(business.id, user.id, {
          name: name.trim(),
          code: code.trim().toLowerCase(),
        });
        toastSuccess("Unit added", "The unit was created.");
      }
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    } catch (err) {
      toastError("Could not save unit", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!business || !user || !deleting) return;
    try {
      await getClientServices().products.deleteUnit(business.id, user.id, deleting.id);
      toastSuccess("Unit deleted", "The unit was removed.");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    } catch (err) {
      toastError("Could not delete unit", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title="Units"
        description="Units of measure used across your catalogue."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add unit
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {!units || units.length === 0 ? (
          <EmptyState
            icon={<Ruler className="size-6" />}
            title="No units yet"
            description="Add units like piece, kg, box or dozen to describe your products."
            action={{ label: "Add unit", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium text-foreground">{unit.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {unit.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.isActive ? "success" : "secondary"}>
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(unit)} aria-label={`Edit ${unit.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(unit)}
                          aria-label={`Delete ${unit.name}`}
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
        title={editing ? "Edit unit" : "Add unit"}
        description="A unit of measure for products and stock."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {editing ? "Save changes" : "Add unit"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="unit-name" required>
            <Input id="unit-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Piece" autoFocus />
          </Field>
          <Field
            label="Code"
            htmlFor="unit-code"
            required
            hint="Short identifier used in reports, e.g. pcs, kg, box."
          >
            <Input id="unit-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. pcs" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete unit"
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
          Products using this unit keep their current value; new products will need a different unit.
        </p>
      </Modal>
    </div>
  );
}
