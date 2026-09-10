"use client";

import { Save, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";

import type { Doctor } from "@/features/doctors/types/doctor";
import { percentFor } from "@/features/doctors/types/doctor";
import { DoctorPicker } from "@/features/doctors/components/doctor-picker";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { DateInput } from "@/shared/components/form/date-input";
import {
  DebtEditor,
  EMPTY_DEBT_DRAFT,
  creditedAmount,
  isDebtDraftValid,
  toDebtDraft,
  type DebtDraftState,
} from "@/shared/components/form/debt-editor";
import { MoneyInput } from "@/shared/components/form/money-input";
import {
  PaymentSplitEditor,
  isSplitValid,
  splitError,
  splitPayments,
} from "@/shared/components/form/payment-split-editor";
import { PaymentTypeSelector } from "@/shared/components/form/payment-type-selector";
import { PhoneInput } from "@/shared/components/form/phone-input";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { PaymentType } from "@/shared/domain/payment-type";
import {
  isToday,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { isPhoneComplete, phoneToApi } from "@/shared/lib/format/phone";
import { percent } from "@/shared/lib/format/percent";
import { uuidV4 } from "@/shared/lib/uuid";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import { cn } from "@/shared/lib/utils";

import {
  useCreateTreatment,
  useTreatmentPreviewQuery,
  useTreatmentTypesQuery,
} from "../hooks/use-treatments";
import {
  TREATMENT_KINDS,
  TREATMENT_KIND_LABEL,
  type TreatmentKind,
} from "../types/treatment";

/**
 * Records a procedure or a consultation.
 *
 * The payment and credit maths are intentionally identical to New Order's —
 * same names, same rules — because they ARE the same rules: `payments[]` must
 * sum to `amount − debt`, and a service that takes no money now is booked
 * `payment_type: "none"` unless the desk marks one deliberately.
 */
export function TreatmentFormDialog({
  open,
  onOpenChange,
  /** Pre-fills the client when opened from a visit or a client card. */
  initialClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClient?: { phone: string; name: string } | null;
}) {
  const create = useCreateTreatment();
  const { data: knownTypes = [] } = useTreatmentTypesQuery();
  const pinGate = usePinGate();

  const [kind, setKind] = useState<TreatmentKind>("treatment");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [performedAt, setPerformedAt] = useState<TashkentDate | null>(null);
  const [debt, setDebt] = useState<DebtDraftState>(EMPTY_DEBT_DRAFT);
  const [paymentType, setPaymentType] = useState<PaymentType | null>("cash");
  const [paymentMarked, setPaymentMarked] = useState(false);
  const [split, setSplit] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Partial<Record<PaymentType, number>>>(
    {},
  );
  const [showValidation, setShowValidation] = useState(false);

  // One key per opening, reused for every retry of this same submission.
  const idempotencyKey = useMemo(() => (open ? uuidV4() : ""), [open]);

  useResetOnChange(open ? (initialClient?.phone ?? "blank") : null, () => {
    if (!open) return;
    setKind("treatment");
    setPhone(initialClient?.phone ?? "");
    setName(initialClient?.name ?? "");
    setDoctor(null);
    setAmount(0);
    setDescription("");
    setPerformedAt(null);
    setDebt(EMPTY_DEBT_DRAFT);
    setPaymentType("cash");
    setPaymentMarked(false);
    setSplit(false);
    setSplitAmounts({});
    setShowValidation(false);
  });

  // --- Money -----------------------------------------------------------------

  const credited = creditedAmount(debt);
  const preview = useTreatmentPreviewQuery({
    kind,
    doctorId: doctor?.id ?? null,
    amount,
    debtAmount: credited,
    debtDueDate: debt.dueDate?.getTime() ?? null,
  });

  /**
   * The preview only counts while it still describes what is typed — an amount
   * changed a keystroke ago must not be priced by the previous answer.
   */
  const livePreview =
    preview.data && preview.data.amount === amount && preview.data.debtAmount === credited
      ? preview.data
      : null;

  const paidNow = livePreview?.paidNow ?? Math.max(0, amount - credited);
  /** Nothing changes hands: the whole service went on credit. */
  const fullyOnCredit = debt.enabled && paidNow === 0 && debt.amount > 0;
  const paymentUnmarked = fullyOnCredit && !paymentMarked;

  /**
   * The percentage this doctor earns for THIS kind of service, when the record
   * carries one. Null means the app has no business guessing — the product rate
   * is a different number entirely, and printing it would misquote the doctor.
   */
  const commissionPercent =
    livePreview?.commissionPercent ?? (doctor ? percentFor(doctor, kind) : null);
  const commissionAmount =
    livePreview?.commissionAmount ??
    (doctor && commissionPercent !== null
      ? Math.round((amount * commissionPercent) / 100)
      : null);

  // --- Validation ------------------------------------------------------------

  const phoneError =
    showValidation && !isPhoneComplete(phone) ? "Telefon raqamini to'liq kiriting" : null;
  const nameError = showValidation && name.trim() === "" ? "Mijoz ismini kiriting" : null;
  const doctorError = showValidation && doctor === null ? "Shifokorni tanlang" : null;
  const amountError = showValidation && amount <= 0 ? "Summani kiriting" : null;
  const paymentError =
    showValidation && !split && !fullyOnCredit && paymentType === null
      ? "To'lov turini tanlang"
      : null;

  const debtValid = isDebtDraftValid(debt, amount);
  const splitOk = isSplitValid(splitAmounts, paidNow);

  const valid =
    isPhoneComplete(phone) &&
    name.trim() !== "" &&
    doctor !== null &&
    amount > 0 &&
    debtValid &&
    (fullyOnCredit || (split ? splitOk : paymentType !== null));

  /** Filing under an earlier day is what the backend gates behind the PIN. */
  const needsPin = performedAt !== null && !isToday(performedAt);

  async function submit(confirmPin?: string) {
    if (!valid || doctor === null) return;
    await create.mutateAsync({
      kind,
      clientPhone: phoneToApi(phone),
      clientName: name,
      doctorId: doctor.id,
      amount,
      description,
      paymentType: paymentUnmarked ? null : (paymentType ?? "cash"),
      payments: split ? splitPayments(splitAmounts) : null,
      debt: toDebtDraft(debt),
      performedAt,
      confirmPin: confirmPin ?? null,
      idempotencyKey,
    });
    onOpenChange(false);
  }

  function handleSubmit() {
    setShowValidation(true);
    if (!valid) return;
    if (needsPin) pinGate.requestPin((pin) => void submit(pin));
    else void submit();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Yangi muolaja</DialogTitle>
            <DialogDescription>
              Komissiyani server hisoblaydi — forma foizni o&rsquo;zi qo&rsquo;llamaydi.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div
              role="radiogroup"
              aria-label="Xizmat turi"
              className="border-border bg-surface-alt flex gap-1 rounded-md border p-1"
            >
              {TREATMENT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "text-label flex-1 rounded-sm px-3 py-2 transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    kind === k
                      ? "bg-surface text-primary-dark shadow-xs"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {TREATMENT_KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tr-phone">Mijoz telefoni</Label>
                <PhoneInput
                  id="tr-phone"
                  value={phone}
                  onValueChange={setPhone}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "tr-phone-error" : undefined}
                  className="h-[46px]"
                />
                {phoneError && (
                  <p
                    id="tr-phone-error"
                    role="alert"
                    className="text-caption text-danger"
                  >
                    {phoneError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tr-name">Mijoz ismi</Label>
                <Input
                  id="tr-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "tr-name-error" : undefined}
                  className="h-[46px]"
                />
                {nameError && (
                  <p id="tr-name-error" role="alert" className="text-caption text-danger">
                    {nameError}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tr-doctor">Shifokor</Label>
              <DoctorPicker
                id="tr-doctor"
                value={doctor}
                onChange={setDoctor}
                onClear={() => setDoctor(null)}
                error={doctorError}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tr-amount">Summa</Label>
                <MoneyInput
                  id="tr-amount"
                  value={amount}
                  onValueChange={setAmount}
                  aria-invalid={Boolean(amountError)}
                  aria-describedby={amountError ? "tr-amount-error" : undefined}
                  className="h-[46px] text-lg font-bold"
                />
                {amountError && (
                  <p
                    id="tr-amount-error"
                    role="alert"
                    className="text-caption text-danger"
                  >
                    {amountError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tr-date">Bajarilgan sana</Label>
                <DateInput
                  id="tr-date"
                  value={performedAt}
                  onChange={setPerformedAt}
                  placeholder="Bugun"
                  toDate={startOfDay(nowTashkent())}
                />
                {needsPin && (
                  <p className="text-caption text-warning">
                    Oldingi kunga yozish uchun PIN-kod so&rsquo;raladi
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tr-description">Tavsif</Label>
              <Input
                id="tr-description"
                list="treatment-types"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Nima qilindi?"
                className="h-[46px]"
              />
              {/* Autocomplete keeps the same procedure worded the same way —
                  which is what makes the services report meaningful. */}
              <datalist id="treatment-types">
                {knownTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>

            <DebtEditor
              state={debt}
              onChange={setDebt}
              maxAmount={amount}
              showValidation={showValidation}
            />

            <div className="space-y-1.5">
              <Label>To&rsquo;lov turi</Label>
              <PaymentTypeSelector
                value={paymentType}
                onChange={(type) => {
                  setPaymentType(type);
                  setPaymentMarked(true);
                }}
                nothingPayable={fullyOnCredit}
                marked={paymentMarked}
                onUnmark={() => setPaymentMarked(false)}
                error={paymentError}
              />
            </div>

            <PaymentSplitEditor
              enabled={split}
              onEnabledChange={setSplit}
              amounts={splitAmounts}
              onAmountChange={(type, value) =>
                setSplitAmounts((prev) => {
                  const next = { ...prev };
                  if (value <= 0) delete next[type];
                  else next[type] = value;
                  return next;
                })
              }
              target={paidNow}
              error={showValidation && split ? splitError(splitAmounts, paidNow) : null}
            />

            <div className="border-border flex items-center gap-3 rounded-md border p-3">
              <span
                className="bg-primary-soft flex size-8 items-center justify-center rounded-sm"
                aria-hidden
              >
                <Stethoscope className="text-primary size-[17px]" />
              </span>
              <div className="flex-1">
                <p className="text-caption text-text-secondary">Shifokor komissiyasi</p>
                {commissionAmount === null ? (
                  <p className="text-title-sm text-text-tertiary mt-0.5">
                    Serverda hisoblanadi
                  </p>
                ) : (
                  <p className="text-title tabular mt-0.5">
                    {money.plain(commissionAmount)}
                    {commissionPercent !== null && (
                      <span className="text-caption text-text-tertiary ml-1.5 font-semibold">
                        · {percent.labeled(commissionPercent)}
                      </span>
                    )}
                    {livePreview === null && commissionAmount > 0 && (
                      <span className="text-caption text-warning ml-1.5 font-normal">
                        (taxminiy)
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-caption text-text-secondary">Hozir to&rsquo;lanadi</p>
                <p className="text-title text-primary-dark tabular mt-0.5">
                  {money.plain(paidNow)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? (
                <span
                  className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                  aria-hidden
                />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        description="Muolajani oldingi kunga yozish uchun 4 xonali PIN-kodni kiriting."
      />
    </>
  );
}
