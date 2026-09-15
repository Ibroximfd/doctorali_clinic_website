import type { Metadata } from "next";

import { ReturnsView } from "@/features/returns/components/returns-view";

export const metadata: Metadata = {
  title: "Vazvratlar",
  description: "Qaytarilgan mahsulotlar va kassadan chiqqan pul.",
};

export default function ReturnsPage() {
  return <ReturnsView />;
}
