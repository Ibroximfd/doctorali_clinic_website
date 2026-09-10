import type { Metadata } from "next";

import { TreatmentsView } from "@/features/treatments/components/treatments-view";

export const metadata: Metadata = {
  title: "Muolajalar",
  description: "Muolaja va konsultatsiyalar.",
};

export default function TreatmentsPage() {
  return <TreatmentsView />;
}
