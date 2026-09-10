import type { Metadata } from "next";

import { PayoutsView } from "@/features/payouts/components/payouts-view";

export const metadata: Metadata = {
  title: "To'lovlar",
  description: "Shifokorlarga haftalik komissiya to'lovlari.",
};

export default function PayoutsPage() {
  return <PayoutsView />;
}
