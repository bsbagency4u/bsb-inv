"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import type { PaymentMode } from "@/types/domain";

export default function PaymentModesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [formOpen, setFormOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const { data: modes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading payment modes…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load payment modes"
      />
    );
  }

  const openCreate = () => {
    setCode("");
    setName("");
    setFormOpen(true);
  };

  const save = async () => {
    if (!business || !user) return;
    if (!code.trim() || !name.trim()) {
      toastError("Missing details", "Code and name are required.");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().transactions.createPaymentMode(business.id, user.id, {
        code: code.trim().toLowerCase(),
        name: name.trim(),
      });
      toastSuccess("Payment mode added", "The payment mode was created.");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["payment-modes"] });
    } catch (err) {
      toastError("Could not add payment mode", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (mode: PaymentMode) => {
    if (!business || !user) return;
    try {
      await getClientServices().transactions.updatePaymentMode(business.id, user.id, mode.id, {
        isActive: !mode.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ["payment-modes"] });
    } catch (err) {
      toastError("Could not update payment mode", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment modes available at checkout."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add mode
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {!modes || modes.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="No payment modes"
            description="Add payment modes like cash, UPI or card."
            action={{ label: "Add mode", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modes.map((mode) => (
                  <TableRow key={mode.id}>
                    <TableCell className="font-medium text-foreground">{mode.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {mode.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mode.isActive ? "success" : "secondary"}>
                        {mode.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={mode.isActive}
                        onCheckedChange={() => void toggle(mode)}
                        aria-label={`Toggle ${mode.name}`}
                      />
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
        title="Add payment mode"
        description="Payment modes are not hard-coded; you control which appear."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Add mode
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="pm-name" required>
            <Input id="pm-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cash" autoFocus />
          </Field>
          <Field label="Code" htmlFor="pm-code" required hint="Short identifier, e.g. cash, upi, card.">
            <Input id="pm-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. cash" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
