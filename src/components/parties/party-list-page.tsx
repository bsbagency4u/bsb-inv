"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Users, Truck } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { PartyForm } from "@/components/parties/party-form";
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
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import type { PartyValues } from "@/lib/validation/schemas";
import type { Customer, Supplier } from "@/types/domain";

type PartyKind = "customer" | "supplier";

export function PartyListPage({ kind }: { kind: PartyKind }) {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | Supplier | null>(null);
  const [deleting, setDeleting] = React.useState<Customer | Supplier | null>(null);

  const queryKey = [kind === "customer" ? "customers" : "suppliers", business?.id];

  const { data: parties, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return kind === "customer"
        ? getClientServices().parties.listCustomers(business.id)
        : getClientServices().parties.listSuppliers(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!parties) return [];
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(q) ||
        (party.phone ?? "").includes(q) ||
        (party.city ?? "").toLowerCase().includes(q)
    );
  }, [parties, search]);

  if (isLoading) return <LoadingState label={`Loading ${kind}s…`} />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title={`Could not load ${kind}s`}
      />
    );
  }

  const isCustomer = kind === "customer";

  const saveParty = async (values: PartyValues) => {
    if (!business || !user) return;
    try {
      if (editing) {
        if (isCustomer) {
          await getClientServices().parties.updateCustomer(business.id, user.id, editing.id, values);
        } else {
          await getClientServices().parties.updateSupplier(business.id, user.id, editing.id, values);
        }
        toastSuccess("Saved", "The record was updated.");
      } else if (isCustomer) {
        await getClientServices().parties.createCustomer(business.id, user.id, values);
        toastSuccess("Customer added", "The customer was created.");
      } else {
        await getClientServices().parties.createSupplier(business.id, user.id, values);
        toastSuccess("Supplier added", "The supplier was created.");
      }
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      toastError("Could not save", normalizeError(err).userMessage);
    }
  };

  const deleteParty = async () => {
    if (!business || !user || !deleting) return;
    try {
      if (isCustomer) {
        await getClientServices().parties.deleteCustomer(business.id, user.id, deleting.id);
      } else {
        await getClientServices().parties.deleteSupplier(business.id, user.id, deleting.id);
      }
      toastSuccess("Deleted", "The record was removed.");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      toastError("Could not delete", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title={isCustomer ? "Customers" : "Suppliers"}
        description={
          isCustomer
            ? "People and businesses you sell to."
            : "Vendors you buy stock from."
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add {isCustomer ? "customer" : "supplier"}
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder={`Search ${kind}s…`}
            className="w-full max-w-sm"
            aria-label={`Search ${kind}s`}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? kind : `${kind}s`}
          </span>
        </div>

        {!parties || parties.length === 0 ? (
          <EmptyState
            icon={
              isCustomer ? <Users className="size-6" /> : <Truck className="size-6" />
            }
            title={isCustomer ? "No customers yet" : "No suppliers yet"}
            description={
              isCustomer
                ? "Add customers so you can attach them to sales invoices."
                : "Add suppliers to track purchases and vendor bills."
            }
            action={{
              label: `Add ${isCustomer ? "customer" : "supplier"}`,
              onClick: () => {
                setEditing(null);
                setFormOpen(true);
              },
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Opening balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((party) => (
                  <TableRow key={party.id}>
                    <TableCell className="font-medium text-foreground">{party.name}</TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground">{party.phone ?? "—"}</p>
                      {party.email ? (
                        <p className="text-xs text-muted-foreground">{party.email}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {party.gstin ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {party.city ? `${party.city}${party.state ? `, ${party.state}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(party.openingBalance, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(party);
                            setFormOpen(true);
                          }}
                          aria-label={`Edit ${party.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(party)}
                          aria-label={`Delete ${party.name}`}
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
        title={
          editing
            ? `Edit ${isCustomer ? "customer" : "supplier"}`
            : `Add ${isCustomer ? "customer" : "supplier"}`
        }
        description="Contact details and GST information."
        size="xl"
      >
        <PartyForm
          party={editing}
          partyType={kind}
          submitLabel={editing ? "Save changes" : `Add ${isCustomer ? "customer" : "supplier"}`}
          onSubmit={saveParty}
        />
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${isCustomer ? "customer" : "supplier"}`}
        description={deleting ? `Delete “${deleting.name}”?` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteParty()}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This removes the record from your address book. Historical transactions are kept.
        </p>
      </Modal>
    </div>
  );
}
