import type { Metadata } from "next";
import { Suspense } from "react";

import { IncomingOrdersView } from "@/features/incoming-orders/components/incoming-orders-view";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";

export const metadata: Metadata = {
  title: "Doctor Ali app",
  description: "Doctor Ali ilovasidan kelgan buyurtmalar.",
};

export default function IncomingOrdersPage() {
  return (
    // The list reads its filter from the URL, which is a client-only concern —
    // the boundary keeps the rest of the page static.
    <Suspense
      fallback={
        <PageContainer>
          <ListSkeleton rows={9} height={64} />
        </PageContainer>
      }
    >
      <IncomingOrdersView />
    </Suspense>
  );
}
