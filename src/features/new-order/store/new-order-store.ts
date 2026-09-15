"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { ClientSearchResult } from "@/features/clients/types/client-search";
import type { Doctor } from "@/features/doctors/types/doctor";
import {
  allowedGift,
  allowedQuantity,
  cartUnitCount,
  computeCartTotals,
  hasCustomPrice,
  lineTotal,
  newCartItem,
  paidQuantity,
  resizeLine,
  stockLimitNotice,
  unitPrice,
  unsellableReason,
  type CartItem,
} from "@/features/orders/types/cart";
import type { OrderPreview } from "@/features/orders/types/order-preview";
import { paidLineFor } from "@/features/orders/types/order-preview";
import { parseProduct, saleStep, type Product } from "@/features/products/types/product";
import type { OrderDetail } from "@/features/orders/types/order";
import type { StockIssue } from "@/shared/lib/api/errors";
import type { BuyerType, OrderType } from "@/shared/domain/order-type";
import { allowsGift } from "@/shared/domain/order-type";
import type { PaymentType } from "@/shared/domain/payment-type";
import { dateFromYmd, isToday, ymd, type TashkentDate } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

import { clearDraft, readDraft, saveDraft } from "../lib/draft-storage";

/** Smallest gap between two draft writes — a fast typist costs one per 250ms. */
const DRAFT_WRITE_INTERVAL_MS = 250;

export interface NewOrderState {
  // --- Who ------------------------------------------------------------------
  orderType: OrderType;
  buyerType: BuyerType;
  /** The chosen client for a clinic sale. */
  client: ClientSearchResult | null;
  /** A delivery client is typed, never looked up. */
  guestName: string;
  /** Digits only, `998XXXXXXXXX` when complete. */
  guestPhone: string;
  doctor: Doctor | null;
  /** Set when this sale was started from a visit, linking the two. */
  appointmentId: string | null;

  // --- What -----------------------------------------------------------------
  cart: CartItem[];
  /** Order total typed by hand; null bills the lines as they are. */
  totalOverride: number | null;
  giftProduct: Product | null;
  note: string;

  // --- Money ----------------------------------------------------------------
  debtEnabled: boolean;
  debtAmount: number;
  debtDueDate: TashkentDate | null;
  debtNote: string;
  paymentType: PaymentType | null;
  /** True once reception has picked a payment type by hand. */
  paymentTypeMarked: boolean;
  splitPayment: boolean;
  splitAmounts: Partial<Record<PaymentType, number>>;

  // --- When -----------------------------------------------------------------
  /** The day this sale is filed under. Null means now — the normal case. */
  orderDate: TashkentDate | null;

  // --- Editing an existing order --------------------------------------------
  editingOrder: OrderDetail | null;

  // --- Transient ------------------------------------------------------------
  /** The server's pricing of the current basket; wins over every local sum. */
  preview: OrderPreview | null;
  previewFailed: boolean;
  showValidation: boolean;
  /** One-shot notice ("Omborda faqat 2 dona"), shown then cleared. */
  notice: string | null;
  /** Per-field messages from a refused save. */
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  /**
   * The server's own sentence for the last refused save, kept until the next
   * submit. The toast that carries it is gone in seconds, and the reason a save
   * was refused is the one thing the desk needs still on screen while they fix
   * it.
   */
  saveError: string | null;
}

interface NewOrderActions {
  hydrate: () => void;
  reset: () => void;

  setOrderType: (type: OrderType) => void;
  setBuyerType: (type: BuyerType) => void;
  selectClient: (client: ClientSearchResult | null) => void;
  setGuestName: (name: string) => void;
  setGuestPhone: (phone: string) => void;
  setDoctor: (doctor: Doctor | null) => void;
  attachAppointment: (id: string | null) => void;

  addProduct: (product: Product, units?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  /** `null` clears the override and returns the line to the catalog price. */
  setLinePrice: (
    productId: string,
    input: { unitPrice: number | null; lineTotal?: number | null },
  ) => void;
  setLineGift: (productId: string, giftQuantity: number) => void;
  setTotalOverride: (amount: number | null) => void;
  setGiftProduct: (product: Product | null) => void;
  setNote: (note: string) => void;

  setDebt: (
    patch: Partial<
      Pick<NewOrderState, "debtEnabled" | "debtAmount" | "debtDueDate" | "debtNote">
    >,
  ) => void;
  setPaymentType: (type: PaymentType) => void;
  unmarkPayment: () => void;
  setSplitPayment: (enabled: boolean) => void;
  setSplitAmount: (type: PaymentType, amount: number) => void;
  setOrderDate: (date: TashkentDate | null) => void;

  startEditing: (order: OrderDetail, items: CartItem[], doctor: Doctor | null) => void;
  setPreview: (preview: OrderPreview | null, failed?: boolean) => void;
  setShowValidation: (show: boolean) => void;
  clearNotice: () => void;
  setFieldErrors: (errors: Readonly<Record<string, readonly string[]>>) => void;
  setSaveError: (message: string | null) => void;
  /** Folds the server's real balances back into the cart after a stock refusal. */
  applyStockIssues: (issues: readonly StockIssue[]) => void;
}

const INITIAL: NewOrderState = {
  orderType: "clinic",
  buyerType: "client",
  client: null,
  guestName: "",
  guestPhone: "",
  doctor: null,
  appointmentId: null,
  cart: [],
  totalOverride: null,
  giftProduct: null,
  note: "",
  debtEnabled: false,
  debtAmount: 0,
  debtDueDate: null,
  debtNote: "",
  paymentType: "cash",
  paymentTypeMarked: false,
  splitPayment: false,
  splitAmounts: {},
  orderDate: null,
  editingOrder: null,
  preview: null,
  previewFailed: false,
  showValidation: false,
  notice: null,
  fieldErrors: {},
  saveError: null,
};

export type NewOrderStore = NewOrderState & NewOrderActions;
export type NewOrderStoreApi = ReturnType<typeof createNewOrderStore>;

/**
 * One order form, in isolation.
 *
 * This is a FACTORY, not a singleton, and that is the whole point: editing an
 * existing order opens a second form on top of the one reception may be halfway
 * through typing. Sharing a single store between them meant opening an edit
 * wiped the new order that was in progress — and saving the edit wiped it
 * again. Each form gets its own instance; only the "Yangi buyurtma" pages share
 * one, because there the draft is deliberately the same across both screens.
 */
export function createNewOrderStore() {
  return createStore<NewOrderStore>()((set, get) => {
    /** Drops a field error the moment the desk fixes the field. */
    function without(key: string) {
      const errors = get().fieldErrors;
      if (!(key in errors)) return errors;
      const copy = { ...errors };
      delete copy[key];
      return copy;
    }

    /**
     * The two consequences every cart mutation has: a manual total the new cart
     * can no longer carry is dropped, then the credited amount is trimmed to
     * what is left to pay. Order matters — the debt is clamped against the
     * total the override decides.
     */
    function afterCartChanged() {
      const state = get();

      // A cart that bills nothing (every line gifted) has no paid line to
      // spread a manual total across; the backend answers
      // `total_override_not_applicable`, so the override is dropped and said so.
      if (state.totalOverride !== null && !canEditTotal(state)) {
        set({
          totalOverride: null,
          notice:
            state.cart.length === 0 ? null : "Qo'lda kiritilgan jami summa bekor qilindi",
        });
      }
      clampDebt();
    }

    /**
     * Keeps the credited amount from exceeding the sale.
     *
     * The case this really guards is the cart *shrinking* after the debt was
     * entered: rather than failing at save time, the amount is trimmed and the
     * change is announced once.
     */
    function clampDebt() {
      const state = get();
      if (!state.debtEnabled) return;
      const payable = selectPayableTotal(state);
      if (state.debtAmount <= payable) return;
      set({
        debtAmount: payable,
        notice: "Qarz summasi buyurtma summasiga moslashtirildi",
      });
    }

    return {
      ...INITIAL,

      hydrate() {
        const draft = readDraft();
        if (draft) set(fromDraftJson(draft));
      },

      reset() {
        clearDraft();
        set({ ...INITIAL });
      },

      setOrderType(type) {
        if (type === get().orderType) return;
        set({
          orderType: type,
          // A delivery can't carry the loyalty gift, so drop any choice made
          // while the form was in clinic mode. The guest name/phone are
          // deliberately KEPT when switching back and forth — reception often
          // hesitates between the two, and losing typed text is the annoying
          // part.
          giftProduct: allowsGift(type) ? get().giftProduct : null,
          fieldErrors: {},
        });
      },

      setBuyerType(type) {
        // A staff purchase needs no doctor, so drop any pending doctor error.
        set({
          buyerType: type,
          fieldErrors: type === "staff" ? without("doctor_id") : get().fieldErrors,
        });
      },

      selectClient(client) {
        set({
          client,
          // Selecting a different client may invalidate the gift choice.
          giftProduct: client?.giftStatus?.giftAvailable ? get().giftProduct : null,
          fieldErrors: without("client_phone"),
        });
      },

      setGuestName(name) {
        set({ guestName: name, fieldErrors: without("client_name") });
      },

      setGuestPhone(phone) {
        // Store the API form (digits only). Deliberately no lookup: a delivery
        // client need not exist in the base, so there is no search and no
        // spinner.
        const digits = phone.replace(/\D/g, "");
        const normalised = digits.startsWith("998")
          ? digits
          : digits === ""
            ? ""
            : `998${digits}`;
        set({
          guestPhone: normalised.slice(0, 12),
          fieldErrors: without("client_phone"),
        });
      },

      setDoctor(doctor) {
        set({ doctor, fieldErrors: without("doctor_id") });
      },

      attachAppointment(id) {
        set({ appointmentId: id });
      },

      addProduct(product, units) {
        // Nothing on the shelf — the backend would reject the order, so the
        // cart never gets into that state in the first place.
        const blocked = unsellableReason(product);
        if (blocked) {
          set({ notice: blocked });
          return;
        }

        const cart = [...get().cart];
        const index = cart.findIndex((item) => item.product.id === product.id);
        const current = index >= 0 ? cart[index].quantity : 0;
        const requested = current + (units ?? saleStep(product));
        const allowed = allowedQuantity(product, requested);

        if (allowed <= current) {
          set({ notice: stockLimitNotice(product) });
          return;
        }

        if (index >= 0) {
          const line = cart[index];
          cart[index] = resizeLine(line, {
            quantity: allowed,
            giftQuantity: line.giftQuantity,
          });
        } else {
          cart.push(newCartItem(product, allowed));
        }

        set({
          cart,
          fieldErrors: without("items"),
          notice: allowed < requested ? stockLimitNotice(product) : null,
        });
        afterCartChanged();
      },

      setQuantity(productId, quantity) {
        if (quantity <= 0) {
          get().removeProduct(productId);
          return;
        }
        const item = get().cart.find((i) => i.product.id === productId);
        if (!item) return;

        // Clamped to what is on the shelf and snapped to whole sale steps, so
        // the stepper can never exceed the balance and a package-only line can
        // never hold a partial box.
        const allowed = allowedQuantity(item.product, quantity);
        if (allowed <= 0) {
          get().removeProduct(productId);
          set({ notice: stockLimitNotice(item.product) });
          return;
        }

        set({
          cart: get().cart.map((line) =>
            line.product.id === productId
              ? resizeLine(line, {
                  quantity: allowed,
                  // Never let the gift count exceed the (possibly lowered)
                  // quantity either.
                  giftQuantity: allowedGift(line.product, line.giftQuantity, allowed),
                })
              : line,
          ),
          notice: allowed < quantity ? stockLimitNotice(item.product) : null,
        });
        afterCartChanged();
      },

      removeProduct(productId) {
        set({ cart: get().cart.filter((i) => i.product.id !== productId) });
        afterCartChanged();
      },

      setLinePrice(productId, input) {
        set({
          cart: get().cart.map((item) => {
            if (item.product.id !== productId) return item;
            // A price at/above the catalog price means "no discount": drop the
            // override so the line bills at the normal price again. Below zero
            // is coerced away too.
            const drop =
              input.unitPrice === null ||
              input.unitPrice >= item.product.priceUzs ||
              input.unitPrice <= 0;
            return drop
              ? { ...item, customPrice: null, customLineTotal: null }
              : {
                  ...item,
                  customPrice: input.unitPrice,
                  customLineTotal: input.lineTotal ?? null,
                };
          }),
        });
        afterCartChanged();
      },

      setLineGift(productId, giftQuantity) {
        set({
          cart: get().cart.map((item) =>
            item.product.id === productId
              ? // Gifting changes how many units are PAID for, so a typed line
                // sum is dropped here exactly as it is on a quantity change.
                resizeLine(item, {
                  quantity: item.quantity,
                  giftQuantity: allowedGift(item.product, giftQuantity, item.quantity),
                })
              : item,
          ),
        });
        afterCartChanged();
      },

      setTotalOverride(amount) {
        const state = get();
        // Clearing it, a negative value, or simply typing the sum the cart
        // already has: all mean "no override".
        const drop =
          amount === null ||
          amount < 0 ||
          amount === selectSubtotal(state) ||
          !canEditTotal(state);
        set({
          totalOverride: drop ? null : amount,
          fieldErrors: without("total_override"),
        });
        clampDebt();
      },

      setGiftProduct(product) {
        set({ giftProduct: product, fieldErrors: without("gift_product_id") });
      },

      setNote(note) {
        set({ note });
      },

      setDebt(patch) {
        const next = { ...get(), ...patch };
        if (patch.debtEnabled === false) {
          set({
            debtEnabled: false,
            debtAmount: 0,
            debtDueDate: null,
            debtNote: "",
            fieldErrors: without("debt"),
          });
          return;
        }
        set({
          debtEnabled: next.debtEnabled,
          debtAmount: Math.max(0, next.debtAmount),
          debtDueDate: next.debtDueDate,
          debtNote: next.debtNote,
          fieldErrors: without("debt"),
        });
        clampDebt();
      },

      setPaymentType(type) {
        // A tap is a deliberate marking: it is what lets an order that takes no
        // money now (full credit, full gift) still be booked as cash or card
        // instead of "To'lanmagan".
        set({
          paymentType: type,
          paymentTypeMarked: true,
          fieldErrors: without("payment_type"),
        });
      },

      unmarkPayment() {
        // The chosen type is kept, not wiped: reception often lowers the debt
        // again right after, and the chip they picked should still be there.
        set({ paymentTypeMarked: false, fieldErrors: without("payment_type") });
      },

      setSplitPayment(enabled) {
        set({ splitPayment: enabled, fieldErrors: without("payment_type") });
      },

      setSplitAmount(type, amount) {
        const next = { ...get().splitAmounts };
        if (amount <= 0) delete next[type];
        else next[type] = amount;
        set({ splitAmounts: next });
      },

      setOrderDate(date) {
        set({ orderDate: date });
      },

      startEditing(order, items, doctor) {
        set({
          ...INITIAL,
          editingOrder: order,
          cart: items,
          // A total that was typed by hand stays typed by hand: re-sending it
          // keeps the money exactly as booked, down to each line's rounding.
          totalOverride:
            order.originalTotal !== null && order.originalTotal !== order.totalAmount
              ? order.totalAmount
              : null,
          doctor,
          orderType: order.orderType,
          buyerType: order.buyerType,
          paymentType: order.paymentType,
          // An order the backend reports as "none" was never marked; anything
          // else carries a type the desk chose and must keep on re-save.
          paymentTypeMarked: !order.isUnpaidOrder,
          splitPayment: order.isMixedPayment && order.payments.length > 1,
          splitAmounts: order.isMixedPayment
            ? Object.fromEntries(
                order.payments.filter((p) => p.amount > 0).map((p) => [p.type, p.amount]),
              )
            : {},
          note: order.note ?? "",
          debtEnabled: order.debt !== null,
          debtAmount: order.debt?.amount ?? 0,
          debtDueDate: order.debt?.dueDate ?? null,
          debtNote: order.debt?.note ?? "",
          appointmentId: order.appointmentId,
          guestPhone: order.clientPhone,
          guestName: order.clientName,
        });
      },

      setPreview(preview, failed = false) {
        set({ preview, previewFailed: failed });
        // The server may price the basket lower than the debt reception typed
        // (a gift it knows about, a rule the app doesn't), so re-check.
        clampDebt();
      },

      setShowValidation(show) {
        set({ showValidation: show });
      },

      clearNotice() {
        set({ notice: null });
      },

      setFieldErrors(errors) {
        set({ fieldErrors: errors });
      },

      setSaveError(message) {
        set({ saveError: message });
      },

      applyStockIssues(issues) {
        if (issues.length === 0) return;
        const byId = new Map(issues.map((issue) => [String(issue.productId), issue]));

        set({
          cart: get().cart.map((item) => {
            const issue = byId.get(item.product.id);
            if (!issue) return item;

            const product: Product = {
              ...item.product,
              stockQuantity: issue.available,
              trackStock: true,
            };
            const allowed = allowedQuantity(product, item.quantity);
            // Nothing sellable left (or less than one whole box): keep the line
            // as it is — visibly wrong next to the error text — rather than
            // silently deleting what reception just tried to sell.
            const quantity = allowed > 0 ? allowed : item.quantity;
            return resizeLine(
              { ...item, product },
              {
                quantity,
                giftQuantity: allowedGift(product, item.giftQuantity, quantity),
              },
            );
          }),
        });
        clampDebt();
      },
    };
  });
}

/**
 * The store the "Yangi buyurtma" pages share.
 *
 * App-scoped on purpose: the order page and the catalogue page are two routes
 * building ONE basket, and the draft has to survive the navigation between them
 * and a browser reload.
 */
export const appNewOrderStore = createNewOrderStore();

const NewOrderStoreContext = createContext<NewOrderStoreApi>(appNewOrderStore);

/** Puts a form's own store in scope — the edit dialog wraps itself in this. */
export const NewOrderStoreProvider = NewOrderStoreContext.Provider;

/** The store instance this subtree belongs to, for subscriptions and reads. */
export function useNewOrderStoreApi(): NewOrderStoreApi {
  return useContext(NewOrderStoreContext);
}

const identity = (state: NewOrderStore) => state;

export function useNewOrderStore(): NewOrderStore;
export function useNewOrderStore<T>(selector: (state: NewOrderStore) => T): T;
export function useNewOrderStore<T>(selector?: (state: NewOrderStore) => T) {
  return useStore(
    useContext(NewOrderStoreContext),
    (selector ?? identity) as (state: NewOrderStore) => T,
  );
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

/**
 * The fields that make up a draft. Search results, submit status and validation
 * errors are deliberately absent, so typing a phone number doesn't churn
 * localStorage.
 *
 * `orderDate` is absent too: a form restored tomorrow must not silently keep
 * yesterday's date.
 */
function toDraftJson(state: NewOrderState): Record<string, unknown> {
  return {
    order_type: state.orderType,
    buyer_type: state.buyerType,
    client: state.client,
    guest_name: state.guestName,
    guest_phone: state.guestPhone,
    doctor: state.doctor,
    appointment_id: state.appointmentId,
    cart: state.cart.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      custom_price: item.customPrice,
      line_total: item.customLineTotal,
      gift_quantity: item.giftQuantity,
    })),
    total_override: state.totalOverride,
    gift_product: state.giftProduct,
    note: state.note,
    debt_enabled: state.debtEnabled,
    debt_amount: state.debtAmount,
    debt_due_date: state.debtDueDate ? ymd(state.debtDueDate) : null,
    debt_note: state.debtNote,
    payment_type: state.paymentType,
    payment_type_marked: state.paymentTypeMarked,
    split_payment: state.splitPayment,
    split_amounts: state.splitAmounts,
  };
}

function fromDraftJson(json: Record<string, unknown>): Partial<NewOrderState> {
  const cart = Array.isArray(json.cart) ? json.cart : [];
  return {
    orderType: json.order_type === "delivery" ? "delivery" : "clinic",
    buyerType: json.buyer_type === "staff" ? "staff" : "client",
    client: (json.client as ClientSearchResult | null) ?? null,
    guestName: String(json.guest_name ?? ""),
    guestPhone: String(json.guest_phone ?? ""),
    doctor: (json.doctor as Doctor | null) ?? null,
    appointmentId: json.appointment_id ? String(json.appointment_id) : null,
    cart: cart.flatMap((raw) => {
      if (typeof raw !== "object" || raw === null) return [];
      const item = raw as Record<string, unknown>;
      const product = parseProductLike(item.product);
      if (!product) return [];
      return [
        {
          product,
          quantity: Number(item.quantity ?? 0),
          customPrice: item.custom_price === null ? null : Number(item.custom_price),
          customLineTotal: item.line_total === null ? null : Number(item.line_total),
          giftQuantity: Number(item.gift_quantity ?? 0),
        } satisfies CartItem,
      ];
    }),
    totalOverride:
      json.total_override === null || json.total_override === undefined
        ? null
        : Number(json.total_override),
    giftProduct: parseProductLike(json.gift_product),
    note: String(json.note ?? ""),
    debtEnabled: json.debt_enabled === true,
    debtAmount: Number(json.debt_amount ?? 0),
    debtDueDate: json.debt_due_date ? dateFromYmd(String(json.debt_due_date)) : null,
    debtNote: String(json.debt_note ?? ""),
    paymentType: (json.payment_type as PaymentType | null) ?? "cash",
    paymentTypeMarked: json.payment_type_marked === true,
    splitPayment: json.split_payment === true,
    splitAmounts:
      typeof json.split_amounts === "object" && json.split_amounts !== null
        ? (json.split_amounts as Partial<Record<PaymentType, number>>)
        : {},
  };
}

/**
 * A stored product is our own serialised `Product`, but a draft written by an
 * older build may carry the API shape — parse both rather than losing the cart.
 */
function parseProductLike(raw: unknown): Product | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.priceUzs === "number") return value as unknown as Product;
  if (value.id !== undefined) return parseProduct(value);
  return null;
}

/**
 * True when the form holds something reception would hate to lose — the signal
 * for whether a draft is worth storing (and, inverted, for wiping the stored
 * one after a save or reset).
 */
export function hasDraftContent(state: NewOrderState): boolean {
  return (
    state.client !== null ||
    state.doctor !== null ||
    state.cart.length > 0 ||
    state.totalOverride !== null ||
    state.giftProduct !== null ||
    state.note !== "" ||
    state.splitPayment ||
    Object.keys(state.splitAmounts).length > 0 ||
    state.orderType === "delivery" ||
    state.guestName !== "" ||
    state.guestPhone !== "" ||
    state.debtEnabled
  );
}

let lastWrite = 0;
let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * Mirrors the form into storage as it changes, collapsing a burst of keystrokes
 * into one trailing write.
 */
export function startDraftPersistence(store: NewOrderStoreApi): () => void {
  return store.subscribe((state) => {
    // An order being edited is already on the server; a draft of it would only
    // resurrect a half-finished edit on the next reload.
    if (state.editingOrder !== null) return;

    const write = () => {
      lastWrite = Date.now();
      pending = null;
      const current = store.getState();
      if (hasDraftContent(current)) saveDraft(toDraftJson(current));
      else clearDraft();
    };

    const since = Date.now() - lastWrite;
    if (since >= DRAFT_WRITE_INTERVAL_MS) write();
    else pending ??= setTimeout(write, DRAFT_WRITE_INTERVAL_MS - since);
  });
}

// ---------------------------------------------------------------------------
// Selectors — the money and the validation, in one place
// ---------------------------------------------------------------------------

function localTotals(state: NewOrderState) {
  return computeCartTotals({
    items: state.cart,
    totalOverride: state.totalOverride,
    giftProduct: selectGiftEligible(state) ? state.giftProduct : null,
  });
}

export function selectSubtotal(state: NewOrderState): number {
  return state.preview?.subtotal ?? localTotals(state).subtotal;
}

/** Cart total actually billed: the lines' sum, or the manually typed total. */
export function selectTotal(state: NewOrderState): number {
  return state.preview?.total ?? localTotals(state).total;
}

export function selectGiftDiscount(state: NewOrderState): number {
  return state.preview?.giftDiscount ?? localTotals(state).giftDiscount;
}

/** Amount the client actually pays: billed total minus the free gift unit. */
export function selectPayableTotal(state: NewOrderState): number {
  return state.preview?.payable ?? localTotals(state).payable;
}

export function selectCreditedAmount(state: NewOrderState): number {
  return state.debtEnabled ? state.debtAmount : 0;
}

/**
 * What reaches the till right now: the payable total minus whatever went on
 * credit. **This, not the total, is what a split payment must add up to** — the
 * single rule the whole payment model rests on, which is exactly why it comes
 * from the server's preview whenever there is one.
 */
export function selectPaidNow(state: NewOrderState): number {
  if (state.preview) return state.preview.paidNow;
  return Math.max(0, selectPayableTotal(state) - selectCreditedAmount(state));
}

/** True when the till takes nothing at all — full credit, or a 0-so'm gift. */
export function selectNothingPayable(state: NewOrderState): boolean {
  return state.cart.length > 0 && selectPaidNow(state) === 0;
}

/** True while the payment chips are showing "To'lanmagan". */
export function selectPaymentUnmarked(state: NewOrderState): boolean {
  return selectNothingPayable(state) && !state.paymentTypeMarked;
}

/**
 * The `payment_type` this order is booked with. Null (→ `"none"` on the wire)
 * only when nothing reaches the till and the desk marked nothing.
 */
export function selectEffectivePaymentType(state: NewOrderState): PaymentType | null {
  return selectPaymentUnmarked(state) ? null : (state.paymentType ?? "cash");
}

/**
 * Whether the "Jami" figure may be typed over at all. A cart that bills nothing
 * has no paid line to spread a manual total across.
 */
export function canEditTotal(state: NewOrderState): boolean {
  return state.cart.length > 0 && localTotals(state).subtotal > 0;
}

/** A delivery never earns the loyalty gift — the sale isn't in the app history. */
export function selectGiftEligible(
  state: Pick<NewOrderState, "orderType" | "client">,
): boolean {
  return (
    allowsGift(state.orderType) && (state.client?.giftStatus?.giftAvailable ?? false)
  );
}

export function selectIsDelivery(state: Pick<NewOrderState, "orderType">): boolean {
  return state.orderType === "delivery";
}

export function selectIsEditing(state: NewOrderState): boolean {
  return state.editingOrder !== null;
}

/** True when a doctor must be chosen: only for a clinic sale to a client. */
export function selectDoctorRequired(state: NewOrderState): boolean {
  return !selectIsDelivery(state) && state.buyerType === "client";
}

/**
 * True when this save writes to a day other than today, which the backend only
 * accepts with the 4-digit PIN. Two ways to get there: filing a new sale under
 * an earlier day, or touching an order rung up before today at all.
 */
export function selectNeedsConfirmPin(state: NewOrderState): boolean {
  if (state.orderDate !== null && !isToday(state.orderDate)) return true;
  return state.editingOrder !== null && !isToday(state.editingOrder.createdAt);
}

/** The date shown on the form: the picked one, the edited order's day, or today. */
export function selectEffectiveOrderDate(state: NewOrderState): TashkentDate | null {
  return state.orderDate ?? state.editingOrder?.createdAt ?? null;
}

/** The server's price for a line, when it has priced this basket. */
export function selectServerLineTotal(
  state: NewOrderState,
  productId: string,
): number | null {
  return state.preview
    ? (paidLineFor(state.preview, productId)?.lineTotal ?? null)
    : null;
}

export function selectUnitCount(state: NewOrderState): number {
  return cartUnitCount(state.cart);
}

/** Value of units handed over free as in-cart gifts, for the summary. */
export function selectManualGiftValue(state: NewOrderState): number {
  return state.cart.reduce((sum, item) => sum + unitPrice(item) * item.giftQuantity, 0);
}

/**
 * The client half of the form.
 *
 * An edit is neither case: the client of a booked order is fixed, the form
 * shows it read-only and `PATCH orders/{id}/` leaves it out of the body.
 * Validating it there blocked the save of any delivery whose order carries no
 * typed guest name — the ordinary shape when a delivery was rung up for a saved
 * client — on a field the edit form does not even render.
 */
export function selectClientValid(state: NewOrderState): boolean {
  if (selectIsEditing(state)) return true;
  return selectIsDelivery(state)
    ? state.guestName.trim() !== "" && state.guestPhone.length === 12
    : state.client !== null;
}

export function selectDebtValid(state: NewOrderState): boolean {
  if (!state.debtEnabled) return true;
  return (
    state.debtAmount > 0 &&
    state.debtAmount <= selectPayableTotal(state) &&
    state.debtDueDate !== null
  );
}

export function selectSplitAssigned(state: NewOrderState): number {
  return Object.values(state.splitAmounts).reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );
}

export function selectSplitValid(state: NewOrderState): boolean {
  const target = selectPaidNow(state);
  const assigned = selectSplitAssigned(state);
  const parts = Object.values(state.splitAmounts).filter((a) => (a ?? 0) > 0);
  return target > 0 && assigned === target && parts.length > 0;
}

export function selectIsValid(state: NewOrderState): boolean {
  if (!selectClientValid(state) || state.cart.length === 0) return false;
  if (selectDoctorRequired(state) && state.doctor === null) return false;
  if (!selectDebtValid(state)) return false;
  // No money changes hands (full credit / full gift) → no payment to ask for.
  if (selectNothingPayable(state)) return true;
  return state.splitPayment ? selectSplitValid(state) : state.paymentType !== null;
}

/**
 * The ONE thing standing between this form and a save, worded for the desk —
 * null when valid.
 *
 * Mirrors `selectIsValid` check for check. The inline field errors say the same
 * thing, but the field that blocks the save can sit far outside the viewport,
 * so a submit that stops with nothing on screen reads as a dead button —
 * especially after the desk has just typed a PIN for it.
 */
export function selectSubmitBlocker(state: NewOrderState): string | null {
  if (!selectClientValid(state)) {
    if (!selectIsDelivery(state)) return "Mijozni tanlang";
    return state.guestName.trim() === ""
      ? "Mijoz ismini kiriting"
      : "Telefon raqamini to'liq kiriting";
  }
  if (state.cart.length === 0) return "Savatga mahsulot qo'shing";
  if (selectDoctorRequired(state) && state.doctor === null) return "Shifokorni tanlang";

  if (!selectDebtValid(state)) {
    if (state.debtAmount <= 0) return "Qarz summasini kiriting";
    if (state.debtAmount > selectPayableTotal(state)) {
      return "Qarz summasi buyurtma summasidan katta";
    }
    return "Qarz muddatini tanlang";
  }

  if (selectNothingPayable(state)) return null;

  if (!state.splitPayment) {
    return state.paymentType === null ? "To'lov turini tanlang" : null;
  }
  if (selectSplitValid(state)) return null;

  const remaining = selectPaidNow(state) - selectSplitAssigned(state);
  if (selectSplitAssigned(state) === 0) return "To'lov summalarini kiriting";
  return remaining > 0
    ? `Yana ${money.uzs(remaining)} taqsimlang`
    : `To'lovlar ${money.uzs(-remaining)} ortiqcha`;
}

export { lineTotal, paidQuantity, hasCustomPrice, unitPrice };
