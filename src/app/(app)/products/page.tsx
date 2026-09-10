import type { Metadata } from "next";

import { ProductsView } from "@/features/products/components/products-view";

export const metadata: Metadata = {
  title: "Mahsulotlar",
  description: "Mahsulotlar katalogi va savdosi.",
};

export default function ProductsPage() {
  return <ProductsView />;
}
