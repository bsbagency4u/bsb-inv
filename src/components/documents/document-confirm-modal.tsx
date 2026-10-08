"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function DocumentConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonRequired = false,
  reasonLabel = "Override reason",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  if (!open && reason !== "") {
    setReason("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            disabled={reasonRequired && reason.trim().length < 3}
            onClick={() => void onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reasonRequired ? (
        <Field label={reasonLabel} htmlFor="document-lock-reason" required>
          <Textarea
            id="document-lock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this locked document must change"
            rows={3}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </Modal>
  );
}
