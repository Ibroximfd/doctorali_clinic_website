import { newCartItem, type CartItem } from "@/features/orders/types/cart";
import type { OrderDetail, OrderLine } from "@/features/orders/types/order";
import type { Product } from "@/features/products/types/product";

/**
 * Rebuilds the basket of an existing order so it can be edited.
 *
 * Two things make this less obvious than a map:
 *
 * 1. **A gift travels as its own line.** The API splits "3 sold + 1 free" into a
 *    paid entry and an `is_gift` entry for the same product, so the two halves
 *    are folded back into one cart item here — otherwise the editor would show
 *    the product twice and the second save would send four paid units.
 * 2. **A manual price is a sum, not a rate.** `unit_price` is what the server
 *    derived from the typed line total, so it is restored as both the custom
 *    price and the line total; re-saving then sends the sum back and the server
 *    spreads it again, exactly as it did the first time.
 *
 * The catalog product is preferred over the order's snapshot because the
 * editor needs today's stock and packaging to clamp quantities; a product that
 * has since been deleted falls back to a stand-in built from the line itself,
 * so an old order is still editable.
 */
export function cartFromOrder(
  order: OrderDetail,
  catalog: ReadonlyMap<string, Product>,
): CartItem[] {
  const items = new Map<string, CartItem>();

  for (const line of order.items) {
    const product = catalog.get(line.productId) ?? productFromLine(line);
    const existing = items.get(line.productId);

    if (line.isGift) {
      items.set(line.productId, {
        ...(existing ?? newCartItem(product, 0)),
        giftQuantity: (existing?.giftQuantity ?? 0) + line.quantity,
      });
      continue;
    }

    // A reduced price is restored as the sum the desk typed, which is what the
    // server re-spreads on save.
    const custom =
      line.originalUnitPrice !== null && line.originalUnitPrice > line.unitPrice
        ? { customPrice: line.unitPrice, customLineTotal: line.subtotal }
        : { customPrice: null, customLineTotal: null };

    items.set(line.productId, {
      ...(existing ?? newCartItem(product, 0)),
      product,
      quantity: (existing?.quantity ?? 0) + line.quantity,
      ...custom,
    });
  }

  return [...items.values()];
}

/**
 * A stand-in for a product that is no longer in the catalog.
 *
 * Stock tracking is off on it deliberately: nothing is known about its shelf,
 * and pretending the balance is zero would block a save that the backend would
 * have accepted.
 */
function productFromLine(line: OrderLine): Product {
  return {
    id: line.productId,
    name: line.productName,
    description: "",
    priceUzs: line.originalUnitPrice ?? line.unitPrice,
    category: "",
    imageUrl: line.imageUrl,
    isActive: false,
    receptionOnly: false,
    stockQuantity: 0,
    minQuantity: 0,
    trackStock: false,
    packageSize: line.packaging.size,
    packageLabel: line.packaging.label,
    packagePrice: null,
    unitSaleEnabled: true,
  };
}
