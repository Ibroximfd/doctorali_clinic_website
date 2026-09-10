import type { Metadata } from "next";

import { AppointmentsView } from "@/features/appointments/components/appointments-view";

export const metadata: Metadata = {
  title: "Tashriflar",
  description: "Rejalashtirilgan tashriflar va bugungi navbat.",
};

export default function AppointmentsPage() {
  return <AppointmentsView />;
}
