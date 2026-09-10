import type { Metadata } from "next";

import { ProductSelectView } from "@/features/new-order/components/product-select-view";

export const metadata: Metadata = {
  title: "Mahsulot tanlash",
  description: "Buyurtma uchun mahsulotlarni tanlash.",
};

export default function ProductSelectPage() {
  return <ProductSelectView />;
}
