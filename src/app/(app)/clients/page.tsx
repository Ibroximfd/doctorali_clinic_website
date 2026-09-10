import type { Metadata } from "next";

import { ClientsView } from "@/features/clients/components/clients-view";

export const metadata: Metadata = {
  title: "Mijozlar",
  description: "Mijozlar bazasi, tarixi va segmentlari.",
};

export default function ClientsPage() {
  return <ClientsView />;
}
