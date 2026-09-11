"use client";

import { useQuery } from "@tanstack/react-query";
import { PackagePlus, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Doctor } from "@/features/doctors/types/doctor";
import type { OrderDetail } from "@/features/orders/types/order";
import { fetchProductsByIds } from "@/features/products/api/products-api";
import { productKeys } from "@/features/products/hooks/use-products";
import type { Product } from "@/features/products/types/product";
import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { dayMonthYearTime, isToday } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import { useNewOrderSession } from "../hooks/use-new-order-session";
import { useOrderSubmit } from "../hooks/use-order-submit";
import { cartFromOrder } from "../lib/cart-from-order";
import {
  canEditTotal,
  createNewOrderStore,
  NewOrderStoreProvider,
  selectPayableTotal,
  selectSubtotal,
  useNewOrderStore,
  type NewOrderStoreApi,
} from "../store/new-order-store";
import { OrderCartPanel } from "./order-cart-panel";
import { OrderClientSection } from "./order-client-section";
import { OrderSummaryPanel } from "./order-summary-panel";
import { ProductPicker } from "./product-picker";
import { TotalOverrideDialog } from "./total-override-dialog";

/**
 * "Buyurtmani tahrirlash" — an existing order edited in a window of its own.
 *
 * It is a dialog, not a trip to the New Order page, and that is the point: the
 * desk edits an order from the list it was looking at and lands back on that
 * same list, with the filters and the scroll position it had. Sending it to
 * "Yangi buyurtma" instead made an edit look exactly like a new sale, and it
 * quietly took over the half-typed order that may already have been waiting
 * there.
 *
 * The form inside runs on its **own** store instance, created when the dialog
 * opens and thrown away when it closes, with the draft storage switched off —
 * an abandoned edit leaves nothing behind, and the new order in progress on the
 * other page is untouched.
 */
export function OrderEditDialog({
  order,
  open,
  onOpenChange,
  onSaved,
}: {
  order: OrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the server accepted the change — refresh whatever is behind. */
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open && order !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1240px]"
        showCloseButton={false}
        // Closing by accident throws the edit away, so the backdrop and Escape
        // are not shortcuts out — the header's ✕ asks first.
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        {order && (
          <OrderEditLoader
            key={order.id}
            order={order}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Everything an editable basket needs that the order payload doesn't carry:
 * the whole catalog product behind each line (today's price, packaging and
 * stock, which is what the quantity steppers clamp against).
 */
function OrderEditLoader({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetail;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const ids = [...new Set(order.items.map((line) => line.productId))];
  const {
    data: products,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: productKeys.byIds(ids),
    queryFn: () => fetchProductsByIds(ids),
    staleTime: 60_000,
  });

  return (
    <>
      <EditHeader order={order} onClose={onClose} />

      {error && !products ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : isPending || !products ? (
        <div className="flex flex-col gap-3 p-5" aria-hidden>
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      ) : (
        <OrderEditForm
          order={order}
          products={products}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function EditHeader({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  return (
    <DialogHeader className="border-surface-alt flex-row items-center gap-3 border-b px-5 py-4">
      <span className="bg-primary-soft flex shrink-0 rounded-[10px] p-2" aria-hidden>
        <Pencil className="text-primary size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle className="text-title-lg">Buyurtmani tahrirlash</DialogTitle>
        <DialogDescription className="tabular truncate">
          {order.orderNumber} · {dayMonthYearTime(order.createdAt)}
          {!isToday(order.createdAt) && " · bugungi emas, PIN so'raladi"}
        </DialogDescription>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Yopish"
        className="shrink-0"
      >
        <X className="size-4" />
      </Button>
    </DialogHeader>
  );
}

/**
 * The form itself, on a store seeded with the order before the first render —
 * no effect, so the basket is never briefly empty on screen.
 */
function OrderEditForm({
  order,
  products,
  onClose,
  onSaved,
}: {
  order: OrderDetail;
  products: ReadonlyMap<string, Product>;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [store] = useState<NewOrderStoreApi>(() => {
    const created = createNewOrderStore();
    created
      .getState()
      .startEditing(order, cartFromOrder(order, products), doctorOf(order));
    return created;
  });

  return (
    <NewOrderStoreProvider value={store}>
      <EditBody order={order} onClose={onClose} onSaved={onSaved} />
    </NewOrderStoreProvider>
  );
}

function EditBody({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetail;
  onClose: () => void;
  onSaved?: () => void;
}) {
  // Priced by the server, like every other basket — but with no draft storage:
  // this order already exists, and a draft of it would resurrect a half-finished
  // edit on the next reload and overwrite the new order in progress.
  const preview = useNewOrderSession({ persistDraft: false });

  const state = useNewOrderStore();
  /*
   * The catalogue opens by itself on an order with nothing in it — the desk
   * cleared the basket to swap a product, and an order cannot be saved empty,
   * so the next thing they need is always the search box.
   */
  const [picking, setPicking] = useState(() => state.cart.length === 0);
  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const { submit, submitting, pinGate } = useOrderSubmit({
    onSaved() {
      toast.success("Buyurtma yangilandi");
      onSaved?.();
      onClose();
    },
  });

  const commissionPercent = state.doctor?.commissionPercent ?? null;
  const commissionAmount =
    state.preview?.commissionAmount ??
    (state.doctor && commissionPercent !== null
      ? Math.round((selectPayableTotal(state) * commissionPercent) / 100)
      : null);

  return (
    <>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
        {/*
         * The catalogue box used to be a fixed 420px that nothing stopped from
         * shrinking — a flex child shrinks by default — so its siblings
         * squeezed it to a strip barely one card tall and the cards came out
         * sliced through the middle. It now takes the column's spare height
         * with a floor under it, and the column still scrolls when a short
         * screen cannot hold all three blocks.
         */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto xl:pr-1">
          <div className="shrink-0">
            <OrderClientSection />
          </div>

          {/* The catalogue lives inside the window. A new order sends the desk
              to a page of its own for this, but an edit must not leave the
              dialog — everything about this order is changed in one place. */}
          {picking && (
            <section
              // Escape closes the catalogue, not the dialog — the search box
              // clears itself first, exactly as it does on the catalogue page.
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                const target = event.target;
                if (target instanceof HTMLInputElement && target.value !== "") return;
                event.stopPropagation();
                setPicking(false);
              }}
              className="border-border bg-surface flex min-h-[340px] flex-1 flex-col gap-3 overflow-hidden rounded-lg border p-4 shadow-sm"
            >
              <div className="flex shrink-0 items-center gap-2">
                <h3 className="text-title-sm flex-1">Mahsulot qo&rsquo;shish</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPicking(false)}
                >
                  <X className="size-4" aria-hidden />
                  Yopish
                </Button>
              </div>
              <ProductPicker
                quantities={Object.fromEntries(
                  state.cart.map((item) => [item.product.id, item.quantity]),
                )}
                onAdd={state.addProduct}
                onQuantityChange={(product, quantity) =>
                  state.setQuantity(product.id, quantity)
                }
              />
            </section>
          )}

          {/* Beside an open catalogue the basket is a receipt of what has just
              been added, so it is capped and scrolls on its own; with the
              catalogue closed it takes the whole column back. */}
          <OrderCartPanel
            className={cn("shrink-0", picking && "max-h-[320px]")}
            priceIsEstimate={preview.previewPending || preview.previewFailed}
            compactEmpty={picking}
            emptyMessage={
              picking
                ? "Savat bo'sh — yuqoridagi kartochkani bosing."
                : "Savat bo'sh — buyurtmada kamida bitta mahsulot bo'lishi kerak."
            }
            action={
              !picking ? (
                <Button
                  type="button"
                  variant={state.cart.length === 0 ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setPicking(true)}
                >
                  {state.cart.length === 0 ? (
                    <PackagePlus className="size-4" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  {state.cart.length === 0
                    ? "Mahsulot tanlash"
                    : "Yana mahsulot qo'shish"}
                </Button>
              ) : undefined
            }
          />
        </div>

        <div className="min-w-0 xl:overflow-y-auto">
          <OrderSummaryPanel
            onEditTotal={() => canEditTotal(state) && setTotalDialogOpen(true)}
            onSubmit={submit}
            onReset={() => setDiscarding(true)}
            resetLabel="Bekor qilish"
            submitting={submitting}
            previewPending={preview.previewPending}
            previewFailed={preview.previewFailed}
            commissionAmount={commissionAmount}
            commissionPercent={commissionPercent}
            commissionIsEstimate={state.preview?.commissionAmount === undefined}
          />
        </div>
      </div>

      <TotalOverrideDialog
        open={totalDialogOpen}
        onOpenChange={setTotalDialogOpen}
        subtotal={selectSubtotal(state)}
        current={state.totalOverride}
        onApply={state.setTotalOverride}
      />

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        description={
          isToday(order.createdAt)
            ? "O'zgarishni saqlash uchun 4 xonali PIN-kodni kiriting."
            : "Bu buyurtma bugungi emas. O'zgarishni saqlash uchun 4 xonali PIN-kodni kiriting."
        }
      />

      {/* Closing mid-edit throws the changes away, so it always asks: the
          dialog opens on a full basket and there is no cheap way to tell a
          deliberate edit from an accidental tap on a stepper. */}
      <AlertDialog open={discarding} onOpenChange={setDiscarding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tahrirni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              Kiritilgan o&rsquo;zgarishlar saqlanmaydi. Buyurtma avvalgi holida qoladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tahrirda qolish</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Ha, chiqish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The doctor as this order recorded them.
 *
 * The percentage comes from the ORDER, not from the doctor's current rate: a
 * sale keeps the commission it was written with, and re-saving it must not
 * silently reprice an old order because the doctor's percentage changed since.
 */
function doctorOf(order: OrderDetail): Doctor | null {
  if (order.doctor.id === "") return null;
  return {
    id: order.doctor.id,
    fullName: order.doctor.fullName,
    specialty: order.doctor.specialty,
    commissionPercent: order.commissionPercent,
    treatmentCommissionPercent: null,
    consultationCommissionPercent: null,
    avatarUrl: order.doctor.avatarUrl,
    isActive: true,
  };
}
