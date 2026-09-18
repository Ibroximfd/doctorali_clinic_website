import { parseOrderType, type OrderType } from "@/shared/domain/order-type";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

/**
 * Where an incoming order was born (`source`): the Mehrigiyo client app or a
 * doctor's own panel.
 *
 * Deliberately NEVER rendered as a label. The desk sees one mixed list, and
 * the only trace of the origin is the discreet dot the owner knows about (see
 * `SourceMark`). A "Mehrigiyo" chip on the row was explicitly not wanted — do
 * not "improve" this into one.
 */
export type IncomingSource = "mehrigiyo" | "doctor";

export function parseIncomingSource(raw: unknown): IncomingSource {
  return raw === "mehrigiyo" ? "mehrigiyo" : "doctor";
}

/**
 * The four buckets the 8 raw statuses collapse into (`status_group`). The raw
 * status itself travels as a display string, so a brand-new backend status
 * never breaks the screen: it lands in a group and shows its own label.
 */
export type IncomingStatusGroup = "new" | "in_progress" | "completed" | "cancelled";

export const INCOMING_STATUS_GROUPS = [
  "new",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const INCOMING_GROUP_LABEL: Readonly<Record<IncomingStatusGroup, string>> = {
  new: "Yangi",
  in_progress: "Jarayonda",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

/** Parses the group code, deriving it from the raw status for older payloads. */
export function parseIncomingStatusGroup(
  group: unknown,
  status?: unknown,
): IncomingStatusGroup {
  if (
    group === "new" ||
    group === "in_progress" ||
    group === "completed" ||
    group === "cancelled"
  ) {
    return group;
  }
  switch (status) {
    case "pending":
    case "confirming":
      return "new";
    case "delivered":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "in_progress";
  }
}

// --- Parse helpers -----------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function optNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function block(raw: unknown, key: string): Record<string, unknown> {
  return isRecord(raw) && isRecord((raw as Record<string, unknown>)[key])
    ? ((raw as Record<string, unknown>)[key] as Record<string, unknown>)
    : {};
}

// --- List row (§4) -----------------------------------------------------------

/**
 * One row of `incoming-orders/`. Status and payment labels come from the
 * backend's own `*_display` strings so a new status never renders as a raw
 * code — the app only maps the group for color and filtering.
 */
export interface IncomingOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  /** Origin — never labelled on screen (see `IncomingSource`). */
  readonly source: IncomingSource;
  /** Raw-status label in Uzbek (`status_display`, e.g. "Tayyorlanmoqda"). */
  readonly statusDisplay: string;
  readonly statusGroup: IncomingStatusGroup;
  readonly clientName: string;
  /** API phone value `998XXXXXXXXX` (may be empty). */
  readonly clientPhone: string;
  /** CRM card behind the client, when one exists — opens the 360° profile. */
  readonly cardId: number | null;
  readonly doctorName: string;
  /** Goods total in whole so'm. */
  readonly totalAmount: number;
  /**
   * What the client actually pays after cashback/points — the figure the
   * courier is told (§4), so it is the primary money on screen.
   */
  readonly payableAmount: number;
  readonly paymentMethodDisplay: string;
  readonly isPaid: boolean;
  readonly paymentStatusDisplay: string;
  readonly orderType: OrderType;
  /** Total PIECES vs number of LINES — the two are different (§4). */
  readonly itemCount: number;
  readonly lineCount: number;
  readonly hasGift: boolean;
  readonly createdAt: TashkentDate;
}

export function parseIncomingOrderSummary(raw: unknown): IncomingOrderSummary {
  const o = (raw ?? {}) as Record<string, unknown>;
  const total = num(o.total_amount);
  const group = parseIncomingStatusGroup(o.status_group, o.status);
  const statusDisplay = str(o.status_display);
  return {
    id: str(o.id),
    orderNumber: str(o.order_number),
    source: parseIncomingSource(o.source),
    statusDisplay: statusDisplay !== "" ? statusDisplay : INCOMING_GROUP_LABEL[group],
    statusGroup: group,
    clientName: str(o.client_name),
    clientPhone: str(o.client_phone),
    cardId: optNum(o.card_id),
    doctorName: str(o.doctor_name),
    totalAmount: total,
    payableAmount: typeof o.payable_amount === "number" ? o.payable_amount : total,
    paymentMethodDisplay: str(o.payment_method_display),
    isPaid: typeof o.is_paid === "boolean" ? o.is_paid : o.payment_status === "paid",
    paymentStatusDisplay: str(o.payment_status_display),
    orderType: parseOrderType(o.order_type),
    itemCount: num(o.item_count),
    lineCount: num(o.line_count),
    hasGift: o.has_gift === true,
    createdAt: tashkentFromApi(str(o.created_at)),
  };
}

// --- Detail blocks (§5) ------------------------------------------------------

export interface IncomingClient {
  readonly id: number;
  /** CRM card id, when the buyer has a card. */
  readonly cardId: number | null;
  readonly fullName: string;
  readonly phone: string;
}

export interface IncomingDoctor {
  readonly fullName: string;
  readonly specialty: string;
}

function maybeParseIncomingDoctor(raw: unknown): IncomingDoctor | null {
  if (!isRecord(raw)) return null;
  const fullName = str(raw.full_name);
  if (fullName === "") return null;
  return { fullName, specialty: str(raw.specialty) };
}

export interface IncomingOrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  /** Server-rendered quantity label ("2 quti") — shown as-is. */
  readonly qtyLabel: string;
  readonly unitPrice: number;
  readonly originalUnitPrice: number;
  readonly discountPercent: number;
  readonly total: number;
  readonly isGift: boolean;
}

function parseIncomingItem(raw: unknown): IncomingOrderItem {
  const l = (raw ?? {}) as Record<string, unknown>;
  const product = isRecord(l.product) ? l.product : {};
  const quantity = num(l.quantity);
  const unitPrice = num(l.unit_price);
  return {
    productId: str(product.id),
    productName: str(product.name),
    imageUrl: typeof product.image_url === "string" ? product.image_url : null,
    quantity,
    qtyLabel: str(l.qty_label, `${quantity} dona`),
    unitPrice,
    originalUnitPrice: num(l.original_unit_price, unitPrice),
    discountPercent: num(l.discount_percent),
    total: num(l.total),
    isGift: l.is_gift === true,
  };
}

/** Every so'm figure of the order — the server's arithmetic, never ours. */
export interface IncomingAmounts {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly deliveryFee: number;
  readonly cashbackUsed: number;
  readonly pointsDiscount: number;
  readonly totalAmount: number;
  readonly payableAmount: number;
  readonly paidAmount: number;
}

export interface IncomingPayment {
  readonly methodDisplay: string;
  readonly providerDisplay: string;
  readonly statusDisplay: string;
  readonly isPaid: boolean;
  readonly paidAt: TashkentDate | null;
}

/**
 * `delivery` block. `overridden = true` means the address/phone was corrected
 * for THIS order and beats the client's saved data (§5).
 */
export interface IncomingDelivery {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly overridden: boolean;
  readonly windowDisplay: string;
  readonly scheduledAt: TashkentDate | null;
  readonly filialName: string;
  readonly courierName: string;
}

export function hasDeliveryInfo(d: IncomingDelivery): boolean {
  return d.address !== "" || d.name !== "" || d.phone !== "" || d.courierName !== "";
}

/** `filial` / `courier` arrive as either a plain name or an object. */
function nameOf(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (isRecord(raw)) return str(raw.full_name ?? raw.name);
  return "";
}

export interface IncomingTimeline {
  readonly createdAt: TashkentDate | null;
  readonly paidAt: TashkentDate | null;
  readonly confirmedAt: TashkentDate | null;
  readonly deliveredAt: TashkentDate | null;
  readonly cancelledAt: TashkentDate | null;
}

export interface IncomingDeliveryAttempt {
  readonly reason: string;
  readonly note: string;
  readonly at: TashkentDate | null;
}

/**
 * The full card of one incoming order (§5): the list row's facts plus every
 * block the endpoint serves. Read-only by design — status changes belong to
 * the logist/operator panel, never to this screen.
 */
export interface IncomingOrderDetail {
  /** Parsed once from the same payload, so the dialog never disagrees with the row. */
  readonly summary: IncomingOrderSummary;
  readonly client: IncomingClient;
  readonly doctor: IncomingDoctor | null;
  /** Commission earner, when different from the creator. */
  readonly attributedDoctor: IncomingDoctor | null;
  readonly items: readonly IncomingOrderItem[];
  readonly amounts: IncomingAmounts;
  readonly payment: IncomingPayment;
  readonly delivery: IncomingDelivery;
  readonly timeline: IncomingTimeline;
  readonly deliveryAttempts: readonly IncomingDeliveryAttempt[];
  readonly giftProductName: string;
  readonly customerNote: string;
  readonly adminNote: string;
  readonly logistNote: string;
  readonly tags: readonly string[];
  readonly fiscalReceiptUrl: string;
}

export function parseIncomingOrderDetail(raw: unknown): IncomingOrderDetail {
  const o = (raw ?? {}) as Record<string, unknown>;
  const client = block(o, "client");
  const amounts = block(o, "amounts");
  const payment = block(o, "payment");
  const delivery = block(o, "delivery");
  const timeline = block(o, "timeline");
  const notes = block(o, "notes");
  const gift = block(o, "gift");
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const rawAttempts = Array.isArray(o.delivery_attempts) ? o.delivery_attempts : [];
  const rawTags = Array.isArray(o.tags) ? o.tags : [];

  const amountOf = (key: string) => num(amounts[key]);
  const timeOf = (source: Record<string, unknown>, key: string) =>
    maybeTashkentFromApi(
      typeof source[key] === "string" ? (source[key] as string) : null,
    );

  return {
    summary: parseIncomingOrderSummary(o),
    client: {
      id: num(client.id),
      cardId: optNum(client.card_id) ?? optNum(o.card_id),
      fullName: str(client.full_name),
      phone: str(client.phone),
    },
    doctor: maybeParseIncomingDoctor(o.doctor),
    attributedDoctor: maybeParseIncomingDoctor(o.attributed_doctor),
    items: rawItems.map(parseIncomingItem),
    amounts: {
      subtotal: amountOf("subtotal"),
      discountAmount: amountOf("discount_amount"),
      deliveryFee: amountOf("delivery_fee"),
      cashbackUsed: amountOf("cashback_used"),
      pointsDiscount: amountOf("points_discount"),
      totalAmount: amountOf("total_amount"),
      payableAmount: amountOf("payable_amount"),
      paidAmount: amountOf("paid_amount"),
    },
    payment: {
      methodDisplay: str(payment.method_display),
      providerDisplay: str(payment.provider_display),
      statusDisplay: str(payment.status_display),
      isPaid: payment.is_paid === true,
      paidAt: timeOf(payment, "paid_at"),
    },
    delivery: {
      name: str(delivery.name),
      phone: str(delivery.phone),
      address: str(delivery.address),
      overridden: delivery.overridden === true,
      windowDisplay: str(delivery.window_display),
      scheduledAt: timeOf(delivery, "scheduled_at"),
      filialName: nameOf(delivery.filial),
      courierName: nameOf(delivery.courier),
    },
    timeline: {
      createdAt: timeOf(timeline, "created_at"),
      paidAt: timeOf(timeline, "paid_at"),
      confirmedAt: timeOf(timeline, "confirmed_at"),
      deliveredAt: timeOf(timeline, "delivered_at"),
      cancelledAt: timeOf(timeline, "cancelled_at"),
    },
    deliveryAttempts: rawAttempts.filter(isRecord).map((attempt) => ({
      reason: str(attempt.reason),
      note: str(attempt.note ?? attempt.comment),
      at: maybeTashkentFromApi(
        typeof attempt.created_at === "string" ? attempt.created_at : null,
      ),
    })),
    giftProductName: str(gift.product_name),
    customerNote: str(notes.customer),
    adminNote: str(notes.admin),
    logistNote: str(notes.logist),
    tags: rawTags
      .map((tag) =>
        typeof tag === "string" ? tag : isRecord(tag) ? str(tag.label ?? tag.value) : "",
      )
      .filter((tag) => tag !== ""),
    fiscalReceiptUrl: str(block(o, "fiscal").receipt_url),
  };
}

export function hasAnyNote(detail: IncomingOrderDetail): boolean {
  return (
    detail.customerNote !== "" || detail.adminNote !== "" || detail.logistNote !== ""
  );
}

// --- Summary stats (§6) ------------------------------------------------------

/**
 * `incoming-orders/summary/`: the money and counts for exactly the filter the
 * list is showing — never computed by adding up the visible page.
 */
export interface IncomingOrdersStats {
  readonly count: number;
  readonly totalAmount: number;
  readonly payableAmount: number;
  readonly paidAmount: number;
  readonly unpaidAmount: number;
  readonly itemCount: number;
}

export function parseIncomingOrdersStats(raw: unknown): IncomingOrdersStats {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    count: num(o.count),
    totalAmount: num(o.total_amount),
    payableAmount: num(o.payable_amount),
    paidAmount: num(o.paid_amount),
    unpaidAmount: num(o.unpaid_amount),
    itemCount: num(o.item_count),
  };
}

// --- Filter dictionaries (§7) ------------------------------------------------

export interface IncomingFilterOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Dropdown dictionaries served by the backend. The UI fills its menus from
 * here rather than hardcoding codes, so a new payment method appears on screen
 * without a release.
 */
export interface IncomingFilterOptions {
  readonly paymentMethods: readonly IncomingFilterOption[];
  readonly orderings: readonly IncomingFilterOption[];
}

export const EMPTY_FILTER_OPTIONS: IncomingFilterOptions = {
  paymentMethods: [],
  orderings: [],
};

function parseOptionList(raw: unknown): IncomingFilterOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter((entry) => entry.value !== null && entry.value !== undefined)
    .map((entry) => ({
      value: str(entry.value),
      label: str(entry.label ?? entry.value),
    }));
}

export function parseIncomingFilterOptions(raw: unknown): IncomingFilterOptions {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    paymentMethods: parseOptionList(o.payment_methods),
    orderings: parseOptionList(o.orderings),
  };
}
