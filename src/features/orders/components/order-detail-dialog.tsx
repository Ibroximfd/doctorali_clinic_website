"use client";

import { Ban, Gift, Pencil, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";

import { clientDetailPath } from "@/config/routes";
import { ReceiptPrintButton } from "@/features/receipt/components/receipt-print-button";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { useDoctorById } from "@/features/doctors/hooks/use-doctors";
import { OrderReturnsCard } from "@/features/returns/components/order-returns-card";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import {
  MIXED_PAYMENT_ICON,
  MIXED_PAYMENT_LABEL,
  NO_PAYMENT_ICON,
  NO_PAYMENT_LABEL,
  PAYMENT_TYPE_ICON,
  PAYMENT_TYPE_LABEL,
} from "@/shared/domain/payment-type";
import { dayMonthYearTime, isToday } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { useOrderDetailQuery } from "../hooks/use-orders";
import {
  isPriceEdited,
  isTotalEdited,
  lineQuantityLabel,
  lineShowsPackaging,
  orderDisplayClientName,
  orderUnitCount,
  totalOverrideDelta,
  type OrderDetail,
  type OrderLine,
} from "../types/order";
import { Badge } from "./order-badges";

/** Everything about one sale: the lines, the money, the debt and the actions. */
export function OrderDetailDialog({
  orderId,
  open,
  onOpenChange,
  onCancel,
  onDelete,
  onEdit,
  onReturn,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: (order: OrderDetail) => void;
  onDelete?: (order: OrderDetail) => void;
  onEdit?: (order: OrderDetail) => void;
  /** Opens the return form — goods back, money out of the till. */
  onReturn?: (order: OrderDetail) => void;
}) {
  const {
    data: order,
    error,
    isPending,
    refetch,
  } = useOrderDetailQuery(open ? orderId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[980px]">
        <DialogHeader>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="tabular truncate">
                {order ? order.orderNumber : "Buyurtma"}
              </DialogTitle>
              <DialogDescription>
                {order ? dayMonthYearTime(order.createdAt) : "Yuklanmoqda…"}
              </DialogDescription>
            </div>
            {/* The figure the dialog is opened for, at the top rather than
                four scrolls down at the end of the money list. */}
            {order && (
              <div className="shrink-0 text-right">
                <p className="text-label-xs text-text-tertiary">Jami</p>
                <p className="text-display-sm tabular leading-none">
                  {money.plain(order.totalAmount)}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        {error && !order ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !order ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-40 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </div>
        ) : (
          <OrderDetailBody order={order} />
        )}

        {order && (
          <DialogFooter className="flex-wrap gap-2">
            <ReceiptPrintButton orderId={order.id} size="sm" />
            <div className="flex-1" />
            {order.status !== "cancelled" && (
              <>
                {onEdit && (
                  <Button variant="outline" onClick={() => onEdit(order)}>
                    <Pencil className="size-4" aria-hidden />
                    Tahrirlash
                  </Button>
                )}
                {/* A return is not a correction: the client is handing goods
                    back, so it moves stock and cash rather than rewriting what
                    was sold. It sits beside the edit because the desk reaches
                    for one or the other from the same screen. */}
                {onReturn && (
                  <Button
                    variant="outline"
                    onClick={() => onReturn(order)}
                    className="border-warning/40 text-warning hover:bg-warning/10"
                  >
                    <Undo2 className="size-4" aria-hidden />
                    Qaytarish
                  </Button>
                )}
                {onCancel && (
                  <Button variant="outline" onClick={() => onCancel(order)}>
                    <Ban className="size-4" aria-hidden />
                    Bekor qilish
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    onClick={() => onDelete(order)}
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    O&rsquo;chirish
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailBody({ order }: { order: OrderDetail }) {
  const overrideDelta = totalOverrideDelta(order);

  /*
   * The order payload does not always carry the doctor's photo, so it is filled
   * in from the doctors list — already cached for five minutes, and the same
   * join the dashboard uses for product images. A face the desk sees elsewhere
   * should not turn back into initials here.
   */
  const catalogDoctor = useDoctorById(order.doctor.id);
  const doctorAvatar = order.doctor.avatarUrl ?? catalogDoctor?.avatarUrl ?? null;
  const doctorSpecialty =
    order.doctor.specialty !== ""
      ? order.doctor.specialty
      : (catalogDoctor?.specialty ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {order.status === "cancelled" && <Badge tone="danger">Bekor qilingan</Badge>}
        {order.orderType === "delivery" && <Badge>{ORDER_TYPE_LABEL.delivery}</Badge>}
        {order.buyerType === "staff" && <Badge>Xodim</Badge>}
        {order.hasGift && (
          <Badge tone="primary">
            <Gift className="size-3" aria-hidden />
            Sovg&rsquo;a
          </Badge>
        )}
        {!order.isReception && <Badge tone="info">Ilovadan</Badge>}
        {order.isEdited && <Badge tone="warning">Tahrirlangan</Badge>}
        {order.createdByName !== "" && (
          <span className="text-caption text-text-tertiary ml-auto">
            {order.createdByName}
          </span>
        )}
      </div>

      {/*
        Two columns on a wide screen: WHAT was sold on the left, WHAT IT COST on
        the right. One tall column meant the desk scrolled past twenty lines to
        reach the total — the figure the dialog is usually opened for.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <PersonCard
              label="Mijoz"
              name={orderDisplayClientName(order)}
              avatarUrl={order.client.avatarUrl}
              caption={phoneFromApi(order.clientPhone || order.client.phone)}
              href={order.client.id > 0 ? clientDetailPath(order.client.id) : null}
            />
            {order.doctor.fullName !== "" ? (
              <PersonCard
                label="Shifokor"
                name={order.doctor.fullName}
                avatarUrl={doctorAvatar}
                caption={
                  (doctorSpecialty !== "" ? `${doctorSpecialty} · ` : "") +
                  percent.labeled(order.commissionPercent)
                }
              />
            ) : (
              <div className="border-border flex flex-col justify-center rounded-md border p-3">
                <p className="text-label-xs text-text-tertiary">Shifokor</p>
                <p className="text-body-sm text-text-tertiary">Belgilanmagan</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline gap-2">
              <h3 className="text-label text-text-secondary">Mahsulotlar</h3>
              <span className="text-caption text-text-tertiary tabular">
                {order.items.length} nom · {orderUnitCount(order)} dona
              </span>
            </div>
            <ul className="border-border overflow-hidden rounded-md border">
              {order.items.map((line, index) => (
                <li
                  key={`${line.id}-${index}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5",
                    index > 0 && "border-surface-alt border-t",
                  )}
                >
                  <OrderLineRow line={line} />
                </li>
              ))}
            </ul>
          </div>

          <OrderReturnsCard orderId={order.id} />

          {order.note && (
            <p className="border-border text-body-sm text-text-secondary rounded-md border p-3">
              {order.note}
            </p>
          )}

          {!isToday(order.createdAt) && (
            <p className="text-caption text-warning">
              Bu buyurtma bugungi emas — o&rsquo;zgartirish uchun PIN-kod so&rsquo;raladi.
            </p>
          )}
        </div>

        <dl className="bg-surface-alt/60 flex flex-col gap-2 rounded-md p-3.5 lg:sticky lg:top-0">
          {isTotalEdited(order) && order.originalTotal !== null && (
            <Row
              label="Qatorlar summasi"
              value={money.plain(order.originalTotal)}
              muted
            />
          )}
          {overrideDelta !== 0 && (
            <Row
              label={overrideDelta < 0 ? "Chegirma" : "Qo'shimcha"}
              value={money.signed(overrideDelta)}
              tone={overrideDelta < 0 ? "primary" : "warning"}
            />
          )}
          <Row label="Jami" value={money.plain(order.totalAmount)} strong />
          {order.debt && (
            <Row
              label={`Qarzga · ${money.plain(order.debt.remaining)} qoldiq`}
              value={money.plain(order.debt.amount)}
              tone="warning"
            />
          )}
          <Row
            label="Kassaga tushdi"
            value={money.plain(order.paidAmount)}
            tone="primary"
          />
          <PaymentRows order={order} />
          {order.commissionAmount > 0 && (
            <Row
              label={`Komissiya · ${percent.labeled(order.commissionPercent)}`}
              value={money.plain(order.commissionAmount)}
              muted
            />
          )}
        </dl>
      </div>
    </div>
  );
}

/** The client and the doctor, drawn the same way so the pair reads as a pair. */
function PersonCard({
  label,
  name,
  caption,
  avatarUrl,
  href,
}: {
  label: string;
  name: string;
  caption: string;
  avatarUrl: string | null;
  href?: string | null;
}) {
  return (
    <div className="border-border flex items-center gap-3 rounded-md border p-3">
      <AppAvatar name={name} imageUrl={avatarUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-label-xs text-text-tertiary">{label}</p>
        {href ? (
          <Link
            href={href}
            className="text-title-sm focus-visible:ring-ring block truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {name}
          </Link>
        ) : (
          <p className="text-title-sm truncate">{name}</p>
        )}
        <p className="text-caption text-text-tertiary tabular truncate">{caption}</p>
      </div>
    </div>
  );
}

/**
 * How the money actually arrived.
 *
 * Each till gets its own icon and its own amount: "Aralash" on its own tells
 * the desk nothing, and the split is the first thing anyone asks about when a
 * day's cash does not balance.
 */
function PaymentRows({ order }: { order: OrderDetail }) {
  if (order.isUnpaidOrder) {
    return (
      <div className="text-text-tertiary flex items-center gap-2">
        <NO_PAYMENT_ICON className="size-4 shrink-0" aria-hidden />
        <span className="text-caption flex-1">{NO_PAYMENT_LABEL}</span>
      </div>
    );
  }

  const parts =
    order.isMixedPayment && order.payments.length > 0
      ? order.payments
      : [{ type: order.paymentType, amount: order.paidAmount }];

  return (
    <div className="flex flex-col gap-1.5">
      {order.isMixedPayment && (
        <div className="text-text-secondary flex items-center gap-2">
          <MIXED_PAYMENT_ICON className="size-4 shrink-0" aria-hidden />
          <span className="text-caption flex-1">{MIXED_PAYMENT_LABEL}</span>
        </div>
      )}
      {parts.map((part) => {
        const Icon = PAYMENT_TYPE_ICON[part.type];
        return (
          <div
            key={part.type}
            className="border-border/70 bg-surface flex items-center gap-2.5 rounded-md border px-2.5 py-2"
          >
            <span className="bg-primary-soft flex size-8 shrink-0 items-center justify-center rounded-md">
              <Icon className="text-primary size-4" aria-hidden />
            </span>
            <span className="text-body-sm flex-1">{PAYMENT_TYPE_LABEL[part.type]}</span>
            <span className="text-title-sm tabular">{money.plain(part.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

function OrderLineRow({ line }: { line: OrderLine }) {
  return (
    <>
      <ProductThumb name={line.productName} imageUrl={line.imageUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-title-sm truncate">{line.productName}</span>
          {line.isGift && (
            <Badge tone="primary">
              <Gift className="size-3" aria-hidden />
              BEPUL
            </Badge>
          )}
        </div>
        <p className="text-caption text-text-tertiary tabular mt-0.5">
          {lineShowsPackaging(line) ? lineQuantityLabel(line) : `${line.quantity} dona`}
          {!line.isGift && ` × ${money.plain(line.unitPrice)}`}
          {isPriceEdited(line) && line.originalUnitPrice !== null && (
            <span className="ml-1.5 line-through">
              {money.plain(line.originalUnitPrice)}
            </span>
          )}
        </p>
      </div>
      <span
        className={cn(
          "text-title-sm tabular shrink-0",
          line.isGift && "text-primary-dark",
        )}
      >
        {line.isGift ? "BEPUL" : money.plain(line.subtotal)}
      </span>
    </>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "primary" | "warning";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt
        className={cn(
          "text-caption flex-1",
          muted ? "text-text-tertiary" : "text-text-secondary",
        )}
      >
        {label}
      </dt>
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
