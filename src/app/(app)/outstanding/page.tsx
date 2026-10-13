"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { AgingSummary, OutstandingTable } from "@/components/ledger/outstanding-table";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { agingTotals, roundMoney, type OutstandingRow } from "@/lib/party-ledger";
import { normalizeError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";

export default function OutstandingPage() {
  const router = useRouter();
  const { business } = useSession();
  const [tab, setTab] = React.useState("receivables");
  const [search, setSearch] = React.useState("");
  const [partyId, setPartyId] = React.useState("");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listSuppliers(business.id);
    },
    enabled: Boolean(business),
  });

  const query = useQuery({
    queryKey: ["outstanding", tab, business?.id, partyId, overdueOnly, fromDate, toDate, search],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      const filters = {
        partyId: partyId || null,
        overdueOnly,
        fromDate: fromDate || null,
        toDate: toDate || null,
        search: search || null,
      };
      return tab === "receivables"
        ? getClientServices().ledger.receivables(business.id, filters)
        : getClientServices().ledger.payables(business.id, filters);
    },
    enabled: Boolean(business),
  });

  const rows = query.data ?? [];
  const currency = business?.currency ?? "INR";
  const total = roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));
  const aging = agingTotals(rows);
  const parties = tab === "receivables" ? customers : suppliers;

  const onPay = (row: OutstandingRow) => {
    router.push(
      `/payments?direction=${tab === "receivables" ? "in" : "out"}&partyId=${row.partyId}`
    );
  };

  return (
    <div>
      <PageHeader
        title="Outstanding"
        description="AR and AP balances from the shared party ledger."
        actions={
          <Badge variant="info" className="px-3 py-1 text-sm">
            {tab === "receivables" ? "Receivable" : "Payable"}: {formatCurrency(total, currency)}
          </Badge>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          tabs={[
            { value: "receivables", label: "Receivables", icon: <Wallet className="size-4" /> },
            { value: "payables", label: "Payables", icon: <Wallet className="size-4" /> },
          ]}
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setPartyId("");
          }}
        />

        <div className="flex flex-wrap items-end gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search invoice or party…"
            className="w-full max-w-sm"
            aria-label="Search outstanding"
          />
          <Field label={tab === "receivables" ? "Customer" : "Supplier"} htmlFor="out-party" className="w-56">
            <Select id="out-party" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
              <option value="">All</option>
              {(parties ?? []).map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" htmlFor="out-from" className="w-40">
            <Input id="out-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To" htmlFor="out-to" className="w-40">
            <Input id="out-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 pb-1 text-sm text-muted-foreground">
            <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} />
            Overdue only
          </label>
        </div>

        {query.isLoading ? (
          <LoadingState label="Loading outstanding…" />
        ) : query.isError ? (
          <ErrorState
            error={normalizeError(query.error).userMessage}
            onRetry={() => query.refetch()}
            title="Could not load outstanding"
          />
        ) : (
          <>
            <AgingSummary totals={aging} currency={currency} />
            <OutstandingTable
              rows={rows}
              currency={currency}
              emptyTitle={tab === "receivables" ? "No receivables" : "No payables"}
              emptyDescription="Open invoices from the shared ledger appear here."
              onPay={onPay}
            />
          </>
        )}
      </div>
    </div>
  );
}
