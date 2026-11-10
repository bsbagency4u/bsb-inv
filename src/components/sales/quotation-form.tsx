"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { GstEngine, GST_RATE_OPTIONS } from "@/services/gst.service";
import { normalizeError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import {
  DEFAULT_QUOTATION,
  QUOTATION_FORMAT_META,
  addDaysIso,
  defaultTemplateForFormat,
} from "@/lib/quotation-settings";
import { todayIsoDate } from "@/lib/document-control";
import type { QuotationFormat, QuotationLine } from "@/types/domain";
import type { QuotationInput, QuotationLineDraft } from "@/services/transaction.service";

const gst = new GstEngine();

interface DraftLine {
  key: string;
  productId: string | null;
  name: string;
  description: string;
  sku: string;
  hsn: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
  discount: number;
}

function newLine(): DraftLine {
  return {
    key: `line-${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    name: "",
    description: "",
    sku: "",
    hsn: "",
    quantity: 1,
    unit: "PCS",
    unitPrice: 0,
    gstRate: 18,
    discount: 0,
  };
}

function fromSaved(item: QuotationLine): DraftLine {
  return {
    key: `line-${Math.random().toString(36).slice(2, 8)}`,
    productId: item.productId,
    name: item.name,
    description: item.description ?? "",
    sku: item.sku ?? "",
    hsn: item.hsn ?? "",
    quantity: item.quantity,
    unit: item.unit ?? "PCS",
    unitPrice: item.unitPrice,
    gstRate: item.gstRate,
    discount: item.discount,
  };
}

export function QuotationForm({
  title,
  description,
  quotationId,
}: {
  title: string;
  description: string;
  quotationId?: string;
}) {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState<"draft" | "sent" | null>(null);
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [partyName, setPartyName] = React.useState("");
  const [format, setFormat] = React.useState<QuotationFormat>("product_service");
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [quotationDate, setQuotationDate] = React.useState(todayIsoDate());
  const [validUntil, setValidUntil] = React.useState("");
  const [docTitle, setDocTitle] = React.useState("");
  const [intro, setIntro] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [timeline, setTimeline] = React.useState("");
  const [assumptions, setAssumptions] = React.useState("");
  const [terms, setTerms] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [lines, setLines] = React.useState<DraftLine[]>([newLine()]);
  const [hydrated, setHydrated] = React.useState(false);

  const { data: defaults, isLoading: loadingDefaults } = useQuery({
    queryKey: ["quotation-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getQuotationDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: products } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: existing, isLoading: loadingExisting, isError, error, refetch } = useQuery({
    queryKey: ["quotation", business?.id, quotationId],
    queryFn: async () => {
      if (!business || !quotationId) throw new Error("No quotation.");
      return getClientServices().transactions.getQuotation(business.id, quotationId);
    },
    enabled: Boolean(business && quotationId),
  });

  if (!hydrated && defaults && (!quotationId || !loadingExisting)) {
    if (existing) {
      setCustomerId(existing.customerId);
      setPartyName(existing.partyName);
      setFormat(existing.format);
      setTemplateId(existing.templateId);
      setQuotationDate(existing.quotationDate);
      setValidUntil(existing.validUntil ?? "");
      setDocTitle(existing.title ?? "");
      setIntro(existing.intro ?? "");
      setScope(existing.scope ?? "");
      setTimeline(existing.timeline ?? "");
      setAssumptions(existing.assumptions ?? "");
      setTerms(existing.termsAndConditions ?? "");
      setNotes(existing.notes ?? "");
      setDiscount(String(existing.discount));
      setLines(existing.items.length ? existing.items.map(fromSaved) : [newLine()]);
    } else if (!quotationId) {
      const nextFormat = defaults.defaultFormat;
      const template = defaultTemplateForFormat(defaults, nextFormat);
      setFormat(nextFormat);
      setTemplateId(template.id);
      setValidUntil(addDaysIso(todayIsoDate(), defaults.validityDays));
      setIntro(template.introHtml);
      setTerms(template.termsAndConditions || defaults.termsAndConditions);
      setDocTitle(nextFormat === "formal_proposal" ? "Proposal" : "Quotation");
    }
    setHydrated(true);
  }

  const settings = defaults ?? DEFAULT_QUOTATION;
  const templates = settings.templates.filter((item) => item.format === format);
  const template = templates.find((item) => item.id === templateId) ?? defaultTemplateForFormat(settings, format);

  const totals = React.useMemo(() => {
    return gst.computeTotals(
      lines.map((line) => ({
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        gstRate: Number(line.gstRate) || 0,
        discount: Number(line.discount) || 0,
      })),
      { intraState: true, discount: Number(discount) || 0 }
    );
  }, [lines, discount]);

  const applyProduct = (key: string, productId: string | null) => {
    const product = products?.find((item) => item.id === productId);
    setLines((current) =>
      current.map((line) =>
        line.key !== key
          ? line
          : product
            ? {
                ...line,
                productId: product.id,
                name: product.name,
                sku: product.sku ?? "",
                hsn: product.hsn ?? "",
                unit: product.unit || "PCS",
                unitPrice: product.salePrice,
                gstRate: product.gstRate,
              }
            : { ...line, productId: null }
      )
    );
  };

  const patchLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const onFormatChange = (next: QuotationFormat) => {
    setFormat(next);
    const nextTemplate = defaultTemplateForFormat(settings, next);
    setTemplateId(nextTemplate.id);
    if (!quotationId) {
      setDocTitle(next === "formal_proposal" ? "Proposal" : "Quotation");
      if (!intro) setIntro(nextTemplate.introHtml);
      if (!terms) setTerms(nextTemplate.termsAndConditions || settings.termsAndConditions);
    }
  };

  const buildInput = (status: "draft" | "sent" | "accepted"): QuotationInput => ({
    customerId,
    partyName: partyName.trim() || undefined,
    quotationDate,
    validUntil: validUntil || null,
    status,
    format,
    templateId: template.id,
    title: docTitle.trim() || null,
    intro: intro.trim() || null,
    scope: scope.trim() || null,
    timeline: timeline.trim() || null,
    assumptions: assumptions.trim() || null,
    termsAndConditions: terms.trim() || null,
    notes: notes.trim() || null,
    discount: Number(discount) || 0,
    items: lines.map(
      (line): QuotationLineDraft => ({
        productId: line.productId,
        name: line.name.trim() || "Item",
        description: line.description.trim() || null,
        sku: line.sku.trim() || null,
        hsn: line.hsn.trim() || null,
        quantity: Number(line.quantity) || 0,
        unit: line.unit.trim() || null,
        unitPrice: Number(line.unitPrice) || 0,
        gstRate: Number(line.gstRate) || 0,
        discount: Number(line.discount) || 0,
      })
    ),
  });

  const save = async (status: "draft" | "sent") => {
    if (!business || !user) return;
    setSaving(status);
    try {
      const preserved =
        existing?.status === "accepted" || (existing?.status === "sent" && status === "draft")
          ? existing.status
          : status;
      const payload = buildInput(preserved);
      if (quotationId) {
        await getClientServices().transactions.updateQuotation(business.id, user.id, quotationId, payload);
        toastSuccess("Quotation saved", status === "sent" ? "Marked as sent." : "Draft updated.");
      } else {
        const result = await getClientServices().transactions.createQuotation(business.id, user.id, payload);
        toastSuccess("Quotation created", result.quotation.quotationNo);
      }
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
      router.push("/sales/quotations");
    } catch (err) {
      toastError("Could not save quotation", normalizeError(err).userMessage);
    } finally {
      setSaving(null);
    }
  };

  if (!hydrated || loadingDefaults || (quotationId && loadingExisting)) {
    return <LoadingState label="Loading quotation…" />;
  }
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load quotation"
      />
    );
  }
  if (quotationId && hydrated && !existing) {
    return <ErrorState error="Quotation not found." title="Quotation not found" />;
  }

  const currency = business?.currency ?? "INR";
  const customerOptions = (customers ?? []).map((item) => ({ value: item.id, label: item.name, description: item.phone ?? undefined }));
  const productOptions = (products ?? []).map((item) => ({
    value: item.id,
    label: item.name,
    description: item.sku ?? undefined,
  }));

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="outline" onClick={() => router.push("/sales/quotations")}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        <Alert variant="info" title="Quotations do not post stock or payments">
          Convert to a sales invoice when the offer is accepted. Completing that invoice is what records stock and finance.
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Format</CardTitle>
            <CardDescription>Choose the document layout when you create the quotation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Format" htmlFor="q-format" required>
              <Select
                id="q-format"
                value={format}
                onChange={(event) => onFormatChange(event.target.value as QuotationFormat)}
              >
                <option value="product_service">{QUOTATION_FORMAT_META.product_service.label}</option>
                <option value="formal_proposal">{QUOTATION_FORMAT_META.formal_proposal.label}</option>
              </Select>
            </Field>
            <Field label="Template" htmlFor="q-template">
              <Select
                id="q-template"
                value={template.id}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="q-title">
              <Input id="q-title" value={docTitle} onChange={(event) => setDocTitle(event.target.value)} />
            </Field>
            <Field label="Date" htmlFor="q-date" required>
              <DatePicker value={quotationDate} onValueChange={setQuotationDate} />
            </Field>
            <Field label="Valid until" htmlFor="q-valid">
              <DatePicker value={validUntil} onValueChange={setValidUntil} />
            </Field>
            <Field label="Customer" htmlFor="q-customer">
              <Combobox
                options={customerOptions}
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(value);
                  const customer = customers?.find((item) => item.id === value);
                  if (customer) setPartyName(customer.name);
                }}
                placeholder="Select customer…"
              />
            </Field>
            <Field label="Party name" htmlFor="q-party" required>
              <Input id="q-party" value={partyName} onChange={(event) => setPartyName(event.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {format === "formal_proposal" ? (
          <Card>
            <CardHeader>
              <CardTitle>Proposal sections</CardTitle>
              <CardDescription>Cover, scope, timeline and assumptions print when the template enables them.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Introduction" htmlFor="q-intro">
                <Textarea id="q-intro" value={intro} onChange={(event) => setIntro(event.target.value)} />
              </Field>
              {template.showScope ? (
                <Field label="Scope of work" htmlFor="q-scope">
                  <Textarea id="q-scope" value={scope} onChange={(event) => setScope(event.target.value)} />
                </Field>
              ) : null}
              {template.showTimeline ? (
                <Field label="Timeline" htmlFor="q-timeline">
                  <Textarea id="q-timeline" value={timeline} onChange={(event) => setTimeline(event.target.value)} />
                </Field>
              ) : null}
              {template.showAssumptions ? (
                <Field label="Assumptions" htmlFor="q-assumptions">
                  <Textarea id="q-assumptions" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
                </Field>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Introduction</CardTitle>
            </CardHeader>
            <CardContent>
              <Field label="Introduction" htmlFor="q-intro">
                <Textarea id="q-intro" value={intro} onChange={(event) => setIntro(event.target.value)} />
              </Field>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lines</CardTitle>
            <CardDescription>GST uses the same engine as sales invoices. Catalogue products are optional until convert.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-28">Rate</TableHead>
                    <TableHead className="w-24">Disc</TableHead>
                    <TableHead className="w-24">GST</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell className="min-w-[240px] space-y-2">
                        <Combobox
                          options={productOptions}
                          value={line.productId}
                          onValueChange={(value) => applyProduct(line.key, value)}
                          placeholder="Catalogue product (optional)"
                        />
                        <Input
                          value={line.name}
                          onChange={(event) => patchLine(line.key, { name: event.target.value })}
                          placeholder="Description"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(event) => patchLine(line.key, { quantity: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(event) => patchLine(line.key, { unitPrice: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={line.discount}
                          onChange={(event) => patchLine(line.key, { discount: Number(event.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(line.gstRate)}
                          onChange={(event) => patchLine(line.key, { gstRate: Number(event.target.value) })}
                        >
                          {GST_RATE_OPTIONS.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}%
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setLines((current) => (current.length === 1 ? current : current.filter((item) => item.key !== line.key)))}
                          aria-label="Remove line"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}>
              <Plus className="size-4" />
              Add line
            </Button>
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <Field label="Invoice discount" htmlFor="q-discount">
                <Input id="q-discount" type="number" min={0} value={discount} onChange={(event) => setDiscount(event.target.value)} />
              </Field>
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(totals.taxAmount, currency)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(totals.total, currency)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Terms and conditions" htmlFor="q-terms">
              <Textarea id="q-terms" value={terms} onChange={(event) => setTerms(event.target.value)} />
            </Field>
            <Field label="Internal notes" htmlFor="q-notes">
              <Textarea id="q-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" loading={saving === "draft"} onClick={() => void save("draft")}>
            Save draft
          </Button>
          <Button loading={saving === "sent"} onClick={() => void save("sent")}>
            Save and mark sent
          </Button>
        </div>
      </div>
    </div>
  );
}
