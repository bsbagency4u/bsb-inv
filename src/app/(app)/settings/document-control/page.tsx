"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import {
  DEFAULT_DOCUMENT_CONTROL,
  DOCUMENT_CONTROL_KIND_META,
  DOCUMENT_CONTROL_KINDS,
  parseDocumentControlDefaults,
} from "@/lib/document-control";
import type { DocumentControlDefaults } from "@/types/domain";

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

export default function DocumentControlSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DocumentControlDefaults | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["document-control", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getDocumentControlDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const settings = draft ?? parseDocumentControlDefaults(defaults ?? DEFAULT_DOCUMENT_CONTROL);

  const patch = (next: Partial<DocumentControlDefaults>) => {
    setDraft(parseDocumentControlDefaults({ ...settings, ...next }));
  };

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updateDocumentControlDefaults(user.id, business.id, settings);
      toastSuccess("Document Control saved", "Purchase, sales, returns and payments will use these rules.");
      await queryClient.invalidateQueries({ queryKey: ["document-control"] });
      setDraft(null);
    } catch (err) {
      toastError("Could not save Document Control", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading Document Control…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load Document Control"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Document Control"
        description="Dates, lock period, numbering and edit/delete rules for every document."
      />
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Dates
            </CardTitle>
            <CardDescription>
              Document date stays as entered. Created and updated timestamps are never rewritten to today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Allow backdate"
              hint="Staff can save a document with a past date, within the day limit."
              checked={settings.allowBackdate}
              onCheckedChange={(checked) => patch({ allowBackdate: checked })}
            />
            <Field label="Maximum backdate days" htmlFor="dc-backdate-days">
              <Input
                id="dc-backdate-days"
                type="number"
                min={0}
                max={3650}
                value={settings.maxBackdateDays}
                onChange={(event) => patch({ maxBackdateDays: Number(event.target.value) || 0 })}
                disabled={!settings.allowBackdate}
              />
            </Field>
            <ToggleRow
              label="Allow future date"
              hint="Staff can save a document dated after today."
              checked={settings.allowFutureDate}
              onCheckedChange={(checked) => patch({ allowFutureDate: checked })}
            />
            <Field label="Maximum future days" htmlFor="dc-future-days">
              <Input
                id="dc-future-days"
                type="number"
                min={0}
                max={365}
                value={settings.maxFutureDays}
                onChange={(event) => patch({ maxFutureDays: Number(event.target.value) || 0 })}
                disabled={!settings.allowFutureDate}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lock period</CardTitle>
            <CardDescription>Posted documents older than this cannot be changed unless lock override is allowed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Lock old documents"
              hint="After the lock days, posted documents need an override reason to change."
              checked={settings.lockEnabled}
              onCheckedChange={(checked) => patch({ lockEnabled: checked })}
            />
            <Field label="Lock after days" htmlFor="dc-lock-days" hint="0 locks posted documents immediately.">
              <Input
                id="dc-lock-days"
                type="number"
                min={0}
                max={3650}
                value={settings.lockAfterDays}
                onChange={(event) => patch({ lockAfterDays: Number(event.target.value) || 0 })}
                disabled={!settings.lockEnabled}
              />
            </Field>
            <ToggleRow
              label="Allow lock override"
              hint="Requires a reason and the override-lock permission. Every override is audited."
              checked={settings.allowOverrideLock}
              onCheckedChange={(checked) => patch({ allowOverrideLock: checked })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit, delete and cancel</CardTitle>
            <CardDescription>Drafts may be deleted. Posted documents prefer cancel with stock and payment reversal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Allow edit posted"
              hint="Posted bills and invoices can be edited. Stock is reversed then reapplied."
              checked={settings.allowEditPosted}
              onCheckedChange={(checked) => patch({ allowEditPosted: checked })}
            />
            <ToggleRow
              label="Allow delete draft"
              hint="Unposted drafts can be hard-deleted. Their numbers are never reused."
              checked={settings.allowDeleteDraft}
              onCheckedChange={(checked) => patch({ allowDeleteDraft: checked })}
            />
            <ToggleRow
              label="Allow delete posted"
              hint="Posted documents are deleted only when nothing downstream has consumed them."
              checked={settings.allowDeletePosted}
              onCheckedChange={(checked) => patch({ allowDeletePosted: checked })}
            />
            <ToggleRow
              label="Allow cancel posted"
              hint="Cancel reverses stock and keeps the original document number."
              checked={settings.allowCancelPosted}
              onCheckedChange={(checked) => patch({ allowCancelPosted: checked })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Numbering</CardTitle>
            <CardDescription>
              Numbers come from an atomic sequence. They do not depend on document date and are never reused after delete or cancel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {DOCUMENT_CONTROL_KINDS.map((kind) => (
              <Field key={kind} label={DOCUMENT_CONTROL_KIND_META[kind].label} htmlFor={`dc-prefix-${kind}`}>
                <Input
                  id={`dc-prefix-${kind}`}
                  value={settings.numbering[kind].prefix}
                  maxLength={12}
                  onChange={(event) =>
                    patch({
                      numbering: {
                        ...settings.numbering,
                        [kind]: { prefix: event.target.value },
                      },
                    })
                  }
                />
              </Field>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={() => void save()} loading={saving}>
              Save Document Control
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
