"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Pencil, Printer } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { PartyForm } from "@/components/parties/party-form";
import { PartyBalanceCards, PartyLedgerTable } from "@/components/ledger/party-ledger-table";
import { OutstandingTable } from "@/components/ledger/outstanding-table";
import { DocumentPrintActions } from "@/components/documents/document-print-actions";
import { printPartyStatement } from "@/lib/party-statement-print";
import { customerContact, paymentReceiptPrintModel, supplierContact } from "@/lib/document-print-models";
import { DEFAULT_INVOICE } from "@/lib/invoice-settings";
import { allocatedAmount, unallocatedAmount } from "@/lib/party-ledger";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PartyValues } from "@/lib/validation/schemas";
import type { PartyLedgerResult } from "@/services/ledger.service";
import type {
  BusinessProfile,
  Customer,
  InvoiceDefaults,
  Payment,
  PurchaseInvoice,
  SalesInvoice,
  Supplier,
} from "@/types/domain";

type PartyKind = "customer" | "supplier";

function invoiceHref(kind: PartyKind, invoiceId: string) {
  return kind === "customer" ? `/sales/invoices/${invoiceId}/edit` : `/purchase/invoices/${invoiceId}/edit`;
}

export function PartyDetailPage({ kind }: { kind: PartyKind }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [tab, setTab] = React.useState("overview");
  const [editOpen, setEditOpen] = React.useState(false);
  const partyId = params?.id;

  const partyQuery = useQuery({
    queryKey: [kind, business?.id, partyId],
    queryFn: async () => {
      if (!business || !partyId) throw new Error("Missing party.");
      return kind === "customer"
        ? getClientServices().parties.getCustomer(business.id, partyId)
        : getClientServices().parties.getSupplier(business.id, partyId);
    },
    enabled: Boolean(business && partyId),
  });

  const ledgerQuery = useQuery({
    queryKey: ["party-ledger", kind, business?.id, partyId],
    queryFn: async () => {
      if (!business || !partyId) throw new Error("Missing party.");
      return kind === "customer"
        ? getClientServices().ledger.getCustomerLedger(business.id, partyId)
        : getClientServices().ledger.getSupplierLedger(business.id, partyId);
    },
    enabled: Boolean(business && partyId),
  });

  const invoicesQuery = useQuery({
    queryKey: [kind === "customer" ? "sales-invoices" : "purchase-invoices", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return kind === "customer"
        ? getClientServices().transactions.listSalesInvoices(business.id)
        : getClientServices().transactions.listPurchaseInvoices(business.id);
    },
    enabled: Boolean(business),
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPayments(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: invoiceDefaults } = useQuery({
    queryKey: ["invoice-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInvoiceDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  if (partyQuery.isLoading) return <LoadingState label={`Loading ${kind}…`} />;
  if (partyQuery.isError) {
    return (
      <ErrorState
        error={normalizeError(partyQuery.error).userMessage}
        onRetry={() => partyQuery.refetch()}
        title={`Could not load ${kind}`}
      />
    );
  }

  const party = partyQuery.data;
  if (!party) {
    return (
      <EmptyState
        title={`${kind === "customer" ? "Customer" : "Supplier"} not found`}
        description="The record may have been removed."
        action={{ label: "Back to list", onClick: () => router.push(kind === "customer" ? "/customers" : "/suppliers") }}
      />
    );
  }

  const currency = business?.currency ?? "INR";
  const ledger = ledgerQuery.data;
  const invoices = ((invoicesQuery.data ?? []) as Array<SalesInvoice | PurchaseInvoice>).filter((invoice) =>
    kind === "customer"
      ? (invoice as SalesInvoice).customerId === party.id
      : (invoice as PurchaseInvoice).supplierId === party.id
  );
  const payments = (paymentsQuery.data ?? []).filter(
    (payment) => payment.partyType === kind && payment.partyId === party.id
  );

  const saveParty = async (values: PartyValues) => {
    if (!business || !user) return;
    try {
      if (kind === "customer") {
        await getClientServices().parties.updateCustomer(business.id, user.id, party.id, values);
      } else {
        await getClientServices().parties.updateSupplier(business.id, user.id, party.id, values);
      }
      toastSuccess("Saved", "The record was updated.");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: [kind, business.id, party.id] });
      await queryClient.invalidateQueries({ queryKey: [kind === "customer" ? "customers" : "suppliers"] });
      await queryClient.invalidateQueries({ queryKey: ["party-ledger"] });
    } catch (err) {
      toastError("Could not save", normalizeError(err).userMessage);
    }
  };

  const printStatement = () => {
    if (!business || !ledger) return;
    const result = printPartyStatement({
      business,
      partyName: party.name,
      kind,
      lines: ledger.lines,
      balance: ledger.balance,
      currency,
    });
    if (!result.ok) toastInfo("Print blocked", "The browser blocked the print dialog. Try again.");
  };

  return (
    <div>
      <PageHeader
        title={party.name}
        description={kind === "customer" ? "Customer ledger, invoices and outstanding." : "Supplier ledger, bills and outstanding."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(kind === "customer" ? "/customers" : "/suppliers")}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `/payments?direction=${kind === "customer" ? "in" : "out"}&partyId=${party.id}`
                )
              }
            >
              <Banknote className="size-4" />
              {kind === "customer" ? "Record receipt" : "Record payment"}
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "ledger", label: "Ledger" },
            { value: "invoices", label: kind === "customer" ? "Invoices" : "Bills" },
            { value: "payments", label: "Payments" },
            { value: "outstanding", label: "Outstanding" },
            { value: "statement", label: "Statement" },
          ]}
          value={tab}
          onValueChange={setTab}
        />

        {tab === "overview" ? (
          <OverviewTab party={party} kind={kind} currency={currency} ledger={ledger} />
        ) : null}

        {tab === "ledger" ? (
          ledgerQuery.isLoading ? (
            <LoadingState label="Loading ledger…" />
          ) : ledger ? (
            <div className="space-y-4">
              <PartyBalanceCards balance={ledger.balance} currency={currency} />
              <PartyLedgerTable lines={ledger.lines} currency={currency} />
            </div>
          ) : (
            <ErrorState
              error={normalizeError(ledgerQuery.error).userMessage}
              onRetry={() => ledgerQuery.refetch()}
              title="Could not load ledger"
            />
          )
        ) : null}

        {tab === "invoices" ? (
          <InvoicesTab kind={kind} invoices={invoices} currency={currency} onOpen={(id) => router.push(invoiceHref(kind, id))} />
        ) : null}

        {tab === "payments" ? (
          <PaymentsTab
            payments={payments}
            currency={currency}
            business={business}
            defaults={invoiceDefaults}
            party={party}
            kind={kind}
          />
        ) : null}

        {tab === "outstanding" ? (
          ledgerQuery.isLoading ? (
            <LoadingState label="Loading outstanding…" />
          ) : (
            <OutstandingTable
              rows={ledger?.outstanding ?? []}
              currency={currency}
              onPay={() =>
                router.push(`/payments?direction=${kind === "customer" ? "in" : "out"}&partyId=${party.id}`)
              }
            />
          )
        ) : null}

        {tab === "statement" ? (
          ledgerQuery.isLoading ? (
            <LoadingState label="Loading statement…" />
          ) : ledger ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" onClick={printStatement}>
                  <Printer className="size-4" />
                  Print statement
                </Button>
              </div>
              <PartyBalanceCards balance={ledger.balance} currency={currency} />
              <PartyLedgerTable lines={ledger.lines} currency={currency} />
            </div>
          ) : null
        ) : null}
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${kind}`}
        description="Contact details and GST information."
        size="xl"
      >
        <PartyForm
          party={party}
          partyType={kind}
          submitLabel="Save changes"
          onSubmit={saveParty}
        />
      </Modal>
    </div>
  );
}

function OverviewTab({
  party,
  kind,
  currency,
  ledger,
}: {
  party: Customer | Supplier;
  kind: PartyKind;
  currency: string;
  ledger: PartyLedgerResult | undefined;
}) {
  return (
    <div className="space-y-4">
      {ledger ? <PartyBalanceCards balance={ledger.balance} currency={currency} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Address book details for this {kind}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <FieldLine label="Phone" value={party.phone} />
            <FieldLine label="Email" value={party.email} />
            <FieldLine label="GSTIN" value={party.gstin} mono />
            <FieldLine label="PAN" value={party.pan} mono />
            <FieldLine
              label="Location"
              value={party.city ? `${party.city}${party.state ? `, ${party.state}` : ""}` : null}
            />
            <FieldLine label="Opening balance" value={formatCurrency(party.openingBalance, currency)} />
            {kind === "customer" && "creditLimit" in party ? (
              <FieldLine
                label="Credit limit"
                value={party.creditLimit != null ? formatCurrency(party.creditLimit, currency) : null}
              />
            ) : null}
            {kind === "supplier" && "paymentTerms" in party ? (
              <FieldLine label="Payment terms" value={party.paymentTerms} />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unallocated advances</CardTitle>
            <CardDescription>Receipts or payments that are not allocated to invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            {!ledger || ledger.advances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unallocated advances.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {ledger.advances.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {payment.documentNo ?? payment.id.slice(0, 8)} · {formatDate(payment.paymentDate)}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(unallocatedAmount(payment), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldLine({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-xs text-foreground" : "font-medium text-foreground"}>{value || "—"}</p>
    </div>
  );
}

function InvoicesTab({
  kind,
  invoices,
  currency,
  onOpen,
}: {
  kind: PartyKind;
  invoices: Array<SalesInvoice | PurchaseInvoice>;
  currency: string;
  onOpen: (id: string) => void;
}) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        title={kind === "customer" ? "No invoices yet" : "No bills yet"}
        description={kind === "customer" ? "Sales invoices for this customer will appear here." : "Purchase bills for this supplier will appear here."}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{kind === "customer" ? "Invoice" : "Bill"}</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const no = kind === "customer" ? (invoice as SalesInvoice).invoiceNo : (invoice as PurchaseInvoice).billNo;
            return (
              <TableRow key={invoice.id} className="cursor-pointer" onClick={() => onOpen(invoice.id)}>
                <TableCell className="font-medium text-foreground">{no}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.invoiceDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(invoice.total, currency)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(invoice.paidAmount, currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "cancelled" ? "destructive" : "secondary"}>
                    {invoice.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentsTab({
  payments,
  currency,
  business,
  defaults,
  party,
  kind,
}: {
  payments: Payment[];
  currency: string;
  business: BusinessProfile | null;
  defaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined;
  party: Customer | Supplier;
  kind: PartyKind;
}) {
  if (payments.length === 0) {
    return <EmptyState title="No payments yet" description="Receipts and payments for this party will appear here." />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Unallocated</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Print</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const contact = kind === "customer" ? customerContact(party as Customer) : supplierContact(party as Supplier);
            return (
              <TableRow key={payment.id}>
                <TableCell className="font-medium text-foreground">{payment.documentNo ?? payment.id.slice(0, 8)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{payment.mode}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(payment.amount, currency)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(unallocatedAmount(payment), currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={payment.status === "cancelled" ? "destructive" : allocatedAmount(payment) === 0 ? "info" : "success"}>
                    {payment.status === "cancelled" ? "cancelled" : allocatedAmount(payment) === 0 ? "advance" : "posted"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {business ? (
                    <DocumentPrintActions
                      business={business}
                      defaults={defaults ?? DEFAULT_INVOICE}
                      model={paymentReceiptPrintModel(payment, { partyLabel: party.name, ...contact })}
                      currency={currency}
                      size="sm"
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
