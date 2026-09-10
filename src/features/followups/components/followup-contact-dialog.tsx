"use client";

import { PhoneCall } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import { cn } from "@/shared/lib/utils";

import { useRecordContact } from "../hooks/use-followups";
import {
  FOLLOWUP_STATUS_LABEL,
  SELECTABLE_FOLLOWUP_STATUSES,
  type FollowupEntry,
  type FollowupStatus,
} from "../types/followup";

/**
 * Records how a call went.
 *
 * `pending` is not offered: it is the synthetic "never contacted" state the
 * backend reports, never a thing reception chooses.
 */
export function FollowupContactDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: FollowupEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const record = useRecordContact();
  const [status, setStatus] = useState<FollowupStatus>("contacted");
  const [note, setNote] = useState("");

  useResetOnChange(open ? (entry?.client.id ?? null) : null, () => {
    if (!open) return;
    setStatus("contacted");
    setNote("");
  });

  if (!entry) return null;

  async function submit() {
    if (!entry) return;
    await record.mutateAsync({ clientId: entry.client.id, status, note });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Bog&rsquo;lanishni qayd etish</DialogTitle>
          <DialogDescription className="tabular">
            {entry.client.fullName || "Mijoz"} · {phoneFromApi(entry.client.phone)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Natija</Label>
            <div role="radiogroup" aria-label="Natija" className="grid grid-cols-2 gap-2">
              {SELECTABLE_FOLLOWUP_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={status === option}
                  onClick={() => setStatus(option)}
                  className={cn(
                    "text-label h-11 rounded-md border transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    status === option
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {FOLLOWUP_STATUS_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-note">Izoh</Label>
            <Textarea
              id="contact-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Suhbat haqida qisqacha…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={record.isPending}>
            {record.isPending ? (
              <span
                className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                aria-hidden
              />
            ) : (
              <PhoneCall className="size-4" aria-hidden />
            )}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
