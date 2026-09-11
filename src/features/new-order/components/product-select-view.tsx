"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { AppRoutes } from "@/config/routes";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { Button } from "@/shared/components/ui/button";
import { money } from "@/shared/lib/format/money";

import { useNewOrderSession } from "../hooks/use-new-order-session";
import { selectSubtotal, useNewOrderStore } from "../store/new-order-store";
import type { Product } from "@/features/products/types/product";
import { OrderCartPanel } from "./order-cart-panel";
import { ProductPicker } from "./product-picker";

/**
 * "Mahsulot tanlash" — the catalogue, on a page of its own.
 *
 * Choosing products is the longest part of an order and it deserves the whole
 * width: the grid gets room for several columns instead of the two it had when
 * it shared the screen with the client form and the money panel. It is a route,
 * not a dialog, so the sidebar stays put, the browser's Back works, and a
 * mis-click never loses the basket.
 *
 * The basket travels with it — same component, same store — so a quantity can
 * be corrected here without going back first.
 */
export function ProductSelectView() {
  const { previewPending, previewFailed } = useNewOrderSession();

  const router = useRouter();
  /*
   * Slices, not the whole store: this screen holds the sixty-card grid, and a
   * whole-store subscription re-rendered all of it on every field the form
   * touched — the note, the phone, each pricing answer from the server.
   */
  const cart = useNewOrderStore((s) => s.cart);
  const addProduct = useNewOrderStore((s) => s.addProduct);
  const setQuantity = useNewOrderStore((s) => s.setQuantity);
  const subtotal = useNewOrderStore(selectSubtotal);

  const setProductQuantity = useCallback(
    (product: Product, quantity: number) => setQuantity(product.id, quantity),
    [setQuantity],
  );

  const quantities = useMemo(
    () => Object.fromEntries(cart.map((item) => [item.product.id, item.quantity])),
    [cart],
  );

  const units = cart.reduce((sum, item) => sum + item.quantity + item.giftQuantity, 0);

  /*
   * Escape goes back to the order, basket and all.
   *
   * This page behaves like a step in a flow, so it should close like one — and
   * nothing can be lost by closing it: the basket lives in the store, not on
   * this screen. The search field keeps its own Escape (it clears the query
   * first), so a stray press never jumps out of a search.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Let a popover, a dialog or a filled search box handle it first.
      if (
        target?.closest("[role='dialog']") ||
        target?.closest("[data-radix-popper-content-wrapper]") ||
        (target instanceof HTMLInputElement && target.value !== "")
      ) {
        return;
      }
      router.push(AppRoutes.newOrder);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <PageContainer className="flex flex-col gap-4 lg:h-full lg:overflow-hidden">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" className="shrink-0">
          <Link href={AppRoutes.newOrder}>
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Buyurtmaga qaytish</span>
            <span className="sm:hidden">Orqaga</span>
          </Link>
        </Button>

        {cart.length > 0 && (
          <p className="text-caption text-text-secondary tabular min-w-0 truncate">
            {cart.length} ta nom · {units} dona ·{" "}
            <span className="text-title-sm">{money.uzs(subtotal)}</span>
            {/* The sum is the server's. Until it answers — or if it can't —
                the figure is the local estimate and says so, because a box is
                rarely nine unit prices. */}
            {(previewPending || previewFailed) && (
              <span className="text-text-tertiary"> (taxminiy)</span>
            )}
          </p>
        )}

        <span className="text-caption text-text-tertiary ml-auto hidden lg:inline">
          <kbd className="border-border bg-surface-alt rounded-xs border px-1">Esc</kbd>{" "}
          orqaga
        </span>

        <Button asChild className="shrink-0">
          <Link href={AppRoutes.newOrder}>
            <Check className="size-4" aria-hidden />
            <span className="hidden sm:inline">Tanlash tugadi</span>
            <span className="sm:hidden">Tayyor</span>
          </Link>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:overflow-hidden">
        <section className="border-border bg-surface flex min-h-0 flex-col rounded-lg border p-4 shadow-sm sm:p-5">
          <ProductPicker
            quantities={quantities}
            onAdd={addProduct}
            onQuantityChange={setProductQuantity}
          />
        </section>

        <OrderCartPanel
          className="min-h-0 lg:max-h-full"
          priceIsEstimate={previewPending || previewFailed}
          emptyMessage="Chapdagi kartochkani bosing — mahsulot shu yerga tushadi."
          action={
            cart.length > 0 ? (
              <Button asChild className="w-full">
                <Link href={AppRoutes.newOrder}>
                  <Check className="size-4" aria-hidden />
                  Buyurtmani rasmiylashtirish
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    </PageContainer>
  );
}
