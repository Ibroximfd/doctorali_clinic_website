"use client";

import { Gift, Store, X } from "lucide-react";

import { ProductSearchPicker } from "@/features/warehouse/components/product-search-picker";
import { Button } from "@/shared/components/ui/button";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { money } from "@/shared/lib/format/money";

import {
  selectGiftEligible,
  selectIsEditing,
  useNewOrderStore,
} from "../store/new-order-store";

/**
 * "Sovg'a" — the loyalty gift, one free product for a client who has earned one.
 *
 * It appears only when the chosen client is actually eligible (the backend says
 * so on the client's `gift_status`), and it is always skippable: a gift the
 * desk forgets to hand over is a complaint, but a gift forced onto every
 * eligible order is a hole in the stock room.
 *
 * The free unit is NOT priced here — `gift_product_id` travels with the order
 * and the server takes its value off the total, which is the figure the preview
 * shows back.
 */
export function OrderGiftSection() {
  const state = useNewOrderStore();
  const { giftProduct, setGiftProduct, fieldErrors } = state;

  // An edit never touches the gift: `PATCH orders/{id}/` has no field for it,
  // so a control here would be a promise the server does not keep.
  if (selectIsEditing(state) || !selectGiftEligible(state)) return null;

  const error = fieldErrors.gift_product_id?.[0];

  return (
    <section className="border-gold/30 bg-gold/6 flex flex-col gap-3 rounded-lg border p-5">
      <div className="flex items-center gap-3">
        <span className="bg-gold/15 flex shrink-0 rounded-[10px] p-2" aria-hidden>
          <Gift className="text-gold size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title-lg">Sovg&rsquo;a (ixtiyoriy)</h2>
          <p className="text-caption text-text-secondary mt-0.5">
            Mijoz sovg&rsquo;aga ega — mahsulot tanlashingiz mumkin
          </p>
        </div>
      </div>

      {giftProduct === null ? (
        <ProductSearchPicker onSelect={setGiftProduct} label="Sovg'a tanlash" />
      ) : (
        <div className="border-border bg-surface flex items-center gap-3 rounded-md border p-2.5">
          <ProductThumb
            name={giftProduct.name}
            imageUrl={giftProduct.imageUrl}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <p className="text-title-sm truncate">🎁 {giftProduct.name}</p>
            <p className="text-caption text-text-tertiary tabular flex items-center gap-1.5 truncate">
              {giftProduct.category || "Sovg'a"} · {money.plain(giftProduct.priceUzs)}
              {giftProduct.receptionOnly && (
                <Store
                  className="text-gold size-3 shrink-0"
                  aria-label="Faqat showroom"
                />
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setGiftProduct(null)}
            aria-label="Sovg'ani bekor qilish"
            className="text-text-tertiary hover:text-danger shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
