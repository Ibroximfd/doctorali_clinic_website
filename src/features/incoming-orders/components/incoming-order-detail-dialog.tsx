"use client";

import { Copy, Gift, MapPin, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { clientDetailPath } from "@/config/routes";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { dayMonthTime, dayMonthYearTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { useIncomingOrderDetailQuery } from "../hooks/use-incoming-orders";
import {
  hasAnyNote,
  hasDeliveryInfo,
  type IncomingDoctor,
  type IncomingOrderDetail,
  type IncomingOrderItem,
} from "../types/incoming-order";
import {
  Badge,
  IncomingGiftBadge,
  IncomingPaidBadge,
  IncomingStatusBadge,
  IncomingTypeBadge,
  SourceMark,
} from "./incoming-badges";

/**
 * The full card of one incoming order — read-only on purpose (§1): statuses
 * are the logist/operator panel's job, so this dialog answers questions and
 * never changes anything.
 */
export function IncomingOrderDetailDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    data: detail,
    error,
    isPending,
    refetch,
  } = useIncomingOrderDetailQuery(open ? orderId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[980px]">
        <DialogHeader>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="tabular flex items-center truncate">
                {detail ? detail.summary.orderNumber : "Buyurtma"}
                {detail && <SourceMark source={detail.summary.source} />}
              </DialogTitle>
              <DialogDescription>
                {detail ? dayMonthYearTime(detail.summary.createdAt) : "Yuklanmoqda…"}
              </DialogDescription>
            </div>
            {/* The figure the dialog is opened for — payable is what the
                client actually pays (§4). */}
            {detail && (
              <div className="shrink-0 text-right">
                <p className="text-label-xs text-text-tertiary">To&rsquo;lanadigan</p>
                <p className="text-display-sm tabular leading-none">
                  {money.plain(detail.amounts.payableAmount)}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        {error && !detail ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !detail ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-40 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </div>
        ) : (
          <IncomingDetailBody detail={detail} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IncomingDetailBody({ detail }: { detail: IncomingOrderDetail }) {
  const { summary, amounts, payment, delivery } = detail;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <IncomingStatusBadge order={summary} />
        <IncomingPaidBadge order={summary} />
        <IncomingTypeBadge order={summary} />
        <IncomingGiftBadge order={summary} />
        {detail.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <PersonCard
              label="Mijoz"
              name={detail.client.fullName || summary.clientName || "Mijoz"}
              caption={phoneFromApi(detail.client.phone || summary.clientPhone)}
              href={
                detail.client.cardId !== null
                  ? clientDetailPath(detail.client.cardId)
                  : null
              }
            />
            <DoctorCard
              doctor={detail.doctor}
              attributedDoctor={detail.attributedDoctor}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline gap-2">
              <h3 className="text-label text-text-secondary">Mahsulotlar</h3>
              <span className="text-caption text-text-tertiary tabular">
                {summary.lineCount || detail.items.length} nom · {summary.itemCount} dona
              </span>
            </div>
            <ul className="border-border overflow-hidden rounded-md border">
              {detail.items.map((item, index) => (
                <li
                  key={`${item.productId}-${index}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5",
                    index > 0 && "border-surface-alt border-t",
                  )}
                >
                  <ItemRow item={item} />
                </li>
              ))}
            </ul>
          </div>

          {hasDeliveryInfo(delivery) && <DeliveryCard detail={detail} />}

          {hasAnyNote(detail) && <NotesCard detail={detail} />}

          {detail.deliveryAttempts.length > 0 && (
            <div className="border-warning/35 bg-warning/5 rounded-md border p-3">
              <h3 className="text-label text-warning mb-1.5 flex items-center gap-1.5">
                <TriangleAlert className="size-4" aria-hidden />
                Yetkazish urinishlari
              </h3>
              <ul className="flex flex-col gap-1.5">
                {detail.deliveryAttempts.map((attempt, index) => (
                  <li key={index} className="text-body-sm">
                    {attempt.reason || "Yetkazib bo'lmadi"}
                    {attempt.note !== "" && (
                      <span className="text-text-secondary"> — {attempt.note}</span>
                    )}
                    {attempt.at && (
                      <span className="text-caption text-text-tertiary tabular ml-1.5">
                        {dayMonthTime(attempt.at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <dl className="bg-surface-alt/60 flex flex-col gap-2 rounded-md p-3.5 lg:sticky lg:top-0">
          {amounts.subtotal !== 0 && (
            <Row label="Mahsulotlar" value={money.plain(amounts.subtotal)} muted />
          )}
          {amounts.discountAmount !== 0 && (
            <Row
              label="Chegirma"
              value={`−${money.plain(amounts.discountAmount)}`}
              tone="primary"
            />
          )}
          {amounts.deliveryFee !== 0 && (
            <Row label="Yetkazish" value={money.plain(amounts.deliveryFee)} muted />
          )}
          {amounts.cashbackUsed !== 0 && (
            <Row
              label="Keshbek"
              value={`−${money.plain(amounts.cashbackUsed)}`}
              tone="primary"
            />
          )}
          {amounts.pointsDiscount !== 0 && (
            <Row
              label="Ball chegirmasi"
              value={`−${money.plain(amounts.pointsDiscount)}`}
              tone="primary"
            />
          )}
          <Row label="To'lanadigan" value={money.plain(amounts.payableAmount)} strong />
          {amounts.paidAmount !== 0 && (
            <Row
              label="To'langan"
              value={money.plain(amounts.paidAmount)}
              tone="primary"
            />
          )}

          {(payment.methodDisplay !== "" || payment.providerDisplay !== "") && (
            <div className="border-border/70 bg-surface mt-1 flex flex-col gap-1 rounded-md border px-2.5 py-2">
              {payment.methodDisplay !== "" && (
                <InfoLine label="To'lov turi" value={payment.methodDisplay} />
              )}
              {payment.providerDisplay !== "" && (
                <InfoLine label="Provayder" value={payment.providerDisplay} />
              )}
              {payment.paidAt && (
                <InfoLine label="To'langan vaqt" value={dayMonthTime(payment.paidAt)} />
              )}
            </div>
          )}

          {detail.giftProductName !== "" && (
            <div className="text-primary-dark flex items-center gap-1.5">
              <Gift className="size-4 shrink-0" aria-hidden />
              <span className="text-caption min-w-0 truncate">
                {detail.giftProductName}
              </span>
            </div>
          )}

          <Timeline detail={detail} />

          {detail.fiscalReceiptUrl !== "" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => {
                void navigator.clipboard
                  .writeText(detail.fiscalReceiptUrl)
                  .then(() => toast.success("Fiskal chek havolasi nusxalandi"));
              }}
            >
              <Copy className="size-4" aria-hidden />
              Fiskal chek havolasi
            </Button>
          )}
        </dl>
      </div>
    </div>
  );
}

function PersonCard({
  label,
  name,
  caption,
  href,
}: {
  label: string;
  name: string;
  caption: string;
  href?: string | null;
}) {
  return (
    <div className="border-border flex items-center gap-3 rounded-md border p-3">
      <AppAvatar name={name} imageUrl={null} size={40} />
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

/** The creator, and the commission earner only when it is someone else. */
function DoctorCard({
  doctor,
  attributedDoctor,
}: {
  doctor: IncomingDoctor | null;
  attributedDoctor: IncomingDoctor | null;
}) {
  if (doctor === null && attributedDoctor === null) {
    return (
      <div className="border-border flex flex-col justify-center rounded-md border p-3">
        <p className="text-label-xs text-text-tertiary">Shifokor</p>
        <p className="text-body-sm text-text-tertiary">Belgilanmagan</p>
      </div>
    );
  }

  const main = doctor ?? attributedDoctor;
  const second =
    doctor !== null &&
    attributedDoctor !== null &&
    attributedDoctor.fullName !== doctor.fullName
      ? attributedDoctor
      : null;

  return (
    <div className="border-border flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <AppAvatar name={main?.fullName ?? ""} imageUrl={null} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-label-xs text-text-tertiary">Shifokor</p>
          <p className="text-title-sm truncate">{main?.fullName}</p>
          {main?.specialty !== "" && (
            <p className="text-caption text-text-tertiary truncate">{main?.specialty}</p>
          )}
        </div>
      </div>
      {second && (
        <p className="text-caption text-text-secondary">
          Komissiya oluvchi: {second.fullName}
        </p>
      )}
    </div>
  );
}

function DeliveryCard({ detail }: { detail: IncomingOrderDetail }) {
  const d = detail.delivery;
  return (
    <div className="border-border rounded-md border p-3">
      <h3 className="text-label text-text-secondary mb-1.5 flex items-center gap-1.5">
        <MapPin className="size-4" aria-hidden />
        Yetkazish
        {/* The address/phone was corrected for THIS order and beats the
            client's saved data (§5) — worth a visible flag. */}
        {d.overridden && (
          <span className="text-label-xs text-warning">
            qo&rsquo;lda o&rsquo;zgartirilgan
          </span>
        )}
      </h3>
      <div className="flex flex-col gap-1">
        {d.name !== "" && <InfoLine label="Qabul qiluvchi" value={d.name} />}
        {d.phone !== "" && <InfoLine label="Telefon" value={phoneFromApi(d.phone)} />}
        {d.address !== "" && <InfoLine label="Manzil" value={d.address} />}
        {d.scheduledAt && (
          <InfoLine label="Rejalashtirilgan" value={dayMonthTime(d.scheduledAt)} />
        )}
        {d.windowDisplay !== "" && (
          <InfoLine label="Vaqt oralig'i" value={d.windowDisplay} />
        )}
        {d.filialName !== "" && <InfoLine label="Filial" value={d.filialName} />}
        {d.courierName !== "" && <InfoLine label="Kuryer" value={d.courierName} />}
      </div>
    </div>
  );
}

function NotesCard({ detail }: { detail: IncomingOrderDetail }) {
  const notes = [
    { label: "Mijoz", text: detail.customerNote },
    { label: "Admin", text: detail.adminNote },
    { label: "Logist", text: detail.logistNote },
  ].filter((note) => note.text !== "");

  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => (
        <p
          key={note.label}
          className="border-border text-body-sm text-text-secondary rounded-md border p-3"
        >
          <span className="text-label-xs text-text-tertiary mr-1.5">{note.label}:</span>
          {note.text}
        </p>
      ))}
    </div>
  );
}

/** The order's life as dated milestones — only the ones that happened. */
function Timeline({ detail }: { detail: IncomingOrderDetail }) {
  const t = detail.timeline;
  const steps = [
    { label: "Yaratilgan", at: t.createdAt ?? detail.summary.createdAt },
    { label: "To'langan", at: t.paidAt },
    { label: "Tasdiqlangan", at: t.confirmedAt },
    { label: "Yetkazilgan", at: t.deliveredAt },
    { label: "Bekor qilingan", at: t.cancelledAt },
  ].filter((step) => step.at !== null);

  if (steps.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-1">
      <p className="text-label-xs text-text-tertiary">Tarix</p>
      {steps.map((step) => (
        <InfoLine
          key={step.label}
          label={step.label}
          value={step.at ? dayMonthTime(step.at) : ""}
        />
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: IncomingOrderItem }) {
  const discounted =
    item.discountPercent > 0 && item.originalUnitPrice !== item.unitPrice;
  return (
    <>
      <ProductThumb name={item.productName} imageUrl={item.imageUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-title-sm truncate">{item.productName}</span>
          {item.isGift && (
            <Badge tone="primary">
              <Gift className="size-3" aria-hidden />
              BEPUL
            </Badge>
          )}
        </div>
        <p className="text-caption text-text-tertiary tabular mt-0.5">
          {item.qtyLabel}
          {!item.isGift && ` × ${money.plain(item.unitPrice)}`}
          {discounted && (
            <>
              <span className="ml-1.5 line-through">
                {money.plain(item.originalUnitPrice)}
              </span>
              <span className="text-primary-dark ml-1.5">−{item.discountPercent}%</span>
            </>
          )}
        </p>
      </div>
      <span
        className={cn(
          "text-title-sm tabular shrink-0",
          item.isGift && "text-primary-dark",
        )}
      >
        {item.isGift ? "BEPUL" : money.plain(item.total)}
      </span>
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-caption text-text-tertiary w-[108px] shrink-0">{label}</span>
      <span className="text-body-sm min-w-0 flex-1">{value}</span>
    </div>
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
