import type { Metadata } from "next";

import { DashboardView } from "@/features/statistics/components/dashboard-view";

export const metadata: Metadata = {
  title: "Statistika",
  description: "Klinika savdo ko'rsatkichlari.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
