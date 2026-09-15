"use client";

import { Check, CheckCircle2, Gift, Minus, Package, Plus, Undo2 } from "lucide-react";
import { useState } from "react";

import { useOrderDetailQuery } from "@/features/orders/hooks/use-orders";
import {
  lineQuantityLabel,
  lineShowsPackaging,
  type OrderDetail,
  type OrderLine,
} from "@/features/orders/types/order";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_ICON,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { ApiError } from "@/shared/lib/api/errors";
import { dayMonthYearTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { useCreateReturn } from "../hooks/use-returns";
import { refundSummary, type OrderReturn } from "../types/order-return";

/** The reason the audit log will show; the backend caps it here. */
const REASON_MAX = 255;

/** How many units of each line are going back, by order-line id. */
type Selection = Readonly<Record<string, number>>;

/**
 * Returns goods from a sale.
 *
 * Everything runs backwards through one request: the stock goes back on the
 * shelf, the doctor's commission shrinks, the client's debt is settled first
 * and only the remainder leaves the till. The desk's job here is just to say
 * WHAT is coming back and WHERE the money should come from.
 *
 * Two rules that shape this screen:
 *
 *  • **The PIN is always asked for**, whatever the order's date — unlike an
 *    edit, this one takes cash out of the drawer, so the day is irrelevant.
 *  • **The quantities come from a fresh order**, never from the row the desk
 *    clicked: a line that was already partly returned has a lower ceiling now,
 *    and the backend refuses anything above it with `return_exceeds_quantity`.
 */
export function OrderReturnDialog({
  orderId,
  open,
  onOpenChange,
  onDone,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs once a return went through — a list behind this can refresh itself. */
  onDone?: () => void;
}) {
  return (
    <Dialog open={open && orderId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[720px]">
        {orderId !== null && (
          <ReturnBody
            key={orderId}
            orderId={orderId}
            onClose={() => onOpenChange(false)}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReturnBody({
  orderId,
  onClose,
  onDone,
}: {
  orderId: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { data: order, error, isPending, refetch } = useOrderDetailQuery(orderId);
  const [result, setResult] = useState<OrderReturn | null>(null);

  if (result) {
    return <ReturnResult result={result} onClose={onClose} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <span className="bg-warning/15 flex shrink-0 rounded-[10px] p-2" aria-hidden>
            <Undo2 className="text-warning size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">Mahsulot qaytarish</span>
            <span className="text-caption text-text-tertiary tabular block font-normal">
              {order
                ? `${order.orderNumber} · ${dayMonthYearTime(order.createdAt)}`
                : "…"}
            </span>
          </span>
        </DialogTitle>
        <DialogDescription>
          Mahsulot skladga qaytadi, komissiya kamayadi. Avval qarz yopiladi, qolgani
          kassadan chiqadi.
        </DialogDescription>
      </DialogHeader>

      {error && !order ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending || !order ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-40 rounded-md" />
        </div>
      ) : (
        <ReturnForm
          order={order}
          onClose={onClose}
          onSaved={(saved) => {
            setResult(saved);
            onDone?.();
          }}
        />
      )}
    </>
  );
}

function ReturnForm({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetail;
  onClose: () => void;
  onSaved: (result: OrderReturn) => void;
}) {
  const create = useCreateReturn();
  const pinGate = usePinGate();

  // Opens with everything selected: a client who brings goods back usually
  // brings all of them, and unticking two lines is faster than ticking eight.
  const [selection, setSelection] = useState<Selection>(() => fullSelection(order));
  // Money goes back the way it came in. An order that took nothing (full
  // credit, a gift) parses as "cash" already, which is the right default for
  // the rare case where a refund is due on it at all.
  const [refundType, setRefundType] = useState<PaymentType>(order.paymentType);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedLines = order.items.filter((line) => (selection[line.id] ?? 0) > 0);
  const everything = isEverything(order, selection);
  /*
   * A partial return has to name each line by its own `order_item_id`. A
   * payload that did not carry one leaves only the whole-order path open —
   * guessing an id here would either be refused or, far worse, match a
   * different line.
   */
  const unaddressable = selectedLines.some((line) => line.orderItemId === null);
  const estimate = selectedLines.reduce(
    (sum, line) => sum + lineValue(line, selection[line.id] ?? 0),
    0,
  );
  const debtOpen = order.debt !== null && order.debt.remaining > 0;

  function setQuantity(line: OrderLine, quantity: number) {
    const clamped = Math.max(0, Math.min(quantity, line.quantity));
    setSelection((current) => ({ ...current, [line.id]: clamped }));
    setError(null);
  }

  async function submit(pin: string) {
    setError(null);
    try {
      const saved = await create.mutateAsync({
        orderId: order.id,
        draft: {
          // Everything selected travels as "no items" — the backend's own way
          // of saying "all of what is left", which stays correct even if the
          // order changed a second ago.
          items: everything
            ? null
            : selectedLines.map((line) => ({
                orderItemId: line.orderItemId as string,
                quantity: selection[line.id] ?? 0,
              })),
          refundPaymentType: refundType,
          reason,
          confirmPin: pin,
        },
      });
      onSaved(saved);
    } catch (caught) {
      // The server's own sentence is the useful one here: it names the product
      // and the quantity that is actually available. The one exception is a
      // 404: that is the whole endpoint missing from this server, not a missing
      // order, and "Ma'lumot topilmadi" would send the desk looking for the
      // sale instead of asking for a backend update.
      setError(
        ApiError.is(caught)
          ? caught.isNotFound
            ? "Bu serverda qaytarish bo'limi yoqilmagan — backend yangilanishi kerak"
            : caught.message
          : "Qaytarib bo'lmadi",
      );
    }
  }

  const blocker =
    order.status === "cancelled"
      ? "Bekor qilingan buyurtmadan qaytarib bo'lmaydi"
      : selectedLines.length === 0
        ? "Qaytariladigan mahsulotni tanlang"
        : !everything && unaddressable
          ? "Bu buyurtmani faqat to'liq qaytarish mumkin — «Hammasi» ni tanlang"
          : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-label flex-1">Qaytariladigan mahsulotlar</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelection(fullSelection(order))}
          >
            <Check className="size-4" aria-hidden />
            Hammasi
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelection({})}
            className="text-text-tertiary"
          >
            Tozalash
          </Button>
        </div>

        <ul className="border-border divide-surface-alt divide-y overflow-hidden rounded-md border">
          {order.items.map((line) => (
            <li key={line.id}>
              <ReturnLineRow
                line={line}
                quantity={selection[line.id] ?? 0}
                onChange={(quantity) => setQuantity(line, quantity)}
              />
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <Label>Pul qaysi kassadan qaytariladi</Label>
          <div
            role="radiogroup"
            aria-label="To'lov turi"
            className="flex flex-wrap gap-1.5"
          >
            {PAYMENT_TYPES.map((type) => {
              const Icon = PAYMENT_TYPE_ICON[type];
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={refundType === type}
                  onClick={() => setRefundType(type)}
                  className={cn(
                    "text-label-sm inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    refundType === type
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {PAYMENT_TYPE_LABEL[type]}
                </button>
              );
            })}
          </div>
          {debtOpen && (
            <p className="text-caption text-warning">
              Bu buyurtmada {money.uzs(order.debt?.remaining ?? 0)} qarz bor — avval
              o&rsquo;shandan ayiriladi, kassadan faqat qolgani chiqadi.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="return-reason">Sabab</Label>
          <Textarea
            id="return-reason"
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Masalan: mijozga to'g'ri kelmadi"
          />
        </div>

        <div className="bg-surface-alt flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md p-3">
          <span className="text-caption text-text-secondary flex-1">
            {selectedLines.length} ta qator
            {everything && selectedLines.length > 0 && " · butun buyurtma"}
          </span>
          {/* Marked as an estimate on purpose: the exact split between the debt
              and the till is the server's, and it arrives with the answer. */}
          <span className="text-title tabular">≈ {money.plain(estimate)}</span>
        </div>

        {(error ?? blocker) && (
          <p
            role="alert"
            className="bg-danger/10 text-caption text-danger rounded-md p-3"
          >
            {error ?? blocker}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button
          type="button"
          disabled={blocker !== null || create.isPending}
          onClick={() => pinGate.requestPin((pin) => void submit(pin))}
          className="bg-warning hover:bg-warning/90 text-white"
        >
          <Undo2 className="size-4" aria-hidden />
          Qaytarishni tasdiqlash
        </Button>
      </DialogFooter>

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        title="Qaytarishni tasdiqlang"
        description="Kassadan pul chiqadi — 4 xonali PIN-kodni kiriting."
      />
    </>
  );
}

/** One order line, with how many of its units are going back. */
function ReturnLineRow({
  line,
  quantity,
  onChange,
}: {
  line: OrderLine;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const selected = quantity > 0;
  const partial = selected && quantity < line.quantity;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors",
        selected && "bg-primary-soft/25",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(next) => onChange(next === true ? line.quantity : 0)}
        aria-label={`${line.productName} qaytarish`}
      />
      <ProductThumb name={line.productName} imageUrl={line.imageUrl} size={38} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-title-sm truncate">{line.productName}</span>
          {line.isGift && (
            <span className="bg-primary-soft text-primary-dark inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
              <Gift className="size-3" aria-hidden />
              BEPUL
            </span>
          )}
        </div>
        <p className="text-caption text-text-tertiary tabular truncate">
          Buyurtmada{" "}
          {lineShowsPackaging(line) ? lineQuantityLabel(line) : `${line.quantity} dona`}
          {!line.isGift && ` · ${money.plain(line.subtotal)}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <StepButton
          label="Kamaytirish"
          disabled={quantity <= 0}
          onClick={() => onChange(quantity - 1)}
        >
          <Minus className="size-4" />
        </StepButton>
        <input
          type="text"
          inputMode="numeric"
          value={String(quantity)}
          aria-label={`${line.productName} qaytariladigan miqdor`}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
            onChange(digits === "" ? 0 : Number(digits));
          }}
          className={cn(
            "text-title-sm tabular h-8 w-12 rounded-sm bg-transparent text-center",
            "hover:bg-surface-alt focus-visible:bg-surface focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        />
        <StepButton
          label="Ko'paytirish"
          disabled={quantity >= line.quantity}
          onClick={() => onChange(quantity + 1)}
        >
          <Plus className="size-4" />
        </StepButton>
      </div>

      <span className="text-title-sm tabular w-[92px] shrink-0 text-right">
        {selected ? `≈ ${money.plain(lineValue(line, quantity))}` : "—"}
        {partial && (
          <span className="text-caption text-text-tertiary block font-normal">
            {line.quantity} dan {quantity}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * What came of it — the three figures, spelled out.
 *
 * Showing only the refund is how the desk ends up believing a debt-settled
 * return "lost" the money; showing only the value is how they expect cash that
 * never left the drawer.
 */
function ReturnResult({ result, onClose }: { result: OrderReturn; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <span className="bg-primary-soft flex shrink-0 rounded-[10px] p-2" aria-hidden>
            <CheckCircle2 className="text-primary size-[18px]" />
          </span>
          Qaytarish rasmiylashtirildi
        </DialogTitle>
        <DialogDescription className="tabular">
          {result.orderNumber} · {refundSummary(result)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <dl className="border-border flex flex-col gap-2 rounded-md border p-3.5">
          <ResultRow
            label="Qaytgan mol qiymati"
            value={money.plain(result.returnedValue)}
            strong
          />
          <ResultRow
            label="Qarzdan hisobga olindi"
            value={money.plain(result.debtReduced)}
            tone={result.debtReduced > 0 ? "warning" : undefined}
          />
          <ResultRow
            label={
              result.refundPaymentType
                ? `Kassadan chiqdi · ${PAYMENT_TYPE_LABEL[result.refundPaymentType]}`
                : "Kassadan chiqdi"
            }
            value={money.plain(result.refundAmount)}
            tone={result.refundAmount > 0 ? "primary" : undefined}
          />
        </dl>

        {result.refundAmount === 0 && result.debtReduced > 0 && (
          <p className="bg-warning/10 text-caption text-warning rounded-md p-3">
            Naqd pul chiqmadi — summa mijozning qarzidan ayirildi.
          </p>
        )}

        {result.isFull && (
          <p className="bg-danger/10 text-caption text-danger rounded-md p-3">
            Buyurtmada to&rsquo;lanadigan mahsulot qolmadi — buyurtma bekor qilindi.
          </p>
        )}

        <ul className="border-border divide-surface-alt divide-y rounded-md border">
          {result.items.map((line) => (
            <li key={line.id} className="text-body-sm flex items-center gap-3 px-3 py-2">
              <Package className="text-text-tertiary size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{line.productName}</span>
              <span className="tabular text-text-secondary shrink-0">
                {line.quantity} dona · {money.plain(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Yopish
        </Button>
      </DialogFooter>
    </>
  );
}

function ResultRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "primary" | "warning";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-caption text-text-secondary flex-1">{label}</dt>
      <dd
        className={cn(
          "tabular",
          strong ? "text-title-lg" : "text-title-sm",
          tone === "primary" && "text-primary-dark",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border-border bg-surface text-text-secondary hover:bg-surface-hover flex size-8 items-center justify-center rounded-sm border transition-colors disabled:opacity-40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}

/** Every line, at its full quantity. */
function fullSelection(order: OrderDetail): Selection {
  return Object.fromEntries(order.items.map((line) => [line.id, line.quantity]));
}

/** True when the whole order is selected — then `items` is left out entirely. */
function isEverything(order: OrderDetail, selection: Selection): boolean {
  return (
    order.items.length > 0 &&
    order.items.every((line) => (selection[line.id] ?? 0) >= line.quantity)
  );
}

/**
 * What these units are worth, taken PROPORTIONALLY from the line's billed sum
 * rather than from a unit price — a hand-typed line total and a manual order
 * total both make the two disagree, and the line's own sum is the one the sale
 * was booked at. It is still only an estimate: the split between the debt and
 * the till is the server's to make.
 */
function lineValue(line: OrderLine, quantity: number): number {
  if (line.quantity <= 0 || quantity <= 0) return 0;
  if (quantity >= line.quantity) return line.subtotal;
  return Math.round((line.subtotal * quantity) / line.quantity);
}
