"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
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

import {
  useAnonymizeClient,
  useBlockClient,
  useUnblockClient,
} from "../hooks/use-clients";

/** Asks for the mandatory block reason. */
export function ClientBlockDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: number;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const block = useBlockClient();
  const [reason, setReason] = useState("");

  async function submit() {
    const trimmed = reason.trim();
    if (trimmed === "") return;
    await block.mutateAsync({ clientId, reason: trimmed });
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Mijozni bloklash</DialogTitle>
          <DialogDescription>
            {clientName} bloklanadi — unga yangi sotuv, muolaja va tashrif rasmiylashtirib
            bo&rsquo;lmaydi. Sabab majburiy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="block-reason">Sabab</Label>
          <Textarea
            id="block-reason"
            rows={2}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nega bloklanmoqda?"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          {/* Validated on click rather than by disabling the button — a dead
              button never explains itself. */}
          <Button
            type="button"
            className="bg-danger hover:bg-danger/90 text-danger-foreground"
            disabled={block.isPending}
            onClick={() => void submit()}
          >
            Bloklash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientUnblockDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: number;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const unblock = useUnblockClient();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Blokdan chiqarish</AlertDialogTitle>
          <AlertDialogDescription>
            {clientName} blokdan chiqariladi va unga yana sotuv qilish mumkin
            bo&rsquo;ladi. Davom etasizmi?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Yo&rsquo;q</AlertDialogCancel>
          <AlertDialogAction onClick={() => void unblock.mutateAsync(clientId)}>
            Ha, chiqarish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The irreversible "forget client": personal data wiped, phone masked, app
 * account unlinked. Only the money records stay.
 */
export function ClientAnonymizeDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: number;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anonymize = useAnonymizeClient();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mijozni unutish</AlertDialogTitle>
          <AlertDialogDescription>
            {clientName} kartasidagi ism, manzil va izohlar O&rsquo;CHIRILADI, telefon
            raqami yashiriladi, ilova hisobi uziladi. Pul yozuvlari saqlanib qoladi. Bu
            amalni ORTGA QAYTARIB BO&rsquo;LMAYDI. Davom etasizmi?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger hover:bg-danger/90 text-danger-foreground"
            onClick={() => void anonymize.mutateAsync(clientId)}
          >
            Ha, unutish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Composes a note on a client card. */
export function ClientNoteDialog({
  clientName,
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setText("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Izoh qo&rsquo;shish</DialogTitle>
          <DialogDescription>{clientName}</DialogDescription>
        </DialogHeader>

        <Textarea
          rows={3}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nima eslab qolish kerak?"
          aria-label="Izoh matni"
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            disabled={busy || text.trim() === ""}
            onClick={() => {
              onSubmit(text.trim());
              setText("");
              onOpenChange(false);
            }}
          >
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
