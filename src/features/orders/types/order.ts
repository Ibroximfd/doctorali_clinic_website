import {
  maybeParseClientRef,
  parseClientRef,
  type ClientRef,
} from "@/features/clients/types/client-ref";
import {
  maybeParseDebt,
  parseDebtStatus,
  type Debt,
  type DebtStatus,
} from "@/features/debts/types/debt";
import { parseDoctorRef, type DoctorRef } from "@/features/doctors/types/doctor";
import {
  NO_PACKAGING,
  formatUnits,
  hasPackaging,
  parsePackaging,
  type Packaging,
} from "@/shared/domain/packaging";
import {
  parseBuyerType,
  parseOrderType,
  type BuyerType,
  type OrderType,
} from "@/shared/domain/order-type";
import {
  parseOrderPayments,
  parsePaymentType,
  type OrderPayment,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { percent } from "@/shared/lib/format/percent";
import {
  dateFromYmd,
  maybeTashkentFromApi,
  nowTashkent,
  startOfDay,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { parseFilialRef, type FilialRef } from "@/shared/domain/filial";

/**
 * Reception order status. The internal backend `delivered` maps to `completed`;
 * only these two states exist for reception orders.
 */
export type OrderStatus = "completed" | "cancelled";

export function parseOrderStatus(raw: unknown): OrderStatus {
  return raw === "cancelled" ? "cancelled" : "completed";
}

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  completed: "Bajarilgan",
  cancelled: "Bekor qilingan",
};

// --- Line items --------------------------------------------------------------

/** A line item in an order detail (server-provided `unit_price` + `subtotal`). */
export interface OrderLine {
  readonly id: string;
  /**
   * The order line's OWN id (`items[].id`), or null when the payload carried
   * none.
   *
   * Separate from `id`, which falls back to the product id so a row always has
   * a key. A return addresses lines by `order_item_id`, and sending a product
   * id in that field would either be refused or — worse — match another line,
   * so the caller that needs the real thing must be able to tell them apart.
   */
  readonly orderItemId: string | null;
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly subtotal: number;
  /**
   * The catalog per-unit price before a manual reduction, or null when the
   * price was not edited. When present it is strictly greater than `unitPrice`
   * and can be shown struck through next to the paid price.
   */
  readonly originalUnitPrice: number | null;
  /**
   * True when this line is a gift: `unitPrice` and `subtotal` are 0 and it
   * renders as "BEPUL" with a 🎁 marker rather than a price.
   */
  readonly isGift: boolean;
  readonly packaging: Packaging;
}

/** True when reception manually lowered this line's price. */
export function isPriceEdited(line: OrderLine): boolean {
  return line.originalUnitPrice !== null && line.originalUnitPrice > line.unitPrice;
}

/** `21` → `2 karobka + 3 dona`, or plain `21 dona` for an unboxed product. */
export function lineQuantityLabel(line: OrderLine): string {
  return formatUnits(line.packaging, line.quantity);
}

/** True when the label above says something the bare number doesn't. */
export function lineShowsPackaging(line: OrderLine): boolean {
  return hasPackaging(line.packaging) && line.quantity > 0;
}

// --- Detail ------------------------------------------------------------------

/** Full order shape from `GET orders/{id}/` and the create/cancel responses. */
export interface OrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly client: ClientRef;
  readonly doctor: DoctorRef;
  readonly items: readonly OrderLine[];
  readonly totalAmount: number;
  readonly commissionPercent: number;
  readonly commissionAmount: number;
  readonly status: OrderStatus;
  readonly createdAt: TashkentDate;
  readonly orderType: OrderType;
  /** True when no app account is linked. */
  readonly isGuest: boolean;
  /**
   * Name and phone **as they were at the time of the sale** — a client can be
   * renamed later, and a receipt must keep saying what it said.
   */
  readonly clientName: string;
  readonly clientPhone: string;
  /** What reached the till: `totalAmount − debt`. */
  readonly paidAmount: number;
  readonly debt: Debt | null;
  /** The visit this sale belongs to, when it was rung up from one. */
  readonly appointmentId: string | null;
  readonly createdByName: string;
  /**
   * What the lines added up to before reception typed a total by hand; null
   * when the order was billed at its natural sum.
   */
  readonly originalTotal: number | null;
  /**
   * True when this order was changed after it was rung up — the receipt the
   * client is holding may be the older one.
   */
  readonly isEdited: boolean;
  readonly editedAt: TashkentDate | null;
  readonly note: string | null;
  readonly hasGift: boolean;
  readonly paymentType: PaymentType;
  readonly buyerType: BuyerType;
  /** True when paid with more than one type (`payment_type: "mixed"`). */
  readonly isMixedPayment: boolean;
  /** True for `payment_type: "none"` — nothing reached the till. */
  readonly isUnpaidOrder: boolean;
  /**
   * False when the client placed this order in the MOBILE APP rather than at
   * the desk. Reception's own facts — payment type, split payments, commission
   * — are empty on such an order by design, so the UI marks it instead of
   * rendering zeros.
   */
  readonly isReception: boolean;
  readonly payments: readonly OrderPayment[];
}

/** True when the total was set by hand rather than computed from the lines. */
export function isTotalEdited(o: OrderDetail): boolean {
  return o.originalTotal !== null && o.originalTotal !== o.totalAmount;
}

/** Signed difference the manual total made: negative discount, positive surcharge. */
export function totalOverrideDelta(o: OrderDetail): number {
  return isTotalEdited(o) ? o.totalAmount - (o.originalTotal as number) : 0;
}

export function orderUnitCount(o: OrderDetail): number {
  return o.items.reduce((sum, i) => sum + i.quantity, 0);
}

export function orderCommissionLabel(o: OrderDetail): string {
  return percent.labeled(o.commissionPercent);
}

/** Name to display: the sale-time snapshot first, then the client card. */
export function orderDisplayClientName(o: OrderDetail): string {
  const snapshot = o.clientName.trim();
  if (snapshot !== "") return snapshot;
  const card = o.client.fullName.trim();
  if (card !== "") return card;
  const digits = o.client.phone.replace(/\D/g, "");
  return digits.length >= 4 ? `Mijoz ${digits.slice(-4)}` : "Mijoz";
}

// --- Summary (list rows) ------------------------------------------------------

/** Light order shape from the list endpoints. Carries no line items. */
export interface OrderSummary {
  /** Branch the record was made in; null on an older payload. */
  readonly filial: FilialRef | null;
  readonly id: string;
  readonly orderNumber: string;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly doctorName: string;
  readonly totalAmount: number;
  readonly commissionAmount: number;
  readonly itemCount: number;
  readonly status: OrderStatus;
  readonly createdAt: TashkentDate;
  readonly hasGift: boolean;
  readonly paymentType: PaymentType;
  readonly buyerType: BuyerType;
  readonly isMixedPayment: boolean;
  readonly isUnpaidOrder: boolean;
  readonly isReception: boolean;
  readonly payments: readonly OrderPayment[];
  readonly orderType: OrderType;
  readonly isGuest: boolean;
  /** The client card behind the sale, so a row can open the 360° profile. */
  readonly clientId: number | null;
  /** Faces for the list row — a person is recognised faster than a name. */
  readonly clientAvatarUrl: string | null;
  readonly doctorAvatarUrl: string | null;
  readonly paidAmount: number;
  readonly hasDebt: boolean;
  readonly debtRemaining: number;
  readonly debtDueDate: TashkentDate | null;
  readonly debtStatus: DebtStatus | null;
}

/**
 * The tail of `ORD-20260910165609-F815` — `F815`.
 *
 * A list row has no room for the full number: at any readable size it wraps
 * onto three lines and drags every row to twice its height. The tail is what
 * the desk reads out to a client anyway; the full number stays one click away
 * in the detail dialog, and on the row's `title`.
 */
export function shortOrderNumber(orderNumber: string): string {
  const tail = orderNumber.split("-").at(-1) ?? "";
  return tail !== "" && tail !== orderNumber ? tail : orderNumber;
}

/** True when this order's debt has slipped past its due date. */
export function isOrderDebtOverdue(o: OrderSummary): boolean {
  if (!o.hasDebt || o.debtDueDate === null) return false;
  if (o.debtStatus !== null && o.debtStatus !== "open" && o.debtStatus !== "partial") {
    return false;
  }
  return o.debtDueDate < startOfDay(nowTashkent());
}

// --- Parsing ------------------------------------------------------------------

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
function fullName(raw: unknown): string {
  return isRecord(raw) ? str(raw.full_name) : "";
}

/**
 * Tolerates both line shapes the backend docs describe: the flat
 * `{product_id, name, …}` of v3 §5.3 and the nested `{product: {…}}` of the
 * older spec — a blank product row helps no one at the desk.
 */
export function parseOrderLine(raw: unknown): OrderLine {
  const l = (raw ?? {}) as Record<string, unknown>;
  const product = isRecord(l.product) ? l.product : {};
  return {
    id: str(l.id ?? l.product_id),
    orderItemId:
      typeof l.id === "string" || typeof l.id === "number" ? String(l.id) : null,
    productId: str(product.id ?? l.product_id),
    productName: str(product.name ?? l.name ?? l.product_name),
    imageUrl:
      typeof product.image_url === "string"
        ? product.image_url
        : typeof l.image_url === "string"
          ? l.image_url
          : null,
    quantity: num(l.quantity),
    unitPrice: num(l.unit_price),
    subtotal: num(l.subtotal),
    originalUnitPrice: optNum(l.original_unit_price),
    isGift: l.is_gift === true,
    // Either shape: nested inside the embedded product, or flat on the line.
    packaging:
      product.package_size !== undefined ? parsePackaging(product) : parsePackaging(l),
  };
}

export function parseOrderDetail(raw: unknown): OrderDetail {
  const o = (raw ?? {}) as Record<string, unknown>;
  const total = num(o.total_amount);
  const rawItems = Array.isArray(o.items) ? o.items : [];

  return {
    id: str(o.id),
    orderNumber: str(o.order_number),
    client: parseClientRef(o.client),
    doctor: parseDoctorRef(o.doctor),
    items: rawItems.map(parseOrderLine),
    totalAmount: total,
    commissionPercent: num(o.commission_percent),
    commissionAmount: num(o.commission_amount),
    status: parseOrderStatus(o.status),
    createdAt: tashkentFromApi(str(o.created_at)),
    orderType: parseOrderType(o.order_type),
    isGuest: o.is_guest === true,
    clientName: str(o.client_name),
    clientPhone: str(o.client_phone),
    // No debt means it was paid in full; falling back to the total keeps an
    // older payload from reporting every past sale as unpaid.
    paidAmount: typeof o.paid_amount === "number" ? o.paid_amount : total,
    debt: maybeParseDebt(o.debt),
    appointmentId:
      o.appointment_id === null || o.appointment_id === undefined
        ? null
        : String(o.appointment_id),
    createdByName: fullName(o.created_by),
    originalTotal: optNum(o.original_total),
    isEdited: o.is_edited === true,
    editedAt: maybeTashkentFromApi(typeof o.edited_at === "string" ? o.edited_at : null),
    note: typeof o.note === "string" && o.note.trim() !== "" ? o.note.trim() : null,
    // Prefer the server flag; fall back to scanning the lines so older payloads
    // still light up the badge correctly.
    hasGift:
      typeof o.has_gift === "boolean"
        ? o.has_gift
        : rawItems.some((i) => isRecord(i) && i.is_gift === true),
    paymentType: parsePaymentType(o.payment_type),
    buyerType: parseBuyerType(o.buyer_type),
    isMixedPayment: o.payment_type === "mixed",
    isUnpaidOrder: o.payment_type === "none",
    isReception: o.is_reception !== false,
    payments: parseOrderPayments(o.payments),
  };
}

/**
 * Tolerates both row shapes: the flat `client_name`/`doctor_name`/`debt_*` keys
 * of the older list payload AND full §5.3-style rows where the same facts live
 * inside nested `client` / `doctor` / `debt` objects — otherwise a v3 list loses
 * names and the whole debt badge.
 */
/** An image field, but only when it is actually a usable string. */
function mediaField(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function parseOrderSummary(raw: unknown): OrderSummary {
  const o = (raw ?? {}) as Record<string, unknown>;
  const total = num(o.total_amount);
  const client = isRecord(o.client) ? o.client : {};
  const doctor = isRecord(o.doctor) ? o.doctor : {};
  const debt = isRecord(o.debt) ? o.debt : {};
  const items = Array.isArray(o.items) ? o.items : null;

  const rawDue = o.debt_due_date ?? debt.due_date;
  const rawDebtStatus = o.debt_status ?? debt.status;

  return {
    filial: parseFilialRef(o.filial),
    id: str(o.id),
    orderNumber: str(o.order_number),
    clientName: str(o.client_name ?? client.full_name),
    clientPhone: str(o.client_phone ?? client.phone),
    doctorName: str(o.doctor_name ?? doctor.full_name),
    totalAmount: total,
    commissionAmount: num(o.commission_amount),
    itemCount: typeof o.item_count === "number" ? o.item_count : (items?.length ?? 0),
    status: parseOrderStatus(o.status),
    createdAt: tashkentFromApi(str(o.created_at)),
    hasGift: o.has_gift === true,
    paymentType: parsePaymentType(o.payment_type),
    buyerType: parseBuyerType(o.buyer_type),
    isMixedPayment: o.payment_type === "mixed",
    isUnpaidOrder: o.payment_type === "none",
    // Absent on the plain orders list (everything there IS reception's).
    isReception: o.is_reception !== false,
    payments: parseOrderPayments(o.payments),
    orderType: parseOrderType(o.order_type),
    isGuest: o.is_guest === true,
    clientId: optNum(o.client_id ?? client.id),
    clientAvatarUrl: mediaField(client.avatar_url ?? client.photo ?? o.client_avatar_url),
    doctorAvatarUrl: mediaField(doctor.avatar_url ?? doctor.photo ?? o.doctor_avatar_url),
    paidAmount: typeof o.paid_amount === "number" ? o.paid_amount : total,
    hasDebt: typeof o.has_debt === "boolean" ? o.has_debt : Object.keys(debt).length > 0,
    debtRemaining: num(o.debt_remaining ?? debt.remaining),
    debtDueDate:
      rawDue === null || rawDue === undefined ? null : dateFromYmd(String(rawDue)),
    debtStatus:
      rawDebtStatus === null || rawDebtStatus === undefined
        ? null
        : parseDebtStatus(rawDebtStatus),
  };
}

/** A gift granted on order creation (top-level `gift` in the create response). */
export interface GiftInfo {
  readonly id: number;
  readonly name: string;
  readonly imageUrl: string | null;
}

export function parseGiftInfo(raw: unknown): GiftInfo | null {
  if (!isRecord(raw)) return null;
  return {
    id: num(raw.id),
    name: str(raw.name),
    imageUrl: typeof raw.image_url === "string" ? raw.image_url : null,
  };
}

/**
 * Result of `POST orders/` and `PATCH orders/{id}/`:
 * `{ order, gift, receipt }`.
 */
export interface CreateOrderResult {
  readonly order: OrderDetail;
  readonly gift: GiftInfo | null;
  /**
   * The backend `receipt` object, kept **unparsed** and handed straight to the
   * print-agent. Null when the backend doesn't send it on create — printing
   * then falls back to `GET orders/{id}/receipt/`.
   */
  readonly receipt: Record<string, unknown> | null;
}

export function parseCreateOrderResult(raw: unknown): CreateOrderResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    order: parseOrderDetail(r.order),
    gift: parseGiftInfo(r.gift),
    receipt: isRecord(r.receipt) ? r.receipt : null,
  };
}

export { NO_PACKAGING, maybeParseClientRef };
