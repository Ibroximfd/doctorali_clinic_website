import type { Metadata } from "next";

import { WarehouseView } from "@/features/warehouse/components/warehouse-view";

export const metadata: Metadata = {
  title: "Sklad",
  description: "Klinika ombori: qoldiq, kirim, chiqim va inventarizatsiya.",
};

export default function WarehousePage() {
  return <WarehouseView />;
}
