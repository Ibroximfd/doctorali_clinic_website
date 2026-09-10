import type { Metadata } from "next";

import { NewOrderView } from "@/features/new-order/components/new-order-view";

export const metadata: Metadata = {
  title: "Yangi buyurtma",
  description: "Mijoz uchun yangi buyurtma yarating.",
};

export default function NewOrderPage() {
  return <NewOrderView />;
}
