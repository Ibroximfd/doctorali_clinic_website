import type { Metadata } from "next";
import { Suspense } from "react";

import { OrdersView } from "@/features/orders/components/orders-view";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";

export const metadata: Metadata = {
  title: "Buyurtmalar",
  description: "Barcha buyurtmalar tarixi.",
};

export default function OrdersPage() {
  return (
    // The list reads its filter from the URL (`?period=&from=&to=`), which is a
    // client-only concern — the boundary keeps the rest of the page static.
    <Suspense
      fallback={
        <PageContainer>
          <ListSkeleton rows={9} height={64} />
        </PageContainer>
      }
    >
      <OrdersView />
    </Suspense>
  );
}
