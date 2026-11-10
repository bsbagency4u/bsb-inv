"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import {
  DEFAULT_QUOTATION,
  EMPTY_BANK_DETAILS,
  QUOTATION_FORMAT_META,
  parseQuotationDefaults,
} from "@/lib/quotation-settings";
import { quotationPrintHtml } from "@/lib/quotation-print";
import { quotationPrintModel } from "@/lib/document-print-models";
import type {
  Quotation,
  QuotationBankDetails,
  QuotationDefaults,
  QuotationFormat,
  QuotationTemplate,
} from "@/types/domain";
import type { BusinessDocumentKind } from "@/services/storage.service";

const TABS = [
  { value: "format", label: "Format" },
  { value: "branding", label: "Branding" },
  { value: "bank", label: "Bank" },
  { value: "templates", label: "Templates" },
  { value: "share", label: "Share" },
];

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} />
    </div>
  );
}

const SAMPLE_QUOTATION: Quotation = {
  id: "sample",
  businessId: "sample",
  quotationNo: "QTN-2026-000001",
  customerId: null,
  partyName: "Sample customer",
  partyGstin: "27BBBBB0000B1Z5",
  partyPhone: "9876543210",
  partyEmail: null,
  quotationDate: "2026-11-09",
  validUntil: "2026-11-24",
  status: "draft",
  format: "product_service",
  templateId: "default-product",
  title: "Quotation",
  intro: "Thank you for the enquiry.",
  scope: "Supply of listed items.",
  timeline: "Delivery within 7 working days.",
  assumptions: "Prices exclude freight unless stated.",
  termsAndConditions: "Offer valid until the date shown.",
  notes: null,
  subtotal: 200,
  discount: 0,
  taxTotal: 36,
  total: 236,
  intraState: true,
  placeOfSupplyState: "MH",
  gstRegistrationSnapshot: "regular",
  convertedSalesInvoiceId: null,
  items: [
    {
      productId: null,
      name: "Sample service",
      description: null,
      sku: "SVC-01",
      hsn: "9983",
      quantity: 1,
      unit: "JOB",
      unitPrice: 200,
      gstRate: 18,
      discount: 0,
      taxableAmount: 200,
      taxAmount: 36,
      amount: 236,
    },
  ],
  createdAt: "2026-11-09",
  updatedAt: "2026-11-09",
};

export default function QuotationSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [tab, setTab] = React.useState("format");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState<BusinessDocumentKind | null>(null);
  const [draft, setDraft] = React.useState<QuotationDefaults | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quotation-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getQuotationDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const settings = draft ?? parseQuotationDefaults(defaults ?? DEFAULT_QUOTATION);
  const previewHtml = business
    ? quotationPrintHtml(
        business,
        quotationPrintModel(
          { ...SAMPLE_QUOTATION, format: settings.defaultFormat, title: settings.defaultFormat === "formal_proposal" ? "Proposal" : "Quotation" },
          { settings }
        ),
        business.currency ?? "INR"
      )
    : "";

  const patch = (next: Partial<QuotationDefaults>) => {
    setDraft(parseQuotationDefaults({ ...settings, ...next }));
  };

  const patchBank = (next: Partial<QuotationBankDetails>) => {
    patch({ bankDetails: { ...settings.bankDetails, ...next } });
  };

  const patchTemplate = (id: string, next: Partial<QuotationTemplate>) => {
    patch({
      templates: settings.templates.map((template) =>
        template.id === id ? { ...template, ...next } : next.isDefault ? { ...template, isDefault: false } : template
      ),
    });
  };

  const uploadAsset = async (kind: BusinessDocumentKind, file: File | null) => {
    if (!file || !business) return;
    setUploading(kind);
    try {
      const uploaded = await getClientServices().storage.uploadBusinessDocument(business.id, kind, file);
      if (kind === "logo") patch({ logoUrl: uploaded.url });
      if (kind === "watermark") patch({ watermarkImageUrl: uploaded.url, watermarkMode: "image", watermarkEnabled: true });
      if (kind === "signature") patch({ signatureImageUrl: uploaded.url, showSignature: true });
      if (kind === "stamp") patch({ stampImageUrl: uploaded.url, showStamp: true });
      toastSuccess("Image uploaded", "Save settings to keep this branding on new quotations.");
    } catch (err) {
      toastError("Could not upload image", normalizeError(err).userMessage);
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updateQuotationDefaults(user.id, business.id, settings);
      toastSuccess("Quotation settings saved", "New quotations use these templates and branding.");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["quotation-defaults"] });
    } catch (err) {
      toastError("Could not save quotation settings", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading quotation settings…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load quotation settings"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Formats, branding, bank details and templates for proposals and product quotes."
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Tabs tabs={TABS} value={tab} onValueChange={setTab} />

          {tab === "format" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4" />
                  Default format
                </CardTitle>
                <CardDescription>New quotations start with this layout. You can still change it per document.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Default format" htmlFor="q-default-format">
                  <Select
                    id="q-default-format"
                    value={settings.defaultFormat}
                    onChange={(event) => patch({ defaultFormat: event.target.value as QuotationFormat })}
                  >
                    <option value="product_service">{QUOTATION_FORMAT_META.product_service.label}</option>
                    <option value="formal_proposal">{QUOTATION_FORMAT_META.formal_proposal.label}</option>
                  </Select>
                </Field>
                <Field label="Validity (days)" htmlFor="q-validity">
                  <Input
                    id="q-validity"
                    type="number"
                    min={1}
                    max={365}
                    value={settings.validityDays}
                    onChange={(event) => patch({ validityDays: Number(event.target.value) || 15 })}
                  />
                </Field>
                <Field label="Paper" htmlFor="q-paper">
                  <Select
                    id="q-paper"
                    value={settings.paperSize === "a5" ? "a5" : "a4"}
                    onChange={(event) => patch({ paperSize: event.target.value === "a5" ? "a5" : "a4" })}
                  >
                    <option value="a4">A4</option>
                    <option value="a5">A5</option>
                  </Select>
                </Field>
                <Field label="Orientation" htmlFor="q-orient">
                  <Select
                    id="q-orient"
                    value={settings.orientation}
                    onChange={(event) => patch({ orientation: event.target.value === "landscape" ? "landscape" : "portrait" })}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </Select>
                </Field>
                <ToggleRow label="Show logo" hint="Uses the quotation logo, falling back to the business logo." checked={settings.showLogo} onCheckedChange={(checked) => patch({ showLogo: checked })} ariaLabel="Show logo" />
                <ToggleRow label="Show GSTIN" hint="Prints business and party GSTIN when present." checked={settings.showGstin} onCheckedChange={(checked) => patch({ showGstin: checked })} ariaLabel="Show GSTIN" />
                <ToggleRow label="Show HSN" hint="HSN/SAC column on itemised quotes." checked={settings.showHsn} onCheckedChange={(checked) => patch({ showHsn: checked })} ariaLabel="Show HSN" />
                <ToggleRow label="Show SKU" hint="SKU column on itemised quotes." checked={settings.showSku} onCheckedChange={(checked) => patch({ showSku: checked })} ariaLabel="Show SKU" />
                <ToggleRow label="Show discount" hint="Discount column and invoice discount row." checked={settings.showDiscount} onCheckedChange={(checked) => patch({ showDiscount: checked })} ariaLabel="Show discount" />
                <ToggleRow label="Tax breakup" hint="CGST/SGST or IGST instead of a single tax row." checked={settings.showTaxBreakup} onCheckedChange={(checked) => patch({ showTaxBreakup: checked })} ariaLabel="Show tax breakup" />
              </CardContent>
            </Card>
          ) : null}

          {tab === "branding" ? (
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Private uploads. Logos and stamps keep their aspect ratio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Logo" htmlFor="q-logo">
                  <Input id="q-logo" type="file" accept="image/*" disabled={uploading === "logo"} onChange={(event) => void uploadAsset("logo", event.target.files?.[0] ?? null)} />
                </Field>
                <ToggleRow label="Signature" hint="Print authorised signatory with optional image." checked={settings.showSignature} onCheckedChange={(checked) => patch({ showSignature: checked })} ariaLabel="Show signature" />
                <Field label="Signature label" htmlFor="q-sign-label">
                  <Input id="q-sign-label" value={settings.signatureLabel} onChange={(event) => patch({ signatureLabel: event.target.value })} />
                </Field>
                <Field label="Signature image" htmlFor="q-sign">
                  <Input id="q-sign" type="file" accept="image/*" disabled={uploading === "signature"} onChange={(event) => void uploadAsset("signature", event.target.files?.[0] ?? null)} />
                </Field>
                <ToggleRow label="Stamp" hint="Optional company stamp beside the signature." checked={settings.showStamp} onCheckedChange={(checked) => patch({ showStamp: checked })} ariaLabel="Show stamp" />
                <Field label="Stamp image" htmlFor="q-stamp">
                  <Input id="q-stamp" type="file" accept="image/*" disabled={uploading === "stamp"} onChange={(event) => void uploadAsset("stamp", event.target.files?.[0] ?? null)} />
                </Field>
                <ToggleRow label="Watermark" hint="Readable overlay. Does not stretch logos." checked={settings.watermarkEnabled} onCheckedChange={(checked) => patch({ watermarkEnabled: checked })} ariaLabel="Enable watermark" />
                <Field label="Watermark mode" htmlFor="q-wm-mode">
                  <Select
                    id="q-wm-mode"
                    value={settings.watermarkMode}
                    onChange={(event) => patch({ watermarkMode: event.target.value === "image" ? "image" : "text" })}
                  >
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                  </Select>
                </Field>
                <Field label="Watermark text" htmlFor="q-wm-text">
                  <Input id="q-wm-text" value={settings.watermarkText} onChange={(event) => patch({ watermarkText: event.target.value })} />
                </Field>
                <Field label="Opacity" htmlFor="q-wm-opacity" hint="0.04 to 0.35">
                  <Input
                    id="q-wm-opacity"
                    type="number"
                    min={0.04}
                    max={0.35}
                    step={0.01}
                    value={settings.watermarkOpacity}
                    onChange={(event) => patch({ watermarkOpacity: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Watermark image" htmlFor="q-wm-image">
                  <Input id="q-wm-image" type="file" accept="image/*" disabled={uploading === "watermark"} onChange={(event) => void uploadAsset("watermark", event.target.files?.[0] ?? null)} />
                </Field>
              </CardContent>
            </Card>
          ) : null}

          {tab === "bank" ? (
            <Card>
              <CardHeader>
                <CardTitle>Bank details</CardTitle>
                <CardDescription>Stored per business. Nothing is hardcoded.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <ToggleRow label="Show on quotation" hint="Prints only when enabled and fields are filled." checked={settings.showBankDetails} onCheckedChange={(checked) => patch({ showBankDetails: checked })} ariaLabel="Show bank details" />
                <div />
                <Field label="Account name" htmlFor="q-ac-name">
                  <Input id="q-ac-name" value={settings.bankDetails.accountName} onChange={(event) => patchBank({ accountName: event.target.value })} />
                </Field>
                <Field label="Account number" htmlFor="q-ac-no">
                  <Input id="q-ac-no" value={settings.bankDetails.accountNumber} onChange={(event) => patchBank({ accountNumber: event.target.value })} />
                </Field>
                <Field label="IFSC" htmlFor="q-ifsc">
                  <Input id="q-ifsc" value={settings.bankDetails.ifsc} onChange={(event) => patchBank({ ifsc: event.target.value })} />
                </Field>
                <Field label="Bank name" htmlFor="q-bank">
                  <Input id="q-bank" value={settings.bankDetails.bankName} onChange={(event) => patchBank({ bankName: event.target.value })} />
                </Field>
                <Field label="Branch" htmlFor="q-branch">
                  <Input id="q-branch" value={settings.bankDetails.branch} onChange={(event) => patchBank({ branch: event.target.value })} />
                </Field>
                <Field label="UPI" htmlFor="q-upi">
                  <Input id="q-upi" value={settings.bankDetails.upi} onChange={(event) => patchBank({ upi: event.target.value })} />
                </Field>
                <Button variant="outline" onClick={() => patch({ bankDetails: { ...EMPTY_BANK_DETAILS } })}>
                  Clear bank details
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {tab === "templates" ? (
            <Card>
              <CardHeader>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Saved per business. One default per format.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings.templates.map((template) => (
                  <div key={template.id} className="space-y-3 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{template.name}</p>
                      <Switch
                        checked={template.isDefault}
                        onCheckedChange={(checked) => patchTemplate(template.id, { isDefault: checked })}
                        aria-label={`Default ${template.name}`}
                      />
                    </div>
                    <Field label="Name" htmlFor={`tpl-name-${template.id}`}>
                      <Input id={`tpl-name-${template.id}`} value={template.name} onChange={(event) => patchTemplate(template.id, { name: event.target.value })} />
                    </Field>
                    <Field label="Introduction" htmlFor={`tpl-intro-${template.id}`}>
                      <Textarea id={`tpl-intro-${template.id}`} value={template.introHtml} onChange={(event) => patchTemplate(template.id, { introHtml: event.target.value })} />
                    </Field>
                    <Field label="Terms" htmlFor={`tpl-terms-${template.id}`}>
                      <Textarea id={`tpl-terms-${template.id}`} value={template.termsAndConditions} onChange={(event) => patchTemplate(template.id, { termsAndConditions: event.target.value })} />
                    </Field>
                    {template.format === "formal_proposal" ? (
                      <div className="grid gap-2">
                        <ToggleRow label="Cover" hint="Separate cover page." checked={template.showCover} onCheckedChange={(checked) => patchTemplate(template.id, { showCover: checked })} ariaLabel="Show cover" />
                        <ToggleRow label="Scope" hint="Scope of work section." checked={template.showScope} onCheckedChange={(checked) => patchTemplate(template.id, { showScope: checked })} ariaLabel="Show scope" />
                        <ToggleRow label="Timeline" hint="Timeline section." checked={template.showTimeline} onCheckedChange={(checked) => patchTemplate(template.id, { showTimeline: checked })} ariaLabel="Show timeline" />
                        <ToggleRow label="Assumptions" hint="Assumptions section." checked={template.showAssumptions} onCheckedChange={(checked) => patchTemplate(template.id, { showAssumptions: checked })} ariaLabel="Show assumptions" />
                      </div>
                    ) : null}
                  </div>
                ))}
                <Field label="Default terms" htmlFor="q-terms">
                  <Textarea id="q-terms" value={settings.termsAndConditions} onChange={(event) => patch({ termsAndConditions: event.target.value })} />
                </Field>
                <Field label="Footer" htmlFor="q-footer">
                  <Input id="q-footer" value={settings.footerNote} onChange={(event) => patch({ footerNote: event.target.value })} />
                </Field>
              </CardContent>
            </Card>
          ) : null}

          {tab === "share" ? (
            <Card>
              <CardHeader>
                <CardTitle>Share</CardTitle>
                <CardDescription>WhatsApp opens a message. Attach the downloaded file yourself if you need to send the document.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow label="WhatsApp" hint="Opens a composed message. Delivery is not claimed." checked={settings.whatsappEnabled} onCheckedChange={(checked) => patch({ whatsappEnabled: checked })} ariaLabel="Enable WhatsApp" />
                <Field label="Message template" htmlFor="q-msg" hint="Tokens: {party} {docTitle} {docNo} {business} {date} {total} {validUntil}">
                  <Textarea id="q-msg" value={settings.messageTemplate} onChange={(event) => patch({ messageTemplate: event.target.value })} />
                </Field>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardFooter className="justify-end">
              <Button loading={saving} onClick={() => void save()}>
                Save quotation settings
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-4">
          <Alert title="Preview only">
            Saved quotations keep their own GST totals. This preview uses sample figures.
          </Alert>
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <iframe title="Quotation preview" className="h-[720px] w-full" srcDoc={previewHtml} />
          </div>
        </div>
      </div>
    </div>
  );
}
