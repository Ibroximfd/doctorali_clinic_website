import { Hospital, Truck, type LucideIcon } from "lucide-react";

/**
 * Where an order was fulfilled (`order_type`).
 *
 * The distinction is not cosmetic. A **delivery** is for someone who may never
 * have installed the app: it is never written to the client's in-app order list
 * and it does not count toward the every-10th-order gift. Getting this wrong in
 * either direction is expensive — a delivery counted toward the gift hands out
 * free product the clinic never promised — so the rules live here rather than
 * being re-derived at each call site.
 */
export const ORDER_TYPES = ["clinic", "delivery"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export function parseOrderType(raw: unknown): OrderType {
  return raw === "delivery" ? "delivery" : "clinic";
}

export const ORDER_TYPE_LABEL: Readonly<Record<OrderType, string>> = {
  clinic: "Klinika",
  delivery: "Dastavka",
};

export const ORDER_TYPE_ICON: Readonly<Record<OrderType, LucideIcon>> = {
  clinic: Hospital,
  delivery: Truck,
};

/**
 * Only a clinic sale can carry the loyalty gift. The New Order form hides the
 * gift block entirely for a delivery, and `gift_product_id` is never sent — the
 * backend rejects it anyway (`gift_not_allowed`).
 */
export function allowsGift(type: OrderType): boolean {
  return type === "clinic";
}

/**
 * A delivery client is identified by a typed name + phone rather than by
 * picking a registered client, so no lookup is performed at all.
 */
export function requiresRegisteredClient(type: OrderType): boolean {
  return type === "clinic";
}

/** Who the purchase is for (`buyer_type`). The backend defaults to `client`. */
export const BUYER_TYPES = ["client", "staff"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

export function parseBuyerType(raw: unknown): BuyerType {
  return raw === "staff" ? "staff" : "client";
}

export const BUYER_TYPE_LABEL: Readonly<Record<BuyerType, string>> = {
  client: "Mijoz",
  staff: "Xodim",
};
