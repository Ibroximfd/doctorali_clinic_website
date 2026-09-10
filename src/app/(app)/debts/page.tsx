import type { Metadata } from "next";

import { DebtsView } from "@/features/debts/components/debts-view";

export const metadata: Metadata = {
  title: "Qarzlar",
  description: "Qarzlar va qaytarish muddatlari.",
};

export default function DebtsPage() {
  return <DebtsView />;
}
