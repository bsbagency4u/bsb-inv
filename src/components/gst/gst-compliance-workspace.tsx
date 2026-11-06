"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Truck } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DEFAULT_EINVOICE_SETTINGS,
  DEFAULT_EWB_SETTINGS,
  EINVOICE_TURNOVER_THRESHOLD,
  EWB_VALUE_THRESHOLD,
  einvoiceLocksDocument,
} from "@/lib/gst-einvoice";
import type { GstComplianceDocumentRow } from "@/services/compliance.service";
import type {
  GstEinvoiceRecord,
  GstEwayBillRecord,
  GstIrpDocumentKind,
  GstIrpEnvironment,
} from "@/types/domain";

const IRN_CANCEL_REASONS = [
  { value: "1", label: "1 — Duplicate" },
  { value: "2", label: "2 — Data entry mistake" },
  { value: "3", label: "3 — Order cancelled" },
  { value: "4", label: "4 — Others" },
];

const EWB_CANCEL_REASONS = [
  { value: "1", label: "1 — Duplicate" },
  { value: "2", label: "2 — Order cancelled" },
  { value: "3", label: "3 — Data entry mistake" },
  { value: "4", label: "4 — Others" },
];

const TRANS_MODES = [
  { value: "1", label: "Road" },
  { value: "2", label: "Rail" },
  { value: "3", label: "Air" },
  { value: "4", label: "Ship / vessel" },
];

function statusVariant(status: string | null | undefined): "success" | "warning" | "destructive" | "secondary" | "info" {
  if (status === "generated") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "secondary";
  return "info";
}

function documentKindLabel(kind: GstIrpDocumentKind) {
  return kind === "sales_return" ? "Credit note" : "Tax invoice";
}

export function GstComplianceWorkspace({
  focus,
}: {
  focus: "einvoice" | "ewaybill";
}) {
  const { user, business, isDemo } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [savingCredentials, setSavingCredentials] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [optedIn, setOptedIn] = React.useState<boolean | null>(null);
  const [turnover, setTurnover] = React.useState<string | null>(null);
  const [ewbOptedIn, setEwbOptedIn] = React.useState<boolean | null>(null);
  const [ewbThreshold, setEwbThreshold] = React.useState<string | null>(null);
  const [intraThreshold, setIntraThreshold] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<string | null>(null);
  const [environment, setEnvironment] = React.useState<GstIrpEnvironment | null>(null);
  const [gstin, setGstin] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [cancelTarget, setCancelTarget] = React.useState<{
    kind: "einvoice" | "ewaybill";
    documentKind: GstIrpDocumentKind;
    documentId: string;
    documentNo: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = React.useState("1");
  const [cancelRemark, setCancelRemark] = React.useState("");
  const [ewbTarget, setEwbTarget] = React.useState<GstComplianceDocumentRow | null>(null);
  const [transMode, setTransMode] = React.useState("1");
  const [transDistance, setTransDistance] = React.useState("");
  const [vehicleNo, setVehicleNo] = React.useState("");
  const [transDocNo, setTransDocNo] = React.useState("");
  const [transDocDate, setTransDocDate] = React.useState("");
  const [fromPlace, setFromPlace] = React.useState("");
  const [toPlace, setToPlace] = React.useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gst-compliance", business?.id],
    queryFn: async () => {
      if (!business || !user) throw new Error("No active business.");
      return getClientServices().compliance.getWorkspace(business.id, user.id);
    },
    enabled: Boolean(business && user),
  });

  const einvoiceSettings = data?.einvoiceSettings ?? DEFAULT_EINVOICE_SETTINGS;
  const ewaySettings = data?.ewayBillSettings ?? DEFAULT_EWB_SETTINGS;
  const opted = optedIn ?? einvoiceSettings.optedIn;
  const turnoverValue = turnover ?? (einvoiceSettings.aggregateTurnover == null ? "" : String(einvoiceSettings.aggregateTurnover));
  const ewbOpted = ewbOptedIn ?? ewaySettings.optedIn;
  const ewbThresholdValue = ewbThreshold ?? String(ewaySettings.valueThreshold);
  const intraThresholdValue =
    intraThreshold ?? (ewaySettings.intraStateThreshold == null ? "" : String(ewaySettings.intraStateThreshold));
  const providerValue = provider ?? data?.credentials.provider ?? "nic";
  const environmentValue = environment ?? data?.credentials.environment ?? "sandbox";
  const gstinValue = gstin ?? data?.credentials.gstin ?? business?.gstin ?? "";

  const rows = React.useMemo(() => {
    const list = data?.documents ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((row) =>
          [row.documentNo, row.partyName, row.partyGstin, row.einvoice.record?.irn, row.ewayBill.record?.ewbNo]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        )
      : list;
    if (focus === "einvoice") {
      return filtered.filter((row) => row.einvoice.eligible || row.einvoice.record);
    }
    return filtered.filter((row) => row.documentKind === "sales_invoice" && (row.ewayBill.eligible || row.ewayBill.record));
  }, [data?.documents, focus, search]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["gst-compliance"] });
    await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
    await queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
  };

  const saveEinvoiceSettings = async () => {
    if (!business || !user) return;
    setSavingSettings(true);
    try {
      const parsedTurnover = turnoverValue.trim() === "" ? null : Number(turnoverValue);
      if (parsedTurnover != null && (!Number.isFinite(parsedTurnover) || parsedTurnover < 0)) {
        throw new Error("Enter a valid aggregate turnover, or leave it blank.");
      }
      await getClientServices().compliance.saveEinvoiceSettings(business.id, user.id, {
        ...einvoiceSettings,
        optedIn: opted,
        aggregateTurnover: parsedTurnover,
      });
      toastSuccess("E-invoice settings saved", "Eligibility now uses the stored turnover and opt-in.");
      await invalidate();
    } catch (err) {
      toastError("Could not save e-invoice settings", normalizeError(err).userMessage);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveEwaySettings = async () => {
    if (!business || !user) return;
    setSavingSettings(true);
    try {
      const threshold = Number(ewbThresholdValue);
      const intra = intraThresholdValue.trim() === "" ? null : Number(intraThresholdValue);
      if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error("Enter a valid e-way bill value threshold.");
      }
      if (intra != null && (!Number.isFinite(intra) || intra < 0)) {
        throw new Error("Enter a valid intra-state threshold, or leave it blank.");
      }
      await getClientServices().compliance.saveEwayBillSettings(business.id, user.id, {
        optedIn: ewbOpted,
        valueThreshold: threshold,
        intraStateThreshold: intra,
      });
      toastSuccess("E-way bill settings saved", "Goods movement rules now use these thresholds.");
      await invalidate();
    } catch (err) {
      toastError("Could not save e-way bill settings", normalizeError(err).userMessage);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCredentials = async () => {
    if (!business) return;
    setSavingCredentials(true);
    try {
      await getClientServices().compliance.saveCredentials({
        businessId: business.id,
        provider: providerValue.trim() || "nic",
        environment: environmentValue,
        gstin: gstinValue.trim().toUpperCase(),
        username: username.trim(),
        password,
      });
      setPassword("");
      toastSuccess("IRP credentials saved", "Username and password are stored encrypted. They are never shown again.");
      await invalidate();
    } catch (err) {
      toastError("Could not save IRP credentials", normalizeError(err).userMessage);
    } finally {
      setSavingCredentials(false);
    }
  };

  const submitEinvoice = async (row: GstComplianceDocumentRow) => {
    if (!business || !user) return;
    const key = `einvoice:${row.documentId}`;
    setBusyKey(key);
    try {
      const record = await getClientServices().compliance.submitEinvoice(
        business.id,
        user.id,
        row.documentKind,
        row.documentId
      );
      toastSuccess("IRN generated", `${record.irn} was acknowledged by the IRP.`);
      await invalidate();
    } catch (err) {
      toastError("Could not generate IRN", normalizeError(err).userMessage);
    } finally {
      setBusyKey(null);
    }
  };

  const submitEway = async () => {
    if (!business || !user || !ewbTarget) return;
    const distance = Number(transDistance);
    if (!Number.isFinite(distance) || distance <= 0) {
      toastError("Distance required", "Enter the consignment distance in kilometres.");
      return;
    }
    const key = `ewaybill:${ewbTarget.documentId}`;
    setBusyKey(key);
    try {
      const record = await getClientServices().compliance.submitEwayBill(
        business.id,
        user.id,
        ewbTarget.documentKind,
        ewbTarget.documentId,
        {
          transMode,
          transDistance: distance,
          transDocNo: transDocNo.trim() || null,
          transDocDate: transDocDate.trim() || null,
          vehicleNo: vehicleNo.trim() || null,
          fromPlace: fromPlace.trim() || null,
          toPlace: toPlace.trim() || null,
        }
      );
      toastSuccess("E-way bill generated", `${record.ewbNo} is valid until ${record.validUpto ?? "the NIC validity"}.`);
      setEwbTarget(null);
      await invalidate();
    } catch (err) {
      toastError("Could not generate e-way bill", normalizeError(err).userMessage);
    } finally {
      setBusyKey(null);
    }
  };

  const confirmCancel = async () => {
    if (!business || !user || !cancelTarget) return;
    const key = `${cancelTarget.kind}:${cancelTarget.documentId}`;
    setBusyKey(key);
    try {
      if (cancelTarget.kind === "einvoice") {
        await getClientServices().compliance.cancelEinvoice(
          business.id,
          user.id,
          cancelTarget.documentKind,
          cancelTarget.documentId,
          cancelReason,
          cancelRemark.trim() || undefined
        );
        toastSuccess("IRN cancelled", `${cancelTarget.documentNo} can be corrected after the IRP cancellation.`);
      } else {
        await getClientServices().compliance.cancelEwayBill(
          business.id,
          user.id,
          cancelTarget.documentKind,
          cancelTarget.documentId,
          cancelReason,
          cancelRemark.trim() || undefined
        );
        toastSuccess("E-way bill cancelled", `${cancelTarget.documentNo} is no longer locked for transport.`);
      }
      setCancelTarget(null);
      setCancelRemark("");
      await invalidate();
    } catch (err) {
      toastError("Could not cancel", normalizeError(err).userMessage);
    } finally {
      setBusyKey(null);
    }
  };

  if (isLoading) {
    return <LoadingState label={focus === "einvoice" ? "Loading e-invoice…" : "Loading e-way bill…"} />;
  }
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title={focus === "einvoice" ? "Could not load e-invoice" : "Could not load e-way bill"}
      />
    );
  }

  const credentials = data?.credentials;
  const title = focus === "einvoice" ? "E-Invoice" : "E-Way Bill";
  const description =
    focus === "einvoice"
      ? "Generate an IRN only for eligible B2B tax invoices, credit notes and debit notes. Printed copies show the IRN and signed QR after the IRP acknowledges them."
      : "Generate an e-way bill for goods movement at or above the notified value. Vehicle and distance are captured at generation time.";

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="space-y-4 p-6">
        {isDemo ? (
          <Alert variant="warning" title="Demo mode cannot call GSTN">
            IRN and e-way bill generation need a live IRP/GSP connection. Settings, eligibility and print fields still work on stored documents.
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              IRP / GSP credentials
            </CardTitle>
            <CardDescription>
              NIC username and password are encrypted at rest. Existing values are never displayed. Sandbox stays the default until you switch to production.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider" htmlFor="gst-provider">
              <Select id="gst-provider" value={providerValue} onChange={(event) => setProvider(event.target.value)}>
                <option value="nic">NIC IRP</option>
                <option value="gsp">GSP</option>
              </Select>
            </Field>
            <Field label="Environment" htmlFor="gst-env">
              <Select
                id="gst-env"
                value={environmentValue}
                onChange={(event) => setEnvironment(event.target.value === "production" ? "production" : "sandbox")}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </Select>
            </Field>
            <Field label="GSTIN" htmlFor="gst-gstin" hint="Must match the supplier GSTIN on the invoice.">
              <Input
                id="gst-gstin"
                value={gstinValue}
                onChange={(event) => setGstin(event.target.value.toUpperCase())}
                maxLength={15}
              />
            </Field>
            <Field label="Username" htmlFor="gst-user" hint={credentials?.usernameMasked ? `Saved: ${credentials.usernameMasked}` : "Not configured"}>
              <Input id="gst-user" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" />
            </Field>
            <Field label="Password" htmlFor="gst-pass" className="sm:col-span-2">
              <PasswordInput
                id="gst-pass"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {credentials?.lastError ? (
              <Alert variant="error" title="Last GSTN error" className="sm:col-span-2">
                {credentials.lastError}
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button onClick={() => void saveCredentials()} loading={savingCredentials}>
              Save credentials
            </Button>
            {credentials?.configured ? <Badge variant="success">Configured</Badge> : <Badge variant="secondary">Not configured</Badge>}
          </CardFooter>
        </Card>

        {focus === "einvoice" ? (
          <Card>
            <CardHeader>
              <CardTitle>E-invoice applicability</CardTitle>
              <CardDescription>
                IRN is required from 1 Aug 2023 when aggregate turnover is Rs {EINVOICE_TURNOVER_THRESHOLD.toLocaleString("en-IN")} or more. Leave turnover blank if it is unknown — the document stays optional until you opt in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Opt in below the threshold</p>
                  <p className="text-xs text-muted-foreground">Eligible B2B documents then require an IRN even if turnover is below the notified limit.</p>
                </div>
                <Switch checked={opted} onCheckedChange={setOptedIn} aria-label="Opt in to e-invoice" />
              </div>
              <Field
                label="Aggregate turnover (Rs)"
                htmlFor="gst-turnover"
                hint="Used only to decide whether e-invoice is mandatory. It is not sent to the IRP."
              >
                <Input
                  id="gst-turnover"
                  type="number"
                  min={0}
                  value={turnoverValue}
                  onChange={(event) => setTurnover(event.target.value)}
                  placeholder="Leave blank if unknown"
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button onClick={() => void saveEinvoiceSettings()} loading={savingSettings}>
                Save e-invoice settings
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-4" />
                E-way bill applicability
              </CardTitle>
              <CardDescription>
                Rule 138 requires an e-way bill for goods when consignment value is Rs {EWB_VALUE_THRESHOLD.toLocaleString("en-IN")} or more. Services-only supplies are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Generate below threshold</p>
                  <p className="text-xs text-muted-foreground">Use this when the business still wants e-way bills for smaller goods consignments.</p>
                </div>
                <Switch checked={ewbOpted} onCheckedChange={setEwbOptedIn} aria-label="Opt in to e-way bill" />
              </div>
              <Field label="Value threshold (Rs)" htmlFor="ewb-threshold">
                <Input
                  id="ewb-threshold"
                  type="number"
                  min={0}
                  value={ewbThresholdValue}
                  onChange={(event) => setEwbThreshold(event.target.value)}
                />
              </Field>
              <Field
                label="Intra-state threshold (Rs)"
                htmlFor="ewb-intra"
                hint="Leave blank to use the same threshold for intra-state movement."
              >
                <Input
                  id="ewb-intra"
                  type="number"
                  min={0}
                  value={intraThresholdValue}
                  onChange={(event) => setIntraThreshold(event.target.value)}
                  placeholder="Same as inter-state"
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button onClick={() => void saveEwaySettings()} loading={savingSettings}>
                Save e-way bill settings
              </Button>
            </CardFooter>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder={focus === "einvoice" ? "Search invoices and IRNs…" : "Search invoices and e-way bills…"}
            className="w-full max-w-sm"
            aria-label="Search GST documents"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "document" : "documents"}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={focus === "einvoice" ? <ShieldCheck className="size-6" /> : <Truck className="size-6" />}
            title={focus === "einvoice" ? "No eligible e-invoices" : "No eligible e-way bills"}
            description={
              focus === "einvoice"
                ? "Posted B2B tax invoices, credit notes and debit notes with a valid GSTIN appear here."
                : "Posted goods invoices at or above the value threshold appear here."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>{focus === "einvoice" ? "IRN" : "E-way bill"}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) =>
                  focus === "einvoice" ? (
                    <EinvoiceRow
                      key={`${row.documentKind}:${row.documentId}`}
                      row={row}
                      currency={business?.currency ?? "INR"}
                      busy={busyKey === `einvoice:${row.documentId}`}
                      onGenerate={() => void submitEinvoice(row)}
                      onCancel={() => {
                        setCancelReason("1");
                        setCancelRemark("");
                        setCancelTarget({
                          kind: "einvoice",
                          documentKind: row.documentKind,
                          documentId: row.documentId,
                          documentNo: row.documentNo,
                        });
                      }}
                    />
                  ) : (
                    <EwayRow
                      key={`${row.documentKind}:${row.documentId}`}
                      row={row}
                      currency={business?.currency ?? "INR"}
                      busy={busyKey === `ewaybill:${row.documentId}`}
                      onGenerate={() => {
                        setTransMode("1");
                        setTransDistance("");
                        setVehicleNo("");
                        setTransDocNo("");
                        setTransDocDate("");
                        setFromPlace(business?.city ?? business?.state ?? "");
                        setToPlace(row.partyName);
                        setEwbTarget(row);
                      }}
                      onCancel={() => {
                        setCancelReason("1");
                        setCancelRemark("");
                        setCancelTarget({
                          kind: "ewaybill",
                          documentKind: row.documentKind,
                          documentId: row.documentId,
                          documentNo: row.documentNo,
                        });
                      }}
                    />
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget?.kind === "ewaybill" ? "Cancel e-way bill" : "Cancel IRN"}
        description="The IRP cancellation reason is sent to GSTN. The document can be edited only after a successful cancellation."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmCancel()}
              loading={Boolean(cancelTarget && busyKey === `${cancelTarget.kind}:${cancelTarget.documentId}`)}
            >
              Cancel with IRP
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Reason" htmlFor="gst-cancel-reason" required>
            <Select id="gst-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
              {(cancelTarget?.kind === "ewaybill" ? EWB_CANCEL_REASONS : IRN_CANCEL_REASONS).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Remark" htmlFor="gst-cancel-remark">
            <Textarea
              id="gst-cancel-remark"
              value={cancelRemark}
              onChange={(event) => setCancelRemark(event.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(ewbTarget)}
        onClose={() => setEwbTarget(null)}
        title={ewbTarget ? `E-way bill: ${ewbTarget.documentNo}` : "E-way bill"}
        description="Transport details are required by NIC and are stored with the generated bill."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEwbTarget(null)}>
              Close
            </Button>
            <Button onClick={() => void submitEway()} loading={Boolean(ewbTarget && busyKey === `ewaybill:${ewbTarget.documentId}`)}>
              Generate e-way bill
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Transport mode" htmlFor="ewb-mode" required>
            <Select id="ewb-mode" value={transMode} onChange={(event) => setTransMode(event.target.value)}>
              {TRANS_MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Distance (km)" htmlFor="ewb-distance" required>
            <Input
              id="ewb-distance"
              type="number"
              min={1}
              value={transDistance}
              onChange={(event) => setTransDistance(event.target.value)}
            />
          </Field>
          <Field label="Vehicle number" htmlFor="ewb-vehicle">
            <Input id="ewb-vehicle" value={vehicleNo} onChange={(event) => setVehicleNo(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Transporter document" htmlFor="ewb-docno">
            <Input id="ewb-docno" value={transDocNo} onChange={(event) => setTransDocNo(event.target.value)} />
          </Field>
          <Field label="Transporter document date" htmlFor="ewb-docdate">
            <Input id="ewb-docdate" type="date" value={transDocDate} onChange={(event) => setTransDocDate(event.target.value)} />
          </Field>
          <Field label="From place" htmlFor="ewb-from">
            <Input id="ewb-from" value={fromPlace} onChange={(event) => setFromPlace(event.target.value)} />
          </Field>
          <Field label="To place" htmlFor="ewb-to" className="sm:col-span-2">
            <Input id="ewb-to" value={toPlace} onChange={(event) => setToPlace(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function EinvoiceRow({
  row,
  currency,
  busy,
  onGenerate,
  onCancel,
}: {
  row: GstComplianceDocumentRow;
  currency: string;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const record = row.einvoice.record;
  const locked = einvoiceLocksDocument(record?.status);
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{row.documentNo}</p>
        <p className="text-xs text-muted-foreground">
          {documentKindLabel(row.documentKind)} · {formatDate(row.documentDate)} · {row.status}
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{row.partyName}</p>
        <p className="text-xs text-muted-foreground">{row.partyGstin ?? "No GSTIN"}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(row.total, currency)}</TableCell>
      <TableCell>
        <RecordStatus record={record} number={record?.irn} required={row.einvoice.required} eligible={row.einvoice.eligible} blockers={row.einvoice.blockers} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {row.einvoice.eligible && !locked ? (
            <Button size="sm" onClick={onGenerate} loading={busy} disabled={!row.einvoice.required && record?.status === "generated"}>
              {record?.status === "failed" ? "Retry IRN" : "Generate IRN"}
            </Button>
          ) : null}
          {locked ? (
            <Button size="sm" variant="outline" onClick={onCancel} loading={busy}>
              Cancel IRN
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EwayRow({
  row,
  currency,
  busy,
  onGenerate,
  onCancel,
}: {
  row: GstComplianceDocumentRow;
  currency: string;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const record = row.ewayBill.record;
  const generated = record?.status === "generated";
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{row.documentNo}</p>
        <p className="text-xs text-muted-foreground">
          {documentKindLabel(row.documentKind)} · {formatDate(row.documentDate)} · {row.status}
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{row.partyName}</p>
        <p className="text-xs text-muted-foreground">{row.partyGstin ?? "No GSTIN"}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(row.total, currency)}</TableCell>
      <TableCell>
        <RecordStatus
          record={record}
          number={record?.ewbNo}
          required={row.ewayBill.required}
          eligible={row.ewayBill.eligible}
          blockers={row.ewayBill.blockers}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {row.ewayBill.eligible && !generated ? (
            <Button size="sm" onClick={onGenerate} loading={busy}>
              {record?.status === "failed" ? "Retry e-way bill" : "Generate e-way bill"}
            </Button>
          ) : null}
          {generated ? (
            <Button size="sm" variant="outline" onClick={onCancel} loading={busy}>
              Cancel e-way bill
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function RecordStatus({
  record,
  number,
  required,
  eligible,
  blockers,
}: {
  record: GstEinvoiceRecord | GstEwayBillRecord | null;
  number: string | null | undefined;
  required: boolean;
  eligible: boolean;
  blockers: string[];
}) {
  if (record?.status === "generated" && number) {
    return (
      <div>
        <Badge variant="success">Generated</Badge>
        <p className="mt-1 break-all text-xs text-muted-foreground">{number}</p>
      </div>
    );
  }
  if (record?.status === "failed") {
    return (
      <div>
        <Badge variant="destructive">Failed</Badge>
        <p className="mt-1 text-xs text-muted-foreground">{record.lastError}</p>
      </div>
    );
  }
  if (record?.status === "cancelled") {
    return <Badge variant="secondary">Cancelled</Badge>;
  }
  if (!eligible) {
    return (
      <div>
        <Badge variant="secondary">Not eligible</Badge>
        <p className="mt-1 text-xs text-muted-foreground">{blockers[0]}</p>
      </div>
    );
  }
  return (
    <Badge variant={required ? "warning" : statusVariant(record?.status)}>
      {required ? "Required" : "Optional"}
    </Badge>
  );
}
