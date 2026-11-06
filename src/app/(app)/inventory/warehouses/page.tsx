"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users, Warehouse as WarehouseIcon } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { LOCATION_KIND_META, LOCATION_KINDS } from "@/lib/inventory-settings";
import type { StockLocationKind } from "@/types/domain";
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
import type { StockLocation, Warehouse } from "@/types/domain";
import { Checkbox } from "@/components/ui/checkbox";

export default function WarehousesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  // Warehouse form state
  const [whFormOpen, setWhFormOpen] = React.useState(false);
  const [whName, setWhName] = React.useState("");
  const [whCode, setWhCode] = React.useState("");
  const [whAddress, setWhAddress] = React.useState("");
  const [whState, setWhState] = React.useState("");
  const [whPincode, setWhPincode] = React.useState("");
  const [whPhone, setWhPhone] = React.useState("");
  const [whEmail, setWhEmail] = React.useState("");
  const [whSaving, setWhSaving] = React.useState(false);

  // Location form state
  const [selectedWarehouse, setSelectedWarehouse] = React.useState<Warehouse | null>(null);
  const [locFormOpen, setLocFormOpen] = React.useState(false);
  const [locName, setLocName] = React.useState("");
  const [locCode, setLocCode] = React.useState("");
  const [locKind, setLocKind] = React.useState<StockLocationKind>("main_store");
  const [locSaving, setLocSaving] = React.useState(false);
  const [assignWarehouse, setAssignWarehouse] = React.useState<Warehouse | null>(null);
  const [assignIds, setAssignIds] = React.useState<string[]>([]);
  const [assignSaving, setAssignSaving] = React.useState(false);

  const { data: warehouses, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listWarehouses(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: locations } = useQuery({
    queryKey: ["stock-locations", business?.id],
    queryFn: async () => {
      if (!business) return [];
      return getClientServices().inventory.listLocations(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: assignments } = useQuery({
    queryKey: ["warehouse-assignments", business?.id],
    queryFn: async () => {
      if (!business) return [];
      return getClientServices().inventory.listWarehouseAssignments(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: team } = useQuery({
    queryKey: ["team", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().team.getSnapshot(business.id);
    },
    enabled: Boolean(business),
  });

  const locationsFor = (warehouseId: string) =>
    (locations ?? []).filter((l) => l.warehouseId === warehouseId);

  if (isLoading) return <LoadingState label="Loading warehouses…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load warehouses"
      />
    );
  }

  const openCreateWarehouse = () => {
    setWhName("");
    setWhCode("");
    setWhAddress("");
    setWhState("");
    setWhPincode("");
    setWhPhone("");
    setWhEmail("");
    setWhFormOpen(true);
  };

  const saveWarehouse = async () => {
    if (!business || !user) return;
    if (!whName.trim() || !whCode.trim()) {
      toastError("Missing details", "Warehouse name and code are required.");
      return;
    }
    setWhSaving(true);
    try {
      await getClientServices().inventory.createWarehouse(business.id, user.id, {
        name: whName.trim(),
        code: whCode.trim().toLowerCase(),
        address: whAddress || null,
        state: whState || null,
        pincode: whPincode || null,
        phone: whPhone || null,
        email: whEmail || null,
      });
      toastSuccess("Warehouse added", "The warehouse was created.");
      setWhFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    } catch (err) {
      toastError("Could not add warehouse", normalizeError(err).userMessage);
    } finally {
      setWhSaving(false);
    }
  };

  const saveLocation = async () => {
    if (!business || !user || !selectedWarehouse) return;
    if (!locName.trim() || !locCode.trim()) {
      toastError("Missing details", "Location name and code are required.");
      return;
    }
    setLocSaving(true);
    try {
      await getClientServices().inventory.createLocation(business.id, user.id, {
        warehouseId: selectedWarehouse.id,
        name: locName.trim(),
        code: locCode.trim().toLowerCase(),
        kind: locKind,
      });
      toastSuccess("Location added", "The location was created.");
      setLocFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["stock-locations"] });
    } catch (err) {
      toastError("Could not add location", normalizeError(err).userMessage);
    } finally {
      setLocSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stores & Warehouses"
        description="Where your stock lives, and the locations within them."
        actions={
          <Button onClick={openCreateWarehouse}>
            <Plus className="size-4" />
            Add warehouse
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {!warehouses || warehouses.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon className="size-6" />}
            title="No warehouses yet"
            description="Create a warehouse to track stock by location."
            action={{ label: "Add warehouse", onClick: openCreateWarehouse }}
          />
        ) : (
          warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <WarehouseIcon className="size-4 text-muted-foreground" />
                    <h2 className="truncate font-semibold text-foreground">{warehouse.name}</h2>
                    <Badge variant="secondary" className="font-mono">
                      {warehouse.code}
                    </Badge>
                    <Badge variant={warehouse.isActive ? "success" : "secondary"}>
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {warehouse.address ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{warehouse.address}</p>
                  ) : null}
                  {[warehouse.state, warehouse.pincode, warehouse.phone].filter(Boolean).length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[warehouse.state, warehouse.pincode, warehouse.phone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignWarehouse(warehouse);
                      setAssignIds(
                        (assignments ?? [])
                          .filter((row) => row.warehouseId === warehouse.id)
                          .map((row) => row.userId)
                      );
                    }}
                  >
                    <Users className="size-4" />
                    Staff
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedWarehouse(warehouse);
                      setLocName("");
                      setLocCode("");
                      setLocKind("main_store");
                      setLocFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add location
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationsFor(warehouse.id).length > 0 ? (
                    locationsFor(warehouse.id).map((location) => (
                      <LocationRow
                        key={location.id}
                        location={location}
                        onDelete={async () => {
                          if (!business || !user) return;
                          try {
                            await getClientServices().inventory.deleteLocation(
                              business.id,
                              user.id,
                              location.id
                            );
                            toastSuccess("Location deleted", "The location was removed.");
                            await queryClient.invalidateQueries({
                              queryKey: ["stock-locations"],
                            });
                          } catch (err) {
                            toastError(
                              "Could not delete location",
                              normalizeError(err).userMessage
                            );
                          }
                        }}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No locations yet for {warehouse.name}. Click Add location to set up racks or shelves inside this warehouse.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </div>

      <Modal
        open={whFormOpen}
        onClose={() => setWhFormOpen(false)}
        title="Add warehouse"
        description="A storage location for stock."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setWhFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveWarehouse()} loading={whSaving}>
              Add warehouse
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="wh-name" required>
            <Input id="wh-name" value={whName} onChange={(event) => setWhName(event.target.value)} placeholder="e.g. Main Warehouse" autoFocus />
          </Field>
          <Field label="Code" htmlFor="wh-code" required hint="Short identifier, e.g. main, wh2.">
            <Input id="wh-code" value={whCode} onChange={(event) => setWhCode(event.target.value)} placeholder="e.g. main" />
          </Field>
          <Field label="Address" htmlFor="wh-address">
            <Textarea id="wh-address" value={whAddress} onChange={(event) => setWhAddress(event.target.value)} placeholder="Optional address" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" htmlFor="wh-state">
              <Input id="wh-state" value={whState} onChange={(event) => setWhState(event.target.value)} placeholder="e.g. Maharashtra" />
            </Field>
            <Field label="PIN" htmlFor="wh-pin">
              <Input id="wh-pin" value={whPincode} onChange={(event) => setWhPincode(event.target.value)} placeholder="400001" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" htmlFor="wh-phone">
              <Input id="wh-phone" value={whPhone} onChange={(event) => setWhPhone(event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Email" htmlFor="wh-email">
              <Input id="wh-email" value={whEmail} onChange={(event) => setWhEmail(event.target.value)} placeholder="Optional" />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={locFormOpen}
        onClose={() => setLocFormOpen(false)}
        title={selectedWarehouse ? `Add location to ${selectedWarehouse.name}` : "Add location"}
        description="Locations help you find stock inside a warehouse."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setLocFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveLocation()} loading={locSaving}>
              Add location
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="loc-name" required>
            <Input id="loc-name" value={locName} onChange={(event) => setLocName(event.target.value)} placeholder="e.g. Rack A" autoFocus />
          </Field>
          <Field label="Code" htmlFor="loc-code" required hint="Short identifier, e.g. rack-a, shelf-1.">
            <Input id="loc-code" value={locCode} onChange={(event) => setLocCode(event.target.value)} placeholder="e.g. rack-a" />
          </Field>
          <Field label="Kind" htmlFor="loc-kind">
            <Select id="loc-kind" value={locKind} onChange={(event) => setLocKind(event.target.value as StockLocationKind)}>
              {LOCATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {LOCATION_KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(assignWarehouse)}
        onClose={() => setAssignWarehouse(null)}
        title={assignWarehouse ? `Staff for ${assignWarehouse.name}` : "Warehouse staff"}
        description="Assign users who can work this warehouse. Leave empty to allow every member."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignWarehouse(null)}>
              Cancel
            </Button>
            <Button
              loading={assignSaving}
              onClick={async () => {
                if (!business || !user || !assignWarehouse) return;
                setAssignSaving(true);
                try {
                  await getClientServices().inventory.setWarehouseAssignments(
                    business.id,
                    user.id,
                    assignWarehouse.id,
                    assignIds
                  );
                  toastSuccess("Staff updated", "Warehouse assignments were saved.");
                  setAssignWarehouse(null);
                  await queryClient.invalidateQueries({ queryKey: ["warehouse-assignments"] });
                } catch (err) {
                  toastError("Could not save staff", normalizeError(err).userMessage);
                } finally {
                  setAssignSaving(false);
                }
              }}
            >
              Save staff
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {(team?.members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            (team?.members ?? []).map((member) => {
              const checked = assignIds.includes(member.userId);
              return (
                <label
                  key={member.userId}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setAssignIds((current) =>
                        next
                          ? [...current, member.userId]
                          : current.filter((id) => id !== member.userId)
                      );
                    }}
                    aria-label={`Assign ${member.fullName || member.email}`}
                  />
                  <span className="flex-1 text-sm text-foreground">
                    {member.fullName || member.email}
                  </span>
                  <span className="text-xs text-muted-foreground">{member.roleName ?? member.roleSlug}</span>
                </label>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}

function LocationRow({
  location,
  onDelete,
}: {
  location: StockLocation;
  onDelete: () => Promise<void>;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{location.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{location.code}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {LOCATION_KIND_META[location.kind]?.label ?? location.kind}
      </TableCell>
      <TableCell>
        <Badge variant={location.isActive ? "success" : "secondary"}>
          {location.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void onDelete()}
          aria-label={`Delete ${location.name}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
