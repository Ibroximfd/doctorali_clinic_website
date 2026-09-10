"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AppRoutes } from "@/config/routes";
import type { OrderDetail } from "@/features/orders/types/order";
import { fetchProductsByIds } from "@/features/products/api/products-api";
import { productKeys } from "@/features/products/hooks/use-products";
import type { Doctor } from "@/features/doctors/types/doctor";
import { ApiError } from "@/shared/lib/api/errors";

import { cartFromOrder } from "../lib/cart-from-order";
import { useNewOrderStore } from "../store/new-order-store";

/**
 * Opens an existing order in the New Order form.
 *
 * The catalog products behind the lines are fetched first: the editor clamps
 * quantities against today's stock and formats boxes from today's packaging, so
 * the order's own snapshot of a product is not enough to edit it safely.
 */
export function useStartOrderEdit() {
  const router = useRouter();
  const client = useQueryClient();
  const startEditing = useNewOrderStore((s) => s.startEditing);
  const [preparing, setPreparing] = useState(false);

  const start = useCallback(
    async (order: OrderDetail) => {
      setPreparing(true);
      try {
        const ids = [...new Set(order.items.map((line) => line.productId))];
        const products = await client.fetchQuery({
          queryKey: productKeys.byIds(ids),
          queryFn: () => fetchProductsByIds(ids),
          staleTime: 60_000,
        });

        startEditing(order, cartFromOrder(order, products), doctorFromOrder(order));
        router.push(AppRoutes.newOrder);
      } catch (error) {
        toast.error(ApiError.is(error) ? error.message : "Buyurtmani ochib bo'lmadi");
      } finally {
        setPreparing(false);
      }
    },
    [client, router, startEditing],
  );

  return { start, preparing } as const;
}

/**
 * The doctor as this order recorded them.
 *
 * The percentage comes from the ORDER, not from the doctor's current rate: a
 * sale keeps the commission it was written with, and re-saving it must not
 * silently reprice an old order because the doctor's percentage changed since.
 */
function doctorFromOrder(order: OrderDetail): Doctor | null {
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
